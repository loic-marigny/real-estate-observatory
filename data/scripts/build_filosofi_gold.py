from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[2]
INPUT_PARQUET_PATH = ROOT_DIR / "data" / "silver" / "filosofi_silver.parquet"
OUTPUT_COMMUNE_PARQUET_PATH = ROOT_DIR / "data" / "gold" / "filosofi_commune_indicators.parquet"
OUTPUT_JSON_PATH = ROOT_DIR / "public" / "data" / "filosofi_summary.json"


def log(message: str) -> None:
    print(f"[build_filosofi_gold] {message}")


def weighted_median(values: pd.Series, weights: pd.Series | None = None) -> float | None:
    frame = pd.DataFrame({"value": values})
    if weights is None:
        frame["weight"] = 1.0
    else:
        frame["weight"] = weights

    frame = frame.dropna(subset=["value", "weight"])
    frame = frame[frame["weight"] > 0]
    if frame.empty:
        return None

    frame = frame.sort_values("value")
    cumulative_weight = frame["weight"].cumsum()
    threshold = frame["weight"].sum() / 2
    value = frame.loc[cumulative_weight >= threshold, "value"].iloc[0]
    return round(float(value), 2)


def weighted_mean(values: pd.Series, weights: pd.Series | None = None) -> float | None:
    frame = pd.DataFrame({"value": values})
    if weights is None:
        frame["weight"] = 1.0
    else:
        frame["weight"] = weights

    frame = frame.dropna(subset=["value", "weight"])
    frame = frame[frame["weight"] > 0]
    if frame.empty:
        return None

    result = (frame["value"] * frame["weight"]).sum() / frame["weight"].sum()
    return round(float(result), 2)


def non_null_columns(frame: pd.DataFrame, columns: list[str]) -> list[str]:
    return [column for column in columns if column in frame.columns and frame[column].notna().any()]


def main() -> None:
    log("Preparing FiLoSoFi gold outputs")
    if not INPUT_PARQUET_PATH.exists():
        raise FileNotFoundError(
            f"Missing silver dataset: {INPUT_PARQUET_PATH}. "
            "Run data/scripts/build_filosofi_silver.py first."
        )

    silver = pd.read_parquet(INPUT_PARQUET_PATH)
    latest_year = None
    available_years = sorted(
        {int(year) for year in silver["year"].dropna().tolist()}
    ) if "year" in silver.columns else []
    if available_years:
        latest_year = available_years[-1]
        latest = silver[silver["year"] == latest_year].copy()
    else:
        latest = silver.copy()

    commune_columns = [
        column
        for column in [
            "commune_code",
            "commune_name",
            "department_code",
            "median_income",
            "d1_income",
            "d2_income",
            "d3_income",
            "d4_income",
            "d5_income",
            "d6_income",
            "d7_income",
            "d8_income",
            "d9_income",
            "poverty_rate",
            "tax_households",
            "population",
            "year",
            "source_file",
            "extracted_file",
        ]
        if column in silver.columns
    ]
    commune_indicators = silver.loc[:, commune_columns].copy()

    OUTPUT_COMMUNE_PARQUET_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    commune_indicators.to_parquet(OUTPUT_COMMUNE_PARQUET_PATH, index=False)

    weight_column = None
    if "tax_households" in latest.columns and latest["tax_households"].notna().any():
        weight_column = "tax_households"
    elif "population" in latest.columns and latest["population"].notna().any():
        weight_column = "population"

    weights = latest[weight_column] if weight_column is not None else None

    national_median_income = None
    if "median_income" in latest.columns and latest["median_income"].notna().any():
        national_median_income = weighted_median(latest["median_income"], weights)

    median_income_by_department: dict[str, float | None] = {}
    if "median_income" in latest.columns and latest["median_income"].notna().any():
        for department_code, group in latest.groupby("department_code"):
            median_income_by_department[str(department_code)] = weighted_median(
                group["median_income"],
                group[weight_column] if weight_column is not None else None,
            )

    decile_columns = non_null_columns(
        latest,
        [
            "d1_income",
            "d2_income",
            "d3_income",
            "d4_income",
            "d5_income",
            "d6_income",
            "d7_income",
            "d8_income",
            "d9_income",
        ],
    )
    decile_summary = None
    if decile_columns:
        decile_summary = {
            column: weighted_median(
                latest[column],
                latest[weight_column] if weight_column is not None else None,
            )
            for column in decile_columns
        }

    poverty_rate_summary = None
    if "poverty_rate" in latest.columns and latest["poverty_rate"].notna().any():
        poverty_rate_summary = {
            "mean": weighted_mean(latest["poverty_rate"], latest[weight_column] if weight_column is not None else None),
            "median": weighted_median(latest["poverty_rate"], latest[weight_column] if weight_column is not None else None),
        }

    summary = {
        "source": "INSEE FiLoSoFi",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "available_years": available_years,
        "latest_year": latest_year,
        "communes_covered": int(silver["commune_code"].nunique()),
        "departments_covered": int(silver["department_code"].nunique()),
        "national_median_income": national_median_income,
        "median_income_by_department": dict(sorted(median_income_by_department.items())),
        "decile_summary": decile_summary,
        "poverty_rate_summary": poverty_rate_summary,
        "notes": [
            "FiLoSoFi is annual data and should be joined to DVF using commune_code and year.",
            "Join keys: DVF commune_code + transaction year, FiLoSoFi commune_code + income year.",
            "Several years may be added later as new FiLoSoFi source files are downloaded.",
        ],
    }

    with OUTPUT_JSON_PATH.open("w", encoding="utf-8") as output_file:
        json.dump(summary, output_file, ensure_ascii=False, indent=2)
        output_file.write("\n")

    log(f"Commune indicators parquet written to {OUTPUT_COMMUNE_PARQUET_PATH}")
    log(f"FiLoSoFi summary written to {OUTPUT_JSON_PATH}")
    log(f"Available years: {available_years}")
    log(f"Communes covered: {summary['communes_covered']}")
    log(f"Departments covered: {summary['departments_covered']}")


if __name__ == "__main__":
    main()
