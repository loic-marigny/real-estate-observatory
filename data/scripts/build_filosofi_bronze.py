from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path
from typing import BinaryIO

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[2]
RAW_DATA_DIR = ROOT_DIR / "data" / "raw"
OUTPUT_PARQUET_PATH = ROOT_DIR / "data" / "bronze" / "filosofi_bronze.parquet"
SUPPORTED_EXTENSIONS = {".zip", ".csv", ".txt", ".xls", ".xlsx"}
TABULAR_EXTENSIONS = {".csv", ".txt", ".xls", ".xlsx"}
YEAR_PATTERN = re.compile(r"(19|20)\d{2}")


def log(message: str) -> None:
    print(f"[build_filosofi_bronze] {message}")


def infer_year(*names: str) -> int | None:
    for name in names:
        match = YEAR_PATTERN.search(name)
        if match:
            return int(match.group(0))

    return None


def infer_geography_level(name: str) -> str:
    normalized = name.lower()
    if "_com" in normalized or "commune" in normalized:
        return "commune"
    if "_dep" in normalized or "departement" in normalized:
        return "department"
    if "_reg" in normalized or "region" in normalized:
        return "region"
    if "_epci" in normalized:
        return "epci"
    if "_arr" in normalized:
        return "arrondissement"
    if "_metro" in normalized:
        return "national"
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
    return frame, encoding


def read_excel_bytes(payload: bytes, extension: str) -> pd.DataFrame:
    engine = "openpyxl" if extension == ".xlsx" else "xlrd"
    return pd.read_excel(
        io.BytesIO(payload),
        dtype=str,
        engine=engine,
    ).fillna("")


def read_tabular_payload(payload: bytes, extension: str) -> tuple[pd.DataFrame, str]:
    if extension in {".csv", ".txt"}:
        frame, encoding = read_delimited_bytes(payload)
        return frame.fillna(""), encoding

    frame = read_excel_bytes(payload, extension)
    return frame, "binary-excel"


def list_raw_candidates() -> list[Path]:
    if not RAW_DATA_DIR.exists():
        raise FileNotFoundError(
            f"Missing raw data directory: {RAW_DATA_DIR}. "
            "Run data/scripts/download_filosofi.py first."
        )

    candidates = [
        path
        for path in RAW_DATA_DIR.iterdir()
        if path.is_file()
        and "filosofi" in path.name.lower()
        and path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    return sorted(candidates)


def rank_archive_member(member_name: str) -> tuple[int, int, int, int]:
    path = Path(member_name)
    normalized = path.name.lower()
    extension = path.suffix.lower()
    is_tabular = extension in TABULAR_EXTENSIONS
    is_metadata = normalized.startswith("meta_")
    geography_level = infer_geography_level(normalized)
    geography_rank = {
        "commune": 5,
        "department": 4,
        "region": 3,
        "epci": 2,
        "national": 1,
        "unknown": 0,
        "arrondissement": 0,
    }.get(geography_level, 0)
    format_rank = {
        ".csv": 4,
        ".txt": 3,
        ".xlsx": 2,
        ".xls": 1,
    }.get(extension, 0)

    return (
        1 if is_tabular else 0,
        0 if is_metadata else 1,
        geography_rank,
        format_rank,
    )


def select_archive_members(archive: zipfile.ZipFile, source_path: Path) -> list[str]:
    members = [
        name
        for name in archive.namelist()
        if Path(name).suffix.lower() in TABULAR_EXTENSIONS
    ]
    if not members:
        raise RuntimeError(f"No tabular FiLoSoFi files found in archive {source_path.name}")

    ranked_members = sorted(members, key=rank_archive_member, reverse=True)
    selected: list[str] = []
    selected_levels: set[str] = set()
    for member_name in ranked_members:
        geography_level = infer_geography_level(member_name)
        if geography_level not in {"commune", "department"}:
            continue
        if infer_file_role(member_name) != "data":
            continue
        if geography_level in selected_levels:
            continue
        selected.append(member_name)
        selected_levels.add(geography_level)

    if not selected:
        selected = [ranked_members[0]]

    ignored = [name for name in members if name not in selected]
    if ignored:
        log(f"Ignoring archive members from {source_path.name}: {', '.join(ignored)}")
    return selected


def build_frame_metadata(frame: pd.DataFrame, source_file: str, extracted_file: str, year: int | None) -> pd.DataFrame:
    frame["source_file"] = source_file
    frame["extracted_file"] = extracted_file
    frame["year"] = year
    frame["geography_level"] = infer_geography_level(extracted_file or source_file)
    frame["file_role"] = infer_file_role(extracted_file or source_file)
    return frame


def read_source_file(source_path: Path) -> list[pd.DataFrame]:
    extension = source_path.suffix.lower()
    if extension == ".zip":
        frames: list[pd.DataFrame] = []
        with zipfile.ZipFile(source_path) as archive:
            selected_members = select_archive_members(archive, source_path)
            for selected_member in selected_members:
                with archive.open(selected_member) as archive_member:
                    payload = archive_member.read()

                member_extension = Path(selected_member).suffix.lower()
                frame, encoding = read_tabular_payload(payload, member_extension)
                year = infer_year(source_path.name, selected_member)
                log(f"Selected archive member: {selected_member}")
                log(f"Detected encoding/reader: {encoding}")
                log(f"Detected columns: {', '.join(frame.columns.astype(str).tolist())}")
                log(f"Row count: {len(frame)}")
                log(f"Inferred year: {year}")
                frames.append(
                    build_frame_metadata(frame, source_path.name, selected_member, year)
                )
        return frames

    payload = source_path.read_bytes()
    frame, encoding = read_tabular_payload(payload, extension)
    year = infer_year(source_path.name)
    log(f"Selected source file: {source_path.name}")
    log(f"Detected encoding/reader: {encoding}")
    log(f"Detected columns: {', '.join(frame.columns.astype(str).tolist())}")
    log(f"Row count: {len(frame)}")
    log(f"Inferred year: {year}")
    return [build_frame_metadata(frame, source_path.name, "", year)]


def main() -> None:
    log("Preparing FiLoSoFi bronze dataset")
    candidates = list_raw_candidates()
    if not candidates:
        raise FileNotFoundError(
            f"No FiLoSoFi files found in {RAW_DATA_DIR}. "
            "Run data/scripts/download_filosofi.py first."
        )

    log(f"Found raw FiLoSoFi candidates: {', '.join(path.name for path in candidates)}")
    frames = [frame for source_path in candidates for frame in read_source_file(source_path)]
    bronze = pd.concat(frames, ignore_index=True, sort=False)

    OUTPUT_PARQUET_PATH.parent.mkdir(parents=True, exist_ok=True)
    bronze.to_parquet(OUTPUT_PARQUET_PATH, index=False)
    log(f"Bronze dataset written to {OUTPUT_PARQUET_PATH}")
    log(f"Total rows written: {len(bronze)}")


if __name__ == "__main__":
    main()
