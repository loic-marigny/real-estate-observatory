from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[3]
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
FILOSOFI2_MEASURE_MAP = {
    "MED_SL": "median_income",
    "D1_SL": "d1_income",
    "D2_SL": "d2_income",
    "D3_SL": "d3_income",
    "D4_SL": "d4_income",
    "D6_SL": "d6_income",
    "D7_SL": "d7_income",
    "D8_SL": "d8_income",
    "D9_SL": "d9_income",
    "PR_MD60": "poverty_rate",
}


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


def source_for_year(year: int) -> dict[str, object]:
    payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    sources = payload.get("sources", {})
    if not isinstance(sources, dict):
        raise RuntimeError("Invalid FiLoSoFi source configuration")
    source = sources.get(str(year))
    if not isinstance(source, dict):
        raise RuntimeError(f"FiLoSoFi year {year} is not configured")
    return source


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
        .replace({"": pd.NA, "s": pd.NA, "S": pd.NA})
    )
    return pd.to_numeric(normalized, errors="coerce")


def detect_columns(frame: pd.DataFrame) -> dict[str, str | None]:
    columns = frame.columns.tolist()
    return {
        "commune_code": select_best_column(columns, [r"^commune_code$", r"^code_commune$", r"^codgeo$", r"^code_geo$", r"^geo$"]),
        "commune_name": select_best_column(columns, [r"^commune_name$", r"^nom_commune$", r"^libgeo$", r"^libelle_commune$", r"^commune$"]),
        "department_code": select_best_column(columns, [r"^department_code$", r"^code_departement$", r"^dep$", r"^coddep$"]),
        "median_income": select_best_column(columns, [r"^median_income$", r"^med\d*$", r"^q2\d*$", r"mediane", r"^med_sl$"]),
        "d1_income": select_best_column(columns, [r"^d1_income$", r"^d1\d*$", r"^d1_sl$"]),
        "d2_income": select_best_column(columns, [r"^d2_income$", r"^d2\d*$", r"^d2_sl$"]),
        "d3_income": select_best_column(columns, [r"^d3_income$", r"^d3\d*$", r"^d3_sl$"]),
        "d4_income": select_best_column(columns, [r"^d4_income$", r"^d4\d*$", r"^d4_sl$"]),
        "d5_income": select_best_column(columns, [r"^d5_income$", r"^d5\d*$"]),
        "d6_income": select_best_column(columns, [r"^d6_income$", r"^d6\d*$", r"^d6_sl$"]),
        "d7_income": select_best_column(columns, [r"^d7_income$", r"^d7\d*$", r"^d7_sl$"]),
        "d8_income": select_best_column(columns, [r"^d8_income$", r"^d8\d*$", r"^d8_sl$"]),
        "d9_income": select_best_column(columns, [r"^d9_income$", r"^d9\d*$", r"^d9_sl$"]),
        "poverty_rate": select_best_column(columns, [r"^poverty_rate$", r"^tp60\d*$", r"pauvrete", r"^pr_md60$"]),
        "tax_households": select_best_column(columns, [r"^tax_households$", r"^nbmenfisc\d*$", r"^nbmen\d*$"]),
        "population": select_best_column(columns, [r"^population$", r"^nbpersmenfisc\d*$", r"^nbpers\d*$"]),
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


def finalize_silver_columns(frame: pd.DataFrame) -> pd.DataFrame:
    for column in STANDARD_COLUMNS:
        if column not in frame.columns:
            frame[column] = "" if column in {"commune_code", "commune_name", "department_code"} else pd.NA
    for column in NUMERIC_COLUMNS:
        frame[column] = to_numeric(frame[column]) if column in frame.columns else pd.Series(dtype="float64")
    return frame


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
        silver[column] = (
            to_numeric(silver[source_column])
            if source_column is not None
            else pd.Series([float("nan")] * len(silver), dtype="float64")
        )

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

    silver["geography_level"] = geography_level
    output_columns = [*frame.columns.tolist(), *[column for column in STANDARD_COLUMNS if column not in frame.columns], "geography_level"]
    return silver.loc[:, dict.fromkeys(output_columns).keys()].copy()


def build_legacy_silver(bronze: pd.DataFrame, year: int) -> pd.DataFrame:
    bronze = rename_columns(bronze)
    if "geography_level" not in bronze.columns:
        bronze["geography_level"] = "commune"

    frames: list[pd.DataFrame] = []
    for geography_level in ("commune", "department"):
        subset = bronze[bronze["geography_level"] == geography_level].copy()
        if subset.empty:
            continue
        frames.append(standardize_subset(subset, geography_level, year))

    unknown_subset = bronze[~bronze["geography_level"].isin(["commune", "department"])].copy()
    if not unknown_subset.empty:
        inferred_level = infer_geography_level_from_frame(unknown_subset)
        if inferred_level is not None:
            log(f"Inferred geography level '{inferred_level}' from bronze columns for year {year}")
            frames.append(standardize_subset(unknown_subset, inferred_level, year))

    if not frames:
        raise RuntimeError("No commune-level or department-level FiLoSoFi data found in bronze dataset")
    return pd.concat(frames, ignore_index=True, sort=False)


def build_historical_silver(bronze: pd.DataFrame, year: int) -> pd.DataFrame:
    bronze = rename_columns(bronze)
    if "table_id" not in bronze.columns:
        raise RuntimeError("Historical FiLoSoFi bronze dataset is missing table_id")

    disp = bronze[bronze["table_id"] == "disp_com"].copy()
    if disp.empty:
        raise RuntimeError("Historical FiLoSoFi bronze dataset is missing DISP_COM rows")

    commune = standardize_subset(disp, "commune", year)
    commune["source_generation"] = "historical"
    commune["dispositif"] = "filosofi"

    pauvres = bronze[bronze["table_id"] == "disp_pauvres_com"].copy()
    if not pauvres.empty:
        detected = detect_columns(pauvres)
        code_column = detected["commune_code"]
        poverty_column = detected["poverty_rate"]
        if code_column is not None and poverty_column is not None:
            poverty = pd.DataFrame(
                {
                    "commune_code": pauvres[code_column].fillna("").astype(str).str.strip().str.upper(),
                    "poverty_rate_from_pauvres": to_numeric(pauvres[poverty_column]),
                }
            )
            poverty = poverty[poverty["commune_code"].ne("")].drop_duplicates(subset=["commune_code"])
            commune = commune.merge(poverty, on="commune_code", how="left")
            if "poverty_rate" not in commune.columns:
                commune["poverty_rate"] = pd.NA
            commune["poverty_rate"] = commune["poverty_rate"].combine_first(commune["poverty_rate_from_pauvres"])
            commune = commune.drop(columns=["poverty_rate_from_pauvres"])

    return commune


def build_filosofi2_silver(bronze: pd.DataFrame, year: int) -> pd.DataFrame:
    bronze = rename_columns(bronze)
    required_columns = {"filosofi_measure", "geo", "geo_object", "time_period", "obs_value"}
    missing = required_columns.difference(bronze.columns)
    if missing:
        raise RuntimeError(f"FiLoSoFi 2 bronze dataset is missing required columns: {', '.join(sorted(missing))}")

    filtered = bronze[bronze["geo_object"].isin(["COM", "DEP"])].copy()
    if filtered.empty:
        raise RuntimeError("FiLoSoFi 2 bronze dataset does not contain COM or DEP rows")

    pivot = (
        filtered.pivot_table(
            index=["geo", "geo_object", "time_period"],
            columns="filosofi_measure",
            values="obs_value",
            aggfunc="first",
        )
        .reset_index()
        .rename_axis(None, axis=1)
    )

    silver = pd.DataFrame()
    silver["year"] = pd.to_numeric(pivot["time_period"], errors="coerce").fillna(year).astype(int)
    silver["geography_level"] = pivot["geo_object"].map({"COM": "commune", "DEP": "department"}).fillna("unknown")
    silver["commune_code"] = pivot["geo"].where(silver["geography_level"] == "commune", "")
    silver["department_code"] = pivot["geo"].where(silver["geography_level"] == "department", "")
    missing_department = silver["department_code"].eq("") & silver["commune_code"].ne("")
    if missing_department.any():
        silver.loc[missing_department, "department_code"] = silver.loc[missing_department, "commune_code"].map(derive_department_code)
    silver["commune_name"] = ""
    silver["source_generation"] = "filosofi2"
    silver["dispositif"] = "filosofi2"
    silver["source_type"] = "insee_filosofi2_multigeography"
    silver["source_file"] = str(bronze["source_file"].iloc[0]) if "source_file" in bronze.columns and not bronze.empty else ""
    silver["extracted_file"] = str(bronze["extracted_file"].iloc[0]) if "extracted_file" in bronze.columns and not bronze.empty else ""
    silver["geo_object"] = pivot["geo_object"]

    for measure, target_column in FILOSOFI2_MEASURE_MAP.items():
        silver[target_column] = to_numeric(pivot[measure]) if measure in pivot.columns else pd.Series([float("nan")] * len(pivot), dtype="float64")

    silver["d5_income"] = silver["median_income"]
    silver["tax_households"] = pd.Series([float("nan")] * len(silver), dtype="float64")
    silver["population"] = pd.Series([float("nan")] * len(silver), dtype="float64")
    return silver


def main() -> None:
    args = parse_args()
    bronze_path = input_path(args.year)
    silver_path = output_path(args.year)
    source = source_for_year(args.year)
    source_type = str(source.get("source_type") or "data_gouv")
    log(f"Preparing FiLoSoFi silver dataset for year {args.year}")

    if not bronze_path.exists():
        raise FileNotFoundError(f"Missing bronze dataset: {bronze_path}")

    bronze = pd.read_parquet(bronze_path)
    if source_type == "insee_xlsx_zip":
        silver = build_historical_silver(bronze, args.year)
    elif source_type == "insee_filosofi2_multigeography":
        silver = build_filosofi2_silver(bronze, args.year)
    else:
        silver = build_legacy_silver(bronze, args.year)

    silver = finalize_silver_columns(silver)
    silver_path.parent.mkdir(parents=True, exist_ok=True)
    silver.to_parquet(silver_path, index=False)
    log(f"Silver dataset written to {silver_path}")
    log(f"Rows: {len(silver)}")
    log(f"Years: {sorted(pd.to_numeric(silver['year'], errors='coerce').dropna().astype(int).unique().tolist())}")
    log(f"Communes: {int(silver['commune_code'].replace('', pd.NA).dropna().nunique()) if 'commune_code' in silver.columns else 0}")
    log(f"Departments: {int(silver['department_code'].replace('', pd.NA).dropna().nunique()) if 'department_code' in silver.columns else 0}")


if __name__ == "__main__":
    main()
