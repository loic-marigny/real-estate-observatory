import { duckdbClient } from './duckdbClient'
import { filosofiAssetUrls, getFilosofiParquetUrl } from './dataAssetConfig'
import type {
  FilosofiDepartmentSource,
  FilosofiGeographyLevel,
  FilosofiIndicator,
  FilosofiIndicatorAvailability,
  FilosofiIndicatorAvailabilityBySource,
  FilosofiIndicatorAvailabilityEntry,
  FilosofiIndicatorOption,
  FilosofiMetadata,
  FilosofiQueryParams,
  FilosofiQueryResult,
  FilosofiQueryRow,
  FilosofiTrendIndicator,
  FilosofiTrendResult,
  FilosofiTrendSeries,
} from '../types/realEstate'

export type FilosofiResultColumn = {
  key: keyof FilosofiQueryRow
  label: string
  type: 'text' | 'number'
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const DEFAULT_SORT_DIRECTION = 'asc'
const AVAILABILITY_LEVEL_KEYS = [
  'commune',
  'department_official',
  'department_derived',
] as const

type AvailabilityLevelKey = (typeof AVAILABILITY_LEVEL_KEYS)[number]

export const FILOSOFI_INDICATOR_LABELS: Record<FilosofiIndicator, string> = {
  median_income: 'Revenu médian',
  d1_income: 'Décile D1',
  d2_income: 'Décile D2',
  d3_income: 'Décile D3',
  d4_income: 'Décile D4',
  d5_income: 'Décile D5',
  d6_income: 'Décile D6',
  d7_income: 'Décile D7',
  d8_income: 'Décile D8',
  d9_income: 'Décile D9',
  poverty_rate: 'Taux de pauvreté',
  tax_households: 'Ménages fiscaux',
  population: 'Population',
}

export const RESULT_COLUMNS: FilosofiResultColumn[] = [
  { key: 'geographyCode', label: 'Code', type: 'text' },
  { key: 'geographyName', label: 'Libellé', type: 'text' },
  { key: 'indicatorValue', label: 'Valeur', type: 'number' },
  { key: 'indicatorSource', label: 'Source', type: 'text' },
  { key: 'isOfficial', label: 'Officiel', type: 'text' },
  { key: 'methodologyVersion', label: 'Version méthodologique', type: 'text' },
  {
    key: 'comparableWithPreviousYears',
    label: 'Comparable aux années précédentes',
    type: 'text',
  },
]

const metadataCache = new Map<string, Promise<FilosofiMetadata>>()
const availabilityCache = new Map<string, Promise<FilosofiIndicatorAvailability>>()

const normalizeNumberArray = (value: unknown): number[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'number' ? item : Number(item)))
        .filter((item) => Number.isFinite(item))
    : []

const normalizeOptionalNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const normalizeIndicatorAvailabilityEntry = (
  value: unknown,
): FilosofiIndicatorAvailabilityEntry => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    available: record.available === true,
    coverage: normalizeOptionalNumber(record.coverage) ?? 0,
    official: record.official === true,
    indicatorSource:
      typeof record.indicatorSource === 'string'
        ? record.indicatorSource
        : typeof record.indicator_source === 'string'
          ? record.indicator_source
          : '',
    comparableWithPreviousYears:
      record.comparableWithPreviousYears === true ||
      record.comparable_with_previous_years === true,
  }
}

const normalizeIndicatorAvailabilityBySource = (
  value: unknown,
): FilosofiIndicatorAvailabilityBySource => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return Object.fromEntries(
    Object.entries(FILOSOFI_INDICATOR_LABELS).map(([indicator]) => [
      indicator,
      normalizeIndicatorAvailabilityEntry(record[indicator]),
    ]),
  ) as FilosofiIndicatorAvailabilityBySource
}

