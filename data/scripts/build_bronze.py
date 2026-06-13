from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq


ROOT_DIR = Path(__file__).resolve().parents[2]
CHUNK_SIZE_ROWS = 200_000


def log(message: str) -> None:
    print(f"[build_bronze] {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the DVF bronze dataset for one year.")
    parser.add_argument("--year", type=int, required=True)
    return parser.parse_args()


def input_archive_path(year: int) -> Path:
    return ROOT_DIR / "data" / "raw" / "dvf" / f"year={year}" / "full.csv.gz"


def output_parquet_path(year: int) -> Path:
    return ROOT_DIR / "data" / "bronze" / "dvf" / f"year={year}" / "dvf_bronze.parquet"


def main() -> None:
    args = parse_args()
    input_path = input_archive_path(args.year)
    output_path = output_parquet_path(args.year)
    log(f"Preparing bronze DVF dataset for year {args.year}")

    if not input_path.exists():
        raise FileNotFoundError(f"Missing input archive: {input_path}. Run data/scripts/download_dvf.py first.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_output_path = output_path.with_suffix(".parquet.part")
    temp_output_path.unlink(missing_ok=True)

    total_rows = 0
    writer: pq.ParquetWriter | None = None
    pipeline_error: Exception | None = None

    try:
        chunk_iterator = pd.read_csv(
            input_path,
            compression="gzip",
            dtype=str,
            keep_default_na=False,
            encoding="utf-8-sig",
            chunksize=CHUNK_SIZE_ROWS,
        )

        for chunk_index, chunk in enumerate(chunk_iterator, start=1):
            chunk["year"] = args.year
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

    temp_output_path.replace(output_path)
    log(f"Bronze dataset written to {output_path}")
    log(f"Rows written: {total_rows}")


if __name__ == "__main__":
    main()
