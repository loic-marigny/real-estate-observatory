from __future__ import annotations

import argparse
import json
from datetime import date, datetime
from pathlib import Path

import pandas as pd
from pandas.api.types import is_numeric_dtype


ROOT_DIR = Path(__file__).resolve().parents[2]
PUBLIC_DATA_DIR = ROOT_DIR / "public" / "data"
PREVIEW_ROWS = 500

DATASETS = {
    "dvf": {
        "source_path_template": ROOT_DIR / "data" / "silver" / "dvf" / "year={year}" / "dvf_silver.parquet",
        "output_path": PUBLIC_DATA_DIR / "dvf_preview.json",
        "source_file_location_template": "data/raw/dvf/year={year}/full.csv.gz",
        "year_column": "year",
    },
    "filosofi": {
        "source_path_template": ROOT_DIR / "data" / "silver" / "filosofi" / "year={year}" / "filosofi_silver.parquet",
        "output_path": PUBLIC_DATA_DIR / "filosofi_preview.json",
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


def build_preview(dataset_id: str, config: dict[str, object], year: int) -> None:
    source_path_template = config["source_path_template"]
    output_path = config["output_path"]
    source_file_location_template = config["source_file_location_template"]
    year_column = config["year_column"]

    assert isinstance(source_path_template, Path)
    assert isinstance(output_path, Path)
    assert isinstance(source_file_location_template, str)

    source_path = Path(str(source_path_template).format(year=year))
    if not source_path.exists():
        raise FileNotFoundError(f"Missing source parquet: {source_path}")

    log(f"Loading {dataset_id} preview source: {source_path}")
    frame = pd.read_parquet(source_path)
    years = []
    if year_column and year_column in frame.columns:
        years = sorted(pd.to_numeric(frame[year_column], errors="coerce").dropna().astype(int).unique().tolist())

    payload = {
        "dataset_id": dataset_id,
        "source_file_location": source_file_location_template.format(year=year),
        "rows": int(len(frame)),
        "columns_count": int(len(frame.columns)),
        "available_years": years or [year],
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


def main() -> None:
    args = parse_args()
    selected_datasets = args.datasets or list(DATASETS.keys())
    for dataset_id in selected_datasets:
        build_preview(dataset_id, DATASETS[dataset_id], args.year)


if __name__ == "__main__":
    main()
