from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from statistics import median


ROOT_DIR = Path(__file__).resolve().parents[2]
INPUT_CSV_PATH = ROOT_DIR / "data" / "raw" / "dvf_sample.csv"
OUTPUT_JSON_PATH = ROOT_DIR / "public" / "data" / "dvf_summary.json"

PROPERTY_TYPES = {"Maison", "Appartement"}
MIN_PRICE_M2 = 300
MAX_PRICE_M2 = 50000
MIN_SURFACE = 9
MAX_SURFACE = 1000


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


def main() -> None:
    log(f"Reading DVF sample from {INPUT_CSV_PATH}")

    if not INPUT_CSV_PATH.exists():
        raise FileNotFoundError(f"Missing input file: {INPUT_CSV_PATH}")

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
        reader = csv.DictReader(csv_file, delimiter=";")

        for row in reader:
            total_rows += 1

            nature_mutation = (row.get("Nature mutation") or "").strip()
            if nature_mutation != "Vente":
                filtered_non_sales += 1
                continue

            property_type = (row.get("Type local") or "").strip()
            if property_type not in PROPERTY_TYPES:
                filtered_non_residential += 1
                continue

            valeur_fonciere = parse_numeric(row.get("Valeur fonciere"))
            surface_reelle_bati = parse_numeric(row.get("Surface reelle bati"))

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

            department_code = (row.get("Code departement") or "").strip()
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
        for property_type, values in median_price_m2_values_by_property_type.items()
    }

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
    log(f"DVF summary written to {OUTPUT_JSON_PATH}")


if __name__ == "__main__":
    main()
