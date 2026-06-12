from __future__ import annotations

from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq


INPUT_PARQUET_PATH = Path(__file__).resolve().parents[2] / "data" / "bronze" / "dvf_bronze.parquet"
OUTPUT_PARQUET_PATH = Path(__file__).resolve().parents[2] / "data" / "silver" / "dvf_silver.parquet"
CHUNK_SIZE_ROWS = 200_000

PROPERTY_TYPES = {"Maison", "Appartement"}
MIN_PRICE_M2 = 300
MAX_PRICE_M2 = 50_000
MIN_SURFACE = 9
MAX_SURFACE = 1_000
NUMERIC_COLUMNS = [
    "valeur_fonciere",
    "surface_reelle_bati",
    "nombre_pieces_principales",
    "surface_terrain",
    "longitude",
    "latitude",
]


def log(message: str) -> None:
    print(f"[build_silver] {message}")


def transform_chunk(chunk: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    stats = {
        "rows_read": len(chunk),
        "filtered_non_sales": 0,
        "filtered_non_residential": 0,
        "filtered_invalid_values": 0,
        "filtered_outliers": 0,
    }

    filtered = chunk.copy()

    filtered = filtered[filtered["nature_mutation"].fillna("").str.strip() == "Vente"]
    stats["filtered_non_sales"] = stats["rows_read"] - len(filtered)

    before_property_filter = len(filtered)
    filtered = filtered[filtered["type_local"].fillna("").str.strip().isin(PROPERTY_TYPES)]
    stats["filtered_non_residential"] = before_property_filter - len(filtered)

    for column in NUMERIC_COLUMNS:
        filtered[column] = pd.to_numeric(filtered[column], errors="coerce")
        filtered[column] = filtered[column].astype("float64")

    before_invalid_filter = len(filtered)
    filtered = filtered[
        filtered["valeur_fonciere"].notna()
        & filtered["surface_reelle_bati"].notna()
        & (filtered["valeur_fonciere"] > 0)
        & (filtered["surface_reelle_bati"] > 0)
        & filtered["code_departement"].fillna("").str.strip().ne("")
    ]
    stats["filtered_invalid_values"] = before_invalid_filter - len(filtered)

    filtered["price_m2"] = filtered["valeur_fonciere"] / filtered["surface_reelle_bati"]

    before_outlier_filter = len(filtered)
    filtered = filtered[
        filtered["price_m2"].between(MIN_PRICE_M2, MAX_PRICE_M2)
        & filtered["surface_reelle_bati"].between(MIN_SURFACE, MAX_SURFACE)
    ]
    stats["filtered_outliers"] = before_outlier_filter - len(filtered)

    return filtered, stats


def main() -> None:
    log("Preparing silver DVF dataset")

    if not INPUT_PARQUET_PATH.exists():
        raise FileNotFoundError(
            f"Missing bronze dataset: {INPUT_PARQUET_PATH}. "
            "Run data/scripts/build_bronze.py first."
        )

    OUTPUT_PARQUET_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp_output_path = OUTPUT_PARQUET_PATH.with_suffix(".parquet.part")

    parquet_file = pq.ParquetFile(INPUT_PARQUET_PATH)
    writer: pq.ParquetWriter | None = None
    temp_output_path.unlink(missing_ok=True)

    totals = {
        "rows_read": 0,
        "rows_kept": 0,
        "filtered_non_sales": 0,
        "filtered_non_residential": 0,
        "filtered_invalid_values": 0,
        "filtered_outliers": 0,
    }

    pipeline_error: Exception | None = None

    try:
        for batch_index, batch in enumerate(parquet_file.iter_batches(batch_size=CHUNK_SIZE_ROWS), start=1):
            chunk = batch.to_pandas()
            filtered_chunk, stats = transform_chunk(chunk)

            totals["rows_read"] += stats["rows_read"]
            totals["rows_kept"] += len(filtered_chunk)
            totals["filtered_non_sales"] += stats["filtered_non_sales"]
            totals["filtered_non_residential"] += stats["filtered_non_residential"]
            totals["filtered_invalid_values"] += stats["filtered_invalid_values"]
            totals["filtered_outliers"] += stats["filtered_outliers"]

            table = pa.Table.from_pandas(filtered_chunk, preserve_index=False)
            if writer is None:
                writer = pq.ParquetWriter(temp_output_path, table.schema)

            writer.write_table(table)
            log(
                f"Processed batch {batch_index}: "
                f"{len(filtered_chunk)} kept / {stats['rows_read']} read"
            )
    except Exception as error:
        pipeline_error = error
    finally:
        if writer is not None:
            writer.close()

    if pipeline_error is not None:
        temp_output_path.unlink(missing_ok=True)
        raise pipeline_error

    if totals["rows_kept"] == 0:
        temp_output_path.unlink(missing_ok=True)
        raise RuntimeError("No rows were written to the silver dataset")

    temp_output_path.replace(OUTPUT_PARQUET_PATH)
    log(f"Silver dataset written to {OUTPUT_PARQUET_PATH}")
    log(f"Rows read: {totals['rows_read']}")
    log(f"Rows kept: {totals['rows_kept']}")
    log(f"Filtered non-sales: {totals['filtered_non_sales']}")
    log(f"Filtered non-residential: {totals['filtered_non_residential']}")
    log(f"Filtered invalid rows: {totals['filtered_invalid_values']}")
    log(f"Filtered outliers: {totals['filtered_outliers']}")


if __name__ == "__main__":
    main()
