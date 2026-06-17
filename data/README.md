# Data Pipeline

This directory contains the multi-year data pipeline used by the observatory.

## Layout

The pipeline stores data by dataset and year:

```text
data/
├── raw/<dataset>/year=YYYY/
├── bronze/<dataset>/year=YYYY/
├── silver/<dataset>/year=YYYY/
└── gold/<dataset>/year=YYYY/
```

`public/data/*.json` remains the frontend-facing layer.

All raw, bronze, silver, and gold files are ignored by Git.

## Year Configuration

Configured years live in `config/pipeline_years.json`.

Example:

```json
{
  "dvf_years": [2020, 2021, 2022, 2023, 2024],
  "filosofi_years": [2017, 2018, 2019, 2020, 2021, 2023]
}
```

If a source year is not yet available upstream, remove it from the config until it can be ingested.

## Local Commands

Process one DVF year:

```bash
python scripts/build_dvf.py --year 2024
```

Process one FiLoSoFi year:

```bash
python scripts/build_filosofi.py --year 2023
```

Process every configured year:

```bash
python scripts/run_pipeline.py
```

Legacy compatibility wrapper:

```bash
python data/scripts/prepare_dvf_sample.py
```

It now delegates to the year-based DVF pipeline.

## FiLoSoFi

FiLoSoFi years currently configured:

- `2017`
- `2018`
- `2019`
- `2020`
- `2021`
- `2023`

`2022` is intentionally excluded because INSEE did not publish that millesime. FiLoSoFi resumes in `2023` with FiLoSoFi 2.

The downloader queries the official `data.gouv.fr` dataset metadata, selects the resource for the requested year, and saves the raw file into `data/raw/filosofi/year=YYYY/`.

Each FiLoSoFi year then produces:

- `data/bronze/filosofi/year=YYYY/filosofi_bronze.parquet`
- `data/silver/filosofi/year=YYYY/filosofi_silver.parquet`
- `data/gold/filosofi/year=YYYY/filosofi_commune_indicators.parquet`
- `data/gold/filosofi/year=YYYY/filosofi_department_indicators.parquet`

The public summary is published from the latest configured year only.

## DVF

Each DVF year then produces:

- `data/raw/dvf/year=YYYY/full.csv.gz`
- `data/bronze/dvf/year=YYYY/dvf_bronze.parquet`
- `data/silver/dvf/year=YYYY/dvf_silver.parquet`
- `data/gold/dvf/year=YYYY/dvf_national.parquet`
- `data/gold/dvf/year=YYYY/dvf_by_department.parquet`
- `data/gold/dvf/year=YYYY/dvf_by_property_type.parquet`
- `data/gold/dvf/year=YYYY/dvf_commune_indicators.parquet`

## Commune-Year Join

`data/scripts/build_commune_year.py` creates:

```text
data/gold/commune_year/commune_year.parquet
```

This table merges available commune-year indicators from DVF and FiLoSoFi when keys exist. No values are invented. If a dataset is missing for a given year, the columns remain empty for that source.

## R2

GitHub Actions uploads processed artifacts to R2 under:

```text
silver/
├── dvf/year=YYYY/
└── filosofi/year=YYYY/

gold/
├── dvf/year=YYYY/
├── filosofi/year=YYYY/
└── commune_year/
```

Raw files are not uploaded by default.
