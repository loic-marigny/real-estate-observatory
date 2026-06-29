# Data Pipeline

This directory contains the Python pipelines that prepare DVF and FiLoSoFi for the observatory.

The active architecture is:

- dataset-oriented
- multi-year
- partitioned by `year=YYYY`
- explicitly split into `raw`, `bronze`, `silver` and `gold`

It is not a flat single-vintage pipeline anymore.

## Pipeline goals

The data layer has four objectives:

1. Normalize heterogeneous public source files.
2. Build stable analytical tables for charts and exploration.
3. Publish lightweight frontend previews under `public/data/`.
4. Publish larger analytical artifacts to Cloudflare R2.

## Directory layout

```text
data/
├── raw/
│   ├── dvf/year=YYYY/
│   └── filosofi/year=YYYY/
├── bronze/
│   ├── dvf/year=YYYY/
│   └── filosofi/year=YYYY/
├── silver/
│   ├── dvf/year=YYYY/
│   └── filosofi/year=YYYY/
└── gold/
    ├── dvf/year=YYYY/
    ├── filosofi/year=YYYY/
    └── commune_year/
```

Locally generated artifacts in `data/raw`, `data/bronze`, `data/silver`, `data/gold` and `reports` are ignored by Git.

`public/data/` is separate: its generated JSON files are versioned because the frontend consumes them directly.

## Script families

- `data/scripts/dvf/`: DVF download and transformations
- `data/scripts/filosofi/`: FiLoSoFi download and transformations
- `data/scripts/publishing/`: preview generation and publication helpers
- `scripts/orchestration/`: user-facing entrypoints
- `scripts/storage/`: R2 upload helpers
- `scripts/shared/`: shared configuration loaders

## Configuration files

### `config/pipeline_years.json`

Defines the DVF years that the project considers part of the active pipeline.

Current configured years:

- `2014`
- `2015`
- `2016`
- `2017`
- `2018`
- `2019`
- `2020`
- `2021`
- `2022`
- `2023`
- `2024`

### `config/filosofi_sources.json`

This is the FiLoSoFi source catalogue. It is the source of truth for:

- enabled years
- available years
- missing years
- default year
- source family and publication metadata
- methodological flags

### `config/filosofi_canonical_columns.json`

Defines the mapping from published FiLoSoFi columns to the project’s canonical variables.

This file matters because FiLoSoFi vintages do not expose exactly the same schema.

## Main commands

Build one DVF year:

```bash
python -m scripts.orchestration.build_dvf --year 2024
```

Build all configured DVF years:

```bash
python -m scripts.orchestration.build_dvf --all-configured
```

Build one FiLoSoFi year:

```bash
python -m scripts.orchestration.build_filosofi --year 2021
```

Build all configured FiLoSoFi years:

```bash
python -m scripts.orchestration.build_filosofi --all-configured
```

Force a fresh FiLoSoFi download and rebuild:

```bash
python -m scripts.orchestration.build_filosofi --year 2021 --force
python -m scripts.orchestration.build_filosofi --all-configured --force
```

Run the full orchestrator:

```bash
python -m scripts.orchestration.run_pipeline
```

Upload a local directory to R2:

```bash
python -m scripts.storage.r2_upload --local data/gold/filosofi --remote-prefix gold/filosofi
```

## DVF pipeline

## Source families

DVF is split across two families of source files:

- `2014-2020`: legacy DGFiP raw exports
- `2021+`: normalized Geo-DVF `full.csv.gz`

The legacy inputs may be:

- plain text / CSV
- pipe-separated
- ZIP archives
- values with French decimal commas
- no latitude / longitude in some vintages

The modern Geo-DVF inputs are cleaner and more standardized.

The project deliberately normalizes both families into the same internal schema before analytics.

## Bronze assumptions

Implemented in `data/scripts/dvf/build_bronze.py`.

The bronze step:

- resolves the raw file already present locally
- auto-detects compression:
  - plain text
  - gzip
  - zip
- auto-detects delimiter
- normalizes headers to canonical names
- keeps only the canonical subset needed downstream
- repairs short commune codes by prefixing them with the department code

Bronze is not yet the analytical layer. It is the schema-normalization layer.

## Silver assumptions

Implemented in `data/scripts/dvf/build_silver.py`.

The silver step keeps only rows that satisfy all of the following:

- `nature_mutation == "Vente"`
- `type_local` in `Maison`, `Appartement`
- `valeur_fonciere > 0`
- `surface_reelle_bati > 0`
- non-empty `code_departement`

It then computes:

- `price_m2 = valeur_fonciere / surface_reelle_bati`

It removes outliers with these hard thresholds:

- `price_m2` between `300` and `50_000`
- `surface_reelle_bati` between `9` and `1_000`

These are modeling choices, not properties of the source.

## Gold outputs

Each DVF year produces:

```text
data/gold/dvf/year=YYYY/dvf_national.parquet
data/gold/dvf/year=YYYY/dvf_by_department.parquet
data/gold/dvf/year=YYYY/dvf_by_property_type.parquet
data/gold/dvf/year=YYYY/dvf_commune_indicators.parquet
```

The gold summary also generates:

- `public/data/dvf_summary.json`

Metrics currently produced include:

- sales count
- national median `price_m2`
- national `D1` and `D9` on `price_m2`
- national median built surface
- departmental median `price_m2`
- commune median `price_m2`

Important limitation:

- Bas-Rhin, Haut-Rhin and Moselle are absent from DVF outputs because the raw public source itself excludes them.

## DVF public previews

Implemented in `data/scripts/publishing/build_public_previews.py`.

For DVF, the preview source is the yearly silver parquet.

Generated files:

- `public/data/dvf_preview.json`
- `public/data/dvf_previews/year=YYYY/dvf_preview.json`

