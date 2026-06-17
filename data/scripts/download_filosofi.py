from __future__ import annotations

import argparse
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests


DATASET_API_URL = (
    "https://www.data.gouv.fr/api/1/datasets/"
    "revenus-et-pauvrete-des-menages-aux-niveaux-national-et-local-"
    "revenus-localises-sociaux-et-fiscaux/"
)
CONFIG_PATH = Path(__file__).resolve().parents[2] / "config" / "filosofi_sources.json"
ROOT_DIR = Path(__file__).resolve().parents[2]
RAW_DATA_DIR = ROOT_DIR / "data" / "raw" / "filosofi"
KNOWN_FORMATS = ("csv", "xlsx", "xls")
PREFERRED_TITLE_FRAGMENT = "revenus et pauvrete des menages"
REQUEST_TIMEOUT = 120
CHUNK_SIZE = 1024 * 1024
YEAR_PATTERN = re.compile(r"(19|20)\d{2}")
POSITIVE_URL_TOKENS = (
    "filosofi",
    "base-filosofi",
    "revenus",
    "pauvrete",
    "menages",
    "dispositif",
    "dep",
    "com",
    "commune",
    "departement",
)
NEGATIVE_URL_TOKENS = (
    "rpm",
    "d1",
    "d2",
    "d3",
    "d4",
    "d5",
    "d6",
    "d7",
    "d8",
    "d9",
    "documentation",
    "doc",
    "metadata",
    "meta",
    "note",
    "notice",
    "xlsm",
)


def log(message: str) -> None:
    print(f"[download_filosofi] {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download a FiLoSoFi resource for one year.")
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
        return datetime.min
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.min


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return normalized.lower()


def format_tokens(resource: dict[str, object]) -> set[str]:
    raw_format = str(resource.get("format") or "").lower()
    return {token for token in re.split(r"[\s,/;|]+", raw_format) if token in KNOWN_FORMATS}


def preferred_format(resource: dict[str, object]) -> str:
    tokens = format_tokens(resource)
    for candidate in KNOWN_FORMATS:
        if candidate in tokens:
            return candidate
    return "bin"


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
    matching = [resource for resource in resources if infer_year_from_resource(resource) == year]
    if not matching:
        raise RuntimeError(f"No FiLoSoFi resource found for year {year}")

    sorted_resources = sorted(
        matching,
        key=lambda resource: (
            PREFERRED_TITLE_FRAGMENT in normalize_text(str(resource.get("title") or "")),
            "csv" in format_tokens(resource),
            parse_last_modified(str(resource.get("last_modified") or "")),
        ),
        reverse=True,
    )
    return sorted_resources[0]


def unique_preserving_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    unique_values: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        unique_values.append(value)
    return unique_values


def candidate_download_links(html: str, base_url: str) -> list[dict[str, str]]:
    candidates: list[dict[str, str]] = []

    for href, label in re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', html, flags=re.IGNORECASE | re.DOTALL):
        absolute_url = urljoin(base_url, href)
        label_text = re.sub(r"<[^>]+>", " ", label)
        candidates.append({"url": absolute_url, "label": label_text.strip()})

    for raw_url in re.findall(r'https?://[^"\'<>\s]+', html, flags=re.IGNORECASE):
        candidates.append({"url": raw_url, "label": ""})

    filtered: list[dict[str, str]] = []
    seen: set[str] = set()
    for candidate in candidates:
        url = candidate["url"]
        if url in seen:
            continue
        seen.add(url)
        path = urlparse(url).path.lower()
        if path.endswith((".csv", ".txt", ".xls", ".xlsx", ".zip")):
            filtered.append(candidate)
            continue
        if "/fichier/" in path and any(extension in path for extension in (".csv", ".txt", ".xls", ".xlsx", ".zip")):
            filtered.append(candidate)
            continue
        if "/fichier/" in path and "download" in url.lower():
            filtered.append(candidate)
    return filtered


def rank_download_candidate(candidate: dict[str, str], preferred: str) -> tuple[int, int, int, int, int, int]:
    url = candidate["url"]
    label = normalize_text(candidate.get("label", ""))
    path = urlparse(url).path.lower()
    extension_order = {".csv": 4, ".xlsx": 3, ".xls": 2, ".txt": 1, ".zip": 0}
    preferred_bonus = 1 if preferred and preferred in path else 0
    combined_text = normalize_text(f"{path} {label}")
    positive_bonus = sum(token in combined_text for token in POSITIVE_URL_TOKENS)
    negative_penalty = sum(token in combined_text for token in NEGATIVE_URL_TOKENS)
    return (
        1 if "/fichier/" in path else 0,
        preferred_bonus,
        positive_bonus,
        0 if negative_penalty else 1,
        1 if Path(path).suffix == ".zip" and "filosofi" in combined_text else 0,
        extension_order.get(Path(path).suffix, -1),
    )


