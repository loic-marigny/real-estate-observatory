from __future__ import annotations

import csv
import gzip
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from statistics import median


ROOT_DIR = Path(__file__).resolve().parents[2]
INPUT_ARCHIVE_PATH = ROOT_DIR / "data" / "raw" / "dvf_latest.csv.gz"
INPUT_CSV_PATH = ROOT_DIR / "data" / "raw" / "dvf_full.csv"
OUTPUT_JSON_PATH = ROOT_DIR / "public" / "data" / "dvf_summary.json"

PROPERTY_TYPES = {"Maison", "Appartement"}
MIN_PRICE_M2 = 300
MAX_PRICE_M2 = 50000
MIN_SURFACE = 9
MAX_SURFACE = 1000

LEGACY_COLUMNS = {
    "nature_mutation": "Nature mutation",
    "type_local": "Type local",
    "valeur_fonciere": "Valeur fonciere",
    "surface_reelle_bati": "Surface reelle bati",
    "code_departement": "Code departement",
}
CURRENT_COLUMNS = {
    "nature_mutation": "nature_mutation",
    "type_local": "type_local",
    "valeur_fonciere": "valeur_fonciere",
    "surface_reelle_bati": "surface_reelle_bati",
    "code_departement": "code_departement",
}


def log(message: str) -> None:
    print(f"[prepare_dvf_sample] {message}")


def parse_numeric(value: str | None) -> float | None:
    if value is None:
        return None

    normalized = (
        value.strip()
        .replace("\xa0", "")
        .replace(" ", "")
        .replace(",", ".")
    )

    if not normalized:
        return None

    try:
        return float(normalized)
    except ValueError:
        return None


def compute_median(values: list[float]) -> float | None:
    if not values:
        return None

    return round(median(values), 2)


def ensure_full_csv() -> None:
    if not INPUT_ARCHIVE_PATH.exists():
        raise FileNotFoundError(
            f"Missing input archive: {INPUT_ARCHIVE_PATH}. "
            "Run data/scripts/download_dvf.py first."
        )

    INPUT_CSV_PATH.parent.mkdir(parents=True, exist_ok=True)

    if INPUT_CSV_PATH.exists() and INPUT_CSV_PATH.stat().st_mtime >= INPUT_ARCHIVE_PATH.stat().st_mtime:
        log(f"Using existing extracted CSV: {INPUT_CSV_PATH}")
        return

    log(f"Extracting readable CSV from {INPUT_ARCHIVE_PATH}")
    temp_output_path = INPUT_CSV_PATH.with_suffix(f"{INPUT_CSV_PATH.suffix}.part")

    try:
        with gzip.open(INPUT_ARCHIVE_PATH, "rb") as compressed_file:
            with temp_output_path.open("wb") as output_file:
                shutil.copyfileobj(compressed_file, output_file, length=1024 * 1024)
    except Exception:
        temp_output_path.unlink(missing_ok=True)
        raise

    temp_output_path.replace(INPUT_CSV_PATH)
    log(f"Extracted readable CSV to {INPUT_CSV_PATH}")


def detect_delimiter(header_line: str) -> str:
    if ";" in header_line and "," not in header_line:
        return ";"

    return ","


def resolve_columns(fieldnames: list[str] | None) -> dict[str, str]:
    if not fieldnames:
        raise RuntimeError("Missing CSV header in DVF source file")

    fieldname_set = set(fieldnames)
    if set(CURRENT_COLUMNS.values()).issubset(fieldname_set):
        return CURRENT_COLUMNS

    if set(LEGACY_COLUMNS.values()).issubset(fieldname_set):
        return LEGACY_COLUMNS

    raise RuntimeError(
        "Unsupported DVF CSV schema. "
        f"Available columns start with: {', '.join(fieldnames[:8])}"
    )


