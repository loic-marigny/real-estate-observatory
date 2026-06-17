from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT_DIR / "config" / "filosofi_sources.json"
STANDARD_COLUMNS = [
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
]
NUMERIC_COLUMNS = [
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
]


def log(message: str) -> None:
    print(f"[build_filosofi_silver] {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the FiLoSoFi silver dataset for one year.")
    parser.add_argument("--year", type=int, required=True)
    return parser.parse_args()


def input_path(year: int) -> Path:
    return ROOT_DIR / "data" / "bronze" / "filosofi" / f"year={year}" / "filosofi_bronze.parquet"


def output_path(year: int) -> Path:
    return ROOT_DIR / "data" / "silver" / "filosofi" / f"year={year}" / "filosofi_silver.parquet"


def pipeline_mode_for_year(year: int) -> str:
    payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    sources = payload.get("sources", {})
    if not isinstance(sources, dict):
        return "full_pipeline"
    source = sources.get(str(year), {})
    if not isinstance(source, dict):
        return "full_pipeline"
    return str(source.get("pipeline_mode", "full_pipeline"))


def normalize_name(value: str) -> str:
    ascii_value = (
        unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    )
    return re.sub(r"[^a-z0-9]+", "_", ascii_value).strip("_")


def rename_columns(frame: pd.DataFrame) -> pd.DataFrame:
    renamed = frame.copy()
    renamed.columns = [normalize_name(str(column)) for column in renamed.columns]
    return renamed


def select_best_column(columns: list[str], patterns: list[str]) -> str | None:
    normalized_patterns = [pattern.lower() for pattern in patterns]
    for column in columns:
        if column in normalized_patterns:
            return column
    for pattern in normalized_patterns:
        regex = re.compile(pattern)
        for column in columns:
            if regex.search(column):
                return column
    return None


def derive_department_code(commune_code: str) -> str | None:
    normalized = commune_code.strip().upper()
    if not normalized:
        return None
    if normalized.startswith(("97", "98")) and len(normalized) >= 3:
        return normalized[:3]
    return normalized[:2]


def to_numeric(series: pd.Series) -> pd.Series:
    normalized = (
        series.fillna("")
        .astype(str)
        .str.strip()
        .str.replace("\xa0", "", regex=False)
        .str.replace(" ", "", regex=False)
        .str.replace(",", ".", regex=False)
        .replace("", pd.NA)
    )
    return pd.to_numeric(normalized, errors="coerce")


def detect_columns(frame: pd.DataFrame) -> dict[str, str | None]:
    columns = frame.columns.tolist()
    return {
        "commune_code": select_best_column(columns, [r"^commune_code$", r"^code_commune$", r"^codgeo$", r"^code_geo$"]),
        "commune_name": select_best_column(columns, [r"^commune_name$", r"^nom_commune$", r"^libgeo$", r"^libelle_commune$", r"^commune$"]),
        "department_code": select_best_column(columns, [r"^department_code$", r"^code_departement$", r"^dep$", r"^coddep$"]),
        "median_income": select_best_column(columns, [r"^median_income$", r"^med\d*$", r"mediane"]),
        "d1_income": select_best_column(columns, [r"^d1_income$", r"^d1\d*$"]),
        "d2_income": select_best_column(columns, [r"^d2_income$", r"^d2\d*$"]),
        "d3_income": select_best_column(columns, [r"^d3_income$", r"^d3\d*$"]),
        "d4_income": select_best_column(columns, [r"^d4_income$", r"^d4\d*$"]),
        "d5_income": select_best_column(columns, [r"^d5_income$", r"^d5\d*$"]),
        "d6_income": select_best_column(columns, [r"^d6_income$", r"^d6\d*$"]),
        "d7_income": select_best_column(columns, [r"^d7_income$", r"^d7\d*$"]),
        "d8_income": select_best_column(columns, [r"^d8_income$", r"^d8\d*$"]),
        "d9_income": select_best_column(columns, [r"^d9_income$", r"^d9\d*$"]),
        "poverty_rate": select_best_column(columns, [r"^poverty_rate$", r"^tp60\d*$", r"pauvrete"]),
        "tax_households": select_best_column(columns, [r"^tax_households$", r"^nbmenfisc\d*$"]),
        "population": select_best_column(columns, [r"^population$", r"^nbpersmenfisc\d*$"]),
        "year": select_best_column(columns, [r"^year$"]),
    }


