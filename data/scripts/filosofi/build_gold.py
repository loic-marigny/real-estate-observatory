from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from scripts.shared.pipeline_config import load_filosofi_catalog

FILOSOFI_CONFIG_PATH = ROOT_DIR / "config" / "filosofi_sources.json"
CANONICAL_MAPPING_PATH = ROOT_DIR / "config" / "filosofi_canonical_columns.json"
REPORTS_DIR = ROOT_DIR / "reports"
GOLD_ROOT = ROOT_DIR / "data" / "gold" / "filosofi"
PUBLIC_SUMMARY_PATH = ROOT_DIR / "public" / "data" / "filosofi_summary.json"

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
CANONICAL_COLUMNS = [
    "geography_code",
    "geography_name",
    "geography_level",
    "year",
    "dispositif",
    "source_generation",
    "indicator_source",
    "is_official",
    "methodology_version",
    "comparable_with_previous_years",
    *NUMERIC_COLUMNS,
]
SECONDARY_DECILE_COLUMNS = {"d2_income", "d3_income", "d4_income", "d5_income", "d6_income", "d7_income", "d8_income"}


def log(message: str) -> None:
    print(f"[build_filosofi_gold] {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the FiLoSoFi gold dataset for one year.")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--publish-public", action="store_true")
    return parser.parse_args()


def silver_path(year: int) -> Path:
    return ROOT_DIR / "data" / "silver" / "filosofi" / f"year={year}" / "filosofi_silver.parquet"


def year_gold_dir(year: int) -> Path:
    return GOLD_ROOT / f"year={year}"


def year_commune_output_path(year: int) -> Path:
    return year_gold_dir(year) / "filosofi_commune_indicators.parquet"


def year_department_output_path(year: int) -> Path:
    return year_gold_dir(year) / "filosofi_department_indicators.parquet"


def year_summary_output_path(year: int) -> Path:
    return year_gold_dir(year) / "filosofi_summary.json"


def department_official_year_path(year: int) -> Path:
    return GOLD_ROOT / "department_official" / f"year={year}" / "filosofi_department_indicators.parquet"


def department_derived_year_path(year: int) -> Path:
    return GOLD_ROOT / "department_derived" / f"year={year}" / "filosofi_department_indicators.parquet"


def commune_all_years_path() -> Path:
    return GOLD_ROOT / "commune_all_years.parquet"


def department_official_all_years_path() -> Path:
    return GOLD_ROOT / "department_official" / "department_all_years.parquet"


def department_derived_all_years_path() -> Path:
    return GOLD_ROOT / "department_derived" / "department_all_years.parquet"


def indicator_availability_path() -> Path:
    return GOLD_ROOT / "indicator_availability.json"


def metadata_path() -> Path:
    return GOLD_ROOT / "metadata.json"


def schema_report_path() -> Path:
    return REPORTS_DIR / "filosofi_schema_comparison.csv"


