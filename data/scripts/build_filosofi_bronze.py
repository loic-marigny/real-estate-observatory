from __future__ import annotations

import argparse
import io
import json
import re
import zipfile
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT_DIR / "config" / "filosofi_sources.json"
SUPPORTED_EXTENSIONS = {".zip", ".csv", ".txt", ".xls", ".xlsx"}
TABULAR_EXTENSIONS = {".csv", ".txt", ".xls", ".xlsx"}


def log(message: str) -> None:
    print(f"[build_filosofi_bronze] {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the FiLoSoFi bronze dataset for one year.")
    parser.add_argument("--year", type=int, required=True)
    return parser.parse_args()


def raw_dir(year: int) -> Path:
    return ROOT_DIR / "data" / "raw" / "filosofi" / f"year={year}"


def output_path(year: int) -> Path:
    return ROOT_DIR / "data" / "bronze" / "filosofi" / f"year={year}" / "filosofi_bronze.parquet"


def pipeline_mode_for_year(year: int) -> str:
    payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    sources = payload.get("sources", {})
    if not isinstance(sources, dict):
        return "full_pipeline"
    source = sources.get(str(year), {})
    if not isinstance(source, dict):
        return "full_pipeline"
    return str(source.get("pipeline_mode", "full_pipeline"))


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
        raise FileNotFoundError(f"Missing raw data directory: {directory}. Run data/scripts/download_filosofi.py first.")
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


def add_metadata(frame: pd.DataFrame, source_file: str, extracted_file: str, year: int) -> pd.DataFrame:
    frame["source_file"] = source_file
    frame["extracted_file"] = extracted_file
    frame["year"] = year
    frame["geography_level"] = infer_geography_level(extracted_file or source_file)
    frame["file_role"] = infer_file_role(extracted_file or source_file)
    return frame


def read_source_file(source_path: Path, year: int) -> list[pd.DataFrame]:
    if source_path.suffix.lower() == ".zip":
        frames: list[pd.DataFrame] = []
        with zipfile.ZipFile(source_path) as archive:
            for selected_member in select_archive_members(archive, source_path):
                payload = archive.read(selected_member)
                extension = Path(selected_member).suffix.lower()
                frame, encoding = read_tabular_payload(payload, extension)
                log(f"Selected archive member: {selected_member}")
                log(f"Detected encoding/reader: {encoding}")
                frames.append(add_metadata(frame, source_path.name, selected_member, year))
        return frames

    payload = source_path.read_bytes()
    frame, encoding = read_tabular_payload(payload, source_path.suffix.lower())
    log(f"Selected source file: {source_path.name}")
    log(f"Detected encoding/reader: {encoding}")
    return [add_metadata(frame, source_path.name, "", year)]


def main() -> None:
    args = parse_args()
    if pipeline_mode_for_year(args.year) == "bronze_only":
        log(f"Year {args.year} is configured as bronze-only. Skipping legacy parquet bronze build.")
        return
    log(f"Preparing FiLoSoFi bronze dataset for year {args.year}")
    candidates = list_raw_candidates(args.year)
    if not candidates:
        raise FileNotFoundError(f"No FiLoSoFi files found in {raw_dir(args.year)}")

    frames = [frame for source_path in candidates for frame in read_source_file(source_path, args.year)]
    bronze = pd.concat(frames, ignore_index=True, sort=False)

    destination = output_path(args.year)
    destination.parent.mkdir(parents=True, exist_ok=True)
    bronze.to_parquet(destination, index=False)
    log(f"Bronze dataset written to {destination}")
    log(f"Total rows written: {len(bronze)}")


if __name__ == "__main__":
    main()
