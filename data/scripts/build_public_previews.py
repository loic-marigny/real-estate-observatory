import json
from datetime import date, datetime
from pathlib import Path

import pandas as pd
from pandas.api.types import is_numeric_dtype


ROOT_DIR = Path(__file__).resolve().parents[2]
SILVER_DIR = ROOT_DIR / "data" / "silver"
PUBLIC_DATA_DIR = ROOT_DIR / "public" / "data"
PREVIEW_ROWS = 500

DATASETS = {
    "dvf": {
        "source_path": SILVER_DIR / "dvf_silver.parquet",
        "output_path": PUBLIC_DATA_DIR / "dvf_preview.json",
        "source_file_location": "data/raw/dvf_latest.csv.gz",
        "year_column": None,
    },
    "filosofi": {
        "source_path": SILVER_DIR / "filosofi_silver.parquet",
        "output_path": PUBLIC_DATA_DIR / "filosofi_preview.json",
        "source_file_location": "data/raw/filosofi_latest.csv.zip",
        "year_column": "year",
    },
}


def log(message: str) -> None:
    print(f"[build_public_previews] {message}")


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
    columns: list[dict[str, str]] = []
    for column_name in frame.columns:
        columns.append(
            {
                "key": column_name,
                "label": column_name.replace("_", " "),
                "type": "number" if is_numeric_dtype(frame[column_name]) else "text",
            }
        )
    return columns


def build_records(frame: pd.DataFrame) -> list[dict[str, object]]:
    preview_frame = frame.head(PREVIEW_ROWS)
    records: list[dict[str, object]] = []

    for raw_record in preview_frame.to_dict(orient="records"):
        records.append(
            {
                key: normalize_scalar(value)
                for key, value in raw_record.items()
            }
        )

    return records


def extract_years(frame: pd.DataFrame, year_column: str | None) -> list[int]:
    if not year_column or year_column not in frame.columns:
        return []

    years = pd.to_numeric(frame[year_column], errors="coerce").dropna().astype(int)
    return sorted(years.unique().tolist())


def build_preview(dataset_id: str, config: dict[str, object]) -> None:
    source_path = config["source_path"]
    output_path = config["output_path"]
    source_file_location = config["source_file_location"]
    year_column = config["year_column"]

    if not isinstance(source_path, Path) or not source_path.exists():
        raise FileNotFoundError(f"Missing source parquet: {source_path}")

    log(f"Loading {dataset_id} preview source: {source_path}")
    frame = pd.read_parquet(source_path)

    payload = {
        "dataset_id": dataset_id,
        "source_file_location": source_file_location,
        "rows": int(len(frame)),
        "columns_count": int(len(frame.columns)),
        "available_years": extract_years(frame, year_column),
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
    for dataset_id, config in DATASETS.items():
        build_preview(dataset_id, config)


if __name__ == "__main__":
    main()