def main() -> None:
    log("Preparing DVF summary from full dataset")
    ensure_full_csv()
    log(f"Reading DVF CSV from {INPUT_CSV_PATH}")

    total_rows = 0
    kept_rows = 0
    filtered_non_sales = 0
    filtered_non_residential = 0
    filtered_invalid_values = 0
    filtered_outliers = 0

    price_m2_values: list[float] = []
    surface_values: list[float] = []
    sales_count_by_department: dict[str, int] = {}
    median_price_m2_values_by_department: dict[str, list[float]] = {}
    median_price_m2_values_by_property_type: dict[str, list[float]] = {
        property_type: [] for property_type in sorted(PROPERTY_TYPES)
    }

    with INPUT_CSV_PATH.open("r", encoding="utf-8-sig", newline="") as csv_file:
        header_line = csv_file.readline()
        if not header_line:
            raise RuntimeError(f"Empty input file: {INPUT_CSV_PATH}")

        delimiter = detect_delimiter(header_line)
        csv_file.seek(0)
        reader = csv.DictReader(csv_file, delimiter=delimiter)
        columns = resolve_columns(reader.fieldnames)

        for row in reader:
            total_rows += 1

            nature_mutation = (row.get(columns["nature_mutation"]) or "").strip()
            if nature_mutation != "Vente":
                filtered_non_sales += 1
                continue

            property_type = (row.get(columns["type_local"]) or "").strip()
            if property_type not in PROPERTY_TYPES:
                filtered_non_residential += 1
                continue

            valeur_fonciere = parse_numeric(row.get(columns["valeur_fonciere"]))
            surface_reelle_bati = parse_numeric(row.get(columns["surface_reelle_bati"]))

            if (
                valeur_fonciere is None
                or surface_reelle_bati is None
                or valeur_fonciere <= 0
                or surface_reelle_bati <= 0
            ):
                filtered_invalid_values += 1
                continue

            price_m2 = valeur_fonciere / surface_reelle_bati
            if (
                price_m2 < MIN_PRICE_M2
                or price_m2 > MAX_PRICE_M2
                or surface_reelle_bati < MIN_SURFACE
                or surface_reelle_bati > MAX_SURFACE
            ):
                filtered_outliers += 1
                continue

            kept_rows += 1
            price_m2_values.append(price_m2)
            surface_values.append(surface_reelle_bati)

            department_code = (row.get(columns["code_departement"]) or "").strip()
            if department_code:
                sales_count_by_department[department_code] = (
                    sales_count_by_department.get(department_code, 0) + 1
                )
                median_price_m2_values_by_department.setdefault(
                    department_code, []
                ).append(price_m2)

            median_price_m2_values_by_property_type[property_type].append(price_m2)

    median_price_m2_by_department = {
        department_code: compute_median(values)
        for department_code, values in sorted(
            median_price_m2_values_by_department.items()
        )
    }
    median_price_m2_by_property_type = {
        property_type: compute_median(values)
        for property_type, values in sorted(
            median_price_m2_values_by_property_type.items()
        )
    }
    departments = [
        {
            "department_code": department_code,
            "sales_count": sales_count_by_department[department_code],
            "median_price_m2": median_price_m2_by_department.get(department_code),
        }
        for department_code in sorted(sales_count_by_department)
    ]

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_file": str(INPUT_CSV_PATH.relative_to(ROOT_DIR)).replace("\\", "/"),
        "filters": {
            "nature_mutation": "Vente",
            "property_types": sorted(PROPERTY_TYPES),
            "outliers": {
                "price_m2_min": MIN_PRICE_M2,
                "price_m2_max": MAX_PRICE_M2,
                "surface_min": MIN_SURFACE,
                "surface_max": MAX_SURFACE,
            },
        },
        "total_sales_count": kept_rows,
        "median_price_m2": compute_median(price_m2_values),
        "median_surface": compute_median(surface_values),
        "sales_count_by_department": dict(sorted(sales_count_by_department.items())),
        "median_price_m2_by_department": median_price_m2_by_department,
        "median_price_m2_by_property_type": median_price_m2_by_property_type,
        "departments": departments,
        "quality_report": {
            "rows_read": total_rows,
            "rows_kept": kept_rows,
            "filtered_non_sales": filtered_non_sales,
            "filtered_non_residential": filtered_non_residential,
            "filtered_invalid_values": filtered_invalid_values,
            "filtered_outliers": filtered_outliers,
        },
    }

    OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_JSON_PATH.open("w", encoding="utf-8") as output_file:
        json.dump(summary, output_file, ensure_ascii=False, indent=2)
        output_file.write("\n")

    log(f"Rows read: {total_rows}")
    log(f"Rows kept after filters: {kept_rows}")
    log(f"Filtered non-sales: {filtered_non_sales}")
    log(f"Filtered non-residential: {filtered_non_residential}")
    log(f"Filtered invalid value/surface rows: {filtered_invalid_values}")
    log(f"Filtered outliers: {filtered_outliers}")
    log(f"Departments covered: {len(departments)}")
    log(f"DVF summary written to {OUTPUT_JSON_PATH}")


if __name__ == "__main__":
    main()
