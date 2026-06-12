# Data Pipeline

This directory contains the local DVF ingestion pipeline and ignored intermediate data artifacts used to prepare frontend assets.

## Architecture

The DVF flow now follows a `bronze / silver / gold` layout:

- `data/raw/`: downloaded source archives from the official DVF publication.
- `data/bronze/`: Parquet copy of the raw DVF file with original columns preserved.
- `data/silver/`: cleaned Parquet dataset restricted to residential sales and enriched with `price_m2`.
- `data/gold/`: aggregated Parquet indicators ready for downstream consumption.
- `public/data/dvf_summary.json`: frontend-facing JSON exported from the gold layer.

All local raw and intermediate data folders are ignored by Git. The repository keeps only the folder structure.

## Scripts

Download the latest available DVF archive:

```bash
python data/scripts/download_dvf.py
```

Download the latest relevant FiLoSoFi resource from data.gouv.fr metadata:

```bash
python data/scripts/download_filosofi.py
```

Force a fresh FiLoSoFi download even if the target file already exists:

```bash
python data/scripts/download_filosofi.py --force
```

The FiLoSoFi downloader queries the official `data.gouv.fr` dataset API, inspects the `resources` array, prefers resources titled `Revenus et pauvreté des ménages`, prioritizes CSV-capable resources when available, falls back to the resource `url` when `latest` is absent, and saves the selected raw file into `data/raw/`.

Build the bronze layer:

```bash
python data/scripts/build_bronze.py
```

Bronze reads `data/raw/dvf_latest.csv.gz`, preserves the original DVF columns, and writes `data/bronze/dvf_bronze.parquet`.

Build the silver layer:

```bash
python data/scripts/build_silver.py
```

Silver reads the bronze parquet, keeps only `Vente`, `Maison`, and `Appartement`, converts numeric columns, removes invalid rows, computes `price_m2`, filters extreme outliers, and writes `data/silver/dvf_silver.parquet`.

Build the gold layer:

```bash
python data/scripts/build_gold.py
```

Gold reads the silver parquet, computes national indicators plus indicators by department and property type, writes parquet outputs into `data/gold/`, and exports `public/data/dvf_summary.json`.

Compatibility wrapper:

```bash
python data/scripts/prepare_dvf_sample.py
```

This legacy entrypoint now runs the full `bronze -> silver -> gold` pipeline.

## Pipeline Overview

1. `download_dvf.py` downloads the latest DVF archive into `data/raw/`.
2. `download_filosofi.py` selects the latest relevant FiLoSoFi resource from official dataset metadata and saves it into `data/raw/`.
3. `build_bronze.py` converts the raw DVF archive into `data/bronze/dvf_bronze.parquet` without altering the original columns.
4. `build_silver.py` produces `data/silver/dvf_silver.parquet` with cleaned residential sales and derived `price_m2`.
5. `build_gold.py` creates gold-level parquet indicators and exports `public/data/dvf_summary.json`.
6. The frontend continues to read `/data/dvf_summary.json`; no frontend contract changes are required.

## Notes

- `download_dvf.py` uses configurable constants at the top of the file so the upstream source can be replaced later.
- `download_filosofi.py` relies on `data.gouv.fr` dataset metadata instead of a hard-coded FiLoSoFi file URL.
- The parquet writers rely on `pandas` with the `pyarrow` engine available in the local Python environment.
- `prepare_dvf_sample.py` is kept only for backward compatibility with the previous workflow.
