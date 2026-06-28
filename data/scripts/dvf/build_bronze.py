from __future__ import annotations

import argparse
import csv
import gzip
import io
import re
import unicodedata
import zipfile
from contextlib import contextmanager
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from data.scripts.dvf.sources import get_dvf_source, resolve_existing_raw_path


ROOT_DIR = Path(__file__).resolve().parents[3]
CHUNK_SIZE_ROWS = 200_000
GZIP_MAGIC = b"\x1f\x8b"
ZIP_MAGIC = b"PK\x03\x04"
CANONICAL_COLUMN_ALIASES = {
    "nature_mutation": ("nature_mutation",),
    "type_local": ("type_local",),
    "valeur_fonciere": ("valeur_fonciere",),
    "surface_reelle_bati": ("surface_reelle_bati",),
    "nombre_pieces_principales": ("nombre_pieces_principales",),
    "surface_terrain": ("surface_terrain",),
    "longitude": ("longitude",),
    "latitude": ("latitude",),
    "code_departement": ("code_departement", "departement", "code_dep"),
    "code_commune": ("code_commune",),
    "nom_commune": ("nom_commune", "commune"),
}


def log(message: str) -> None:
    print(f"[build_bronze] {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the DVF bronze dataset for one year.")
    parser.add_argument("--year", type=int, required=True)
    return parser.parse_args()


def input_archive_path(year: int) -> Path:
    existing_path = resolve_existing_raw_path(year)
    if existing_path is not None:
        return existing_path

    source = get_dvf_source(year)
    return ROOT_DIR / "data" / "raw" / "dvf" / f"year={year}" / source.raw_filename


def output_parquet_path(year: int) -> Path:
    return ROOT_DIR / "data" / "bronze" / "dvf" / f"year={year}" / "dvf_bronze.parquet"


def normalize_header(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    without_accents = "".join(character for character in normalized if not unicodedata.combining(character))
    lowered = without_accents.lower().strip()
    lowered = re.sub(r"[^a-z0-9]+", "_", lowered)
    return lowered.strip("_")


def normalize_chunk_columns(chunk: pd.DataFrame) -> pd.DataFrame:
    normalized_input_columns = {normalize_header(column): column for column in chunk.columns}
    normalized = pd.DataFrame(index=chunk.index)

    for canonical_column, aliases in CANONICAL_COLUMN_ALIASES.items():
        source_column = next(
            (normalized_input_columns[alias] for alias in aliases if alias in normalized_input_columns),
            None,
        )
        normalized[canonical_column] = chunk[source_column] if source_column is not None else ""

    department_codes = normalized["code_departement"].fillna("").astype(str).str.strip()
    commune_codes = normalized["code_commune"].fillna("").astype(str).str.strip()
    normalized["code_departement"] = department_codes
    normalized["code_commune"] = commune_codes
    short_commune_mask = commune_codes.str.len().between(1, 3)
    normalized.loc[short_commune_mask, "code_commune"] = (
        department_codes[short_commune_mask] + commune_codes[short_commune_mask].str.zfill(3)
    )
    normalized["nom_commune"] = normalized["nom_commune"].fillna("").astype(str).str.strip()

    return normalized


def resolve_csv_delimiter(path: Path) -> str:
    with open_text_stream(path) as text_stream:
        sample = text_stream.read(4096)
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;|\t")
        return dialect.delimiter
    except csv.Error:
        first_line = sample.splitlines()[0] if sample else ""
        if "|" in first_line:
            return "|"
        if ";" in first_line:
            return ";"
        return ","


@contextmanager
def open_text_stream(path: Path):
    with path.open("rb") as binary_file:
        magic = binary_file.read(4)

    if magic.startswith(GZIP_MAGIC):
        with gzip.open(path, mode="rt", encoding="utf-8-sig", newline="") as gzip_file:
            yield gzip_file
        return

    if magic.startswith(ZIP_MAGIC):
        with zipfile.ZipFile(path) as archive:
            members = [member for member in archive.namelist() if not member.endswith("/")]
            if not members:
                raise RuntimeError(f"Legacy DVF archive is empty: {path}")
            with archive.open(members[0]) as member_file:
                with io.TextIOWrapper(member_file, encoding="utf-8-sig", newline="") as text_file:
                    yield text_file
        return

    with path.open("rt", encoding="utf-8-sig", newline="") as text_file:
        yield text_file


def main() -> None:
    args = parse_args()
    input_path = input_archive_path(args.year)
    output_path = output_parquet_path(args.year)
    log(f"Preparing bronze DVF dataset for year {args.year}")

    if not input_path.exists():
        raise FileNotFoundError(f"Missing input archive: {input_path}. Run python -m data.scripts.dvf.download first.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_output_path = output_path.with_suffix(".parquet.part")
    temp_output_path.unlink(missing_ok=True)

    total_rows = 0
    writer: pq.ParquetWriter | None = None
    pipeline_error: Exception | None = None

    try:
        delimiter = resolve_csv_delimiter(input_path)
        with open_text_stream(input_path) as input_stream:
            chunk_iterator = pd.read_csv(
                input_stream,
                sep=delimiter,
                dtype=str,
                keep_default_na=False,
                chunksize=CHUNK_SIZE_ROWS,
                low_memory=False,
            )

            for chunk_index, chunk in enumerate(chunk_iterator, start=1):
                normalized_chunk = normalize_chunk_columns(chunk)
                normalized_chunk["year"] = args.year
                table = pa.Table.from_pandas(normalized_chunk, preserve_index=False)
                if writer is None:
                    writer = pq.ParquetWriter(temp_output_path, table.schema)

                writer.write_table(table)
                total_rows += len(normalized_chunk)
                log(f"Processed chunk {chunk_index} with {len(normalized_chunk)} rows")
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
