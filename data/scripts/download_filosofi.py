from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import shutil
import unicodedata
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ET

import requests


DATASET_API_URL = (
    "https://www.data.gouv.fr/api/1/datasets/"
    "revenus-et-pauvrete-des-menages-aux-niveaux-national-et-local-"
    "revenus-localises-sociaux-et-fiscaux/"
)
CONFIG_PATH = Path(__file__).resolve().parents[2] / "config" / "filosofi_sources.json"
ROOT_DIR = Path(__file__).resolve().parents[2]
RAW_DATA_DIR = ROOT_DIR / "data" / "raw" / "filosofi"
BRONZE_DATA_DIR = ROOT_DIR / "data" / "bronze" / "filosofi"
KNOWN_FORMATS = ("csv", "xlsx", "xls")
PREFERRED_TITLE_FRAGMENT = "revenus et pauvrete des menages"
REQUEST_TIMEOUT = 120
CHUNK_SIZE = 1024 * 1024
YEAR_PATTERN = re.compile(r"(19|20)\d{2}")
HTML_MARKERS = ("<!doctype html", "<html", "<head", "<body")
ZIP_SIGNATURE = b"PK\x03\x04"
SHEET_NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}
DOCUMENTATION_SHEETS = {"Sommaire", "Variables", "Documentation générale", "Seuils"}
DATA_SHEET_HINTS = ("ENSEMBLE", "TRAGERF_", "TAILLEM_", "OCCTYPR_", "OCCTYPD_", "TYPMENR_", "OPRDEC_", "TRDEC_")
REQUIRED_2023_COLUMNS = {
    "FILOSOFI_MEASURE",
    "GEO",
    "GEO_OBJECT",
    "UNIT_MEASURE",
    "CONF_STATUS",
    "OBS_STATUS",
    "UNIT_MULT",
    "TIME_PERIOD",
    "OBS_VALUE",
}


def log(message: str) -> None:
    print(f"[download_filosofi] {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download FiLoSoFi source data for one year.")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def load_source_config() -> dict[str, object]:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def source_for_year(year: int) -> dict[str, object]:
    config = load_source_config()
    sources = config.get("sources")
    if not isinstance(sources, dict):
        raise RuntimeError("Invalid FiLoSoFi source configuration: missing sources map")
    source = sources.get(str(year))
    if not isinstance(source, dict):
        raise RuntimeError(f"FiLoSoFi year {year} is not configured")
    return source


def parse_last_modified(value: str | None) -> datetime:
    if not value:
        return datetime.min.replace(tzinfo=UTC)
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.min.replace(tzinfo=UTC)


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return normalized.lower()


def format_tokens(resource: dict[str, object]) -> set[str]:
    raw_format = str(resource.get("format") or "").lower()
    return {token for token in re.split(r"[\s,/;|]+", raw_format) if token in KNOWN_FORMATS}


def resource_urls(resource: dict[str, object]) -> list[str]:
    return [
        str(resource.get("latest") or ""),
        str(resource.get("url") or ""),
    ]


def has_tabular_url(resource: dict[str, object]) -> bool:
    for candidate in resource_urls(resource):
        if is_tabular_url(candidate):
            return True
    return False


def is_tabular_resource(resource: dict[str, object]) -> bool:
    if format_tokens(resource):
        return True
    return has_tabular_url(resource)


def preferred_format(resource: dict[str, object]) -> str:
    tokens = format_tokens(resource)
    for candidate in KNOWN_FORMATS:
        if candidate in tokens:
            return candidate
    return "bin"


def is_tabular_url(value: str) -> bool:
    lowered = value.lower()
    path = urlparse(lowered).path
    return path.endswith((".csv", ".txt", ".xls", ".xlsx", ".zip"))