export const normalizeFilosofiMetadata = (payload: unknown): FilosofiMetadata => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid FiLoSoFi metadata payload')
  }
  const record = payload as Record<string, unknown>
  return {
    source: typeof record.source === 'string' ? record.source : 'INSEE FiLoSoFi',
    generatedAt:
      typeof (record.generatedAt ?? record.generated_at) === 'string'
        ? String(record.generatedAt ?? record.generated_at)
        : '',
    availableYears: normalizeNumberArray(record.availableYears ?? record.available_years),
    missingYears: normalizeNumberArray(record.missingYears ?? record.missing_years),
    methodologyBreaks: Array.isArray(record.methodologyBreaks ?? record.methodology_breaks)
      ? ((record.methodologyBreaks ?? record.methodology_breaks) as unknown[])
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
          .map((item) => ({
            year: normalizeOptionalNumber(item.year) ?? 0,
            label: typeof item.label === 'string' ? item.label : '',
            comparableToPreviousYear:
              item.comparableToPreviousYear === true ||
              item.comparable_to_previous_year === true,
          }))
          .filter((item) => item.year > 0)
      : [],
    datasets: {
      communeAllYears:
        typeof record.datasets === 'object' &&
        record.datasets &&
        typeof (record.datasets as Record<string, unknown>).communeAllYears === 'string'
          ? String((record.datasets as Record<string, unknown>).communeAllYears)
          : typeof record.datasets === 'object' &&
              record.datasets &&
              typeof (record.datasets as Record<string, unknown>).commune_all_years === 'string'
            ? String((record.datasets as Record<string, unknown>).commune_all_years)
            : '',
      departmentOfficialAllYears:
        typeof record.datasets === 'object' &&
        record.datasets &&
        typeof (record.datasets as Record<string, unknown>).departmentOfficialAllYears === 'string'
          ? String((record.datasets as Record<string, unknown>).departmentOfficialAllYears)
          : typeof record.datasets === 'object' &&
              record.datasets &&
              typeof (record.datasets as Record<string, unknown>).department_official_all_years === 'string'
            ? String((record.datasets as Record<string, unknown>).department_official_all_years)
            : '',
      departmentDerivedAllYears:
        typeof record.datasets === 'object' &&
        record.datasets &&
        typeof (record.datasets as Record<string, unknown>).departmentDerivedAllYears === 'string'
          ? String((record.datasets as Record<string, unknown>).departmentDerivedAllYears)
          : typeof record.datasets === 'object' &&
              record.datasets &&
              typeof (record.datasets as Record<string, unknown>).department_derived_all_years === 'string'
            ? String((record.datasets as Record<string, unknown>).department_derived_all_years)
            : '',
      indicatorAvailability:
        typeof record.datasets === 'object' &&
        record.datasets &&
        typeof (record.datasets as Record<string, unknown>).indicatorAvailability === 'string'
          ? String((record.datasets as Record<string, unknown>).indicatorAvailability)
          : typeof record.datasets === 'object' &&
              record.datasets &&
              typeof (record.datasets as Record<string, unknown>).indicator_availability === 'string'
            ? String((record.datasets as Record<string, unknown>).indicator_availability)
            : '',
    },
  }
}

export const normalizeFilosofiIndicatorAvailability = (
  payload: unknown,
): FilosofiIndicatorAvailability => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid FiLoSoFi indicator availability payload')
  }
  const record = payload as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(record)
      .map(([year, value]) => {
        const yearRecord = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
        return [
          year,
          {
            commune: normalizeIndicatorAvailabilityBySource(yearRecord.commune),
            department_official: normalizeIndicatorAvailabilityBySource(
              yearRecord.department_official,
            ),
            department_derived: normalizeIndicatorAvailabilityBySource(
              yearRecord.department_derived,
            ),
          },
        ]
      })
      .filter(([year]) => Number.isFinite(Number(year))),
  ) as FilosofiIndicatorAvailability
}

const fetchJson = async <T>(
  cache: Map<string, Promise<T>>,
  url: string,
  normalize: (payload: unknown) => T,
): Promise<T> => {
  const cached = cache.get(url)
  if (cached) {
    return cached
  }
  const promise = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return normalize((await response.json()) as unknown)
    })
    .catch((error) => {
      cache.delete(url)
      throw error
    })
  cache.set(url, promise)
  return promise
}