def read_json(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid JSON object in {path}")
    return payload


def source_for_year(year: int) -> dict[str, object]:
    return load_filosofi_catalog(FILOSOFI_CONFIG_PATH).get_source(year, allow_disabled=True)


def available_catalog_years() -> list[int]:
    return load_filosofi_catalog(FILOSOFI_CONFIG_PATH).available_years


def configured_years() -> list[int]:
    return load_filosofi_catalog(FILOSOFI_CONFIG_PATH).enabled_years


def known_missing_years() -> list[int]:
    return load_filosofi_catalog(FILOSOFI_CONFIG_PATH).known_missing_years


def source_flag(source: dict[str, object], key: str, default: bool = False) -> bool:
    value = source.get(key, default)
    return value if isinstance(value, bool) else default


def methodology_breaks_from_catalog() -> list[dict[str, object]]:
    catalog = load_filosofi_catalog(FILOSOFI_CONFIG_PATH)
    breaks: list[dict[str, object]] = []
    for year in catalog.available_years:
        source = catalog.get_source(year, allow_disabled=True)
        if not source_flag(source, "methodological_break"):
            continue
        label = str(source.get("methodological_break_label") or f"Methodological break for {source.get('dispositif') or 'filosofi'}")
        breaks.append(
            {
                "year": year,
                "label": label,
                "comparable_to_previous_year": False,
            }
        )
    return breaks


def canonical_mapping() -> dict[str, dict[str, str | None]]:
    payload = read_json(CANONICAL_MAPPING_PATH).get("canonical_columns", {})
    if not isinstance(payload, dict):
        raise RuntimeError("Invalid canonical FiLoSoFi mapping")
    normalized: dict[str, dict[str, str | None]] = {}
    for canonical_column, mapping in payload.items():
        if not isinstance(mapping, dict):
            continue
        normalized[str(canonical_column)] = {
            str(year): (None if value is None else str(value))
            for year, value in mapping.items()
        }
    return normalized


def source_generation_for_year(year: int, source: dict[str, object]) -> str:
    configured_generation = str(source.get("source_generation") or "").strip()
    if configured_generation:
        return configured_generation
    if str(source.get("dispositif") or "") == "filosofi2":
        return "filosofi2"
    return "historical"


def methodology_version_for_row(dispositif: str, indicator_source: str) -> str:
    if indicator_source == "derived_from_communes":
        return "derived_from_filosofi_v1"
    if dispositif == "filosofi2":
        return "filosofi_v2"
    return "filosofi_v1"


def row_level_comparability(year: int, geography_level: str, indicator_source: str, dispositif: str) -> bool:
    source = source_for_year(year)
    if indicator_source == "derived_from_communes":
        return False
    if source_flag(source, "methodological_break") or dispositif == "filosofi2":
        return False
    if geography_level == "department":
        return False
    return source_flag(source, "comparable_with_previous_years")


def normalize_numeric(series: pd.Series | None, size: int) -> pd.Series:
    if series is None:
        return pd.Series([pd.NA] * size, dtype="Float64")
    return pd.to_numeric(series, errors="coerce").astype("Float64")


def normalize_text(series: pd.Series | None, size: int) -> pd.Series:
    if series is None:
        return pd.Series([pd.NA] * size, dtype="string")
    normalized = series.astype("string").str.strip()
    return normalized.mask(normalized.eq(""), pd.NA)


def finalize_frame(frame: pd.DataFrame) -> pd.DataFrame:
    finalized = frame.copy()
    for column in CANONICAL_COLUMNS:
        if column not in finalized.columns:
            if column in NUMERIC_COLUMNS:
                finalized[column] = pd.Series([pd.NA] * len(finalized), dtype="Float64")
            elif column == "year":
                finalized[column] = pd.Series([pd.NA] * len(finalized), dtype="Int64")
            elif column in {"is_official", "comparable_with_previous_years"}:
                finalized[column] = pd.Series([pd.NA] * len(finalized), dtype="boolean")
            else:
                finalized[column] = pd.Series([pd.NA] * len(finalized), dtype="string")

    string_columns = [
        "geography_code",
        "geography_name",
        "geography_level",
        "dispositif",
        "source_generation",
        "indicator_source",
        "methodology_version",
    ]
    for column in string_columns:
        finalized[column] = normalize_text(finalized[column], len(finalized))
    finalized["year"] = pd.to_numeric(finalized["year"], errors="coerce").astype("Int64")
    finalized["is_official"] = finalized["is_official"].astype("boolean")
    finalized["comparable_with_previous_years"] = finalized["comparable_with_previous_years"].astype("boolean")
    for column in NUMERIC_COLUMNS:
        finalized[column] = normalize_numeric(finalized[column], len(finalized))
    return finalized.loc[:, CANONICAL_COLUMNS].copy()


def has_real_source_column(year: int, canonical_column: str, mapping: dict[str, dict[str, str | None]]) -> bool:
    year_mapping = mapping.get(canonical_column, {})
    return bool(year_mapping.get(str(year)))


def choose_weight_column(frame: pd.DataFrame) -> str | None:
    if "tax_households" in frame.columns and frame["tax_households"].notna().any():
        return "tax_households"
    if "population" in frame.columns and frame["population"].notna().any():
        return "population"
    return None


def weighted_median(values: pd.Series, weights: pd.Series | None = None) -> float | None:
    weighted = pd.DataFrame({"value": values})
    weighted["weight"] = 1.0 if weights is None else weights
    weighted = weighted.dropna(subset=["value", "weight"])
    weighted = weighted[weighted["weight"] > 0]
    if weighted.empty:
        return None
    weighted = weighted.sort_values("value")
    threshold = weighted["weight"].sum() / 2
    cumulative_weight = weighted["weight"].cumsum()
    return float(weighted.loc[cumulative_weight >= threshold, "value"].iloc[0])


def weighted_mean(values: pd.Series, weights: pd.Series | None = None) -> float | None:
    weighted = pd.DataFrame({"value": values})
    weighted["weight"] = 1.0 if weights is None else weights
    weighted = weighted.dropna(subset=["value", "weight"])
    weighted = weighted[weighted["weight"] > 0]
    if weighted.empty:
        return None
    return float((weighted["value"] * weighted["weight"]).sum() / weighted["weight"].sum())


def empty_canonical_frame() -> pd.DataFrame:
    return finalize_frame(pd.DataFrame(columns=CANONICAL_COLUMNS))


def build_commune_frame(
    commune_silver: pd.DataFrame,
    year: int,
    dispositif: str,
    source_generation: str,
    mapping: dict[str, dict[str, str | None]],
) -> pd.DataFrame:
    if commune_silver.empty:
        return empty_canonical_frame()

    commune_silver = commune_silver.reset_index(drop=True).copy()
    harmonized = pd.DataFrame(index=commune_silver.index)
    harmonized["geography_code"] = normalize_text(commune_silver.get("commune_code"), len(commune_silver))
    if has_real_source_column(year, "geography_name", mapping):
        harmonized["geography_name"] = normalize_text(commune_silver.get("commune_name"), len(commune_silver))
    else:
        harmonized["geography_name"] = pd.Series([pd.NA] * len(commune_silver), dtype="string")
    harmonized["geography_level"] = pd.Series(["commune"] * len(commune_silver), dtype="string")
    harmonized["year"] = pd.Series([year] * len(commune_silver), dtype="Int64")
    harmonized["dispositif"] = pd.Series([dispositif] * len(commune_silver), dtype="string")
    harmonized["source_generation"] = pd.Series([source_generation] * len(commune_silver), dtype="string")
    harmonized["indicator_source"] = pd.Series(["official_insee"] * len(commune_silver), dtype="string")
    harmonized["is_official"] = pd.Series([True] * len(commune_silver), dtype="boolean")
    methodology = methodology_version_for_row(dispositif, "official_insee")
    harmonized["methodology_version"] = pd.Series([methodology] * len(commune_silver), dtype="string")
    harmonized["comparable_with_previous_years"] = pd.Series(
        [row_level_comparability(year, "commune", "official_insee", dispositif)] * len(commune_silver),
        dtype="boolean",
    )

    for column in NUMERIC_COLUMNS:
        if has_real_source_column(year, column, mapping):
            harmonized[column] = normalize_numeric(commune_silver.get(column), len(commune_silver))
        else:
            harmonized[column] = pd.Series([pd.NA] * len(commune_silver), dtype="Float64")

    harmonized = finalize_frame(harmonized)
    harmonized = harmonized[harmonized["geography_code"].notna()].copy()
    return harmonized.reset_index(drop=True)


def derive_department_frame_from_communes(commune_frame: pd.DataFrame, year: int, dispositif: str) -> pd.DataFrame:
    if commune_frame.empty:
        return empty_canonical_frame()

    commune_with_department = commune_frame.copy()
    commune_with_department["department_code"] = (
        commune_with_department["geography_code"]
        .astype("string")
        .str.upper()
        .map(lambda value: value[:3] if isinstance(value, str) and value.startswith(("97", "98")) else value[:2] if isinstance(value, str) else value)
    )
    weight_column = choose_weight_column(commune_with_department)
    rows: list[dict[str, object]] = []
    for department_code, group in commune_with_department.groupby("department_code", dropna=True):
        weights = group[weight_column] if weight_column else None
        row: dict[str, object] = {
            "geography_code": str(department_code),
            "geography_name": pd.NA,
            "geography_level": "department",
            "year": year,
            "dispositif": dispositif,
            "source_generation": "historical",
            "indicator_source": "derived_from_communes",
            "is_official": False,
            "methodology_version": methodology_version_for_row(dispositif, "derived_from_communes"),
            "comparable_with_previous_years": False,
        }
        for column in NUMERIC_COLUMNS:
            if column == "poverty_rate":
                row[column] = weighted_mean(group[column], weights) if group[column].notna().any() else None
            else:
                row[column] = weighted_median(group[column], weights) if group[column].notna().any() else None
        rows.append(row)
    return finalize_frame(pd.DataFrame(rows))


def build_department_frame(
    department_silver: pd.DataFrame,
    commune_frame: pd.DataFrame,
    year: int,
    dispositif: str,
    source_generation: str,
    mapping: dict[str, dict[str, str | None]],
) -> tuple[pd.DataFrame, str]:
    if department_silver.empty:
        return derive_department_frame_from_communes(commune_frame, year, dispositif), "derived_from_communes"

    department_silver = department_silver.reset_index(drop=True).copy()
    harmonized = pd.DataFrame(index=department_silver.index)
    harmonized["geography_code"] = normalize_text(department_silver.get("department_code"), len(department_silver))
    harmonized["geography_name"] = pd.Series([pd.NA] * len(department_silver), dtype="string")
    harmonized["geography_level"] = pd.Series(["department"] * len(department_silver), dtype="string")
    harmonized["year"] = pd.Series([year] * len(department_silver), dtype="Int64")
    harmonized["dispositif"] = pd.Series([dispositif] * len(department_silver), dtype="string")
    harmonized["source_generation"] = pd.Series([source_generation] * len(department_silver), dtype="string")
    harmonized["indicator_source"] = pd.Series(["official_insee"] * len(department_silver), dtype="string")
    harmonized["is_official"] = pd.Series([True] * len(department_silver), dtype="boolean")
    methodology = methodology_version_for_row(dispositif, "official_insee")
    harmonized["methodology_version"] = pd.Series([methodology] * len(department_silver), dtype="string")
    harmonized["comparable_with_previous_years"] = pd.Series(
        [row_level_comparability(year, "department", "official_insee", dispositif)] * len(department_silver),
        dtype="boolean",
    )

    for column in NUMERIC_COLUMNS:
        if has_real_source_column(year, column, mapping):
            harmonized[column] = normalize_numeric(department_silver.get(column), len(department_silver))
        else:
            harmonized[column] = pd.Series([pd.NA] * len(department_silver), dtype="Float64")

    harmonized = finalize_frame(harmonized)
    harmonized = harmonized[harmonized["geography_code"].notna()].copy()
    return harmonized.reset_index(drop=True), "official_insee"


def write_department_partition(department_frame: pd.DataFrame, year: int, indicator_source: str) -> None:
    official_path = department_official_year_path(year)
    derived_path = department_derived_year_path(year)
    official_path.parent.mkdir(parents=True, exist_ok=True)
    derived_path.parent.mkdir(parents=True, exist_ok=True)

    if indicator_source == "official_insee":
        department_frame.to_parquet(official_path, index=False)
        if derived_path.exists():
            derived_path.unlink()
    else:
        department_frame.to_parquet(derived_path, index=False)
        if official_path.exists():
            official_path.unlink()


def summarize_department_values(department_frame: pd.DataFrame) -> dict[str, float | None]:
    values: dict[str, float | None] = {}
    for row in department_frame.to_dict(orient="records"):
        code = str(row.get("geography_code") or "")
        if not code:
            continue
        value = row.get("median_income")
        values[code] = round(float(value), 2) if value is not None and pd.notna(value) else None
    return dict(sorted(values.items()))


def department_deciles_summary(department_frame: pd.DataFrame) -> dict[str, dict[str, float | None]]:
    rows: dict[str, dict[str, float | None]] = {}
    for row in department_frame.to_dict(orient="records"):
        code = str(row.get("geography_code") or "")
        if not code:
            continue
        rows[code] = {
            column: round(float(row[column]), 2) if row.get(column) is not None and pd.notna(row[column]) else None
            for column in [column for column in NUMERIC_COLUMNS if column.startswith("d")]
        }
    return dict(sorted(rows.items()))


def compute_year_summary(
    commune_frame: pd.DataFrame,
    department_frame: pd.DataFrame,
    year: int,
    dispositif: str,
    department_indicator_source: str,
) -> dict[str, object]:
    weight_column = choose_weight_column(commune_frame)
    weights = commune_frame[weight_column] if weight_column else None
    national_median_income = (
        weighted_median(commune_frame["median_income"], weights)
        if commune_frame["median_income"].notna().any()
        else None
    )
    poverty_rate_summary = None
    if commune_frame["poverty_rate"].notna().any():
        poverty_rate_summary = {
            "mean": round(float(weighted_mean(commune_frame["poverty_rate"], weights)), 2),
            "median": round(float(weighted_median(commune_frame["poverty_rate"], weights)), 2),
        }

    decile_summary = {
        column: (
            round(float(weighted_median(commune_frame[column], weights)), 2)
            if commune_frame[column].notna().any()
            else None
        )
        for column in ["d1_income", "d5_income", "d9_income"]
    }

    return {
        "source": "INSEE FiLoSoFi",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "available_years": [year],
        "latest_year": year,
        "dispositif": dispositif,
        "communes_covered": int(commune_frame["geography_code"].dropna().nunique()),
        "departments_covered": int(department_frame["geography_code"].dropna().nunique()),
        "department_indicator_source": department_indicator_source,
        "national_median_income": round(float(national_median_income), 2) if national_median_income is not None else None,
        "median_income_by_department": summarize_department_values(department_frame),
        "department_deciles_by_department": department_deciles_summary(department_frame),
        "decile_summary": decile_summary,
        "poverty_rate_summary": poverty_rate_summary,
        "notes": [
            "FiLoSoFi is annual data and should be joined to DVF using commune_code and year.",
            "Columns with no published source value remain null in the harmonized gold layer.",
            "Department series are split between official INSEE outputs and derived commune aggregations.",
            "FiLoSoFi 2 starts in 2023 and introduces a methodological break.",
        ],
    }


def safe_read_frame(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        return None
    frame = pd.read_parquet(path)
    missing_columns = [column for column in CANONICAL_COLUMNS if column not in frame.columns]
    if missing_columns:
        log(f"Skipping non-harmonized parquet during aggregation: {path}")
        return None
    return finalize_frame(frame)


def collect_partition_frames(base_dir: Path) -> list[pd.DataFrame]:
    frames: list[pd.DataFrame] = []
    if not base_dir.exists():
        return frames
    for path in sorted(base_dir.glob("year=*/filosofi_department_indicators.parquet")):
        frame = safe_read_frame(path)
        if frame is not None:
            frames.append(frame)
    return frames


def frame_year(frame: pd.DataFrame) -> int | None:
    if frame.empty or "year" not in frame.columns:
        return None
    years = frame["year"].dropna()
    if years.empty:
        return None
    return int(years.iloc[0])


def indicator_coverage(frame: pd.DataFrame, column: str) -> float:
    if frame.empty:
        return 0.0
    return round(float(frame[column].notna().mean()), 4)


def comparable_for_indicator(
    year: int,
    geography_level: str,
    indicator_source: str,
    indicator: str,
    available: bool,
) -> bool:
    source = source_for_year(year)
    if not available:
        return False
    if indicator_source == "derived_from_communes":
        return False
    if source_flag(source, "methodological_break"):
        return False
    if geography_level == "department":
        return False
    if indicator in SECONDARY_DECILE_COLUMNS:
        return source_flag(source, "secondary_deciles_comparable_with_previous_years")
    return source_flag(source, "comparable_with_previous_years")


def build_indicator_availability_payload(
    commune_frames: list[pd.DataFrame],
    official_department_frames: list[pd.DataFrame],
    derived_department_frames: list[pd.DataFrame],
) -> dict[str, object]:
    payload: dict[str, object] = {}
    frame_index: dict[tuple[str, int], pd.DataFrame] = {}
    for level, frames in (
        ("commune", commune_frames),
        ("department_official", official_department_frames),
        ("department_derived", derived_department_frames),
    ):
        for frame in frames:
            year = frame_year(frame)
            if year is None:
                continue
            frame_index[(level, year)] = frame

    for year in configured_years():
        year_payload: dict[str, object] = {}
        for level in ("commune", "department_official", "department_derived"):
            frame = frame_index.get((level, year))
            if frame is None:
                year_payload[level] = {}
                continue
            level_payload: dict[str, object] = {}
            for indicator in NUMERIC_COLUMNS:
                coverage = indicator_coverage(frame, indicator)
                available = coverage > 0
                official = bool(frame["is_official"].dropna().iloc[0]) if frame["is_official"].notna().any() else False
                indicator_source = str(frame["indicator_source"].dropna().iloc[0]) if frame["indicator_source"].notna().any() else ""
                geography_level = str(frame["geography_level"].dropna().iloc[0]) if frame["geography_level"].notna().any() else ""
                level_payload[indicator] = {
                    "available": available,
                    "coverage": coverage,
                    "official": official,
                    "indicator_source": indicator_source,
                    "comparable_with_previous_years": comparable_for_indicator(
                        year,
                        geography_level,
                        indicator_source,
                        indicator,
                        available,
                    ),
                }
            year_payload[level] = level_payload
        payload[str(year)] = year_payload
    return payload


def build_metadata_payload(
    commune_frames: list[pd.DataFrame],
    official_department_frames: list[pd.DataFrame],
    derived_department_frames: list[pd.DataFrame],
) -> dict[str, object]:
    available_years = sorted(
        {
            year
            for frame in [*commune_frames, *official_department_frames, *derived_department_frames]
            for year in [frame_year(frame)]
            if year is not None
        }
    )
    return {
        "source": "INSEE FiLoSoFi",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "available_years": available_years,
        "missing_years": sorted({*known_missing_years(), *[year for year in configured_years() if year not in available_years]}),
        "methodology_breaks": methodology_breaks_from_catalog(),
        "datasets": {
            "commune_all_years": str(commune_all_years_path().relative_to(ROOT_DIR)).replace("\\", "/"),
            "department_official_all_years": str(department_official_all_years_path().relative_to(ROOT_DIR)).replace("\\", "/"),
            "department_derived_all_years": str(department_derived_all_years_path().relative_to(ROOT_DIR)).replace("\\", "/"),
            "indicator_availability": str(indicator_availability_path().relative_to(ROOT_DIR)).replace("\\", "/"),
        },
    }


def schema_status_for_row(canonical_column: str, geography_level: str) -> tuple[str, str]:
    if geography_level == "department":
        if canonical_column == "geography_name":
            return "missing_in_source", "Department labels are not kept in the current harmonized pipeline."
        if canonical_column in {"median_income", "d1_income", "d2_income", "d3_income", "d4_income", "d6_income", "d7_income", "d8_income", "d9_income", "poverty_rate", "tax_households", "population"}:
            return "mixed_official_and_derived", "2017 and 2023 are official department series; 2018-2021 are derived from commune rows."
    if canonical_column == "d5_income":
        return "not_published", "No explicit D5 column is published in the configured FiLoSoFi sources; the harmonized layer keeps it null."
    if canonical_column in {"d2_income", "d3_income", "d4_income", "d6_income", "d7_income", "d8_income"}:
        return "partially_available", "These indicators are absent in 2017 and structurally unpublished for commune rows in 2023."
    if canonical_column == "geography_name":
        return "partial_labels", "Commune labels are available in 2018-2021 only in the current source set."
    if canonical_column in {"median_income", "d1_income", "d9_income", "poverty_rate"}:
        return "methodological_break_2023", "Indicator exists across vintages but 2023 belongs to FiLoSoFi 2."
    return "stable", "Indicator is present in the configured historical vintages when published."


def write_schema_report() -> None:
    mapping = canonical_mapping()
    report_years = available_catalog_years()
    rows: list[dict[str, object]] = []
    for geography_level in ("commune", "department"):
        for canonical_column in [
            "geography_code",
            "geography_name",
            *NUMERIC_COLUMNS,
        ]:
            status, notes = schema_status_for_row(canonical_column, geography_level)
            row: dict[str, object] = {
                "canonical_column": canonical_column,
                "geography_level": geography_level,
                "status": status,
                "notes": notes,
            }
            year_mapping = mapping.get(canonical_column, {})
            for year in report_years:
                row[f"{year}_column"] = year_mapping.get(str(year)) or ""
            rows.append(row)
    report = pd.DataFrame(rows)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report.to_csv(schema_report_path(), index=False)


def concat_or_empty(frames: list[pd.DataFrame]) -> pd.DataFrame:
    if not frames:
        return empty_canonical_frame()
    return finalize_frame(pd.concat(frames, ignore_index=True, sort=False))


def write_multiyear_outputs() -> None:
    commune_frames: list[pd.DataFrame] = []
    for year in configured_years():
        frame = safe_read_frame(year_commune_output_path(year))
        if frame is not None:
            commune_frames.append(frame)

    official_department_frames = collect_partition_frames(GOLD_ROOT / "department_official")
    derived_department_frames = collect_partition_frames(GOLD_ROOT / "department_derived")

    commune_all_years = concat_or_empty(commune_frames)
    department_official_all_years = concat_or_empty(official_department_frames)
    department_derived_all_years = concat_or_empty(derived_department_frames)

    GOLD_ROOT.mkdir(parents=True, exist_ok=True)
    department_official_all_years_path().parent.mkdir(parents=True, exist_ok=True)
    department_derived_all_years_path().parent.mkdir(parents=True, exist_ok=True)

    commune_all_years.to_parquet(commune_all_years_path(), index=False)
    department_official_all_years.to_parquet(department_official_all_years_path(), index=False)
    department_derived_all_years.to_parquet(department_derived_all_years_path(), index=False)

    availability = build_indicator_availability_payload(
        commune_frames,
        official_department_frames,
        derived_department_frames,
    )
    indicator_availability_path().write_text(
        json.dumps(availability, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    metadata = build_metadata_payload(
        commune_frames,
        official_department_frames,
        derived_department_frames,
    )
    metadata_path().write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_schema_report()


def main() -> None:
    args = parse_args()
    input_path = silver_path(args.year)
    source = source_for_year(args.year)
    mapping = canonical_mapping()
    output_dir = year_gold_dir(args.year)
    commune_output = year_commune_output_path(args.year)
    department_output = year_department_output_path(args.year)
    summary_output = year_summary_output_path(args.year)

    log(f"Preparing FiLoSoFi gold outputs for year {args.year}")
    if not input_path.exists():
        raise FileNotFoundError(f"Missing silver dataset: {input_path}")

    silver = pd.read_parquet(input_path)
    if "geography_level" not in silver.columns:
        raise RuntimeError("FiLoSoFi silver dataset must expose geography_level before gold harmonization")

    dispositif = str(source.get("dispositif") or "filosofi")
    source_generation = source_generation_for_year(args.year, source)

    commune_silver = silver[silver["geography_level"] == "commune"].copy()
    department_silver = silver[silver["geography_level"] == "department"].copy()

    commune_frame = build_commune_frame(commune_silver, args.year, dispositif, source_generation, mapping)
    department_frame, department_indicator_source = build_department_frame(
        department_silver,
        commune_frame,
        args.year,
        dispositif,
        source_generation,
        mapping,
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    commune_frame.to_parquet(commune_output, index=False)
    department_frame.to_parquet(department_output, index=False)
    write_department_partition(department_frame, args.year, department_indicator_source)

    summary = compute_year_summary(
        commune_frame,
        department_frame,
        args.year,
        dispositif,
        department_indicator_source,
    )
    summary_output.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.publish_public:
        PUBLIC_SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
        PUBLIC_SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    write_multiyear_outputs()

    log(f"Commune indicators parquet written to {commune_output}")
    log(f"Department indicators parquet written to {department_output}")
    log(f"FiLoSoFi summary written to {summary_output}")
    log(f"Commune consolidated parquet written to {commune_all_years_path()}")
    log(f"Indicator availability written to {indicator_availability_path()}")
    log(f"Schema comparison report written to {schema_report_path()}")


if __name__ == "__main__":
    main()
