from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT_DIR / "config" / "filosofi_sources.json"
DEPARTMENT_INDICATOR_COLUMNS = [
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
]


def log(message: str) -> None:
    print(f"[build_filosofi_gold] {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the FiLoSoFi gold dataset for one year.")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--publish-public", action="store_true")
    return parser.parse_args()


def silver_path(year: int) -> Path:
    return ROOT_DIR / "data" / "silver" / "filosofi" / f"year={year}" / "filosofi_silver.parquet"


def gold_dir(year: int) -> Path:
    return ROOT_DIR / "data" / "gold" / "filosofi" / f"year={year}"


def source_for_year(year: int) -> dict[str, object]:
    payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    sources = payload.get("sources", {})
    if not isinstance(sources, dict):
        raise RuntimeError("Invalid FiLoSoFi source configuration")
    source = sources.get(str(year))
    if not isinstance(source, dict):
        raise RuntimeError(f"FiLoSoFi year {year} is not configured")
    return source


def weighted_median(values: pd.Series, weights: pd.Series | None = None) -> float | None:
    frame = pd.DataFrame({"value": values})
    frame["weight"] = 1.0 if weights is None else weights
    frame = frame.dropna(subset=["value", "weight"])
    frame = frame[frame["weight"] > 0]
    if frame.empty:
        return None
    frame = frame.sort_values("value")
    cumulative_weight = frame["weight"].cumsum()
    threshold = frame["weight"].sum() / 2
    return round(float(frame.loc[cumulative_weight >= threshold, "value"].iloc[0]), 2)


def weighted_mean(values: pd.Series, weights: pd.Series | None = None) -> float | None:
    frame = pd.DataFrame({"value": values})
    frame["weight"] = 1.0 if weights is None else weights
    frame = frame.dropna(subset=["value", "weight"])
    frame = frame[frame["weight"] > 0]
    if frame.empty:
        return None
    return round(float((frame["value"] * frame["weight"]).sum() / frame["weight"].sum()), 2)


def choose_weight_column(frame: pd.DataFrame) -> str | None:
    if "tax_households" in frame.columns and frame["tax_households"].notna().any():
        return "tax_households"
    if "population" in frame.columns and frame["population"].notna().any():
        return "population"
    return None


def derive_department_indicators_from_communes(commune_silver: pd.DataFrame, year: int) -> pd.DataFrame:
    if commune_silver.empty:
        return pd.DataFrame(
            columns=[
                "department_code",
                *DEPARTMENT_INDICATOR_COLUMNS,
                "poverty_rate",
                "tax_households",
                "population",
                "year",
                "is_derived_from_communes",
                "communes_count",
            ]
        )

    weight_column = choose_weight_column(commune_silver)
    records: list[dict[str, object]] = []
    for department_code, group in commune_silver.groupby("department_code"):
        weights = group[weight_column] if weight_column else None
        record: dict[str, object] = {
            "department_code": str(department_code),
            "year": year,
            "is_derived_from_communes": True,
            "communes_count": int(group["commune_code"].replace("", pd.NA).dropna().nunique()),
            "tax_households": float(group["tax_households"].sum()) if "tax_households" in group.columns and group["tax_households"].notna().any() else None,
            "population": float(group["population"].sum()) if "population" in group.columns and group["population"].notna().any() else None,
            "poverty_rate": weighted_mean(group["poverty_rate"], weights) if "poverty_rate" in group.columns and group["poverty_rate"].notna().any() else None,
        }
        for column in DEPARTMENT_INDICATOR_COLUMNS:
            record[column] = weighted_median(group[column], weights) if column in group.columns and group[column].notna().any() else None
        records.append(record)
    return pd.DataFrame(records)


