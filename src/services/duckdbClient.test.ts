import { describe, expect, it, vi } from 'vitest'

import { createDuckDbClient, rowsFromQueryResult } from './duckdbClient'

describe('duckdbClient', () => {
  it('initializes DuckDB only once for concurrent calls', async () => {
    const connection = {
      query: vi.fn().mockResolvedValue({
        toArray: () => [{ toJSON: () => ({ count: 1 }) }],
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }
    const factory = vi.fn().mockResolvedValue({
      connect: vi.fn().mockResolvedValue(connection),
    })

    const client = createDuckDbClient(factory)

    await Promise.all([client.query('select 1'), client.query('select 2')])

    expect(factory).toHaveBeenCalledTimes(1)
    expect(connection.close).toHaveBeenCalledTimes(2)
  })

  it('converts Arrow-like rows to plain objects', () => {
    const rows = rowsFromQueryResult({
      toArray: () => [
        { toJSON: () => ({ geography_code: '01001', median_income: 22000 }) },
        { geography_code: '01002', median_income: 24000 },
      ],
    })

    expect(rows).toEqual([
      { geography_code: '01001', median_income: 22000 },
      { geography_code: '01002', median_income: 24000 },
    ])
  })
})
