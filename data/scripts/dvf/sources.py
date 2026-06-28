from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]
RAW_DATA_DIR = ROOT_DIR / "data" / "raw" / "dvf"
GEO_DVF_DOWNLOAD_URL = "https://files.data.gouv.fr/geo-dvf/latest/csv/"
GEO_DVF_FILENAME = "full.csv.gz"
LEGACY_DVF_FILENAME = "dvf_raw.txt"
ZIP_ARCHIVE_PATTERNS = (
    "{year}-full.csv.zip",
    "full.csv.zip",
    "dvf.csv.zip",
)


@dataclass(frozen=True)
class DvfSource:
    year: int
    source_kind: str
    raw_filename: str
    delimiter: str
    download_url: str | None = None


LEGACY_DVF_URLS = {
    2017: "https://www.data.gouv.fr/fr/datasets/r/7161c9f2-3d91-4caf-afa2-cfe535807f04",
    2018: "https://www.data.gouv.fr/fr/datasets/r/1be77ca5-dc1b-4e50-af2b-0240147e0346",
    2019: "https://www.data.gouv.fr/fr/datasets/r/3004168d-bec4-44d9-a781-ef16f41856a2",
    2020: "https://www.data.gouv.fr/fr/datasets/r/90a98de0-f562-4328-aa16-fe0dd1dca60f",
}


def get_dvf_source(year: int) -> DvfSource:
    if year in LEGACY_DVF_URLS:
        return DvfSource(
            year=year,
            source_kind="legacy_dgfip_raw",
            raw_filename=LEGACY_DVF_FILENAME,
            delimiter="|",
            download_url=LEGACY_DVF_URLS[year],
        )

    return DvfSource(
        year=year,
        source_kind="geo_dvf",
        raw_filename=GEO_DVF_FILENAME,
        delimiter=",",
    )


def raw_year_dir(year: int) -> Path:
    return RAW_DATA_DIR / f"year={year}"


def raw_output_path(year: int) -> Path:
    return raw_year_dir(year) / get_dvf_source(year).raw_filename


def raw_input_candidates(year: int) -> list[Path]:
    source = get_dvf_source(year)
    candidates = [raw_year_dir(year) / source.raw_filename]

    legacy_fallback = raw_year_dir(year) / GEO_DVF_FILENAME
    if source.source_kind == "legacy_dgfip_raw" and legacy_fallback not in candidates:
        candidates.append(legacy_fallback)

    for pattern in ZIP_ARCHIVE_PATTERNS:
        candidate = raw_year_dir(year) / pattern.format(year=year)
        if candidate not in candidates:
            candidates.append(candidate)

    return candidates


def resolve_existing_raw_path(year: int) -> Path | None:
    for path in raw_input_candidates(year):
        if path.exists():
            return path
    return None


def relative_raw_location(year: int) -> str:
    path = resolve_existing_raw_path(year) or raw_output_path(year)
    return str(path.relative_to(ROOT_DIR)).replace("\\", "/")
