from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[2]
INPUT_PARQUET_PATH = ROOT_DIR / "data" / "silver" / "dvf_silver.parquet"
GOLD_DIR = ROOT_DIR / "data" / "gold"
OUTPUT_NATIONAL_PARQUET_PATH = GOLD_DIR / "dvf_national.parquet"
OUTPUT_DEPARTMENT_PARQUET_PATH = GOLD_DIR / "dvf_by_department.parquet"
OUTPUT_PROPERTY_TYPE_PARQUET_PATH = GOLD_DIR / "dvf_by_property_type.parquet"
OUTPUT_JSON_PATH = ROOT_DIR / "public" / "data" / "dvf_summary.json"

PROPERTY_TYPES = ["Appartement", "Maison"]
FILTERS = {
    "nature_mutation": "Vente",
    "property_types": PROPERTY_TYPES,
    "outliers": {
        "price_m2_min": 300,
        "price_m2_max": 50_000,
        "surface_min": 9,
        "surface_max": 1_000,
    },
}


def log(message: str) -> None:
    print(f"[build_gold] {message}")


def compute_median(series: pd.Series) -> float | None:
    cleaned = series.dropna()
    if cleaned.empty:
        return None

    return round(float(cleaned.median()), 2)


def main() -> None:
    log("Preparing gold DVF outputs")

    if not INPUT_PARQUET_PATH.exists():
        raise FileNotFoundError(
            f"Missing silver dataset: {INPUT_PARQUET_PATH}. "
            "Run data/scripts/build_silver.py first."
        )

    GOLD_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)

    columns = ["code_departement", "type_local", "surface_reelle_bati", "price_m2"]
    df = pd.read_parquet(INPUT_PARQUET_PATH, columns=columns)

    national_row = pd.DataFrame(
        [
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "source_file": str(INPUT_PARQUET_PATH.relative_to(ROOT_DIR)).replace("\\", "/"),
                "total_sales_count": int(len(df)),
                "median_price_m2": compute_median(df["price_m2"]),
                "median_surface": compute_median(df["surface_reelle_bati"]),
            }
        ]
    )

    by_department = (
        df.groupby("code_departement", dropna=False)
        .agg(
            sales_count=("code_departement", "size"),
            median_price_m2=("price_m2", "median"),
        )
        .reset_index()
        .rename(columns={"code_departement": "department_code"})
        .sort_values("department_code")
    )
    by_department["sales_count"] = by_department["sales_count"].astype(int)
    by_department["median_price_m2"] = by_department["median_price_m2"].round(2)

    by_property_type = (
        df.groupby("type_local", dropna=False)
        .agg(median_price_m2=("price_m2", "median"))
        .reset_index()
        .rename(columns={"type_local": "property_type"})
        .sort_values("property_type")
    )
    by_property_type["median_price_m2"] = by_property_type["median_price_m2"].round(2)

    national_row.to_parquet(OUTPUT_NATIONAL_PARQUET_PATH, index=False)
    by_department.to_parquet(OUTPUT_DEPARTMENT_PARQUET_PATH, index=False)
    by_property_type.to_parquet(OUTPUT_PROPERTY_TYPE_PARQUET_PATH, index=False)

    sales_count_by_department = {
        row["department_code"]: int(row["sales_count"])
        for row in by_department.to_dict(orient="records")
    }
    median_price_m2_by_department = {
        row["department_code"]: round(float(row["median_price_m2"]), 2)
        if pd.notna(row["median_price_m2"])
        else None
        for row in by_department.to_dict(orient="records")
    }
    median_price_m2_by_property_type = {
        row["property_type"]: round(float(row["median_price_m2"]), 2)
        if pd.notna(row["median_price_m2"])
        else None
        for row in by_property_type.to_dict(orient="records")
    }
    departments = [
        {
            "department_code": row["department_code"],
            "sales_count": int(row["sales_count"]),
            "median_price_m2": round(float(row["median_price_m2"]), 2)
            if pd.notna(row["median_price_m2"])
            else None,
        }
        for row in by_department.to_dict(orient="records")
    ]

    summary = {
        "generated_at": national_row.at[0, "generated_at"],
        "source_file": national_row.at[0, "source_file"],
        "filters": FILTERS,
        "total_sales_count": int(national_row.at[0, "total_sales_count"]),
        "median_price_m2": national_row.at[0, "median_price_m2"],
        "median_surface": national_row.at[0, "median_surface"],
        "sales_count_by_department": sales_count_by_department,
        "median_price_m2_by_department": median_price_m2_by_department,
        "median_price_m2_by_property_type": median_price_m2_by_property_type,
        "departments": departments,
    }

    with OUTPUT_JSON_PATH.open("w", encoding="utf-8") as output_file:
        json.dump(summary, output_file, ensure_ascii=False, indent=2)
        output_file.write("\n")

    log(f"Gold national parquet written to {OUTPUT_NATIONAL_PARQUET_PATH}")
    log(f"Gold department parquet written to {OUTPUT_DEPARTMENT_PARQUET_PATH}")
    log(f"Gold property-type parquet written to {OUTPUT_PROPERTY_TYPE_PARQUET_PATH}")
    log(f"Frontend summary written to {OUTPUT_JSON_PATH}")
    log(f"Departments covered: {len(departments)}")


if __name__ == "__main__":
    main()
