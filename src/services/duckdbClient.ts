import * as duckdb from '@duckdb/duckdb-wasm'
import duckdbWasmMvp from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import duckdbWorkerMvp from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdbWasmEh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import duckdbWorkerEh from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'

type ArrowLikeRow = {
  toJSON?: () => Record<string, unknown>
} & Record<string, unknown>

type QueryResultLike = {
  toArray: () => ArrowLikeRow[]
}

type ConnectionLike = {
  close: () => Promise<void>
  query: (sql: string) => Promise<QueryResultLike>
}

type DuckDbLike = {
  connect: () => Promise<ConnectionLike>
}

type DuckDbFactory = () => Promise<DuckDbLike>

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdbWasmMvp,
    mainWorker: duckdbWorkerMvp,
  },
  eh: {
    mainModule: duckdbWasmEh,
    mainWorker: duckdbWorkerEh,
  },
}

export class DuckDbClientError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'DuckDbClientError'
    if (cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = cause
    }
  }
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Unknown DuckDB error'
}

const defaultDuckDbFactory = async (): Promise<DuckDbLike> => {
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)
  const worker = new Worker(bundle.mainWorker!)
  const logger = new duckdb.VoidLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)

  try {
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
    return db
  } catch (error) {
    worker.terminate()
    throw error
  }
}

export const rowsFromQueryResult = (
  result: QueryResultLike,
): Array<Record<string, unknown>> =>
  result.toArray().map((row) => (typeof row.toJSON === 'function' ? row.toJSON() : { ...row }))

export const createDuckDbClient = (factory: DuckDbFactory = defaultDuckDbFactory) => {
  let dbPromise: Promise<DuckDbLike> | null = null

  const getDb = async (): Promise<DuckDbLike> => {
    if (!dbPromise) {
      dbPromise = factory().catch((error) => {
        dbPromise = null
        throw new DuckDbClientError(
          `DuckDB initialization failed: ${getErrorMessage(error)}`,
          error,
        )
      })
    }
    return dbPromise
  }

  const withConnection = async <T>(
    fn: (connection: ConnectionLike) => Promise<T>,
  ): Promise<T> => {
    const db = await getDb()
    const connection = await db.connect()
    try {
      return await fn(connection)
    } catch (error) {
      throw new DuckDbClientError(
        `DuckDB query failed: ${getErrorMessage(error)}`,
        error,
      )
    } finally {
      await connection.close()
    }
  }

  const query = async (sql: string): Promise<Array<Record<string, unknown>>> =>
    withConnection(async (connection) => rowsFromQueryResult(await connection.query(sql)))

  return {
    getDb,
    query,
    withConnection,
  }
}

export const duckdbClient = createDuckDbClient()
