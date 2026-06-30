import type {
  FilosofiTrendIndicator,
  FilosofiTrendResult,
  FilosofiTrendSeries,
} from '../types/realEstate'
import { getBundledAssetUrl } from './dataAssetConfig'

const FILOSOFI_NATIONAL_SERIES_URL = getBundledAssetUrl(
  'data/filosofi_national_series.json',
)

type NationalSeriesRecord = {
  year: number
  median_income: number | null
  d1_income: number | null
  d9_income: number | null
}

type NationalSeriesPayload = {
  series?: NationalSeriesRecord[]
}

const INDICATOR_LABELS: Record<FilosofiTrendIndicator, string> = {
  d1_income: 'Décile D1 (10% plus pauvres)',
  median_income: 'Revenu médian',
  d9_income: 'Décile D9 (10% plus riches)',
}

const asNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const normalizeSeriesRecord = (value: unknown): NationalSeriesRecord | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const year = asNumberOrNull(record.year)

  if (year === null) {
    return null
  }

  return {
    year,
    median_income: asNumberOrNull(record.median_income),
    d1_income: asNumberOrNull(record.d1_income),
    d9_income: asNumberOrNull(record.d9_income),
  }
}

const normalizePayload = (value: unknown): NationalSeriesRecord[] => {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid FiLoSoFi national series payload')
  }

  const payload = value as NationalSeriesPayload
  if (!Array.isArray(payload.series)) {
    throw new Error('Missing FiLoSoFi national series data')
  }

  return payload.series
    .map(normalizeSeriesRecord)
    .filter((record): record is NationalSeriesRecord => record !== null)
    .sort((left, right) => left.year - right.year)
}

export async function queryFilosofiNationalTrend(): Promise<FilosofiTrendResult> {
  const response = await fetch(FILOSOFI_NATIONAL_SERIES_URL)

  if (!response.ok) {
    throw new Error(`Failed to load FiLoSoFi national series: ${response.status}`)
  }

  const rows = normalizePayload((await response.json()) as unknown)
  const availableYears = rows.map((row) => row.year)

  const series = (
    ['d1_income', 'median_income', 'd9_income'] as FilosofiTrendIndicator[]
  ).map((indicator): FilosofiTrendSeries => ({
    indicator,
    label: INDICATOR_LABELS[indicator],
    points: rows.map((row) => ({
      year: row.year,
      value: row[indicator],
    })),
  }))

  return {
    availableYears,
    series,
    geographyLevel: 'commune',
    departmentSource: 'official',
  }
}
