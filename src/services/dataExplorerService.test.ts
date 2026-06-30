import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./duckdbClient', () => ({
  duckdbClient: {
    query: vi.fn(),
  },
}))

vi.mock('./dataAssetConfig', () => ({
  getBundledAssetUrl: (path: string) => `/base/${path}`,
  dvfAssetUrls: {
    yearSilverParquet: (year: number) =>
      `https://assets.example/silver/dvf/year=${year}/dvf_silver.parquet`,
  },
}))

import { duckdbClient } from './duckdbClient'
import { getDatasetPreview } from './dataExplorerService'

const mockedDuckDbQuery = vi.mocked(duckdbClient.query)

describe('dataExplorerService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockedDuckDbQuery.mockReset()
    global.fetch = vi.fn()
  })

  it('keeps the preview payload as-is when no DVF year override is requested', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        dataset_id: 'dvf',
        source_file_location: 'data/raw/dvf/year=2024/full.csv.gz',
        rows: 10,
        columns_count: 2,
        available_years: [2023, 2024],
        last_update: null,
        columns: [
          { key: 'id_mutation', label: 'id mutation', type: 'text' },
          { key: 'nature_mutation', label: 'nature mutation', type: 'text' },
        ],
        records: [{ id_mutation: '2024-1', nature_mutation: 'Vente' }],
      }),
    } as Response)

    const preview = await getDatasetPreview('dvf')

    expect(preview.columns.map((column) => column.key)).toEqual([
      'id_mutation',
      'nature_mutation',
    ])
    expect(preview.columns[0]).toMatchObject({
      key: 'id_mutation',
      label: 'Identifiant de mutation',
      type: 'text',
    })
    expect(preview.columns[0].description).toMatch(/mutation immobilière/i)
    expect(preview.records).toEqual([
      { id_mutation: '2024-1', nature_mutation: 'Vente' },
    ])
    expect(mockedDuckDbQuery).not.toHaveBeenCalled()
  })

  it('filters DVF preview columns to those available in the selected yearly parquet', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: false,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dataset_id: 'dvf',
          source_file_location: 'data/raw/dvf/year=2024/full.csv.gz',
          rows: 10,
          columns_count: 4,
          available_years: [2018, 2024],
          last_update: null,
          columns: [
            { key: 'id_mutation', label: 'id mutation', type: 'text' },
            { key: 'date_mutation', label: 'date mutation', type: 'text' },
            { key: 'nature_mutation', label: 'nature mutation', type: 'text' },
            { key: 'price_m2', label: 'price m2', type: 'number' },
          ],
          records: [],
        }),
      } as Response)

    mockedDuckDbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('DESCRIBE SELECT *')) {
        return [
          { column_name: 'nature_mutation' },
          { column_name: 'price_m2' },
          { column_name: 'code_commune' },
        ]
      }

      if (sql.includes('COUNT(*) AS row_count')) {
        return [{ row_count: 321 }]
      }

      if (sql.includes('SELECT "nature_mutation", "price_m2"')) {
        return [{ nature_mutation: 'Vente', price_m2: 1234.5 }]
      }

      throw new Error(`Unexpected SQL: ${sql}`)
    })

    const preview = await getDatasetPreview('dvf', 2018)

    expect(preview.columns.map((column) => column.key)).toEqual([
      'nature_mutation',
      'price_m2',
    ])
    expect(preview.columns[1]).toMatchObject({
      key: 'price_m2',
      label: 'Prix au m²',
      type: 'number',
    })
    expect(preview.dataset.columns).toBe(3)
    expect(preview.dataset.rows).toBe(321)
    expect(preview.dataset.sourceFileLocation).toBe('data/raw/dvf/year=2018/')
    expect(preview.records).toEqual([{ nature_mutation: 'Vente', price_m2: 1234.5 }])
  })

  it('uses the static yearly DVF public preview when it exists', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        dataset_id: 'dvf',
        source_file_location: 'data/raw/dvf/year=2019/dvf_raw.txt',
        rows: 42,
        columns_count: 2,
        available_years: [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2024],
        last_update: null,
        columns: [
          { key: 'nature_mutation', label: 'nature mutation', type: 'text' },
          { key: 'price_m2', label: 'price m2', type: 'number' },
        ],
        records: [{ nature_mutation: 'Vente', price_m2: 987.6 }],
      }),
    } as Response)

    const preview = await getDatasetPreview('dvf', 2019)

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      '/base/data/dvf_previews/year=2019/dvf_preview.json',
    )
    expect(preview.columns[0]).toMatchObject({
      key: 'nature_mutation',
      label: 'Nature de mutation',
      type: 'text',
    })
    expect(preview.dataset.sourceFileLocation).toBe('data/raw/dvf/year=2019/dvf_raw.txt')
    expect(preview.records).toEqual([{ nature_mutation: 'Vente', price_m2: 987.6 }])
    expect(mockedDuckDbQuery).not.toHaveBeenCalled()
  })
})
