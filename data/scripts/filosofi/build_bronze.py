from __future__ import annotations

import argparse
import csv
import io
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[3]
CONFIG_PATH = ROOT_DIR / "config" / "filosofi_sources.json"
SHEET_NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}
SUPPORTED_EXTENSIONS = {".zip", ".csv", ".txt", ".xls", ".xlsx"}
TABULAR_EXTENSIONS = {".csv", ".txt", ".xls", ".xlsx"}


def log(message: str) -> None:
    print(f"[build_filosofi_bronze] {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the FiLoSoFi bronze dataset for one year.")
    parser.add_argument("--year", type=int, required=True)
    return parser.parse_args()


def load_source_config() -> dict[str, object]:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def source_for_year(year: int) -> dict[str, object]:
    payload = load_source_config()
    sources = payload.get("sources", {})
    if not isinstance(sources, dict):
        raise RuntimeError("Invalid FiLoSoFi source configuration")
    source = sources.get(str(year))
    if not isinstance(source, dict):
        raise RuntimeError(f"FiLoSoFi year {year} is not configured")
    return source


def raw_dir(year: int) -> Path:
    return ROOT_DIR / "data" / "raw" / "filosofi" / f"year={year}"


def bronze_dir(year: int) -> Path:
    return ROOT_DIR / "data" / "bronze" / "filosofi" / f"year={year}"


def extracted_dir(year: int) -> Path:
    return bronze_dir(year) / "extracted"


def output_path(year: int) -> Path:
    return bronze_dir(year) / "filosofi_bronze.parquet"


def normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def infer_geography_level(name: str) -> str:
    normalized = name.lower()
    if "_com" in normalized or "commune" in normalized:
        return "commune"
    if "_dep" in normalized or "departement" in normalized:
        return "department"
    if "_reg" in normalized or "region" in normalized:
        return "region"
    return "unknown"


def infer_file_role(name: str) -> str:
    return "metadata" if Path(name).name.lower().startswith("meta_") else "data"


