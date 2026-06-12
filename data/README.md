# Data Pipeline

This directory contains the local DVF ingestion pipeline and ignored intermediate data artifacts used to prepare frontend assets.

## Architecture

The data flows now follow a `bronze / silver / gold` layout:

- `data/raw/`: downloaded source archives from official DVF and FiLoSoFi publications.
- `data/bronze/`: Parquet copies of raw source files with original columns preserved plus source metadata.
- `data/silver/`: cleaned and standardized datasets ready for analytical joins.
- `data/gold/`: aggregated indicators ready for downstream consumption.
- `public/data/*.json`: frontend-facing JSON summaries exported from gold layers.

All local raw and intermediate data folders are ignored by Git. This includes raw ZIP, CSV, TXT, XLS, XLSX files and processed parquet outputs. The repository keeps only the folder structure.

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

Build the FiLoSoFi bronze layer:

```bash
python data/scripts/build_filosofi_bronze.py
```

FiLoSoFi bronze scans `data/raw/` for files containing `filosofi`, supports ZIP/CSV/TXT/XLS/XLSX sources, reads relevant tabular content directly from ZIP archives when needed, preserves original columns, and writes `data/bronze/filosofi_bronze.parquet`.

Build the FiLoSoFi silver layer:

```bash
python data/scripts/build_filosofi_silver.py
```

FiLoSoFi silver standardizes commune-level indicators such as `commune_code`, `department_code`, `median_income`, deciles, poverty rate, tax households, population, and `year`, then writes `data/silver/filosofi_silver.parquet`.

Build the FiLoSoFi gold layer:

```bash
python data/scripts/build_filosofi_gold.py
```

FiLoSoFi gold produces `data/gold/filosofi_commune_indicators.parquet` and exports `public/data/filosofi_summary.json` for frontend consumption.

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
5. `build_gold.py` creates DVF gold-level parquet indicators and exports `public/data/dvf_summary.json`.
6. `build_filosofi_bronze.py` converts raw FiLoSoFi files into `data/bronze/filosofi_bronze.parquet`.
7. `build_filosofi_silver.py` standardizes commune-level FiLoSoFi indicators into `data/silver/filosofi_silver.parquet`.
8. `build_filosofi_gold.py` creates FiLoSoFi commune indicators and exports `public/data/filosofi_summary.json`.
9. The frontend reads JSON summaries from `public/data/`; no backend is required.

## Future Join

The future join between DVF and FiLoSoFi should use:

- DVF: `commune_code` + transaction year
- FiLoSoFi: `commune_code` + income year

The FiLoSoFi pipeline is designed so several years can be added later as new raw files are downloaded. A `year` column is inferred whenever possible from the raw filename, archive filename, or extracted file name.

## Notes

- `download_dvf.py` uses configurable constants at the top of the file so the upstream source can be replaced later.
- `download_filosofi.py` relies on `data.gouv.fr` dataset metadata instead of a hard-coded FiLoSoFi file URL.
- FiLoSoFi ZIP archives are read without committing extracted working files; unnecessary archive members are ignored instead of being kept locally.
- The parquet writers rely on `pandas` with the `pyarrow` engine available in the local Python environment.
- `prepare_dvf_sample.py` is kept only for backward compatibility with the previous workflow.