export const getMetadata = async (): Promise<FilosofiMetadata> =>
  fetchJson(metadataCache, filosofiAssetUrls.metadata(), normalizeFilosofiMetadata)

export const getIndicatorAvailability =
  async (): Promise<FilosofiIndicatorAvailability> =>
    fetchJson(
      availabilityCache,
      filosofiAssetUrls.indicatorAvailability(),
      normalizeFilosofiIndicatorAvailability,
    )

export const getAvailableYears = async (): Promise<number[]> => {
  const metadata = await getMetadata()
  return metadata.availableYears.filter((year) => year !== 2022)
}

export const getAvailabilityLevelKey = (
  geographyLevel: FilosofiGeographyLevel,
  departmentSource: FilosofiDepartmentSource = 'official',
): AvailabilityLevelKey =>
  geographyLevel === 'commune'
    ? 'commune'
    : departmentSource === 'derived'
      ? 'department_derived'
      : 'department_official'

export const getAvailableIndicatorsFromAvailability = (
  availability: FilosofiIndicatorAvailability,
  year: number,
  geographyLevel: FilosofiGeographyLevel,
  departmentSource: FilosofiDepartmentSource = 'official',
): FilosofiIndicatorOption[] => {
  const yearAvailability = availability[String(year)]
  if (!yearAvailability) {
    return []
  }
  const levelKey = getAvailabilityLevelKey(geographyLevel, departmentSource)
  const entries = yearAvailability[levelKey]
  return (Object.keys(FILOSOFI_INDICATOR_LABELS) as FilosofiIndicator[])
    .map((indicator) => ({
      indicator,
      label: FILOSOFI_INDICATOR_LABELS[indicator],
      ...(entries[indicator] ?? normalizeIndicatorAvailabilityEntry(null)),
    }))
    .filter((entry) => entry.available && entry.coverage > 0)
}

export const getAvailableIndicators = async (
  year: number,
  geographyLevel: FilosofiGeographyLevel,
  departmentSource: FilosofiDepartmentSource = 'official',
): Promise<FilosofiIndicatorOption[]> => {
  const availability = await getIndicatorAvailability()
  return getAvailableIndicatorsFromAvailability(
    availability,
    year,
    geographyLevel,
    departmentSource,
  )
}

const ALLOWED_SORT_COLUMNS = new Set([
  'geography_code',
  'geography_name',
  ...Object.keys(FILOSOFI_INDICATOR_LABELS),
])

const escapeSqlStringLiteral = (value: string): string =>
  `'${value.replaceAll("'", "''")}'`

const normalizeLimit = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_LIMIT
  }
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value)))
}

const normalizeOffset = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.trunc(value))
}

const normalizeSortDirection = (value: unknown): 'asc' | 'desc' =>
  value === 'desc' ? 'desc' : DEFAULT_SORT_DIRECTION

const normalizeSearch = (value: string | undefined): string => value?.trim() ?? ''

export const resolveFilosofiQueryAsset = (
  geographyLevel: FilosofiGeographyLevel,
  departmentSource: FilosofiDepartmentSource = 'official',
): string => getFilosofiParquetUrl(geographyLevel, departmentSource)

export const validateSortColumn = (
  sortBy: string | undefined,
  indicator: FilosofiIndicator,
): string => {
  if (!sortBy) {
    return indicator
  }
  if (!ALLOWED_SORT_COLUMNS.has(sortBy)) {
    throw new Error(`Unsupported sort column: ${sortBy}`)
  }
  return sortBy
}

type BuiltQuery = {
  sql: string
  countSql: string
  limit: number
  offset: number
  parquetUrl: string
}

