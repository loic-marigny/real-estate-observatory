from __future__ import annotations

import re
import unicodedata
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[2]
INPUT_PARQUET_PATH = ROOT_DIR / "data" / "bronze" / "filosofi_bronze.parquet"
OUTPUT_PARQUET_PATH = ROOT_DIR / "data" / "silver" / "filosofi_silver.parquet"
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


def normalize_name(value: str) -> str:
    ascii_value = (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )
    ascii_value = re.sub(r"[^a-z0-9]+", "_", ascii_value)
    return ascii_value.strip("_")


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
    )
    normalized = normalized.replace("", pd.NA)
    return pd.to_numeric(normalized, errors="coerce")


def detect_columns(frame: pd.DataFrame) -> dict[str, str | None]:
    columns = frame.columns.tolist()
    detected = {
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
        "tax_households": select_best_column(columns, [r"^tax_households$", r"^nbmenfisc\d*$", r"menages_fiscaux"]),
        "population": select_best_column(columns, [r"^population$", r"^nbpersmenfisc\d*$", r"population"]),
        "year": select_best_column(columns, [r"^year$"]),
    }
    return detected


def build_empty_numeric_column(length: int) -> pd.Series:
    return pd.Series([float("nan")] * length, dtype="float64")


def standardize_subset(frame: pd.DataFrame, geography_level: str) -> pd.DataFrame:
    detected = detect_columns(frame)
    silver = frame.copy()

    if geography_level == "commune":
        if detected["commune_code"] is None:
            available_columns = ", ".join(frame.columns.tolist())
            raise RuntimeError(
                "Unable to detect commune_code in commune-level FiLoSoFi data. "
                f"Available columns: {available_columns}"
            )
        silver["commune_code"] = (
            silver[detected["commune_code"]]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.upper()
        )
    else:
        silver["commune_code"] = ""

    commune_name_column = detected["commune_name"]
    if commune_name_column is not None:
        silver["commune_name"] = silver[commune_name_column].fillna("").astype(str).str.strip()
    else:
        silver["commune_name"] = ""
        if geography_level == "commune":
            log("Warning: commune_name column not detected; continuing with empty values")

    department_code_column = detected["department_code"]
    if department_code_column is not None:
        silver["department_code"] = (
            silver[department_code_column].fillna("").astype(str).str.strip().str.upper()
        )
    elif geography_level == "department":
        if detected["commune_code"] is None:
            available_columns = ", ".join(frame.columns.tolist())
            raise RuntimeError(
                "Unable to detect department code in department-level FiLoSoFi data. "
                f"Available columns: {available_columns}"
            )
        silver["department_code"] = (
            silver[detected["commune_code"]]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.upper()
        )
    else:
        silver["department_code"] = ""

    for column in NUMERIC_COLUMNS:
        source_column = detected.get(column)
        if source_column is not None:
            silver[column] = to_numeric(silver[source_column])
        else:
            silver[column] = build_empty_numeric_column(len(silver))

    year_column = detected["year"]
    if year_column is not None:
        silver["year"] = to_numeric(silver[year_column]).astype("Int64")
    else:
        silver["year"] = to_numeric(silver["year"]).astype("Int64")

    if silver["d5_income"].isna().all() and not silver["median_income"].isna().all():
        silver["d5_income"] = silver["median_income"]

    if silver["median_income"].isna().all():
        if silver[["d1_income", "d5_income", "d9_income"]].notna().any(axis=None):
            log(
                f"Warning: median_income missing for {geography_level}-level data; "
                "continuing because decile data is available"
            )
        else:
            log(
                f"Warning: median_income missing for {geography_level}-level data "
                "and no decile income columns detected"
            )

    if geography_level == "commune":
        silver = silver[silver["commune_code"].ne("")].copy()
        missing_department_mask = silver["department_code"].eq("")
        if missing_department_mask.any():
            silver.loc[missing_department_mask, "department_code"] = silver.loc[
                missing_department_mask, "commune_code"
            ].map(derive_department_code)
    elif geography_level == "department":
        silver = silver[silver["department_code"].ne("")].copy()

    return silver


def main() -> None:
    log("Preparing FiLoSoFi silver dataset")
    if not INPUT_PARQUET_PATH.exists():
        raise FileNotFoundError(
            f"Missing bronze dataset: {INPUT_PARQUET_PATH}. "
            "Run data/scripts/build_filosofi_bronze.py first."
        )

    bronze = pd.read_parquet(INPUT_PARQUET_PATH)
    bronze = rename_columns(bronze)
    if "geography_level" not in bronze.columns:
        bronze["geography_level"] = "commune"

    frames: list[pd.DataFrame] = []
    for geography_level in ("commune", "department"):
        subset = bronze[bronze["geography_level"] == geography_level].copy()
        if subset.empty:
            continue
        log(f"Standardizing {geography_level}-level FiLoSoFi data")
        frames.append(standardize_subset(subset, geography_level))

    if not frames:
        raise RuntimeError("No commune-level or department-level FiLoSoFi data found in bronze dataset")

    silver = pd.concat(frames, ignore_index=True, sort=False)

    output_columns = [
        *bronze.columns.tolist(),
        *[column for column in STANDARD_COLUMNS if column not in bronze.columns],
    ]
    silver = silver.loc[:, dict.fromkeys(output_columns).keys()].copy()

    OUTPUT_PARQUET_PATH.parent.mkdir(parents=True, exist_ok=True)
    silver.to_parquet(OUTPUT_PARQUET_PATH, index=False)

    available_indicators = [
        column
        for column in STANDARD_COLUMNS
        if column in silver.columns and column not in {"commune_code", "commune_name", "department_code", "year"}
        and silver[column].notna().any()
    ]
    years = sorted(
        {
            int(year)
            for year in silver["year"].dropna().tolist()
        }
    )
    log(f"Silver dataset written to {OUTPUT_PARQUET_PATH}")
    log(f"Rows: {len(silver)}")
    log(f"Years: {years}")
    log(f"Communes: {silver.loc[silver['geography_level'] == 'commune', 'commune_code'].nunique()}")
    log(f"Departments: {silver.loc[silver['geography_level'] == 'department', 'department_code'].nunique()}")
    log(f"Available standardized indicators: {', '.join(available_indicators)}")


if __name__ == "__main__":
    main()