def infer_geography_level_from_frame(frame: pd.DataFrame) -> str | None:
    detected = detect_columns(frame)
    commune_col = detected["commune_code"]
    department_col = detected["department_code"]

    if commune_col is not None:
        commune_values = (
            frame[commune_col]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.upper()
        )
        commune_values = commune_values[commune_values.ne("")]
        if not commune_values.empty:
            if commune_values.str.len().ge(5).any() or commune_values.str.match(r"^(97|98)\d{2,}$").any():
                return "commune"
            if commune_values.str.len().le(3).all():
                return "department"

    if department_col is not None:
        department_values = (
            frame[department_col]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.upper()
        )
        department_values = department_values[department_values.ne("")]
        if not department_values.empty:
            return "department"

    return None


def standardize_subset(frame: pd.DataFrame, geography_level: str, year: int) -> pd.DataFrame:
    detected = detect_columns(frame)
    silver = frame.copy()

    if geography_level == "commune":
        commune_col = detected["commune_code"]
        if commune_col is None:
            raise RuntimeError(f"Unable to detect commune_code. Available columns: {', '.join(frame.columns.tolist())}")
        silver["commune_code"] = silver[commune_col].fillna("").astype(str).str.strip().str.upper()
    else:
        silver["commune_code"] = ""

    commune_name_col = detected["commune_name"]
    silver["commune_name"] = (
        silver[commune_name_col].fillna("").astype(str).str.strip()
        if commune_name_col is not None
        else ""
    )

    department_code_col = detected["department_code"]
    if department_code_col is not None:
        silver["department_code"] = silver[department_code_col].fillna("").astype(str).str.strip().str.upper()
    elif geography_level == "department" and detected["commune_code"] is not None:
        silver["department_code"] = silver[detected["commune_code"]].fillna("").astype(str).str.strip().str.upper()
    else:
        silver["department_code"] = ""

    for column in NUMERIC_COLUMNS:
        source_column = detected.get(column)
        silver[column] = to_numeric(silver[source_column]) if source_column is not None else pd.Series([float("nan")] * len(silver), dtype="float64")

    silver["year"] = year
    if silver["d5_income"].isna().all() and not silver["median_income"].isna().all():
        silver["d5_income"] = silver["median_income"]

    if geography_level == "commune":
        silver = silver[silver["commune_code"].ne("")].copy()
        missing_department = silver["department_code"].eq("")
        if missing_department.any():
            silver.loc[missing_department, "department_code"] = silver.loc[missing_department, "commune_code"].map(derive_department_code)
    else:
        silver = silver[silver["department_code"].ne("")].copy()

    output_columns = [*frame.columns.tolist(), *[column for column in STANDARD_COLUMNS if column not in frame.columns]]
    return silver.loc[:, dict.fromkeys(output_columns).keys()].copy()


def main() -> None:
    args = parse_args()
    if pipeline_mode_for_year(args.year) == "bronze_only":
        log(f"Year {args.year} is configured as bronze-only. Skipping silver build.")
        return
    bronze_path = input_path(args.year)
    silver_path = output_path(args.year)
    log(f"Preparing FiLoSoFi silver dataset for year {args.year}")

    if not bronze_path.exists():
        raise FileNotFoundError(f"Missing bronze dataset: {bronze_path}")

    bronze = rename_columns(pd.read_parquet(bronze_path))
    if "geography_level" not in bronze.columns:
        bronze["geography_level"] = "commune"

    frames: list[pd.DataFrame] = []
    for geography_level in ("commune", "department"):
        subset = bronze[bronze["geography_level"] == geography_level].copy()
        if subset.empty:
            continue
        frames.append(standardize_subset(subset, geography_level, args.year))

    unknown_subset = bronze[~bronze["geography_level"].isin(["commune", "department"])].copy()
    if not unknown_subset.empty:
        inferred_level = infer_geography_level_from_frame(unknown_subset)
        if inferred_level is not None:
            log(f"Inferred geography level '{inferred_level}' from bronze columns for year {args.year}")
            frames.append(standardize_subset(unknown_subset, inferred_level, args.year))

    if not frames:
        raise RuntimeError("No commune-level or department-level FiLoSoFi data found in bronze dataset")

    silver = pd.concat(frames, ignore_index=True, sort=False)
    silver_path.parent.mkdir(parents=True, exist_ok=True)
    silver.to_parquet(silver_path, index=False)
    log(f"Silver dataset written to {silver_path}")
    log(f"Rows: {len(silver)}")


if __name__ == "__main__":
    main()
