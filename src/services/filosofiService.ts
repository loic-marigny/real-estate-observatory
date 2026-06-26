import type {
  FilosofiDecileSummary,
  FilosofiPovertyRateSummary,
  FilosofiSummary,
} from '../types/realEstate'

const FILOSOFI_SUMMARY_URL = '/data/filosofi_summary.json'

const asNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return null
}

const normalizeDecileSummary = (value: unknown): FilosofiDecileSummary | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  return {
    d1Income: asNumberOrNull(record.d1Income ?? record.d1_income),
    d2Income: asNumberOrNull(record.d2Income ?? record.d2_income),
    d3Income: asNumberOrNull(record.d3Income ?? record.d3_income),
    d4Income: asNumberOrNull(record.d4Income ?? record.d4_income),
    d5Income: asNumberOrNull(record.d5Income ?? record.d5_income),
    d6Income: asNumberOrNull(record.d6Income ?? record.d6_income),
    d7Income: asNumberOrNull(record.d7Income ?? record.d7_income),
    d8Income: asNumberOrNull(record.d8Income ?? record.d8_income),
    d9Income: asNumberOrNull(record.d9Income ?? record.d9_income),
  }
}

const normalizePovertyRateSummary = (
  value: unknown,
): FilosofiPovertyRateSummary | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  return {
    mean: asNumberOrNull(record.mean),
    median: asNumberOrNull(record.median),
  }
}

const normalizeMedianIncomeByDepartment = (
  value: unknown,
): Record<string, number | null> => {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      asNumberOrNull(item),
    ]),
  )
}

const normalizeFilosofiSummary = (data: unknown): FilosofiSummary => {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid FiLoSoFi summary payload')
  }

  const record = data as Record<string, unknown>

  return {
    source: typeof record.source === 'string' ? record.source : 'INSEE FiLoSoFi',
    generatedAt:
      typeof (record.generatedAt ?? record.generated_at) === 'string'
        ? ((record.generatedAt ?? record.generated_at) as string)
        : '',
    availableYears: Array.isArray(record.availableYears ?? record.available_years)
      ? ((record.availableYears ?? record.available_years) as unknown[])
          .map((value) => (typeof value === 'number' ? value : Number(value)))
          .filter((value) => Number.isFinite(value))
      : [],
    latestYear:
      typeof (record.latestYear ?? record.latest_year) === 'number'
        ? ((record.latestYear ?? record.latest_year) as number)
        : asNumberOrNull(record.latestYear ?? record.latest_year),
    communesCovered:
      typeof (record.communesCovered ?? record.communes_covered) === 'number'
        ? ((record.communesCovered ?? record.communes_covered) as number)
        : 0,
    departmentsCovered:
      typeof (record.departmentsCovered ?? record.departments_covered) === 'number'
        ? ((record.departmentsCovered ?? record.departments_covered) as number)
        : 0,
    nationalMedianIncome: asNumberOrNull(
      record.nationalMedianIncome ?? record.national_median_income,
    ),
    medianIncomeByDepartment: normalizeMedianIncomeByDepartment(
      record.medianIncomeByDepartment ?? record.median_income_by_department,
    ),
    decileSummary: normalizeDecileSummary(
      record.decileSummary ?? record.decile_summary,
    ),
    povertyRateSummary: normalizePovertyRateSummary(
      record.povertyRateSummary ?? record.poverty_rate_summary,
    ),
    notes: Array.isArray(record.notes)
      ? (record.notes as unknown[]).filter(
          (value): value is string => typeof value === 'string',
        )
      : [],
  }
}

export async function getFilosofiSummary(): Promise<FilosofiSummary> {
  const response = await fetch(FILOSOFI_SUMMARY_URL)

  if (!response.ok) {
    throw new Error(`Failed to load FiLoSoFi summary: ${response.status}`)
  }

  const data = (await response.json()) as unknown
  return normalizeFilosofiSummary(data)
}
