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

If a source year is not yet available upstream at the required geographic level, remove it from the config until it can be ingested reliably.

## Local Commands

Process one DVF year:

```bash
python scripts/build_dvf.py --year 2024
```

Process one FiLoSoFi year:

```bash
python scripts/build_filosofi.py --year 2021
```

Download only one bronze FiLoSoFi source year:

```bash
python data/scripts/download_filosofi.py --year 2018
python data/scripts/download_filosofi.py --year 2019
python data/scripts/download_filosofi.py --year 2020
python data/scripts/download_filosofi.py --year 2021
python data/scripts/download_filosofi.py --year 2023
```

Force a fresh download:

```bash
python data/scripts/download_filosofi.py --year 2021 --force
python scripts/build_filosofi.py --all-configured --force
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

The FiLoSoFi source configuration is centralized in `config/filosofi_sources.json`.

| Annee | Dispositif | Source | Format | Portee |
| --- | --- | --- | --- | --- |
| 2018 | Filosofi | archive communale | ZIP/XLSX | communes et arrondissements municipaux |
| 2019 | Filosofi | archive communale | ZIP/XLSX | communes et arrondissements municipaux |
| 2020 | Filosofi | archive communale | ZIP/XLSX | communes et arrondissements municipaux |
| 2021 | Filosofi | archive communale | ZIP/XLSX | communes et arrondissements municipaux |
| 2022 | absent | non publie | - | - |
| 2023 | Filosofi 2 | fichier tous niveaux | ZIP/CSV | plusieurs niveaux geographiques |

### 2017

The legacy 2017 path still uses the official `data.gouv.fr` dataset metadata and produces the existing raw / bronze / silver / gold layers:

- `data/raw/filosofi/year=2017/`
- `data/bronze/filosofi/year=2017/filosofi_bronze.parquet`
- `data/silver/filosofi/year=2017/filosofi_silver.parquet`
- `data/gold/filosofi/year=2017/filosofi_commune_indicators.parquet`
- `data/gold/filosofi/year=2017/filosofi_department_indicators.parquet`

### 2020 Bronze Ingestion

The post-2017 ingestion is intentionally bronze-only at this stage. The historical Filosofi years 2018, 2019, 2020, and 2021 all use commune-level XLSX ZIP archives with six workbooks. The pipeline preserves the original archives and extracts the workbooks without modifying them.

Official pages and archive links:

- 2018: `https://www.insee.fr/fr/statistiques/5009218`
- 2018 archive: `https://www.insee.fr/fr/statistiques/fichier/5009218/indic-struct-distrib-revenu-2018-COMMUNES.zip`
- 2019: `https://www.insee.fr/fr/statistiques/6036907`
- 2019 archive: `https://www.insee.fr/fr/statistiques/fichier/6036907/indic-struct-distrib-revenu-2019-COMMUNES.zip`
- 2020: `https://www.insee.fr/fr/statistiques/6692220`
- 2020 archive: `https://www.insee.fr/fr/statistiques/fichier/6692220/indic-struct-distrib-revenu-2020-COMMUNES_XLSX.zip`
- 2021: `https://www.insee.fr/fr/statistiques/7756855`
- 2021 archive: `https://www.insee.fr/fr/statistiques/fichier/7756855/indic-struct-distrib-revenu-2021-COMMUNES_XLSX.zip`

The archive naming differs slightly by year:

- 2018 and 2019: `...COMMUNES.zip`
- 2020 and 2021: `...COMMUNES_XLSX.zip`

The 2018 to 2021 workbooks expose the same six families, with minor filename case differences for `Pauvres`:

- `FILO<YEAR>_DEC_COM.xlsx`
- `FILO<YEAR>_DEC_Pauvres_COM.xlsx` or `FILO<YEAR>_DEC_PAUVRES_COM.xlsx`
- `FILO<YEAR>_DISP_COM.xlsx`
- `FILO<YEAR>_DISP_Pauvres_COM.xlsx` or `FILO<YEAR>_DISP_PAUVRES_COM.xlsx`
- `FILO<YEAR>_TRDECILES_DEC_COM.xlsx`
- `FILO<YEAR>_TRDECILES_DISP_COM.xlsx`

These archives all preserve the same workbook families:

- `DEC`: declared income before redistribution
- `DISP`: disposable income and standard of living after redistribution
- `PAUVRES`: indicators focused on poor or low-income households
- `TRDECILES`: income composition by decile band
- `COM`: commune level, including municipal arrondissements for Paris, Lyon, and Marseille

The bronze ingestion preserves the original archive and extracts the real XLSX files without modifying or merging them:

```text
data/bronze/filosofi/year=YYYY/
├── source/
│   └── <archive d'origine>
├── extracted/
│   └── <fichiers internes reels>
└── manifest.json
```

`manifest.json` records the source URLs, final resolved download URL, UTC download timestamp, archive size, archive SHA-256, extracted file sizes and SHA-256 values, workbook sheet names, publication date, reference geography, territorial coverage, validation status, and methodological warnings when needed.

The workbooks are not fused at this stage. Their internal structure is preserved:

- rows 1 to 4: title, vintage, geography, source
- row 5: human-readable labels
- row 6: technical variable codes
- row 7 onward: observations

Common sheets include:

- `Sommaire`
- `ENSEMBLE`
- population subgroups such as `TRAGERF_*`, `TAILLEM_*`, `OCCTYPR_*`, `OCCTYPD_*`, `TYPMENR_*`, `OPRDEC_*`, `TRDEC_*`
- `Variables`
- `Documentation générale`
- thematic documentation
- `Seuils`

Important source semantics:

- `CODGEO` is the geographic code
- `LIBGEO` is the geographic label
- `s` means the value is protected by statistical secrecy or not diffused

The bronze layer preserves `s` exactly as published. It is not converted to zero or null at this stage.

Special year-level metadata:

- 2018 is published with geography `2019-01-01`
- 2019 is published with geography `2020-01-01`
- 2020 is published with geography `2021-01-01`
- 2021 is published with geography `2022-01-01`
- the 2021 archive currently published on the official page supersedes the initial `2024-01-29` release after corrections documented by INSEE on `2024-03-12`

### 2023 Bronze Ingestion

The 2023 source belongs to `Filosofi 2` and is not directly comparable to 2018-2021. The bronze ingestion therefore preserves it separately and does not harmonize its columns with the historical workbooks.

Official page:

- `https://www.insee.fr/fr/statistiques/8984752`

The pipeline discovers the CSV link for the block:

- `Revenus et pauvreté des ménages en 2023 - Tous les niveaux géographiques`

and prefers the CSV archive over the XLSX variant. The current published archive resolves to:

- `https://www.insee.fr/fr/statistiques/fichier/8984752/FILOSOFI_CC_csv.zip`

The 2023 bronze layer preserves:

```text
data/bronze/filosofi/year=2023/
├── source/
│   └── FILOSOFI_CC_csv.zip
├── extracted/
│   ├── DS_FILOSOFI_CC_2023_data.csv
│   └── DS_FILOSOFI_CC_2023_metadata.csv
└── manifest.json
```

The 2023 manifest includes:

- the final discovered URL
- the archive SHA-256
- the CSV delimiter and encoding
- the list of columns
- the distinct `GEO_OBJECT` values
- the list of `FILOSOFI_MEASURE` values
- the row count
- a methodological break flag

The published 2023 CSV schema is:

- `FILOSOFI_MEASURE`
- `GEO`
- `GEO_OBJECT`
- `UNIT_MEASURE`
- `CONF_STATUS`
- `OBS_STATUS`
- `UNIT_MULT`
- `TIME_PERIOD`
- `OBS_VALUE`

The current bronze inspection records these geographic levels:

- `AAV2020`
- `ARM`
- `ARR`
- `BV2022`
- `COM`
- `DEP`
- `EPCI`
- `FRANCE`
- `OTHER`
- `REG`
- `UU2020`
- `ZE2020`

The bronze inspection also records the published measures, including:

- `MED_SL`
- `PR_MD60`
- deciles `D1_SL` to `D9_SL`
- quartiles `Q1_SL`, `Q3_SL`
- `GI_SL`
- `S80S20_SL`
- disposable income components such as `S_DIR_TAX_DI`, `S_EI_DI`, `S_RET_PEN_DI`, `S_SOC_BEN_DI`

Because `Filosofi 2` uses a normalized multi-geography structure, it must be handled by a dedicated future silver normalization path.

### Future FiLoSoFi Silver Decisions

The post-2017 bronze ingestion deliberately avoids premature normalization. The next silver step will need explicit decisions about:

- which of the six workbooks should feed the main commune-level analytical table
- whether `DEC` and `DISP` remain separate datasets or are normalized into one shared schema
- how to represent subgroup sheets without flattening incompatible populations together
- how to convert `s` into nulls plus an explicit secrecy flag
- how and when department-level indicators should be sourced from official department files instead of recalculated from commune data
- how to split the 2023 multi-geography file by level without losing the normalized measure structure
- how to handle the methodological break between `Filosofi` and `Filosofi 2`

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