def pick_text_encoding(payload: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            payload.decode(encoding)
            return encoding
        except UnicodeDecodeError:
            continue
    return "latin-1"


def read_delimited_bytes(payload: bytes) -> tuple[pd.DataFrame, str]:
    encoding = pick_text_encoding(payload)
    frame = pd.read_csv(
        io.BytesIO(payload),
        sep=None,
        engine="python",
        dtype=str,
        keep_default_na=False,
        encoding=encoding,
    )
    return frame.fillna(""), encoding


def read_excel_bytes(payload: bytes, extension: str) -> pd.DataFrame:
    engine = "openpyxl" if extension == ".xlsx" else "xlrd"
    return pd.read_excel(io.BytesIO(payload), dtype=str, engine=engine).fillna("")


def read_tabular_payload(payload: bytes, extension: str) -> tuple[pd.DataFrame, str]:
    if extension in {".csv", ".txt"}:
        return read_delimited_bytes(payload)
    return read_excel_bytes(payload, extension), "binary-excel"


def list_raw_candidates(year: int) -> list[Path]:
    directory = raw_dir(year)
    if not directory.exists():
        raise FileNotFoundError(f"Missing raw data directory: {directory}. Run python -m data.scripts.filosofi.download first.")
    return sorted(
        path
        for path in directory.iterdir()
        if path.is_file() and "filosofi" in path.name.lower() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def rank_archive_member(member_name: str) -> tuple[int, int, int, int]:
    path = Path(member_name)
    normalized = path.name.lower()
    extension = path.suffix.lower()
    geography_rank = {"commune": 5, "department": 4, "region": 3, "unknown": 0}.get(
        infer_geography_level(normalized),
        0,
    )
    format_rank = {".csv": 4, ".txt": 3, ".xlsx": 2, ".xls": 1}.get(extension, 0)
    return (
        1 if extension in TABULAR_EXTENSIONS else 0,
        0 if infer_file_role(normalized) == "metadata" else 1,
        geography_rank,
        format_rank,
    )


def select_archive_members(archive: zipfile.ZipFile, source_path: Path) -> list[str]:
    members = [name for name in archive.namelist() if Path(name).suffix.lower() in TABULAR_EXTENSIONS]
    if not members:
        raise RuntimeError(f"No tabular FiLoSoFi files found in archive {source_path.name}")

    selected: list[str] = []
    seen_levels: set[str] = set()
    for member_name in sorted(members, key=rank_archive_member, reverse=True):
        geography_level = infer_geography_level(member_name)
        if geography_level not in {"commune", "department"}:
            continue
        if infer_file_role(member_name) != "data":
            continue
        if geography_level in seen_levels:
            continue
        selected.append(member_name)
        seen_levels.add(geography_level)
    return selected or [sorted(members, key=rank_archive_member, reverse=True)[0]]


def add_metadata(frame: pd.DataFrame, source_file: str, extracted_file: str, year: int, source_type: str, table_id: str) -> pd.DataFrame:
    frame = frame.fillna("").copy()
    frame["source_file"] = source_file
    frame["extracted_file"] = extracted_file
    frame["year"] = year
    frame["source_type"] = source_type
    frame["table_id"] = table_id
    frame["geography_level"] = infer_geography_level(extracted_file or source_file)
    frame["file_role"] = infer_file_role(extracted_file or source_file)
    return frame


def read_legacy_source_file(source_path: Path, year: int, source_type: str) -> list[pd.DataFrame]:
    if source_path.suffix.lower() == ".zip":
        frames: list[pd.DataFrame] = []
        with zipfile.ZipFile(source_path) as archive:
            for selected_member in select_archive_members(archive, source_path):
                payload = archive.read(selected_member)
                extension = Path(selected_member).suffix.lower()
                frame, encoding = read_tabular_payload(payload, extension)
                log(f"Selected archive member: {selected_member}")
                log(f"Detected encoding/reader: {encoding}")
                frames.append(add_metadata(frame, source_path.name, selected_member, year, source_type, "legacy"))
        return frames

    payload = source_path.read_bytes()
    frame, encoding = read_tabular_payload(payload, source_path.suffix.lower())
    log(f"Selected source file: {source_path.name}")
    log(f"Detected encoding/reader: {encoding}")
    return [add_metadata(frame, source_path.name, "", year, source_type, "legacy")]


def parse_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(text.text or "" for text in string_item.iterfind(".//a:t", SHEET_NS))
        for string_item in root.findall("a:si", SHEET_NS)
    ]


def col_to_index(reference: str) -> int:
    letters = "".join(character for character in reference if character.isalpha())
    result = 0
    for character in letters:
        result = result * 26 + (ord(character.upper()) - 64)
    return result - 1


def load_xlsx_sheet_rows(path: Path, sheet_name: str) -> list[list[str]]:
    with zipfile.ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relation_map = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels.findall("pr:Relationship", SHEET_NS)
        }
        target = None
        for sheet in workbook.find("a:sheets", SHEET_NS):
            if sheet.attrib["name"] != sheet_name:
                continue
            rel_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = relation_map[rel_id]
            break
        if target is None:
            raise RuntimeError(f"Sheet {sheet_name} not found in {path.name}")

        target_path = target.lstrip("/")
        if not target_path.startswith("xl/"):
            target_path = f"xl/{target_path}"

        shared_strings = parse_shared_strings(archive)
        sheet_xml = ET.fromstring(archive.read(target_path))
        rows: list[list[str]] = []
        for row in sheet_xml.findall("a:sheetData/a:row", SHEET_NS):
            values: list[str] = []
            current_index = 0
            for cell in row.findall("a:c", SHEET_NS):
                reference = cell.attrib.get("r", "")
                index = col_to_index(reference) if reference else current_index
                while len(values) < index:
                    values.append("")
                cell_type = cell.attrib.get("t")
                raw_value = cell.find("a:v", SHEET_NS)
                value = "" if raw_value is None or raw_value.text is None else raw_value.text
                if cell_type == "s" and value:
                    value = shared_strings[int(value)]
                values.append(value)
                current_index = index + 1
            rows.append(values)
    return rows


def make_unique_columns(values: list[str], fallback_values: list[str]) -> list[str]:
    columns: list[str] = []
    counts: dict[str, int] = {}
    for index, raw_value in enumerate(values):
        fallback = fallback_values[index] if index < len(fallback_values) else ""
        candidate = normalize_text(raw_value) or normalize_text(fallback) or f"column_{index + 1}"
        counts[candidate] = counts.get(candidate, 0) + 1
        if counts[candidate] > 1:
            candidate = f"{candidate}_{counts[candidate]}"
        columns.append(candidate)
    return columns


