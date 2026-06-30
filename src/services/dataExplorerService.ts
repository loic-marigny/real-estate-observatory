import {
  datasetRegistry,
  datasetRegistryList,
  type BusinessDatasetId,
} from '../data/datasetRegistry'
import { resolveColumnDefinition } from '../data/columnMetadata'
import { dvfAssetUrls, getBundledAssetUrl } from './dataAssetConfig'
import { duckdbClient } from './duckdbClient'
import { formatPreviewLabel, normalizePreviewValue } from '../utils/text'
import type {
  DatasetColumn,
  DatasetColumnFilterKind,
  DatasetColumnType,
} from '../types/dataExplorer'

export type {
  DatasetColumn,
  DatasetColumnFilterKind,
  DatasetColumnType,
} from '../types/dataExplorer'

export type DatasetPreviewResponse = {
  dataset_id: BusinessDatasetId
  source_file_location: string
  rows: number
  columns_count: number
  available_years: number[]
  last_update: string | null
  columns: DatasetColumn[]
  records: Array<Record<string, unknown>>
}

export type DatasetDescriptor = {
  id: BusinessDatasetId
  label: string
  description: string
  sourceOrganization: string
  availableYears: number[]
  sourceFileLocation: string
  rows: number | null
  columns: number | null
  lastUpdate: string | null
}

export type DatasetPreview = {
  dataset: DatasetDescriptor
  columns: DatasetColumn[]
  records: Array<Record<string, unknown>>
}

const getDvfYearPreviewUrl = (year: number): string =>
  getBundledAssetUrl(`data/dvf_previews/year=${year}/dvf_preview.json`)

const escapeSqlStringLiteral = (value: string): string =>
  `'${value.replaceAll("'", "''")}'`

const quoteSqlIdentifier = (value: string): string =>
  `"${value.replaceAll('"', '""')}"`

const asNumberArray = (value: unknown): number[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'number' ? item : Number(item)))
        .filter((item) => Number.isFinite(item))
    : []

const normalizeColumnType = (value: unknown): DatasetColumnType => {
  switch (value) {
    case 'number':
    case 'date':
    case 'boolean':
      return value
    default:
      return 'text'
  }
}

const normalizeColumnFilterKind = (
  value: unknown,
): DatasetColumnFilterKind | undefined => {
  switch (value) {
    case 'text':
    case 'number-range':
    case 'date-range':
    case 'boolean-select':
      return value
    default:
      return undefined
  }
}

const normalizeRecord = (
  record: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, normalizePreviewValue(value)]),
  )

const normalizePreviewPayload = (payload: unknown): DatasetPreviewResponse => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid dataset preview payload')
  }

  const record = payload as Record<string, unknown>
  const datasetId = String(record.dataset_id) as BusinessDatasetId
  const registryEntry = datasetRegistry[datasetId]
  if (!registryEntry) {
    throw new Error(`Unknown dataset id: ${datasetId}`)
  }

  return {
    dataset_id: datasetId,
    source_file_location:
      typeof record.source_file_location === 'string'
        ? record.source_file_location
        : '',
    rows: typeof record.rows === 'number' ? record.rows : 0,
    columns_count:
      typeof record.columns_count === 'number' ? record.columns_count : 0,
    available_years: asNumberArray(record.available_years),
    last_update:
      typeof record.last_update === 'string' ? record.last_update : null,
    columns: Array.isArray(record.columns)
      ? record.columns
          .filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === 'object',
          )
          .map((item) => ({
            ...resolveColumnDefinition({
              scope: datasetId,
              key: typeof item.key === 'string' ? item.key : '',
              fallbackLabel: formatPreviewLabel(
                typeof item.key === 'string' ? item.key : '',
                typeof item.label === 'string' ? item.label : '',
              ),
              fallbackType: normalizeColumnType(item.type),
              fallbackDescription:
                typeof item.description === 'string' ? item.description : null,
              fallbackFilterKind: normalizeColumnFilterKind(item.filterKind),
            }),
          }))
          .filter((item) => item.key !== '')
      : [],
    records: Array.isArray(record.records)
      ? record.records
          .filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === 'object',
          )
          .map(normalizeRecord)
      : [],
  }
}

const buildDatasetDescriptor = (
  entry: (typeof datasetRegistry)[BusinessDatasetId],
  payload: DatasetPreviewResponse,
): DatasetDescriptor => ({
  id: entry.id,
  label: entry.label,
  description: entry.description,
  sourceOrganization: entry.sourceOrganization,
  availableYears: payload.available_years,
  sourceFileLocation: payload.source_file_location,
  rows: payload.rows,
  columns: payload.columns_count,
  lastUpdate: payload.last_update,
})

