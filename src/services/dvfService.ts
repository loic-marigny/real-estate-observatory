import type { DvfDepartmentSummary, DvfSummary, DvfTrendResult } from '../types/realEstate'
import { duckdbClient } from './duckdbClient'
import { dvfAssetUrls } from './dataAssetConfig'

const DVF_SUMMARY_URL = '/data/dvf_summary.json'

const asNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return null
}

const normalizeDepartment = (
  departmentCode: string,
  salesCountByDepartment: Record<string, number>,
  medianPricePerSquareMeterByDepartment: Record<string, number | null>,
): DvfDepartmentSummary => ({
  departmentCode,
  salesCount: salesCountByDepartment[departmentCode] ?? 0,
  medianPricePerSquareMeter:
    medianPricePerSquareMeterByDepartment[departmentCode] ?? null,
})

const normalizeDvfSummary = (data: unknown): DvfSummary => {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid DVF summary payload')
  }

  const record = data as Record<string, unknown>
  const filtersRecord =
    typeof record.filters === 'object' && record.filters !== null
      ? (record.filters as Record<string, unknown>)
      : {}
  const salesCountByDepartment =
    typeof (record.salesCountByDepartment ?? record.sales_count_by_department) ===
      'object' &&
    (record.salesCountByDepartment ?? record.sales_count_by_department) !== null
      ? Object.fromEntries(
          Object.entries(
            (record.salesCountByDepartment ??
              record.sales_count_by_department) as Record<string, unknown>,
          ).map(([key, value]) => [key, typeof value === 'number' ? value : 0]),
        )
      : {}

  const medianPricePerSquareMeterByDepartment =
    typeof (
      record.medianPricePerSquareMeterByDepartment ??
      record.median_price_m2_by_department
    ) === 'object' &&
    (record.medianPricePerSquareMeterByDepartment ??
      record.median_price_m2_by_department) !== null
      ? Object.fromEntries(
          Object.entries(
            (record.medianPricePerSquareMeterByDepartment ??
              record.median_price_m2_by_department) as Record<string, unknown>,
          ).map(
            ([key, value]) => [key, asNumberOrNull(value)],
          ),
        )
      : {}

  const medianPricePerSquareMeterByPropertyType =
    typeof (
      record.medianPricePerSquareMeterByPropertyType ??
      record.median_price_m2_by_property_type
    ) === 'object' &&
    (record.medianPricePerSquareMeterByPropertyType ??
      record.median_price_m2_by_property_type) !== null
      ? Object.fromEntries(
          Object.entries(
            (record.medianPricePerSquareMeterByPropertyType ??
              record.median_price_m2_by_property_type) as Record<
              string,
              unknown
            >,
          ).map(([key, value]) => [key, asNumberOrNull(value)]),
        )
      : {}

  const departmentCodes = Array.from(
    new Set([
      ...Object.keys(salesCountByDepartment),
      ...Object.keys(medianPricePerSquareMeterByDepartment),
    ]),
  ).sort()

  return {
    generatedAt:
      typeof (record.generatedAt ?? record.generated_at) === 'string'
        ? ((record.generatedAt ?? record.generated_at) as string)
        : '',
    sourceFile:
      typeof (record.sourceFile ?? record.source_file) === 'string'
        ? ((record.sourceFile ?? record.source_file) as string)
        : '',
    filters: {
      mutationTypes: Array.isArray(filtersRecord.mutationTypes)
        ? (filtersRecord.mutationTypes as string[])
        : typeof filtersRecord.nature_mutation === 'string'
          ? [filtersRecord.nature_mutation]
          : [],
      residentialTypes: Array.isArray(filtersRecord.residentialTypes)
        ? (filtersRecord.residentialTypes as string[])
        : Array.isArray(filtersRecord.property_types)
          ? (filtersRecord.property_types as string[])
          : [],
    },
    totalSalesCount:
      typeof (record.totalSalesCount ?? record.total_sales_count) === 'number'
        ? ((record.totalSalesCount ?? record.total_sales_count) as number)
        : 0,
    medianPricePerSquareMeter: asNumberOrNull(
      record.medianPricePerSquareMeter ?? record.median_price_m2,
    ),
    medianSurface: asNumberOrNull(record.medianSurface ?? record.median_surface),
    salesCountByDepartment,
    medianPricePerSquareMeterByDepartment,
    medianPricePerSquareMeterByPropertyType,
    departments: departmentCodes.map((departmentCode) =>
      normalizeDepartment(
        departmentCode,
        salesCountByDepartment,
        medianPricePerSquareMeterByDepartment,
      ),
    ),
  }
}

