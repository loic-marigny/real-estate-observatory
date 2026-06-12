from __future__ import annotations

import argparse
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests


DATASET_API_URL = (
    "https://www.data.gouv.fr/api/1/datasets/"
    "revenus-et-pauvrete-des-menages-aux-niveaux-national-et-local-"
    "revenus-localises-sociaux-et-fiscaux/"
)
PREFERRED_TITLE_FRAGMENT = "revenus et pauvreté des ménages"
KNOWN_FORMATS = ("csv", "xlsx", "xls")
REQUEST_TIMEOUT = 120
CHUNK_SIZE = 1024 * 1024

ROOT_DIR = Path(__file__).resolve().parents[2]
RAW_DATA_DIR = ROOT_DIR / "data" / "raw"


def log(message: str) -> None:
    print(f"[download_filosofi] {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download the latest relevant FiLoSoFi resource from data.gouv.fr metadata."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download even if the target file already exists.",
    )
    return parser.parse_args()


def parse_last_modified(value: str | None) -> datetime:
    if not value:
        return datetime.min

    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def title_matches(resource: dict[str, object]) -> bool:
    title = str(resource.get("title") or "")
    return PREFERRED_TITLE_FRAGMENT in title.lower()


def format_tokens(resource: dict[str, object]) -> set[str]:
    raw_format = str(resource.get("format") or "").lower()
    return {
        token
        for token in re.split(r"[\s,/;|]+", raw_format)
        if token in KNOWN_FORMATS
    }


def preferred_format(resource: dict[str, object]) -> str:
    tokens = format_tokens(resource)
    for candidate in KNOWN_FORMATS:
        if candidate in tokens:
            return candidate

    return "bin"


def select_resource(resources: list[dict[str, object]]) -> dict[str, object]:
    if not resources:
        raise RuntimeError("No resources found in FiLoSoFi dataset metadata")

    sorted_resources = sorted(
        resources,
        key=lambda resource: (
            title_matches(resource),
            "csv" in format_tokens(resource),
            parse_last_modified(str(resource.get("last_modified") or "")),
        ),
        reverse=True,
    )
    return sorted_resources[0]


def discover_file_url(start_url: str, expected_format: str) -> str:
    response = requests.get(start_url, stream=True, timeout=REQUEST_TIMEOUT, allow_redirects=True)
    response.raise_for_status()

    content_type = (response.headers.get("content-type") or "").lower()
    final_url = response.url

    if "text/html" not in content_type:
        response.close()
        return final_url

    html = response.text
    response.close()

    generic_matches = re.findall(
        r"/fr/statistiques/fichier/[^\"'<>]+\.(?:zip|csv|xls|xlsx)",
        html,
        flags=re.IGNORECASE,
    )
    if generic_matches:
        sorted_matches = sorted(
            generic_matches,
            key=lambda match: (
                expected_format in match.lower(),
                ".csv" in match.lower(),
                ".xlsx" in match.lower(),
                ".xls" in match.lower(),
            ),
            reverse=True,
        )
        return urljoin(final_url, sorted_matches[0])

    return final_url


def build_output_filename(resource: dict[str, object], download_url: str) -> str:
    selected_format = preferred_format(resource)
    path = urlparse(download_url).path.lower()

    if path.endswith(".zip") and selected_format in KNOWN_FORMATS:
        return f"filosofi_latest.{selected_format}.zip"

    if path.endswith(".csv"):
        return "filosofi_latest.csv"
    if path.endswith(".xlsx"):
        return "filosofi_latest.xlsx"
    if path.endswith(".xls"):
        return "filosofi_latest.xls"
    if path.endswith(".zip"):
        return "filosofi_latest.zip"

    if selected_format in KNOWN_FORMATS:
        return f"filosofi_latest.{selected_format}"

    return "filosofi_latest.bin"


def stream_download(download_url: str, output_path: Path) -> None:
    temp_output_path = output_path.with_suffix(f"{output_path.suffix}.part")
    temp_output_path.unlink(missing_ok=True)

    total_bytes = 0

    try:
        with requests.get(download_url, stream=True, timeout=REQUEST_TIMEOUT) as response:
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


def main() -> None:
    args = parse_args()
    log("Preparing FiLoSoFi raw data download")

    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    log(f"Raw data directory ready: {RAW_DATA_DIR}")

    metadata_response = requests.get(DATASET_API_URL, timeout=REQUEST_TIMEOUT)
    metadata_response.raise_for_status()
    dataset = metadata_response.json()

    resources = dataset.get("resources")
    if not isinstance(resources, list):
        raise RuntimeError("Dataset metadata does not expose a valid resources array")

    selected_resource = select_resource(resources)
    selected_title = str(selected_resource.get("title") or "")
    selected_format = str(selected_resource.get("format") or "")
    selected_last_modified = str(selected_resource.get("last_modified") or "")
    selected_url = str(selected_resource.get("latest") or selected_resource.get("url") or "")

    if not selected_url:
        raise RuntimeError("Selected FiLoSoFi resource does not expose a download URL")

    resolved_download_url = discover_file_url(selected_url, preferred_format(selected_resource))
    output_filename = build_output_filename(selected_resource, resolved_download_url)
    output_path = RAW_DATA_DIR / output_filename

    log(f"Selected resource title: {selected_title}")
    log(f"Selected resource format: {selected_format}")
    log(f"Selected resource last_modified: {selected_last_modified}")
    log(f"Download URL: {resolved_download_url}")
    log(f"Output path: {output_path}")

    if output_path.exists() and not args.force:
        log(f"Skipping download, file already exists: {output_path}")
        return

    stream_download(resolved_download_url, output_path)
    log(f"Download completed: {output_path}")


if __name__ == "__main__":
    main()
