from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urljoin

import requests


DOWNLOAD_URL = "https://files.data.gouv.fr/geo-dvf/latest/csv/"
OUTPUT_FILENAME = "dvf_latest.csv.gz"
CHUNK_SIZE = 1024 * 1024
REQUEST_TIMEOUT = 120
MAX_DOWNLOAD_ATTEMPTS = 3

ROOT_DIR = Path(__file__).resolve().parents[2]
RAW_DATA_DIR = ROOT_DIR / "data" / "raw"
OUTPUT_PATH = RAW_DATA_DIR / OUTPUT_FILENAME
YEAR_LINK_PATTERN = re.compile(r'href="[^"]*/(?P<year>\d{4})/"')


def log(message: str) -> None:
    print(f"[download_dvf] {message}")


def resolve_download_url(session: requests.Session) -> str:
    if not DOWNLOAD_URL.endswith("/"):
        return DOWNLOAD_URL

    log(f"Resolving latest DVF archive from index: {DOWNLOAD_URL}")
    response = session.get(DOWNLOAD_URL, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()

    available_years = sorted({match.group("year") for match in YEAR_LINK_PATTERN.finditer(response.text)})
    if not available_years:
        raise RuntimeError(f"No yearly DVF directories found at {DOWNLOAD_URL}")

    latest_year = available_years[-1]
    resolved_url = urljoin(DOWNLOAD_URL, f"{latest_year}/full.csv.gz")
    log(f"Resolved latest DVF year: {latest_year}")
    log(f"Resolved archive URL: {resolved_url}")
    return resolved_url


def stream_download(session: requests.Session, download_url: str, temp_output_path: Path) -> None:
    for attempt in range(1, MAX_DOWNLOAD_ATTEMPTS + 1):
        downloaded_bytes = temp_output_path.stat().st_size if temp_output_path.exists() else 0
        headers = {"Range": f"bytes={downloaded_bytes}-"} if downloaded_bytes else {}
        mode = "ab" if downloaded_bytes else "wb"

        if downloaded_bytes:
            log(
                f"Resuming download from byte {downloaded_bytes} "
                f"(attempt {attempt}/{MAX_DOWNLOAD_ATTEMPTS})"
            )
        else:
            log(f"Starting fresh download (attempt {attempt}/{MAX_DOWNLOAD_ATTEMPTS})")

        try:
            with session.get(
                download_url,
                stream=True,
                timeout=REQUEST_TIMEOUT,
                headers=headers,
            ) as response:
                response.raise_for_status()

                if downloaded_bytes and response.status_code == 200:
                    log("Server did not honor resume request, restarting from zero")
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


def download_file() -> None:
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    log(f"Raw data directory ready: {RAW_DATA_DIR}")

    if OUTPUT_PATH.exists():
        log(f"Skipping download, file already exists: {OUTPUT_PATH}")
        return

    with requests.Session() as session:
        download_url = resolve_download_url(session)
        temp_output_path = OUTPUT_PATH.with_suffix(f"{OUTPUT_PATH.suffix}.part")

        log(f"Starting download from: {download_url}")
        log(f"Saving archive to: {OUTPUT_PATH}")
        stream_download(session, download_url, temp_output_path)

    temp_output_path.replace(OUTPUT_PATH)
    log(f"Download completed: {OUTPUT_PATH}")


def main() -> None:
    log("Preparing DVF raw data download")

    try:
        download_file()
    except (requests.RequestException, RuntimeError) as error:
        log(f"Download failed: {error}")
        raise


if __name__ == "__main__":
    main()
