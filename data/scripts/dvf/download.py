from __future__ import annotations

import argparse
import re
from pathlib import Path
from urllib.parse import urljoin

import requests

from data.scripts.dvf.sources import (
    GEO_DVF_DOWNLOAD_URL,
    get_dvf_source,
    raw_output_path,
    resolve_existing_raw_path,
)
CHUNK_SIZE = 1024 * 1024
REQUEST_TIMEOUT = 120
MAX_DOWNLOAD_ATTEMPTS = 3

YEAR_LINK_PATTERN = re.compile(r'href="[^"]*/(?P<year>\d{4})/"')


def log(message: str) -> None:
    print(f"[download_dvf] {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download DVF data for a specific year.")
    parser.add_argument("--year", type=int, required=False)
    return parser.parse_args()


def resolve_available_years(session: requests.Session) -> list[int]:
    response = session.get(GEO_DVF_DOWNLOAD_URL, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return sorted({int(match.group("year")) for match in YEAR_LINK_PATTERN.finditer(response.text)})


def resolve_download_url(session: requests.Session, year: int | None) -> tuple[int, str]:
    if year is not None:
        source = get_dvf_source(year)
        if source.download_url is not None:
            log(f"Resolved DVF year: {year}")
            log(f"Resolved archive URL: {source.download_url}")
            return year, source.download_url

    available_years = resolve_available_years(session)
    if not available_years:
        raise RuntimeError(f"No yearly DVF directories found at {GEO_DVF_DOWNLOAD_URL}")

    selected_year = year if year is not None else available_years[-1]
    if selected_year not in available_years:
        raise RuntimeError(
            f"DVF year {selected_year} is not available. Available years: {available_years}"
        )

    resolved_url = urljoin(GEO_DVF_DOWNLOAD_URL, f"{selected_year}/full.csv.gz")
    log(f"Resolved DVF year: {selected_year}")
    log(f"Resolved archive URL: {resolved_url}")
    return selected_year, resolved_url


def build_output_path(year: int) -> Path:
    return raw_output_path(year)


def can_reuse_local_archive(year: int | None) -> bool:
    return year is not None and resolve_existing_raw_path(year) is not None


def stream_download(session: requests.Session, download_url: str, temp_output_path: Path) -> None:
    for attempt in range(1, MAX_DOWNLOAD_ATTEMPTS + 1):
        downloaded_bytes = temp_output_path.stat().st_size if temp_output_path.exists() else 0
        headers = {"Range": f"bytes={downloaded_bytes}-"} if downloaded_bytes else {}
        mode = "ab" if downloaded_bytes else "wb"

        try:
            with session.get(
                download_url,
                stream=True,
                timeout=REQUEST_TIMEOUT,
                headers=headers,
            ) as response:
                response.raise_for_status()

                if downloaded_bytes and response.status_code == 200:
                    temp_output_path.unlink(missing_ok=True)
                    downloaded_bytes = 0
                    mode = "wb"

                total_bytes = downloaded_bytes
                with temp_output_path.open(mode) as output_file:
                    for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                        if not chunk:
                            continue
                        output_file.write(chunk)
                        total_bytes += len(chunk)
                        log(f"Downloaded {total_bytes / (1024 * 1024):.2f} MB")
            return
        except requests.RequestException as error:
            log(f"Attempt {attempt} failed: {error}")
            if attempt == MAX_DOWNLOAD_ATTEMPTS:
                temp_output_path.unlink(missing_ok=True)
                raise


def main() -> None:
    args = parse_args()
    log("Preparing DVF raw data download")

    if can_reuse_local_archive(args.year):
        output_path = resolve_existing_raw_path(args.year)
        log(f"Skipping download, file already exists: {output_path}")
        return

    with requests.Session() as session:
        year, download_url = resolve_download_url(session, args.year)
        output_path = build_output_path(year)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        log(f"Raw data directory ready: {output_path.parent}")

        temp_output_path = output_path.with_suffix(f"{output_path.suffix}.part")
        log(f"Starting download from: {download_url}")
        log(f"Saving archive to: {output_path}")
        try:
            stream_download(session, download_url, temp_output_path)
        except requests.HTTPError as error:
            source = get_dvf_source(year)
            if source.source_kind == "legacy_dgfip_raw":
                raise RuntimeError(
                    f"Legacy DVF resource for year {year} is not reachable at {download_url}. "
                    f"Place the official raw file manually in {output_path.parent} and rerun the pipeline."
                ) from error
            raise
        temp_output_path.replace(output_path)
        log(f"Download completed: {output_path}")


if __name__ == "__main__":
    main()
