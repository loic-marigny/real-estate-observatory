from __future__ import annotations

import argparse
import json
from datetime import date, datetime
from pathlib import Path

import pandas as pd
from pandas.api.types import is_numeric_dtype

from data.scripts.dvf.sources import relative_raw_location
from scripts.shared.pipeline_config import load_pipeline_config


ROOT_DIR = Path(__file__).resolve().parents[3]
PUBLIC_DATA_DIR = ROOT_DIR / "public" / "data"
PREVIEW_ROWS = 500

DATASETS = {
    "dvf": {
        "source_path_template": ROOT_DIR / "data" / "silver" / "dvf" / "year={year}" / "dvf_silver.parquet",
        "output_path": PUBLIC_DATA_DIR / "dvf_preview.json",
        "year_output_path_template": PUBLIC_DATA_DIR / "dvf_previews" / "year={year}" / "dvf_preview.json",
        "source_file_location_template": None,
        "year_column": "year",
    },
    "filosofi": {
        "source_path_template": ROOT_DIR / "data" / "silver" / "filosofi" / "year={year}" / "filosofi_silver.parquet",
        "output_path": PUBLIC_DATA_DIR / "filosofi_preview.json",
        "year_output_path_template": None,
        "source_file_location_template": "data/raw/filosofi/year={year}/",
        "year_column": "year",
    },
}


def log(message: str) -> None:
    print(f"[build_public_previews] {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build lightweight public JSON previews from processed datasets.")
    parser.add_argument("--dataset", choices=sorted(DATASETS.keys()), action="append", dest="datasets")
    parser.add_argument("--year", type=int, required=True)
    return parser.parse_args()


def normalize_scalar(value):
    if pd.isna(value):
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if hasattr(value, "item"):
        try:
            return value.item()
        except (ValueError, TypeError):
            pass
    return value


def build_columns(frame: pd.DataFrame) -> list[dict[str, str]]:
    return [
        {
            "key": column_name,
            "label": column_name.replace("_", " "),
            "type": "number" if is_numeric_dtype(frame[column_name]) else "text",
        }
        for column_name in frame.columns
    ]


def build_records(frame: pd.DataFrame) -> list[dict[str, object]]:
    preview_frame = frame.head(PREVIEW_ROWS)
    return [
        {key: normalize_scalar(value) for key, value in raw_record.items()}
        for raw_record in preview_frame.to_dict(orient="records")
    ]


def resolve_available_years(dataset_id: str, frame: pd.DataFrame, year_column: str, year: int) -> list[int]:
    if dataset_id == "dvf":
        configured_years = load_pipeline_config().get("dvf_years", [])
        if configured_years:
            return configured_years

    if year_column and year_column in frame.columns:
        years = sorted(
            pd.to_numeric(frame[year_column], errors="coerce")
            .dropna()
            .astype(int)
            .unique()
            .tolist()
        )
        if years:
            return years

    return [year]


def build_preview(dataset_id: str, config: dict[str, object], year: int) -> None:
    source_path_template = config["source_path_template"]
    output_path = config["output_path"]
    year_output_path_template = config["year_output_path_template"]
    source_file_location_template = config["source_file_location_template"]
    year_column = config["year_column"]

    assert isinstance(source_path_template, Path)
    assert isinstance(output_path, Path)
    source_path = Path(str(source_path_template).format(year=year))
    if not source_path.exists():
        raise FileNotFoundError(f"Missing source parquet: {source_path}")

    log(f"Loading {dataset_id} preview source: {source_path}")
    frame = pd.read_parquet(source_path)
    years = resolve_available_years(dataset_id, frame, year_column, year)
    source_file_location = (
        relative_raw_location(year)
        if dataset_id == "dvf"
        else source_file_location_template.format(year=year)
    )

    payload = {
        "dataset_id": dataset_id,
        "source_file_location": source_file_location,
        "rows": int(len(frame)),
        "columns_count": int(len(frame.columns)),
        "available_years": years,
        "last_update": None,
        "columns": build_columns(frame),
        "records": build_records(frame),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False),
        encoding="utf-8",
    )
    log(f"Wrote {dataset_id} preview: {output_path}")

    if year_output_path_template is not None:
        year_output_path = Path(str(year_output_path_template).format(year=year))
        year_output_path.parent.mkdir(parents=True, exist_ok=True)
        year_output_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False),
            encoding="utf-8",
        )
        log(f"Wrote {dataset_id} yearly preview: {year_output_path}")


def main() -> None:
    args = parse_args()
    selected_datasets = args.datasets or list(DATASETS.keys())
    for dataset_id in selected_datasets:
        build_preview(dataset_id, DATASETS[dataset_id], args.year)


if __name__ == "__main__":
    main()