def infer_year_from_resource(resource: dict[str, object]) -> int | None:
    for candidate in (
        str(resource.get("title") or ""),
        str(resource.get("url") or ""),
        str(resource.get("latest") or ""),
    ):
        match = YEAR_PATTERN.search(candidate)
        if match:
            return int(match.group(0))
    return None


def select_resource(resources: list[dict[str, object]], year: int) -> dict[str, object]:
    matching = [
        resource
        for resource in resources
        if infer_year_from_resource(resource) == year and is_tabular_resource(resource)
    ]
    if not matching:
        raise RuntimeError(f"No FiLoSoFi resource found for year {year}")

    return sorted(
        matching,
        key=lambda resource: (
            PREFERRED_TITLE_FRAGMENT in normalize_text(str(resource.get("title") or "")),
            "csv" in format_tokens(resource),
            parse_last_modified(str(resource.get("last_modified") or "")),
        ),
        reverse=True,
    )[0]


def raw_output_dir(year: int) -> Path:
    return RAW_DATA_DIR / f"year={year}"


def bronze_output_dir(year: int) -> Path:
    return BRONZE_DATA_DIR / f"year={year}"


def bronze_source_dir(year: int) -> Path:
    return bronze_output_dir(year) / "source"


def bronze_extracted_dir(year: int) -> Path:
    return bronze_output_dir(year) / "extracted"


def bronze_manifest_path(year: int) -> Path:
    return bronze_output_dir(year) / "manifest.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_size_bytes(path: Path) -> int:
    return path.stat().st_size


def looks_like_html(path: Path) -> bool:
    head = path.read_bytes()[:512].decode("utf-8", errors="ignore").strip().lower()
    return any(marker in head for marker in HTML_MARKERS)


