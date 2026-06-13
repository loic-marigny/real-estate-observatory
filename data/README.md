# Data Pipeline

This directory contains the multi-year real-estate data pipeline used by the observatory.

## Layout

The pipeline stores data by dataset and year:

```text
data/
├── raw/
│   ├── dvf/year=2024/
│   └── filosofi/year=2017/
├── bronze/
│   ├── dvf/year=2024/
│   └── filosofi/year=2017/
├── silver/
│   ├── dvf/year=2024/
│   └── filosofi/year=2017/
└── gold/
    ├── dvf/year=2024/
    ├── filosofi/year=2017/
    └── commune_year/
```

`public/data/*.json` remains the frontend-facing layer. The current public JSON files are published from the latest configured year for each dataset.

All raw, bronze, silver, and gold files are ignored by Git. Large files are meant to live locally or in Cloudflare R2, not in the repository.

## Year Configuration

Configured years live in:

```text
config/pipeline_years.json
```

Example:

```json
{
  "dvf_years": [2020, 2021, 2022, 2023, 2024],
  "filosofi_years": [2017]
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
python scripts/build_filosofi.py --year 2017
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

## Pipeline Behavior

### DVF

- `data/scripts/download_dvf.py --year YYYY`
  downloads DVF raw data into `data/raw/dvf/year=YYYY/`
- `data/scripts/build_bronze.py --year YYYY`
  preserves original DVF columns and adds `year`
- `data/scripts/build_silver.py --year YYYY`
  keeps residential sales, converts numeric fields, computes `price_m2`, and keeps `year`
- `data/scripts/build_gold.py --year YYYY`
  writes:
  - `data/gold/dvf/year=YYYY/dvf_national.parquet`
  - `data/gold/dvf/year=YYYY/dvf_by_department.parquet`
  - `data/gold/dvf/year=YYYY/dvf_by_property_type.parquet`
  - `data/gold/dvf/year=YYYY/dvf_commune_indicators.parquet`

### FiLoSoFi

- `data/scripts/download_filosofi.py --year YYYY`
  downloads the matching INSEE resource into `data/raw/filosofi/year=YYYY/`
- `data/scripts/build_filosofi_bronze.py --year YYYY`
  preserves original columns and source metadata
- `data/scripts/build_filosofi_silver.py --year YYYY`
  standardizes commune and department indicators and keeps `year`
- `data/scripts/build_filosofi_gold.py --year YYYY`
  writes:
  - `data/gold/filosofi/year=YYYY/filosofi_commune_indicators.parquet`
  - `data/gold/filosofi/year=YYYY/filosofi_department_indicators.parquet`

### Commune-Year Join

`data/scripts/build_commune_year.py` creates:

```text
data/gold/commune_year/commune_year.parquet
```

This table merges available commune-year indicators from DVF and FiLoSoFi when keys exist. It may contain:

- `commune_code`
- `commune_name`
- `department_code`
- `year`
- DVF indicators
- FiLoSoFi indicators
- combined ratios such as `price_income_ratio` when both sources exist

No values are invented. If a dataset is missing for a given year, the columns remain empty for that source.

## Frontend Outputs

The latest configured year for each dataset is also exported to:

- `public/data/dvf_summary.json`
- `public/data/dvf_preview.json`
- `public/data/filosofi_summary.json`
- `public/data/filosofi_preview.json`

These public JSON files are lightweight and remain the inputs consumed by the frontend.

## Cloudflare R2

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