const fetchPreviewPayload = async (
  datasetId: BusinessDatasetId,
): Promise<{
  entry: (typeof datasetRegistry)[BusinessDatasetId]
  payload: DatasetPreviewResponse
}> => {
  const entry = datasetRegistry[datasetId]
  if (!entry) {
    throw new Error(`Unsupported dataset: ${datasetId}`)
  }

  const response = await fetch(entry.previewUrl)
  if (!response.ok) {
    throw new Error(`Failed to load ${entry.label}: ${response.status}`)
  }

  const payload = normalizePreviewPayload((await response.json()) as unknown)
  return { entry, payload }
}

const listParquetColumns = async (parquetUrl: string): Promise<string[]> => {
  const escapedUrl = escapeSqlStringLiteral(parquetUrl)
  const rows = await duckdbClient.query(`
    DESCRIBE SELECT *
    FROM read_parquet(${escapedUrl})
  `)

  return rows
    .map((row) => row.column_name)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
}

const getDvfPreviewFromParquet = async (
  preview: DatasetPreview,
  year: number,
): Promise<DatasetPreview> => {
  const parquetUrl = dvfAssetUrls.yearSilverParquet(year)
  const escapedUrl = escapeSqlStringLiteral(parquetUrl)
  const [availableColumnKeys, countRows] = await Promise.all([
    listParquetColumns(parquetUrl),
    duckdbClient.query(`
      SELECT COUNT(*) AS row_count
      FROM read_parquet(${escapedUrl})
    `),
  ])

  const selectedColumns = preview.columns.filter((column) =>
    availableColumnKeys.includes(column.key),
  )
  const columnList = selectedColumns.map((column) => quoteSqlIdentifier(column.key)).join(', ')
  const previewRows =
    columnList.length > 0
      ? await duckdbClient.query(`
          SELECT ${columnList}
          FROM read_parquet(${escapedUrl})
          LIMIT 500
        `)
      : []

  const rowCountValue = countRows[0]?.row_count
  const normalizedRowCount =
    typeof rowCountValue === 'number'
      ? rowCountValue
      : Number(rowCountValue ?? preview.dataset.rows ?? 0)

  return {
    dataset: {
      ...preview.dataset,
      rows: Number.isFinite(normalizedRowCount) ? normalizedRowCount : preview.dataset.rows,
      columns: availableColumnKeys.length,
      sourceFileLocation: `data/raw/dvf/year=${year}/`,
    },
    columns: selectedColumns,
    records: previewRows.map((record) => normalizeRecord(record)),
  }
}

export async function listDatasets(): Promise<DatasetDescriptor[]> {
  const previews = await Promise.all(
    datasetRegistryList.map(async (entry) => {
      try {
        const response = await fetch(entry.previewUrl)
        if (!response.ok) {
          throw new Error(`Preview unavailable: ${response.status}`)
        }
        const payload = normalizePreviewPayload((await response.json()) as unknown)
        return buildDatasetDescriptor(entry, payload)
      } catch {
        return {
          id: entry.id,
          label: entry.label,
          description: entry.description,
          sourceOrganization: entry.sourceOrganization,
          availableYears: [],
          sourceFileLocation: '',
          rows: null,
          columns: null,
          lastUpdate: null,
        }
      }
    }),
  )

  return previews
}

export async function getDatasetPreview(
  datasetId: BusinessDatasetId,
  year?: number,
): Promise<DatasetPreview> {
  if (datasetId === 'dvf' && typeof year === 'number' && Number.isFinite(year)) {
    try {
      const response = await fetch(getDvfYearPreviewUrl(year))
      if (response.ok) {
        const payload = normalizePreviewPayload((await response.json()) as unknown)
        const entry = datasetRegistry[datasetId]

        return {
          dataset: buildDatasetDescriptor(entry, payload),
          columns: payload.columns,
          records: payload.records,
        }
      }
    } catch {
      // Fall back to live parquet preview when the yearly public preview is missing.
    }
  }

  const { entry, payload } = await fetchPreviewPayload(datasetId)

  const preview: DatasetPreview = {
    dataset: buildDatasetDescriptor(entry, payload),
    columns: payload.columns,
    records: payload.records,
  }

  if (datasetId === 'dvf' && typeof year === 'number' && Number.isFinite(year)) {
    return getDvfPreviewFromParquet(preview, year)
  }

  return preview
}