def ensure_clean_directory(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def cleanup_invalid_bronze_artifacts(year: int) -> None:
    manifest_path = bronze_manifest_path(year)
    if manifest_path.exists():
        manifest_path.unlink()

    for directory in (bronze_extracted_dir(year), bronze_source_dir(year)):
        if not directory.exists():
            continue
        for child in sorted(directory.rglob("*"), reverse=True):
            if child.is_file():
                try:
                    child.unlink(missing_ok=True)
                except PermissionError:
                    if child.suffix == ".part":
                        log(f"Skipping locked temporary file during cleanup: {child}")
                        continue
                    raise
            elif child.is_dir():
                try:
                    child.rmdir()
                except OSError:
                    continue
        try:
            directory.rmdir()
        except OSError:
            continue

    bronze_dir = bronze_output_dir(year)
    if bronze_dir.exists():
        try:
            bronze_dir.rmdir()
        except OSError:
            pass


def build_output_filename(year: int, download_url: str) -> str:
    path = urlparse(download_url).path
    filename = Path(path).name
    if filename:
        return filename
    suffix = Path(path.lower()).suffix
    if suffix in {".csv", ".txt", ".xls", ".xlsx", ".zip"}:
        return f"filosofi_{year}{suffix}"
    return f"filosofi_{year}.bin"


def stream_download(download_url: str, output_path: Path) -> dict[str, str]:
    temp_output_path = output_path.with_name(
        f"{output_path.name}.{datetime.now(UTC).strftime('%Y%m%d%H%M%S%f')}.part"
    )
    total_bytes = 0
    response_content_type = ""
    final_url = download_url
    try:
        with requests.get(download_url, stream=True, timeout=REQUEST_TIMEOUT, allow_redirects=True) as response:
            response.raise_for_status()
            response_content_type = (response.headers.get("content-type") or "").lower()
            final_url = response.url
            with temp_output_path.open("wb") as output_file:
                for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                    if not chunk:
                        continue
                    output_file.write(chunk)
                    total_bytes += len(chunk)
                    log(f"Downloaded {total_bytes / (1024 * 1024):.2f} MB")
        if "html" in response_content_type or looks_like_html(temp_output_path):
            raise RuntimeError(f"Received an HTML response instead of the expected file from {download_url}")
    except Exception:
        temp_output_path.unlink(missing_ok=True)
        raise
    temp_output_path.replace(output_path)
    return {
        "final_url": final_url,
        "content_type": response_content_type,
    }


def validate_zip_signature(path: Path) -> None:
    head = path.read_bytes()[:4]
    if head != ZIP_SIGNATURE:
        raise RuntimeError(f"Downloaded file does not start with a ZIP signature: {path}")


def validate_zip_archive(path: Path) -> list[str]:
    if looks_like_html(path):
        raise RuntimeError(f"Downloaded file is HTML, not a valid ZIP archive: {path}")
    validate_zip_signature(path)
    try:
        with zipfile.ZipFile(path) as archive:
            archive.testzip()
            return [Path(member.filename).name for member in archive.infolist() if not member.is_dir()]
    except zipfile.BadZipFile as exc:
        raise RuntimeError(f"Downloaded file is not a readable ZIP archive: {path}") from exc


def validate_xlsx_zip_members(
    archive_path: Path,
    member_names: list[str],
    year: int,
    required_fragments: list[str],
) -> list[str]:
    if not member_names:
        raise RuntimeError(f"ZIP archive is empty: {archive_path}")
    if any(not member.lower().endswith(".xlsx") for member in member_names):
        raise RuntimeError(f"ZIP archive contains non-XLSX files for FiLoSoFi year {year}: {member_names}")

    year_token = str(year)
    invalid_year_files = [member for member in member_names if year_token not in member]
    if invalid_year_files:
        raise RuntimeError(
            f"ZIP archive contains files that do not match FiLoSoFi year {year}: {', '.join(invalid_year_files)}"
        )

    upper_names = [member.upper() for member in member_names]
    missing_fragments = [
        fragment
        for fragment in required_fragments
        if not any(fragment.upper() in member for member in upper_names)
    ]
    if missing_fragments:
        raise RuntimeError(
            f"ZIP archive is inconsistent for FiLoSoFi year {year}. Missing required families: {', '.join(missing_fragments)}"
        )

    return member_names


def extract_files(archive_path: Path, destination_dir: Path, selected_filenames: list[str]) -> list[Path]:
    ensure_clean_directory(destination_dir)
    extracted_paths: list[Path] = []
    with zipfile.ZipFile(archive_path) as archive:
        name_to_member = {
            Path(member.filename).name: member
            for member in archive.infolist()
            if not member.is_dir()
        }
        for filename in selected_filenames:
            member = name_to_member[filename]
            destination_path = destination_dir / filename
            with archive.open(member) as source_handle, destination_path.open("wb") as output_handle:
                shutil.copyfileobj(source_handle, output_handle)
            extracted_paths.append(destination_path)
    return extracted_paths


def parse_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    shared: list[str] = []
    for string_item in root.findall("a:si", SHEET_NS):
        shared.append("".join(text.text or "" for text in string_item.iterfind(".//a:t", SHEET_NS)))
    return shared


def read_xlsx_sheet_rows(xlsx_path: Path, row_limit: int = 8) -> tuple[list[str], list[list[str]]]:
    with zipfile.ZipFile(xlsx_path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relation_map = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels.findall("pr:Relationship", SHEET_NS)
        }
        sheets: list[tuple[str, str]] = []
        for sheet in workbook.find("a:sheets", SHEET_NS):
            rel_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            sheets.append((sheet.attrib["name"], relation_map[rel_id]))

        shared_strings = parse_shared_strings(archive)
        first_sheet_name, target = sheets[0]
        target_path = target.lstrip("/")
        if not target_path.startswith("xl/"):
            target_path = f"xl/{target_path}"

        sheet_xml = ET.fromstring(archive.read(target_path))
        rows: list[list[str]] = []
        for row in sheet_xml.findall("a:sheetData/a:row", SHEET_NS)[:row_limit]:
            values: list[str] = []
            for cell in row.findall("a:c", SHEET_NS):
                cell_type = cell.attrib.get("t")
                raw_value = cell.find("a:v", SHEET_NS)
                value = "" if raw_value is None or raw_value.text is None else raw_value.text
                if cell_type == "s" and value:
                    value = shared_strings[int(value)]
                values.append(value)
            rows.append(values)
    return [name for name, _ in sheets], rows


def extract_publication_and_geography(rows: list[list[str]]) -> dict[str, str]:
    joined_rows = [" ".join(cell for cell in row if cell).strip() for row in rows]
    payload = " ".join(text for text in joined_rows if text)
    publication_match = re.search(r"Mise en ligne le (\d{2}/\d{2}/\d{4})", payload)
    geography_match = re.search(r"G[ée]ographie au (\d{2}/\d{2}/\d{4})", payload)
    return {
        "published_at_from_workbook": (
            datetime.strptime(publication_match.group(1), "%d/%m/%Y").strftime("%Y-%m-%d")
            if publication_match
            else ""
        ),
        "reference_geography_from_workbook": (
            datetime.strptime(geography_match.group(1), "%d/%m/%Y").strftime("%Y-%m-%d")
            if geography_match
            else ""
        ),
    }


def inspect_xlsx_workbook(path: Path) -> dict[str, object]:
    sheet_names, rows = read_xlsx_sheet_rows(path)
    metadata = extract_publication_and_geography(rows)
    has_documentation_sheet = any(sheet in DOCUMENTATION_SHEETS for sheet in sheet_names)
    has_data_sheet = any(sheet == "ENSEMBLE" or any(sheet.startswith(prefix) for prefix in DATA_SHEET_HINTS) for sheet in sheet_names)
    if not has_documentation_sheet:
        raise RuntimeError(f"Workbook is missing documentation sheets: {path.name}")
    if not has_data_sheet:
        raise RuntimeError(f"Workbook is missing data sheets: {path.name}")
    return {
        "filename": path.name,
        "size_bytes": file_size_bytes(path),
        "sha256": sha256_file(path),
        "sheet_names": sheet_names,
        "first_sheet_rows": rows,
        "published_at_from_workbook": metadata["published_at_from_workbook"],
        "reference_geography_from_workbook": metadata["reference_geography_from_workbook"],
    }


def extract_links_from_html(html: str, base_url: str) -> list[dict[str, str]]:
    links: list[dict[str, str]] = []
    for href, label in re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', html, flags=re.IGNORECASE | re.DOTALL):
        absolute_url = urljoin(base_url, href)
        clean_label = re.sub(r"<[^>]+>", " ", label)
        links.append({"url": absolute_url, "label": " ".join(clean_label.split())})
    return links


def discover_filosofi2_link(source: dict[str, object]) -> str:
    page_url = str(source.get("source_page_url") or "")
    discovery = source.get("link_discovery")
    if not isinstance(discovery, dict):
        raise RuntimeError("Missing link_discovery configuration for FiLoSoFi 2 source")

    preferred_format = str(discovery.get("preferred_format") or "csv").lower()
    required_url_fragment = str(discovery.get("required_url_fragment") or "").lower()
    with requests.get(page_url, timeout=REQUEST_TIMEOUT, allow_redirects=True) as response:
        response.raise_for_status()
        html = response.text
        final_url = response.url

    candidates = extract_links_from_html(html, final_url)
    filtered = [
        link
        for link in candidates
        if "/fichier/" in link["url"]
        and (required_url_fragment in link["url"].lower() if required_url_fragment else True)
    ]
    if not filtered:
        raise RuntimeError(f"Unable to discover a FiLoSoFi 2 file link from {page_url}")

    def rank(link: dict[str, str]) -> tuple[int, int]:
        lower_url = link["url"].lower()
        return (
            1 if lower_url.endswith(f"{preferred_format}.zip") or lower_url.endswith(f".{preferred_format}") else 0,
            1 if required_url_fragment and required_url_fragment in lower_url else 0,
        )

    return sorted(filtered, key=rank, reverse=True)[0]["url"]


def inspect_filosofi2_csv_zip(archive_path: Path) -> dict[str, object]:
    member_names = validate_zip_archive(archive_path)
    csv_members = [name for name in member_names if name.lower().endswith(".csv")]
    if not csv_members:
        raise RuntimeError("FiLoSoFi 2 archive does not contain CSV files")

    extracted_dir = bronze_extracted_dir(2023)  # overwritten by caller via patch when needed
    _ = extracted_dir
    return {"member_names": csv_members}


def extract_csv_archive(archive_path: Path, destination_dir: Path) -> list[Path]:
    member_names = validate_zip_archive(archive_path)
    selected = [name for name in member_names if name.lower().endswith(".csv")]
    if not selected:
        raise RuntimeError("CSV archive does not contain CSV members")
    return extract_files(archive_path, destination_dir, selected)


def inspect_csv_file(path: Path) -> dict[str, object]:
    sample = path.read_bytes()[:200000]
    if any(marker in sample.lower() for marker in (b"<!doctype html", b"<html", b"<head", b"<body")):
        raise RuntimeError(f"CSV payload is actually HTML: {path}")

    text = path.read_text(encoding="utf-8-sig")
    first_line = text.splitlines()[0] if text else ""
    delimiter = ";" if first_line.count(";") >= first_line.count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    fieldnames = reader.fieldnames or []
    missing_columns = REQUIRED_2023_COLUMNS.difference(fieldnames)
    if missing_columns:
        raise RuntimeError(f"FiLoSoFi 2 CSV is missing required columns: {', '.join(sorted(missing_columns))}")

    row_count = 0
    geo_objects: set[str] = set()
    measures: set[str] = set()
    for row in reader:
        row_count += 1
        geo_objects.add(str(row.get("GEO_OBJECT") or ""))
        measures.add(str(row.get("FILOSOFI_MEASURE") or ""))

    return {
        "filename": path.name,
        "size_bytes": file_size_bytes(path),
        "sha256": sha256_file(path),
        "delimiter": delimiter,
        "encoding": "utf-8-sig",
        "columns": fieldnames,
        "row_count": row_count,
        "geo_objects": sorted(value for value in geo_objects if value),
        "measures": sorted(value for value in measures if value),
    }


def inspect_plain_csv_file(path: Path) -> dict[str, object]:
    sample = path.read_bytes()[:200000]
    if any(marker in sample.lower() for marker in (b"<!doctype html", b"<html", b"<head", b"<body")):
        raise RuntimeError(f"CSV payload is actually HTML: {path}")

    text = path.read_text(encoding="utf-8-sig")
    first_line = text.splitlines()[0] if text else ""
    delimiter = ";" if first_line.count(";") >= first_line.count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    fieldnames = reader.fieldnames or []
    row_count = sum(1 for _ in reader)

    return {
        "filename": path.name,
        "size_bytes": file_size_bytes(path),
        "sha256": sha256_file(path),
        "delimiter": delimiter,
        "encoding": "utf-8-sig",
        "columns": fieldnames,
        "row_count": row_count,
    }


def inspect_filosofi2_extracted_files(paths: list[Path]) -> list[dict[str, object]]:
    extracted_files: list[dict[str, object]] = []
    for path in paths:
        if path.name.endswith("_data.csv"):
            extracted_files.append(inspect_csv_file(path))
            continue
        extracted_files.append(inspect_plain_csv_file(path))

    if not any(item["filename"].endswith("_data.csv") for item in extracted_files):
        raise RuntimeError("FiLoSoFi 2 archive does not contain a *_data.csv file")

    return extracted_files


def build_xlsx_zip_manifest(
    *,
    year: int,
    source: dict[str, object],
    archive_path: Path,
    download_metadata: dict[str, str],
    workbooks: list[dict[str, object]],
    downloaded_at: datetime,
    warnings: list[str] | None = None,
) -> dict[str, object]:
    published_at_from_workbook = next((str(item.get("published_at_from_workbook") or "") for item in workbooks if item.get("published_at_from_workbook")), "")
    reference_geography_from_workbook = next((str(item.get("reference_geography_from_workbook") or "") for item in workbooks if item.get("reference_geography_from_workbook")), "")
    return {
        "dataset": "filosofi",
        "dispositif": str(source.get("dispositif") or "filosofi"),
        "year": str(year),
        "source_type": str(source.get("source_type") or ""),
        "geographic_level": str(source.get("geographic_level") or ""),
        "includes_municipal_arrondissements": bool(source.get("includes_municipal_arrondissements", False)),
        "source_page_url": str(source.get("source_page_url") or ""),
        "configured_download_url": str(source.get("download_url") or ""),
        "final_download_url": download_metadata["final_url"],
        "content_type": download_metadata["content_type"],
        "downloaded_at": downloaded_at.astimezone(UTC).isoformat().replace("+00:00", "Z"),
        "archive_filename": archive_path.name,
        "archive_size_bytes": file_size_bytes(archive_path),
        "archive_sha256": sha256_file(archive_path),
        "published_at": str(source.get("published_at") or ""),
        "published_at_from_workbook": published_at_from_workbook,
        "reference_geography": str(source.get("reference_geography") or ""),
        "reference_geography_from_workbook": reference_geography_from_workbook,
        "territorial_coverage": str(source.get("territorial_coverage") or ""),
        "validation_status": "valid",
        "validation_warnings": warnings or [],
        "extracted_files": workbooks,
    }


def build_filosofi2_manifest(
    *,
    year: int,
    source: dict[str, object],
    archive_path: Path,
    download_metadata: dict[str, str],
    extracted_files: list[dict[str, object]],
    downloaded_at: datetime,
) -> dict[str, object]:
    data_file = next((item for item in extracted_files if str(item.get("filename", "")).endswith("_data.csv")), extracted_files[0])
    return {
        "dataset": "filosofi",
        "dispositif": str(source.get("dispositif") or "filosofi2"),
        "year": str(year),
        "source_type": str(source.get("source_type") or ""),
        "geographic_level": str(source.get("geographic_level") or ""),
        "methodological_break": bool(source.get("methodological_break", False)),
        "source_page_url": str(source.get("source_page_url") or ""),
        "configured_download_url": "",
        "final_download_url": download_metadata["final_url"],
        "content_type": download_metadata["content_type"],
        "downloaded_at": downloaded_at.astimezone(UTC).isoformat().replace("+00:00", "Z"),
        "archive_filename": archive_path.name,
        "archive_size_bytes": file_size_bytes(archive_path),
        "archive_sha256": sha256_file(archive_path),
        "reference_geography_published": str(source.get("reference_geography_published") or ""),
        "reference_geography_production": str(source.get("reference_geography_production") or ""),
        "territorial_coverage": str(source.get("territorial_coverage") or ""),
        "validation_status": "valid",
        "validation_warnings": [],
        "extracted_files": extracted_files,
        "csv_schema": {
            "filename": data_file["filename"],
            "encoding": data_file["encoding"],
            "delimiter": data_file["delimiter"],
            "columns": data_file["columns"],
            "row_count": data_file["row_count"],
            "geo_objects": data_file["geo_objects"],
            "measures": data_file["measures"],
        },
    }


def write_manifest(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def existing_bronze_ingestion_is_valid(year: int, source: dict[str, object]) -> bool:
    manifest_path = bronze_manifest_path(year)
    source_dir = bronze_source_dir(year)
    archive_filename = str(source.get("archive_filename") or "")
    if not manifest_path.exists() or not source_dir.exists():
        return False
    archive_candidates = list(source_dir.glob("*"))
    if archive_filename:
        archive_candidates = [source_dir / archive_filename] if (source_dir / archive_filename).exists() else []
    if len(archive_candidates) != 1:
        return False
    archive_path = archive_candidates[0]

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False

    if manifest.get("archive_sha256") != sha256_file(archive_path):
        return False
    if manifest.get("archive_size_bytes") != file_size_bytes(archive_path):
        return False

    extracted_files = manifest.get("extracted_files")
    if not isinstance(extracted_files, list):
        return False

    extracted_dir = bronze_extracted_dir(year)
    for entry in extracted_files:
        if not isinstance(entry, dict):
            return False
        filename = str(entry.get("filename") or "")
        if not filename:
            return False
        path = extracted_dir / filename
        if not path.exists():
            return False
        if entry.get("size_bytes") != file_size_bytes(path):
            return False
        if entry.get("sha256") != sha256_file(path):
            return False
    return True


def discover_file_url(start_url: str, expected_format: str) -> str:
    with requests.get(start_url, stream=True, timeout=REQUEST_TIMEOUT, allow_redirects=True) as response:
        response.raise_for_status()
        content_type = (response.headers.get("content-type") or "").lower()
        final_url = response.url
        if "text/html" not in content_type:
            return final_url
        html = response.text

    candidates = [
        link["url"]
        for link in extract_links_from_html(html, final_url)
        if is_tabular_url(link["url"])
    ]
    if not candidates:
        raise RuntimeError(f"Unable to discover a tabular download link from {start_url}")

    def rank(candidate: str) -> tuple[int, int]:
        lower = candidate.lower()
        return (1 if expected_format != "bin" and expected_format in lower else 0, 1 if lower.endswith(".zip") else 0)

    return sorted(candidates, key=rank, reverse=True)[0]


def resolve_data_gouv_download(year: int) -> tuple[str, str]:
    with requests.get(DATASET_API_URL, timeout=REQUEST_TIMEOUT) as response:
        response.raise_for_status()
        dataset = response.json()

    resources = dataset.get("resources")
    if not isinstance(resources, list):
        raise RuntimeError("Dataset metadata does not expose a valid resources array")

    selected_resource = select_resource(resources, year)
    selected_url = str(selected_resource.get("latest") or selected_resource.get("url") or "")
    if not selected_url:
        raise RuntimeError("Selected FiLoSoFi resource does not expose a download URL")

    resolved_download_url = discover_file_url(selected_url, preferred_format(selected_resource))
    return resolved_download_url, str(selected_resource.get("title") or f"FiLoSoFi {year}")


def ingest_insee_xlsx_zip_bronze(year: int, source: dict[str, object], force: bool) -> None:
    archive_filename = str(source.get("archive_filename") or "")
    download_url = str(source.get("download_url") or "")
    required_fragments = [str(value) for value in source.get("required_filename_fragments", [])]
    expected_files = [str(value) for value in source.get("expected_files", [])]
    if not archive_filename or not download_url:
        raise RuntimeError(f"Invalid insee_xlsx_zip configuration for FiLoSoFi year {year}")

    source_dir = bronze_source_dir(year)
    extracted_dir = bronze_extracted_dir(year)
    manifest_path = bronze_manifest_path(year)
    archive_path = source_dir / archive_filename

    if not force and existing_bronze_ingestion_is_valid(year, source):
        log(f"Skipping download, valid bronze ingestion already exists: {archive_path}")
        return

    if force or archive_path.exists() or manifest_path.exists() or extracted_dir.exists():
        log(f"Refreshing bronze ingestion for year {year}")
        cleanup_invalid_bronze_artifacts(year)

    source_dir.mkdir(parents=True, exist_ok=True)
    download_metadata = stream_download(download_url, archive_path)
    member_names = validate_zip_archive(archive_path)
    if expected_files:
        missing = [filename for filename in expected_files if filename not in member_names]
        if missing:
            raise RuntimeError(f"ZIP archive is incomplete. Missing expected files: {', '.join(missing)}")
        selected_filenames = expected_files
    else:
        selected_filenames = validate_xlsx_zip_members(archive_path, member_names, year, required_fragments)

    extracted_paths = extract_files(archive_path, extracted_dir, selected_filenames)
    workbooks = [inspect_xlsx_workbook(path) for path in extracted_paths]
    manifest = build_xlsx_zip_manifest(
        year=year,
        source=source,
        archive_path=archive_path,
        download_metadata=download_metadata,
        workbooks=workbooks,
        downloaded_at=datetime.now(UTC),
        warnings=[str(value) for value in source.get("validation_warnings", [])],
    )
    write_manifest(manifest_path, manifest)

    log(f"Bronze archive written to: {archive_path}")
    log(f"Extracted files written to: {extracted_dir}")
    log(f"Manifest written to: {manifest_path}")


def ingest_filosofi2_multigeography_bronze(year: int, source: dict[str, object], force: bool) -> None:
    discovered_url = discover_filosofi2_link(source)
    archive_filename = build_output_filename(year, discovered_url)
    source_dir = bronze_source_dir(year)
    extracted_dir = bronze_extracted_dir(year)
    manifest_path = bronze_manifest_path(year)
    archive_path = source_dir / archive_filename

    if not force and existing_bronze_ingestion_is_valid(year, source):
        log(f"Skipping download, valid bronze ingestion already exists: {archive_path}")
        return

    if force or archive_path.exists() or manifest_path.exists() or extracted_dir.exists():
        log(f"Refreshing bronze ingestion for year {year}")
        cleanup_invalid_bronze_artifacts(year)

    source_dir.mkdir(parents=True, exist_ok=True)
    download_metadata = stream_download(discovered_url, archive_path)
    validate_zip_archive(archive_path)
    extracted_paths = extract_csv_archive(archive_path, extracted_dir)
    extracted_files = inspect_filosofi2_extracted_files(extracted_paths)
    manifest = build_filosofi2_manifest(
        year=year,
        source=source,
        archive_path=archive_path,
        download_metadata=download_metadata,
        extracted_files=extracted_files,
        downloaded_at=datetime.now(UTC),
    )
    write_manifest(manifest_path, manifest)

    log(f"Bronze archive written to: {archive_path}")
    log(f"Extracted files written to: {extracted_dir}")
    log(f"Manifest written to: {manifest_path}")


def ingest_data_gouv_raw(year: int, force: bool) -> None:
    download_url, selected_title = resolve_data_gouv_download(year)
    output_dir = raw_output_dir(year)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / build_output_filename(year, download_url)

    log(f"Selected resource title: {selected_title}")
    log(f"Download URL: {download_url}")
    log(f"Output path: {output_path}")
    if output_path.exists() and not force:
        log(f"Skipping download, file already exists: {output_path}")
        return

    if output_path.exists():
        output_path.unlink()
    stream_download(download_url, output_path)
    log(f"Download completed: {output_path}")
    log(f"Source: {selected_title}")


def main() -> None:
    args = parse_args()
    source = source_for_year(args.year)
    source_type = str(source.get("source_type") or "data_gouv")
    log(f"Preparing FiLoSoFi source acquisition for year {args.year}")

    if source_type == "insee_xlsx_zip":
        log(f"Source page: {source.get('source_page_url', '')}")
        log(f"Download URL: {source.get('download_url', '')}")
        ingest_insee_xlsx_zip_bronze(args.year, source, args.force)
        return

    if source_type == "insee_filosofi2_multigeography":
        log(f"Source page: {source.get('source_page_url', '')}")
        ingest_filosofi2_multigeography_bronze(args.year, source, args.force)
        return

    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    ingest_data_gouv_raw(args.year, args.force)


if __name__ == "__main__":
    main()