export const buildFilosofiQuery = (
  params: FilosofiQueryParams,
  parquetUrl: string,
): BuiltQuery => {
  const limit = normalizeLimit(params.limit)
  const offset = normalizeOffset(params.offset)
  const sortDirection = normalizeSortDirection(params.sortDirection)
  const sortBy = validateSortColumn(params.sortBy, params.indicator)
  const search = normalizeSearch(params.search)
  const escapedParquetUrl = escapeSqlStringLiteral(parquetUrl)
  const yearFilter = `year = ${Math.trunc(params.year)}`
  const indicatorFilter = `${params.indicator} IS NOT NULL`
  const searchFilter = search
    ? ` AND (
      lower(coalesce(geography_code, '')) LIKE lower(${escapeSqlStringLiteral(`%${search}%`)})
      OR lower(coalesce(geography_name, '')) LIKE lower(${escapeSqlStringLiteral(`%${search}%`)})
    )`
    : ''
  const baseFrom = `FROM read_parquet(${escapedParquetUrl})`
  const whereClause = `WHERE ${yearFilter} AND ${indicatorFilter}${searchFilter}`
  const orderBy = `ORDER BY ${sortBy} ${sortDirection.toUpperCase()} NULLS LAST`

  return {
    sql: `
      SELECT
        geography_code,
        geography_name,
        geography_level,
        year,
        dispositif,
        source_generation,
        indicator_source,
        is_official,
        methodology_version,
        comparable_with_previous_years,
        ${params.indicator} AS indicator_value
      ${baseFrom}
      ${whereClause}
      ${orderBy}
      LIMIT ${limit}
      OFFSET ${offset}
    `,
    countSql: `
      SELECT count(*) AS total_rows
      ${baseFrom}
      ${whereClause}
    `,
    limit,
    offset,
    parquetUrl,
  }
}

export const FILOSOFI_TREND_INDICATORS: FilosofiTrendIndicator[] = [
  'median_income',
  'd1_income',
  'd9_income',
]

export const buildFilosofiTrendQuery = (
  params: {
    departmentSource?: FilosofiDepartmentSource
    indicators: FilosofiTrendIndicator[]
    years: number[]
  },
  parquetUrl: string,
): string => {
  const selectedIndicators = params.indicators.length
    ? params.indicators
    : FILOSOFI_TREND_INDICATORS

  const aggregates = selectedIndicators
    .map((indicator) => `avg(${indicator}) AS ${indicator}`)
    .join(',\n        ')

  const yearList = params.years
    .map((year) => `${Math.trunc(year)}`)
    .filter((year, index, array) => array.indexOf(year) === index)
    .join(', ')

  const escapedParquetUrl = escapeSqlStringLiteral(parquetUrl)

  return `
    SELECT
      year,
      ${aggregates}
    FROM read_parquet(${escapedParquetUrl})
    WHERE year IN (${yearList})
      AND year IS NOT NULL
    GROUP BY year
    ORDER BY year
  `
}

export const queryFilosofiTrend = async (
  params: {
    geographyLevel: FilosofiGeographyLevel
    departmentSource?: FilosofiDepartmentSource
    indicators: FilosofiTrendIndicator[]
  },
): Promise<FilosofiTrendResult> => {
  const years = await getAvailableYears()
  const parquetUrl = resolveFilosofiQueryAsset(
    params.geographyLevel,
    params.departmentSource,
  )

  const rows = await duckdbClient.query(
    buildFilosofiTrendQuery(
      {
        departmentSource: params.departmentSource,
        indicators: params.indicators,
        years,
      },
      parquetUrl,
    ),
  )

  const rowsByYear = Object.fromEntries(
    rows.map((row) => [
      Number(row.year),
      row,
    ]),
  ) as Record<string, Record<string, unknown>>

  const series: FilosofiTrendSeries[] = params.indicators.map((indicator) => ({
    indicator,
    label: FILOSOFI_INDICATOR_LABELS[indicator],
    points: years.map((year) => ({
      year,
      value: normalizeOptionalNumber(rowsByYear[String(year)]?.[indicator]),
    })),
  }))

  return {
    availableYears: years,
    series,
    geographyLevel: params.geographyLevel,
    departmentSource: params.departmentSource ?? 'official',
  }
}