Preview semantics:

- `rows`: full row count of the silver file
- `columns_count`: full column count of the silver file
- `records`: first `500` rows only
- `source_file_location`: relative raw-source location used for that year

This matters because the Data Explorer may later display fewer columns for a specific selected year if a fallback path uses a narrower live parquet schema.

## FiLoSoFi pipeline

## Why FiLoSoFi is more complex

FiLoSoFi is not a single stable schema across all years.

The project therefore uses:

- a year source catalogue
- canonical column mappings
- explicit methodological flags
- separate official and derived department outputs

## Bronze and silver intent

The exact download and normalization details depend on the configured source family for each year, but the goal is always the same:

- ingest the published files for the year
- normalize them into a common silver representation
- preserve missingness rather than fabricate indicators

## Gold harmonization choices

Implemented in `data/scripts/filosofi/build_gold.py`.

The canonical gold schema includes:

- geography identifiers
- geography level
- year
- source-generation flags
- official / derived flags
- comparability flags
- income and poverty indicators

Important choices:

- if a variable is not published for a year, it stays `null`
- `d5_income` stays `null` in the harmonized gold layer because there is no explicit published `D5` source column in the configured catalogue
- `2023` is treated as a methodological break because it belongs to FiLoSoFi 2

## Department logic

Department rows are split into two families:

### Official department rows

Used when the source year actually publishes department-level values.

These rows are marked:

- `indicator_source = official_insee`
- `is_official = true`

### Derived department rows

Used when no official department-level source is available and the project derives a department aggregate from commune rows.

These rows are marked:

- `indicator_source = derived_from_communes`
- `is_official = false`
- `comparable_with_previous_years = false`

Derived rows are not interchangeable with official rows.

## Weighting assumptions

When FiLoSoFi needs an aggregate, the project chooses the weight column in this order:

1. `tax_households` if available
2. otherwise `population` if available
3. otherwise unweighted fallback

The gold builder uses:

- weighted medians for most income indicators
- weighted means for poverty rate

This is a project modeling choice. It is not equivalent to reconstructing the exact true national distribution from microdata.

## FiLoSoFi outputs

Each processed year produces:

```text
data/gold/filosofi/year=YYYY/filosofi_commune_indicators.parquet
data/gold/filosofi/year=YYYY/filosofi_department_indicators.parquet
data/gold/filosofi/year=YYYY/filosofi_summary.json
```

The pipeline also maintains consolidated files:

```text
data/gold/filosofi/commune_all_years.parquet
data/gold/filosofi/department_official/department_all_years.parquet
data/gold/filosofi/department_derived/department_all_years.parquet
data/gold/filosofi/metadata.json
data/gold/filosofi/indicator_availability.json
data/gold/filosofi/summaries_by_year.json
reports/filosofi_schema_comparison.csv
```

These consolidated artifacts are the main source for browser-side querying.

## Public FiLoSoFi files

The pipeline generates and may publish locally:

- `public/data/filosofi_summary.json`
- `public/data/filosofi_summaries.json`
- `public/data/filosofi_preview.json`

It also keeps:

- `public/data/filosofi_national_series.json`

Important distinction:

- `filosofi_preview.json` is a static preview of the yearly silver layer
- the Data Explorer FiLoSoFi table is a live query over consolidated gold parquet files
- the homepage national chart relies on `filosofi_national_series.json` when official national series exist

## Commune-year merged output

The merged analytical output is:

```text
data/gold/commune_year/commune_year.parquet
```

Its design principle is conservative:

- join available commune-year indicators across sources
- do not invent missing values
- keep the temporal and methodological gaps visible

## What is versioned, generated and published

## Versioned in Git

- code
- workflows
- configuration
- documentation
- `public/data/*.json`
- `public/data/*.geojson`

## Generated locally and ignored by Git

- `data/raw/**`
- `data/bronze/**`
- `data/silver/**`
- `data/gold/**`
- `reports/**`

## Published to R2

DVF workflow:

- `silver/dvf/year=YYYY/...`
- `gold/dvf/year=YYYY/...`

FiLoSoFi workflow:

- `silver/filosofi/year=YYYY/...`
- `gold/filosofi/year=YYYY/...`
- consolidated FiLoSoFi parquet and JSON metadata
- `reports/filosofi_schema_comparison.csv`

Global workflow:

- `gold/commune_year/commune_year.parquet`

## Files directly used by the frontend

Local bundled files:

- `public/data/dvf_summary.json`
- `public/data/dvf_preview.json`
- `public/data/dvf_previews/year=YYYY/dvf_preview.json`
- `public/data/filosofi_summary.json`
- `public/data/filosofi_summaries.json`
- `public/data/filosofi_national_series.json`
- `public/data/filosofi_preview.json`
- `public/data/departements.geojson`

Remote files:

- `gold/filosofi/metadata.json`
- `gold/filosofi/indicator_availability.json`
- `gold/filosofi/commune_all_years.parquet`
- `gold/filosofi/department_official/department_all_years.parquet`
- `gold/filosofi/department_derived/department_all_years.parquet`

## R2 variables

Required by upload scripts and GitHub Actions:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT_URL`
- `R2_BUCKET_NAME`

These are server-side only.

## Public URL expectations

The frontend concatenates:

- `VITE_DATA_ASSET_BASE_URL`
- plus `gold/filosofi/...`

So the public base URL must already include any path prefix.

Example:

```text
https://example.r2.dev/real-estate-portfolio/gold/filosofi/metadata.json
https://example.r2.dev/real-estate-portfolio/gold/filosofi/commune_all_years.parquet
```

## Validation

Main validation commands:

```bash
npm run build
npm test
python -m unittest discover -s tests
```

Use the root [README.md](../README.md) for the frontend setup and high-level architecture.
