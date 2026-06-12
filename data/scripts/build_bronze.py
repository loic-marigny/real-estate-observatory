from __future__ import annotations

from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq


INPUT_ARCHIVE_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "dvf_latest.csv.gz"
OUTPUT_PARQUET_PATH = Path(__file__).resolve().parents[2] / "data" / "bronze" / "dvf_bronze.parquet"
CHUNK_SIZE_ROWS = 200_000


def log(message: str) -> None:
    print(f"[build_bronze] {message}")


def main() -> None:
    log("Preparing bronze DVF dataset")

    if not INPUT_ARCHIVE_PATH.exists():
        raise FileNotFoundError(
            f"Missing input archive: {INPUT_ARCHIVE_PATH}. "
            "Run data/scripts/download_dvf.py first."
        )

    OUTPUT_PARQUET_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp_output_path = OUTPUT_PARQUET_PATH.with_suffix(".parquet.part")
    temp_output_path.unlink(missing_ok=True)

    total_rows = 0
    writer: pq.ParquetWriter | None = None
    pipeline_error: Exception | None = None

    try:
        chunk_iterator = pd.read_csv(
            INPUT_ARCHIVE_PATH,
            compression="gzip",
            dtype=str,
            keep_default_na=False,
            encoding="utf-8-sig",
            chunksize=CHUNK_SIZE_ROWS,
        )

        for chunk_index, chunk in enumerate(chunk_iterator, start=1):
            table = pa.Table.from_pandas(chunk, preserve_index=False)
            if writer is None:
                writer = pq.ParquetWriter(temp_output_path, table.schema)

            writer.write_table(table)
            total_rows += len(chunk)
            log(f"Processed chunk {chunk_index} with {len(chunk)} rows")
    except Exception as error:
        pipeline_error = error
    finally:
        if writer is not None:
            writer.close()

    if pipeline_error is not None:
        temp_output_path.unlink(missing_ok=True)
        raise pipeline_error

    if total_rows == 0:
        temp_output_path.unlink(missing_ok=True)
        raise RuntimeError("No rows were written to the bronze dataset")

    temp_output_path.replace(OUTPUT_PARQUET_PATH)
    log(f"Bronze dataset written to {OUTPUT_PARQUET_PATH}")
    log(f"Rows written: {total_rows}")


if __name__ == "__main__":
    main()