const toBooleanOrNull = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value
  }
  return null
}

const toStringOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null
  }
  const stringValue = String(value).trim()
  return stringValue ? stringValue : null
}

const normalizeQueryRow = (row: Record<string, unknown>): FilosofiQueryRow => ({
  geographyCode: toStringOrNull(row.geography_code),
  geographyName: toStringOrNull(row.geography_name),
  geographyLevel:
    row.geography_level === 'department' ? 'department' : 'commune',
  year: normalizeOptionalNumber(row.year),
  dispositif: toStringOrNull(row.dispositif),
  sourceGeneration: toStringOrNull(row.source_generation),
  indicatorSource: toStringOrNull(row.indicator_source),
  isOfficial: toBooleanOrNull(row.is_official),
  methodologyVersion: toStringOrNull(row.methodology_version),
  comparableWithPreviousYears: toBooleanOrNull(
    row.comparable_with_previous_years,
  ),
  indicatorValue: normalizeOptionalNumber(row.indicator_value),
})

export const getMethodologyWarnings = async (
  year: number,
  geographyLevel: FilosofiGeographyLevel,
  departmentSource: FilosofiDepartmentSource = 'official',
  indicator?: FilosofiIndicator,
): Promise<string[]> => {
  const [metadata, availability] = await Promise.all([
    getMetadata(),
    getIndicatorAvailability(),
  ])
  const warnings: string[] = []
  const methodologyBreak = metadata.methodologyBreaks.find((entry) => entry.year === year)
  if (methodologyBreak) {
    warnings.push(
      'À partir de 2023, les données proviennent de Filosofi 2. Elles ne sont pas directement comparables aux millésimes antérieurs sans précaution.',
    )
  }
  if (geographyLevel === 'department' && departmentSource === 'derived') {
    warnings.push(
      'Les données départementales affichées ici sont dérivées des communes et ne constituent pas une série officielle INSEE.',
    )
  }
  if (indicator) {
    const entry =
      availability[String(year)]?.[getAvailabilityLevelKey(geographyLevel, departmentSource)]?.[
        indicator
      ]
    if (entry && entry.available && entry.coverage > 0 && entry.coverage < 1) {
      warnings.push(
        `La couverture publiée pour ${FILOSOFI_INDICATOR_LABELS[indicator].toLowerCase()} est partielle (${(
          entry.coverage * 100
        ).toFixed(1)} %).`,
      )
    }
  }
  return warnings
}

export const queryFilosofiData = async (
  params: FilosofiQueryParams,
): Promise<FilosofiQueryResult> => {
  const years = await getAvailableYears()
  if (!years.includes(params.year)) {
    throw new Error(`FiLoSoFi year ${params.year} is not available`)
  }

  const departmentSource = params.departmentSource ?? 'official'
  const availableIndicators = await getAvailableIndicators(
    params.year,
    params.geographyLevel,
    departmentSource,
  )
  const indicatorAvailability = availableIndicators.find(
    (entry) => entry.indicator === params.indicator,
  )
  if (!indicatorAvailability) {
    throw new Error(
      `Indicator ${params.indicator} is not available for ${params.geographyLevel} in ${params.year}`,
    )
  }

  const parquetUrl = resolveFilosofiQueryAsset(
    params.geographyLevel,
    departmentSource,
  )
  const built = buildFilosofiQuery(params, parquetUrl)
  const [rowsPayload, countPayload, warnings] = await Promise.all([
    duckdbClient.query(built.sql),
    duckdbClient.query(built.countSql),
    getMethodologyWarnings(
      params.year,
      params.geographyLevel,
      departmentSource,
      params.indicator,
    ),
  ])

  return {
    rows: rowsPayload.map(normalizeQueryRow),
    totalRows: normalizeOptionalNumber(countPayload[0]?.total_rows) ?? 0,
    limit: built.limit,
    offset: built.offset,
    parquetUrl: built.parquetUrl,
    warnings,
    indicator: params.indicator,
  }
}