def resolve_page_download_url(page_url: str, preferred_format_name: str) -> str:
    with requests.get(page_url, timeout=REQUEST_TIMEOUT, allow_redirects=True) as response:
        response.raise_for_status()
        html = response.text
        final_url = response.url

    candidates = candidate_download_links(html, final_url)
    if not candidates:
        raise RuntimeError(f"No downloadable FiLoSoFi link found on page {page_url}")

    selected_candidate = sorted(
        candidates,
        key=lambda candidate: rank_download_candidate(candidate, preferred_format_name),
        reverse=True,
    )[0]
    selected_url = selected_candidate["url"]
    if sum(token in normalize_text(f"{selected_url} {selected_candidate.get('label', '')}") for token in POSITIVE_URL_TOKENS) == 0:
        raise RuntimeError(f"No FiLoSoFi-like download candidate found on page {page_url}")
    return selected_url


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


def discover_file_url(start_url: str, expected_format: str) -> str:
    with requests.get(start_url, stream=True, timeout=REQUEST_TIMEOUT, allow_redirects=True) as response:
        response.raise_for_status()
        content_type = (response.headers.get("content-type") or "").lower()
        final_url = response.url

        if "text/html" not in content_type:
            return final_url

        html = response.text

    candidates = candidate_download_links(html, final_url)
    if candidates:
        return sorted(
            candidates,
            key=lambda candidate: rank_download_candidate(candidate, expected_format),
            reverse=True,
        )[0]["url"]
    return final_url


def build_output_filename(year: int, download_url: str) -> str:
    path = urlparse(download_url).path.lower()
    suffix = Path(path).suffix
    if suffix in {".csv", ".txt", ".xls", ".xlsx", ".zip"}:
        return f"filosofi_{year}{suffix}"
    return f"filosofi_{year}.bin"


def stream_download(download_url: str, output_path: Path) -> None:
    temp_output_path = output_path.with_suffix(f"{output_path.suffix}.part")
    temp_output_path.unlink(missing_ok=True)
    total_bytes = 0
    try:
        with requests.get(download_url, stream=True, timeout=REQUEST_TIMEOUT, allow_redirects=True) as response:
            response.raise_for_status()
            with temp_output_path.open("wb") as output_file:
                for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                    if not chunk:
                        continue
                    output_file.write(chunk)
                    total_bytes += len(chunk)
                    log(f"Downloaded {total_bytes / (1024 * 1024):.2f} MB")
    except Exception:
        temp_output_path.unlink(missing_ok=True)
        raise
    temp_output_path.replace(output_path)


def resolve_download(year: int) -> tuple[str, str]:
    source = source_for_year(year)
    if source.get("page_url"):
        page_url = str(source["page_url"])
        download_url = resolve_page_download_url(page_url, "")
        return download_url, page_url

    download_url, _ = resolve_data_gouv_download(year)
    return download_url, DATASET_API_URL


def main() -> None:
    args = parse_args()
    log(f"Preparing FiLoSoFi raw data download for year {args.year}")
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)

    source = source_for_year(args.year)
    if source.get("page_url"):
        page_url = str(source["page_url"])
        log(f"Source page: {page_url}")
        try:
            download_url = resolve_page_download_url(page_url, "")
            source_label = page_url
        except Exception as exc:
            log(f"Page link resolution failed, falling back to data.gouv: {exc}")
            download_url, selected_title = resolve_data_gouv_download(args.year)
            source_label = selected_title
            log(f"Selected resource title: {selected_title}")
    else:
        download_url, selected_title = resolve_data_gouv_download(args.year)
        source_label = selected_title
        log(f"Selected resource title: {selected_title}")

    output_dir = RAW_DATA_DIR / f"year={args.year}"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / build_output_filename(args.year, download_url)

    log(f"Download URL: {download_url}")
    log(f"Output path: {output_path}")
    if output_path.exists() and not args.force:
        log(f"Skipping download, file already exists: {output_path}")
        return

    stream_download(download_url, output_path)
    log(f"Download completed: {output_path}")
    log(f"Source: {source_label}")


if __name__ == "__main__":
    main()
