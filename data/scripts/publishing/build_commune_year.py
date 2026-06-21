from __future__ import annotations

from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[3]
DVF_GOLD_DIR = ROOT_DIR / "data" / "gold" / "dvf"
FILOSOFI_GOLD_DIR = ROOT_DIR / "data" / "gold" / "filosofi"
OUTPUT_DIR = ROOT_DIR / "data" / "gold" / "commune_year"
OUTPUT_PATH = OUTPUT_DIR / "commune_year.parquet"


def log(message: str) -> None:
    print(f"[build_commune_year] {message}")


def collect_year_files(base_dir: Path, filename: str) -> list[Path]:
    if not base_dir.exists():
        return []
    return sorted(base_dir.glob(f"year=*/{filename}"))


def load_dvf_communes() -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for path in collect_year_files(DVF_GOLD_DIR, "dvf_commune_indicators.parquet"):
        frame = pd.read_parquet(path)
        frames.append(frame)
    if not frames:
        return pd.DataFrame(
            columns=[
                "commune_code",
                "commune_name",
                "department_code",
                "year",
                "dvf_sales_count",
                "dvf_median_price_m2",
                "dvf_median_surface",
            ]
        )
    df = pd.concat(frames, ignore_index=True, sort=False)
    return df.rename(
        columns={
            "sales_count": "dvf_sales_count",
            "median_price_m2": "dvf_median_price_m2",
            "median_surface": "dvf_median_surface",
        }
    )


def load_filosofi_communes() -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for path in collect_year_files(FILOSOFI_GOLD_DIR, "filosofi_commune_indicators.parquet"):
        frame = pd.read_parquet(path)
        frames.append(frame)
    if not frames:
        return pd.DataFrame(
            columns=[
                "commune_code",
                "commune_name",
                "department_code",
                "year",
                "filosofi_median_income",
                "filosofi_d1_income",
                "filosofi_d5_income",
                "filosofi_d9_income",
                "filosofi_poverty_rate",
                "filosofi_tax_households",
                "filosofi_population",
            ]
        )
    df = pd.concat(frames, ignore_index=True, sort=False)
    return df.rename(
        columns={
            "median_income": "filosofi_median_income",
            "d1_income": "filosofi_d1_income",
            "d5_income": "filosofi_d5_income",
            "d9_income": "filosofi_d9_income",
            "poverty_rate": "filosofi_poverty_rate",
            "tax_households": "filosofi_tax_households",
            "population": "filosofi_population",
        }
    )


def main() -> None:
    log("Preparing commune-year dataset")
    dvf = load_dvf_communes()
    filosofi = load_filosofi_communes()

    merged = dvf.merge(
        filosofi,
        how="outer",
        on=["commune_code", "year"],
        suffixes=("_dvf", "_filosofi"),
    )

    if "commune_name_dvf" in merged.columns and "commune_name_filosofi" in merged.columns:
        merged["commune_name"] = merged["commune_name_dvf"].combine_first(merged["commune_name_filosofi"])
    elif "commune_name_dvf" in merged.columns:
        merged["commune_name"] = merged["commune_name_dvf"]
    elif "commune_name_filosofi" in merged.columns:
        merged["commune_name"] = merged["commune_name_filosofi"]

    if "department_code_dvf" in merged.columns and "department_code_filosofi" in merged.columns:
        merged["department_code"] = merged["department_code_dvf"].combine_first(merged["department_code_filosofi"])
    elif "department_code_dvf" in merged.columns:
        merged["department_code"] = merged["department_code_dvf"]
    elif "department_code_filosofi" in merged.columns:
        merged["department_code"] = merged["department_code_filosofi"]

    for column in ["commune_name_dvf", "commune_name_filosofi", "department_code_dvf", "department_code_filosofi"]:
        if column in merged.columns:
            merged = merged.drop(columns=column)

    if {"dvf_median_price_m2", "filosofi_median_income"}.issubset(merged.columns):
        merged["price_income_ratio"] = (
            merged["dvf_median_price_m2"] / merged["filosofi_median_income"]
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    merged.to_parquet(OUTPUT_PATH, index=False)
    log(f"Commune-year dataset written to {OUTPUT_PATH}")
    log(f"Rows written: {len(merged)}")


if __name__ == "__main__":
    main()
