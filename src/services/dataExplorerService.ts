import {
  datasetRegistry,
  datasetRegistryList,
  type BusinessDatasetId,
} from '../data/datasetRegistry'
import { formatPreviewLabel, normalizePreviewValue } from '../utils/text'

export type DatasetColumn = {
  key: string
  label: string
  type: 'text' | 'number'
}

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

const asNumberArray = (value: unknown): number[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'number' ? item : Number(item)))
        .filter((item) => Number.isFinite(item))
    : []

const normalizeColumnType = (value: unknown): 'text' | 'number' =>
  value === 'number' ? 'number' : 'text'

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
            key: typeof item.key === 'string' ? item.key : '',
            label: formatPreviewLabel(
              typeof item.key === 'string' ? item.key : '',
              typeof item.label === 'string' ? item.label : '',
            ),
            type: normalizeColumnType(item.type),
          }))
          .filter((item) => item.key !== '')
      : [],
    records: Array.isArray(record.records)
      ? record.records.filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === 'object',
        ).map(normalizeRecord)
      : [],
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
        return {
          id: entry.id,
          label: entry.label,
          description: entry.description,
          sourceOrganization: entry.sourceOrganization,
          availableYears: payload.available_years,
          sourceFileLocation: payload.source_file_location,
          rows: payload.rows,
          columns: payload.columns_count,
          lastUpdate: payload.last_update,
        }
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
): Promise<DatasetPreview> {
  const entry = datasetRegistry[datasetId]
  if (!entry) {
    throw new Error(`Unsupported dataset: ${datasetId}`)
  }

  const response = await fetch(entry.previewUrl)
  if (!response.ok) {
    throw new Error(`Failed to load ${entry.label}: ${response.status}`)
  }

  const payload = normalizePreviewPayload((await response.json()) as unknown)

  return {
    dataset: {
      id: entry.id,
      label: entry.label,
      description: entry.description,
      sourceOrganization: entry.sourceOrganization,
      availableYears: payload.available_years,
      sourceFileLocation: payload.source_file_location,
      rows: payload.rows,
      columns: payload.columns_count,
      lastUpdate: payload.last_update,
    },
    columns: payload.columns,
    records: payload.records,
  }
}
