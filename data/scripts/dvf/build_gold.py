from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from scripts.shared.pipeline_config import load_pipeline_config


ROOT_DIR = Path(__file__).resolve().parents[3]

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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the DVF gold dataset for one year.")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--publish-public", action="store_true")
    return parser.parse_args()


def silver_path(year: int) -> Path:
    return ROOT_DIR / "data" / "silver" / "dvf" / f"year={year}" / "dvf_silver.parquet"


def gold_dir(year: int) -> Path:
    return ROOT_DIR / "data" / "gold" / "dvf" / f"year={year}"


def public_summary_path() -> Path:
    return ROOT_DIR / "public" / "data" / "dvf_summary.json"


def configured_dvf_years() -> list[int]:
    return load_pipeline_config().get("dvf_years", [])


def compute_median(series: pd.Series) -> float | None:
    cleaned = series.dropna()
    if cleaned.empty:
        return None
    return round(float(cleaned.median()), 2)


def compute_quantile(series: pd.Series, quantile: float) -> float | None:
    cleaned = series.dropna()
    if cleaned.empty:
        return None
    return round(float(cleaned.quantile(quantile)), 2)


def build_national_row(
    df: pd.DataFrame,
    year: int,
    generated_at: str,
    source_file: str,
) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "year": year,
                "generated_at": generated_at,
                "source_file": source_file,
                "total_sales_count": int(len(df)),
                "median_price_m2": compute_median(df["price_m2"]),
                "d1_price_m2": compute_quantile(df["price_m2"], 0.1),
                "d9_price_m2": compute_quantile(df["price_m2"], 0.9),
                "median_surface": compute_median(df["surface_reelle_bati"]),
            }
        ]
    )


def main() -> None:
    args = parse_args()
    input_path = silver_path(args.year)
    output_dir = gold_dir(args.year)
    output_national = output_dir / "dvf_national.parquet"
    output_department = output_dir / "dvf_by_department.parquet"
    output_property_type = output_dir / "dvf_by_property_type.parquet"
    output_commune = output_dir / "dvf_commune_indicators.parquet"
    output_summary = output_dir / "dvf_summary.json"

    log(f"Preparing gold DVF outputs for year {args.year}")
    if not input_path.exists():
        raise FileNotFoundError(f"Missing silver dataset: {input_path}. Run python -m data.scripts.dvf.build_silver first.")

    output_dir.mkdir(parents=True, exist_ok=True)

    columns = [
        "code_departement",
        "code_commune",
        "nom_commune",
        "type_local",
        "surface_reelle_bati",
        "price_m2",
        "year",
    ]
    df = pd.read_parquet(input_path, columns=columns)

    generated_at = datetime.now(timezone.utc).isoformat()
    source_file = str(input_path.relative_to(ROOT_DIR)).replace("\\", "/")
    national_row = build_national_row(
        df,
        args.year,
        generated_at,
        source_file,
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
    by_department["year"] = args.year
    by_department["sales_count"] = by_department["sales_count"].astype(int)
    by_department["median_price_m2"] = by_department["median_price_m2"].round(2)

    by_property_type = (
        df.groupby("type_local", dropna=False)
        .agg(median_price_m2=("price_m2", "median"))
        .reset_index()
        .rename(columns={"type_local": "property_type"})
        .sort_values("property_type")
    )
    by_property_type["year"] = args.year
    by_property_type["median_price_m2"] = by_property_type["median_price_m2"].round(2)

    by_commune = (
        df.groupby(["code_commune", "nom_commune", "code_departement"], dropna=False)
        .agg(
            sales_count=("code_commune", "size"),
            median_price_m2=("price_m2", "median"),
            median_surface=("surface_reelle_bati", "median"),
        )
        .reset_index()
        .rename(
            columns={
                "code_commune": "commune_code",
                "nom_commune": "commune_name",
                "code_departement": "department_code",
            }
        )
    )
    by_commune["year"] = args.year
    by_commune["sales_count"] = by_commune["sales_count"].astype(int)
    by_commune["median_price_m2"] = by_commune["median_price_m2"].round(2)
    by_commune["median_surface"] = by_commune["median_surface"].round(2)

    national_row.to_parquet(output_national, index=False)
    by_department.to_parquet(output_department, index=False)
    by_property_type.to_parquet(output_property_type, index=False)
    by_commune.to_parquet(output_commune, index=False)

    summary = {
        "year": args.year,
        "available_years": configured_dvf_years(),
        "generated_at": generated_at,
        "source_file": source_file,
        "filters": FILTERS,
        "total_sales_count": int(national_row.at[0, "total_sales_count"]),
        "median_price_m2": national_row.at[0, "median_price_m2"],
        "d1_price_m2": national_row.at[0, "d1_price_m2"],
        "d9_price_m2": national_row.at[0, "d9_price_m2"],
        "median_surface": national_row.at[0, "median_surface"],
        "sales_count_by_department": {
            row["department_code"]: int(row["sales_count"])
            for row in by_department.to_dict(orient="records")
        },
        "median_price_m2_by_department": {
            row["department_code"]: round(float(row["median_price_m2"]), 2)
            if pd.notna(row["median_price_m2"])
            else None
            for row in by_department.to_dict(orient="records")
        },
        "median_price_m2_by_property_type": {
            row["property_type"]: round(float(row["median_price_m2"]), 2)
            if pd.notna(row["median_price_m2"])
            else None
            for row in by_property_type.to_dict(orient="records")
        },
        "departments": [
            {
                "department_code": row["department_code"],
                "year": args.year,
                "sales_count": int(row["sales_count"]),
                "median_price_m2": round(float(row["median_price_m2"]), 2)
                if pd.notna(row["median_price_m2"])
                else None,
            }
            for row in by_department.to_dict(orient="records")
        ],
    }

    output_summary.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.publish_public:
        public_path = public_summary_path()
        public_path.parent.mkdir(parents=True, exist_ok=True)
        public_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    log(f"Gold directory written to {output_dir}")
    log(f"Departments covered: {len(summary['departments'])}")


if __name__ == "__main__":
    main()