export async function getDvfSummary(): Promise<DvfSummary> {
  const response = await fetch(DVF_SUMMARY_URL)

  if (!response.ok) {
    throw new Error(`Failed to load DVF summary: ${response.status}`)
  }

  const data = (await response.json()) as unknown
  return normalizeDvfSummary(data)
}

const escapeSqlStringLiteral = (value: string): string =>
  `'${value.replaceAll("'", "''")}'`

// List of years to try loading
// These years have data available on R2
const DVF_YEARS = [2021, 2022, 2023, 2024]

const getDvfNationalParquetUrl = (year: number): string =>
  dvfAssetUrls.yearParquet(year)

async function loadDvfYearData(year: number): Promise<Array<Record<string, unknown>> | null> {
  const parquetUrl = getDvfNationalParquetUrl(year)
  const escapedUrl = escapeSqlStringLiteral(parquetUrl)

  const decileSql = `
    SELECT
      CAST(year AS INTEGER) AS year,
      median_price_m2,
      d1_price_m2,
      d9_price_m2
    FROM read_parquet(${escapedUrl})
    WHERE year = ${year}
      AND median_price_m2 IS NOT NULL
      AND median_price_m2 > 0
  `

  const medianOnlySql = `
    SELECT
      CAST(year AS INTEGER) AS year,
      median_price_m2
    FROM read_parquet(${escapedUrl})
    WHERE year = ${year}
      AND median_price_m2 IS NOT NULL
      AND median_price_m2 > 0
  `

  const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error)

  try {
    return await duckdbClient.query(decileSql)
  } catch (error) {
    const message = errorMessage(error)
    if (
      /column .* does not exist|no such column|Catalog entry not found|Referenced column .* not found/i.test(
        message,
      )
    ) {
      try {
        return await duckdbClient.query(medianOnlySql)
      } catch {
        // File might not exist for this year, silently skip
        console.debug(`DVF data not available for year ${year}`)
        return null
      }
    }

    console.debug(`DVF data not available for year ${year}`)
    return null
  }
}

export async function queryDvfTrend(): Promise<DvfTrendResult> {
  // Load all years in parallel
  const yearResults = await Promise.all(DVF_YEARS.map((year) => loadDvfYearData(year)))

  const allRows: Array<Record<string, unknown>> = []
  for (const rows of yearResults) {
    if (rows && rows.length > 0) {
      allRows.push(...rows)
    }
  }

  if (allRows.length === 0) {
    throw new Error('Impossible de charger les tendances DVF')
  }

  const points = allRows
    .map((row) => ({
      year: typeof row.year === 'number' ? row.year : Number(row.year),
      medianPricePerSquareMeter:
        typeof row.median_price_m2 === 'number' ? row.median_price_m2 : null,
      d1PricePerSquareMeter:
        typeof row.d1_price_m2 === 'number' ? row.d1_price_m2 : null,
      d9PricePerSquareMeter:
        typeof row.d9_price_m2 === 'number' ? row.d9_price_m2 : null,
    }))
    .filter((point) => Number.isFinite(point.year))
    .sort((a, b) => a.year - b.year)

  return {
    availableYears: points.map((p) => p.year).sort((a, b) => a - b),
    points,
  }
}