def sheet_rows_to_frame(rows: list[list[str]]) -> pd.DataFrame:
    header_row_index = next(
        (index for index, row in enumerate(rows) if row and normalize_text(str(row[0])) == "codgeo"),
        None,
    )
    if header_row_index is None:
        raise RuntimeError("Unable to detect the technical header row in FiLoSoFi workbook")
    label_row = rows[header_row_index - 1] if header_row_index > 0 else []
    code_row = rows[header_row_index]
    columns = make_unique_columns(code_row, label_row)

    records: list[list[str]] = []
    for row in rows[header_row_index + 1 :]:
        padded = row[: len(columns)] + [""] * max(0, len(columns) - len(row))
        records.append(padded[: len(columns)])

    frame = pd.DataFrame(records, columns=columns).fillna("")
    first_column = columns[0]
    frame = frame[frame[first_column].astype(str).str.strip().ne("")].copy()
    return frame.reset_index(drop=True)


def historical_table_id(path: Path) -> str:
    normalized = path.name.lower()
    if "_disp_pauvres_com" in normalized:
        return "disp_pauvres_com"
    if "_disp_com" in normalized:
        return "disp_com"
    return normalize_text(path.stem)


def select_historical_workbooks(directory: Path) -> list[Path]:
    candidates = sorted(directory.glob("*.xlsx"))
    selected = [
        path
        for path in candidates
        if (
            ("_disp_com" in path.name.lower() and "_trdeciles_" not in path.name.lower())
            or "_disp_pauvres_com" in path.name.lower()
        )
    ]
    if not selected:
        raise FileNotFoundError(f"No DISP commune workbooks found in {directory}")
    return selected


def build_historical_bronze(year: int, source_type: str) -> pd.DataFrame:
    directory = extracted_dir(year)
    if not directory.exists():
        raise FileNotFoundError(f"Missing bronze extracted directory: {directory}. Run python -m data.scripts.filosofi.download first.")

    frames: list[pd.DataFrame] = []
    for workbook_path in select_historical_workbooks(directory):
        rows = load_xlsx_sheet_rows(workbook_path, "ENSEMBLE")
        frame = sheet_rows_to_frame(rows)
        table_id = historical_table_id(workbook_path)
        log(f"Selected bronze workbook: {workbook_path.name} [table={table_id}, sheet=ENSEMBLE]")
        frames.append(add_metadata(frame, workbook_path.name, workbook_path.name, year, source_type, table_id))
    return pd.concat(frames, ignore_index=True, sort=False)


def select_filosofi2_data_file(directory: Path) -> Path:
    candidates = sorted(path for path in directory.glob("*.csv") if path.name.endswith("_data.csv"))
    if not candidates:
        raise FileNotFoundError(f"No FiLoSoFi 2 data CSV found in {directory}")
    return candidates[0]


def build_filosofi2_bronze(year: int, source_type: str) -> pd.DataFrame:
    directory = extracted_dir(year)
    if not directory.exists():
        raise FileNotFoundError(f"Missing bronze extracted directory: {directory}. Run python -m data.scripts.filosofi.download first.")

    data_file = select_filosofi2_data_file(directory)
    payload = data_file.read_bytes()
    frame, encoding = read_delimited_bytes(payload)
    log(f"Selected bronze CSV: {data_file.name}")
    log(f"Detected encoding/reader: {encoding}")
    return add_metadata(frame, data_file.name, data_file.name, year, source_type, "filosofi2_data")


def main() -> None:
    args = parse_args()
    source = source_for_year(args.year)
    source_type = str(source.get("source_type") or "data_gouv")
    log(f"Preparing FiLoSoFi bronze dataset for year {args.year}")

    if source_type == "data_gouv":
        candidates = list_raw_candidates(args.year)
        if not candidates:
            raise FileNotFoundError(f"No FiLoSoFi files found in {raw_dir(args.year)}")
        bronze = pd.concat(
            [
                frame
                for source_path in candidates
                for frame in read_legacy_source_file(source_path, args.year, source_type)
            ],
            ignore_index=True,
            sort=False,
        )
    elif source_type == "insee_xlsx_zip":
        bronze = build_historical_bronze(args.year, source_type)
    elif source_type == "insee_filosofi2_multigeography":
        bronze = build_filosofi2_bronze(args.year, source_type)
    else:
        raise RuntimeError(f"Unsupported FiLoSoFi source type: {source_type}")

    destination = output_path(args.year)
    destination.parent.mkdir(parents=True, exist_ok=True)
    bronze.to_parquet(destination, index=False)
    log(f"Bronze dataset written to {destination}")
    log(f"Total rows written: {len(bronze)}")


if __name__ == "__main__":
    main()