def main() -> None:
    args = parse_args()
    input_path = silver_path(args.year)
    output_dir = gold_dir(args.year)
    commune_output = output_dir / "filosofi_commune_indicators.parquet"
    department_output = output_dir / "filosofi_department_indicators.parquet"
    summary_output = output_dir / "filosofi_summary.json"
    public_output = ROOT_DIR / "public" / "data" / "filosofi_summary.json"
    source = source_for_year(args.year)

    log(f"Preparing FiLoSoFi gold outputs for year {args.year}")
    if not input_path.exists():
        raise FileNotFoundError(f"Missing silver dataset: {input_path}")

    silver = pd.read_parquet(input_path)
    if "geography_level" not in silver.columns:
        silver["geography_level"] = "commune"

    commune_silver = silver[silver["geography_level"] == "commune"].copy()
    official_department_silver = silver[silver["geography_level"] == "department"].copy()

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
            "source_type",
            "source_generation",
            "dispositif",
            "source_file",
            "extracted_file",
        ]
        if column in silver.columns
    ]
    commune_indicators = commune_silver.loc[:, commune_columns].copy()

    if official_department_silver.empty:
        department_indicators = derive_department_indicators_from_communes(commune_silver, args.year)
        department_indicator_source = "derived_from_communes"
    else:
        department_columns = [
            column
            for column in [
                "department_code",
                *DEPARTMENT_INDICATOR_COLUMNS,
                "poverty_rate",
                "tax_households",
                "population",
                "year",
                "source_type",
                "source_generation",
                "dispositif",
                "source_file",
                "extracted_file",
            ]
            if column in official_department_silver.columns
        ]
        department_indicators = official_department_silver.loc[:, department_columns].copy()
        department_indicators["is_derived_from_communes"] = False
        department_indicator_source = "official"

    output_dir.mkdir(parents=True, exist_ok=True)
    commune_indicators.to_parquet(commune_output, index=False)
    department_indicators.to_parquet(department_output, index=False)

    weight_column = choose_weight_column(commune_silver)
    weights = commune_silver[weight_column] if weight_column else None
    national_median_income = (
        weighted_median(commune_silver["median_income"], weights)
        if "median_income" in commune_silver.columns and commune_silver["median_income"].notna().any()
        else None
    )

    median_income_by_department = {
        str(row["department_code"]): round(float(row["median_income"]), 2)
        if pd.notna(row["median_income"])
        else None
        for row in department_indicators.to_dict(orient="records")
        if str(row.get("department_code") or "")
    }

    department_deciles_by_department = {
        str(row["department_code"]): {
            key: round(float(row[key]), 2) if pd.notna(row[key]) else None
            for key in DEPARTMENT_INDICATOR_COLUMNS
            if key in row
        }
        for row in department_indicators.to_dict(orient="records")
        if str(row.get("department_code") or "")
    }

    decile_summary = None
    if {"d1_income", "d5_income", "d9_income"}.issubset(commune_silver.columns):
        decile_summary = {
            "d1_income": weighted_median(commune_silver["d1_income"], weights),
            "d5_income": weighted_median(commune_silver["d5_income"], weights),
            "d9_income": weighted_median(commune_silver["d9_income"], weights),
        }

    poverty_rate_summary = None
    if "poverty_rate" in commune_silver.columns and commune_silver["poverty_rate"].notna().any():
        poverty_rate_summary = {
            "mean": weighted_mean(commune_silver["poverty_rate"], weights),
            "median": weighted_median(commune_silver["poverty_rate"], weights),
        }

    summary = {
        "source": "INSEE FiLoSoFi",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "available_years": [args.year],
        "latest_year": args.year,
        "source_type": str(source.get("source_type") or ""),
        "dispositif": str(source.get("dispositif") or "filosofi"),
        "communes_covered": int(commune_silver["commune_code"].replace("", pd.NA).dropna().nunique()) if not commune_silver.empty else 0,
        "departments_covered": int(department_indicators["department_code"].replace("", pd.NA).dropna().nunique()) if not department_indicators.empty else 0,
        "department_indicator_source": department_indicator_source,
        "national_median_income": national_median_income,
        "median_income_by_department": dict(sorted(median_income_by_department.items())),
        "department_deciles_by_department": dict(sorted(department_deciles_by_department.items())),
        "decile_summary": decile_summary,
        "poverty_rate_summary": poverty_rate_summary,
        "notes": [
            "FiLoSoFi is annual data and should be joined to DVF using commune_code and year.",
            "Join keys: DVF commune_code + transaction year, FiLoSoFi commune_code + income year.",
            "For historical commune-only FiLoSoFi vintages, department indicators in gold are derived from commune rows.",
            "FiLoSoFi 2 uses a different normalized schema and should be compared carefully with the historical FiLoSoFi vintages.",
        ],
    }

    summary_output.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.publish_public:
        public_output.parent.mkdir(parents=True, exist_ok=True)
        public_output.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    log(f"Commune indicators parquet written to {commune_output}")
    log(f"Department indicators parquet written to {department_output}")
    log(f"FiLoSoFi summary written to {summary_output}")


if __name__ == "__main__":
    main()
