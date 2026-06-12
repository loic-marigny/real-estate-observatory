# Data Pipeline

This directory contains local scripts and ignored raw files used to prepare DVF-derived frontend assets.

## Raw Files

Raw source files are stored in:

- `data/raw/`

These raw files are ignored by Git. The repository keeps the folder structure, but not the downloaded archives or extracted CSV files.

## Scripts

Download the latest available DVF archive:

```bash
python data/scripts/download_dvf.py
```

The script runs independently, creates `data/raw/` automatically, skips the download if `data/raw/dvf_latest.csv.gz` already exists, and resolves the latest published DVF year from the official index before downloading `full.csv.gz`.

Prepare the local summary JSON from the downloaded DVF archive:

```bash
python data/scripts/prepare_dvf_sample.py
```

This script extracts a readable `data/raw/dvf_full.csv` from `data/raw/dvf_latest.csv.gz` when needed, then computes `public/data/dvf_summary.json` from the full national dataset.

## Pipeline Overview

1. `download_dvf.py` queries the official DVF index, resolves the latest available yearly archive, and downloads it into `data/raw/`.
2. Raw files remain local and are not committed.
3. `prepare_dvf_sample.py` extracts `data/raw/dvf_full.csv` from the downloaded archive if the readable CSV is missing or outdated.
4. The script cleans and filters residential sales from the full CSV.
5. The script writes `public/data/dvf_summary.json` for the frontend with coverage across all departments present in the national DVF file.

## Notes

- `download_dvf.py` uses the `DOWNLOAD_URL` and `OUTPUT_FILENAME` constants at the top of the file so the source archive can be replaced later without changing the script structure.
- Raw archives in `data/raw/` are ignored by Git and should not be committed.
- `prepare_dvf_sample.py` keeps its historical filename, but it now processes the full downloaded DVF dataset rather than a manually added sample file.
- The frontend continues to read `/data/dvf_summary.json`; there is no backend dependency in this pipeline.
