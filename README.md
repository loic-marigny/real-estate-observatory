# Real Estate Observatory Frontend

Frontend React + TypeScript + Vite for the real-estate observatory.

## Data Access

The application now uses two complementary data access modes:

- lightweight JSON metadata for UI orchestration
- DuckDB-Wasm in the browser for FiLoSoFi Parquet queries

FiLoSoFi UI orchestration uses:

- `gold/filosofi/metadata.json`
- `gold/filosofi/indicator_availability.json`

FiLoSoFi tabular queries use DuckDB-Wasm against:

- `gold/filosofi/commune_all_years.parquet`
- `gold/filosofi/department_official/department_all_years.parquet`
- `gold/filosofi/department_derived/department_all_years.parquet`

DuckDB-Wasm was chosen because the site remains a static frontend on GitHub Pages. This keeps the first analytical access layer inside the browser without introducing a backend API at this stage.

## Configuration

Set the public base URL for R2 assets with:

```bash
VITE_DATA_ASSET_BASE_URL=https://<public-r2-host>
```

Example expected runtime layout:

```text
https://<public-r2-host>/gold/filosofi/metadata.json
https://<public-r2-host>/gold/filosofi/indicator_availability.json
https://<public-r2-host>/gold/filosofi/commune_all_years.parquet
```

If `VITE_DATA_ASSET_BASE_URL` is not set, the app falls back to root-relative paths such as `/gold/filosofi/...`.

## Required R2 Settings

DuckDB-Wasm reads remote Parquet files over HTTP. Cloudflare R2 must therefore expose:

- public `GET`, `HEAD`, and `OPTIONS`
- CORS allowing the GitHub Pages origin
- support for `Range` requests
- exposed headers including `Accept-Ranges`, `Content-Length`, `Content-Range`, and `ETag`

Without that configuration, FiLoSoFi queries in the browser will fail even if the files exist in the bucket.

## FiLoSoFi Rules

The frontend does not hardcode FiLoSoFi years or indicators.

Availability is determined from `metadata.json` and `indicator_availability.json`, including:

- `2022` excluded
- `D2` to `D8` absent in `2017`
- commune deciles absent in `2023`
- official and derived department datasets kept separate
- methodological break warning for `2023` and FiLoSoFi 2

To add a future vintage, update the pipeline outputs and metadata on R2. The interface should adapt without hardcoded year changes.

## Commands

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Build the frontend:

```bash
npm run build
```

## Current Limits

- DuckDB-Wasm is only used for FiLoSoFi at this stage
- no temporal charts are implemented yet
- no backend filtering API exists yet
- no advanced cache beyond in-memory metadata caching is implemented
