import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  DatasetColumn,
  DatasetColumnFilterKind,
} from '../../services/dataExplorerService'
import { SearchBar } from './SearchBar'
import { SelectField } from './SelectField'

type SortDirection = 'asc' | 'desc'

type ColumnFilter = {
  text: string
  min: string
  max: string
  start: string
  end: string
  boolean: 'all' | 'true' | 'false'
}

type BaseDataTableProps = {
  columns: DatasetColumn[]
  rows: Array<Record<string, unknown>>
}

type ClientDataTableProps = BaseDataTableProps & {
  mode?: 'client'
}

type RemoteDataTableProps = BaseDataTableProps & {
  mode: 'remote'
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  pageSize: number
  page: number
  totalRows: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  footnote?: ReactNode
  formatValue?: (value: unknown) => string
  getRowKey?: (row: Record<string, unknown>, rowIndex: number) => string
}

export type DataTableProps = ClientDataTableProps | RemoteDataTableProps

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200]

const EMPTY_FILTER: ColumnFilter = {
  text: '',
  min: '',
  max: '',
  start: '',
  end: '',
  boolean: 'all',
}

const isTextValue = (value: unknown): boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

const stringifyValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
}

const formatRemoteValue = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 2,
    }).format(value)
  }
  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non'
  }
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  return String(value)
}

const parseNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const normalized = stringifyValue(value).trim().replace(',', '.')
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const parseDateValue = (value: unknown): number | null => {
  const normalized = stringifyValue(value).trim()
  if (!normalized) {
    return null
  }

  const directTimestamp = Date.parse(normalized)
  if (Number.isFinite(directTimestamp)) {
    return directTimestamp
  }

  const frenchMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!frenchMatch) {
    return null
  }

  const [, day, month, year] = frenchMatch
  const rebuiltTimestamp = Date.parse(`${year}-${month}-${day}`)
  return Number.isFinite(rebuiltTimestamp) ? rebuiltTimestamp : null
}

const parseBooleanValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value
  }

  const normalized = stringifyValue(value).trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (['true', '1', 'yes', 'oui', 'vrai'].includes(normalized)) {
    return true
  }

  if (['false', '0', 'no', 'non', 'faux'].includes(normalized)) {
    return false
  }

  return null
}

const resolveFilterKind = (column: DatasetColumn): DatasetColumnFilterKind => {
  if (column.filterKind) {
    return column.filterKind
  }

  switch (column.type) {
    case 'number':
      return 'number-range'
    case 'date':
      return 'date-range'
    case 'boolean':
      return 'boolean-select'
    default:
      return 'text'
  }
}

const matchesColumnFilter = (
  rawValue: unknown,
  column: DatasetColumn,
  filter: ColumnFilter | undefined,
): boolean => {
  if (!filter) {
    return true
  }

  const filterKind = resolveFilterKind(column)
  switch (filterKind) {
    case 'number-range': {
      const numericValue = parseNumericValue(rawValue)
      if (numericValue === null) {
        return !filter.min && !filter.max
      }

      const min = parseNumericValue(filter.min)
      const max = parseNumericValue(filter.max)
      if (min !== null && numericValue < min) {
        return false
      }
      if (max !== null && numericValue > max) {
        return false
      }
      return true
    }

    case 'date-range': {
      const dateValue = parseDateValue(rawValue)
      if (dateValue === null) {
        return !filter.start && !filter.end
      }

      const start = parseDateValue(filter.start)
      const end = parseDateValue(filter.end)
      if (start !== null && dateValue < start) {
        return false
      }
      if (end !== null && dateValue > end) {
        return false
      }
      return true
    }

    case 'boolean-select': {
      if (filter.boolean === 'all') {
        return true
      }

      const booleanValue = parseBooleanValue(rawValue)
      if (booleanValue === null) {
        return false
      }

      return filter.boolean === 'true' ? booleanValue : !booleanValue
    }

    case 'text':
    default:
      return stringifyValue(rawValue)
        .toLowerCase()
        .includes(filter.text.trim().toLowerCase())
  }
}

const compareValues = (
  leftValue: unknown,
  rightValue: unknown,
  column: DatasetColumn,
): number => {
  switch (column.type) {
    case 'number': {
      const leftNumber = parseNumericValue(leftValue)
      const rightNumber = parseNumericValue(rightValue)
      return (leftNumber ?? -Infinity) - (rightNumber ?? -Infinity)
    }

    case 'date': {
      const leftDate = parseDateValue(leftValue)
      const rightDate = parseDateValue(rightValue)
      return (leftDate ?? -Infinity) - (rightDate ?? -Infinity)
    }

    case 'boolean': {
      const leftBoolean = parseBooleanValue(leftValue)
      const rightBoolean = parseBooleanValue(rightValue)
      return Number(leftBoolean ?? false) - Number(rightBoolean ?? false)
    }

    case 'text':
    default:
      return stringifyValue(leftValue).localeCompare(stringifyValue(rightValue), 'fr', {
        sensitivity: 'base',
      })
  }
}

export function DataTable(props: DataTableProps) {
  const topScrollRef = useRef<HTMLDivElement | null>(null)
  const topScrollInnerRef = useRef<HTMLDivElement | null>(null)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)

  const isRemoteMode = props.mode === 'remote'

  const [searchQuery, setSearchQuery] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({})

  const filteredRows = useMemo(() => {
    if (isRemoteMode) {
      return props.rows
    }

    const normalizedQuery = searchQuery.trim().toLowerCase()

    return props.rows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        props.columns.some((column) =>
          stringifyValue(row[column.key]).toLowerCase().includes(normalizedQuery),
        )

      if (!matchesQuery) {
        return false
      }

      return props.columns.every((column) =>
        matchesColumnFilter(row[column.key], column, columnFilters[column.key]),
      )
    })
  }, [columnFilters, isRemoteMode, props.columns, props.rows, searchQuery])

  const sortedRows = useMemo(() => {
    if (isRemoteMode || !sortColumn) {
      return filteredRows
    }

    const column = props.columns.find((item) => item.key === sortColumn)
    if (!column) {
      return filteredRows
    }

    return [...filteredRows].sort((left, right) => {
      const comparison = compareValues(left[sortColumn], right[sortColumn], column)
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredRows, isRemoteMode, props.columns, sortColumn, sortDirection])

  const totalPages = isRemoteMode
    ? Math.max(1, Math.ceil(props.totalRows / props.pageSize))
    : Math.max(1, Math.ceil(sortedRows.length / pageSize))

  const safePage = isRemoteMode ? Math.min(props.page, totalPages) : Math.min(page, totalPages)

  const paginatedRows = isRemoteMode
    ? props.rows
    : sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    const topScroll = topScrollRef.current
    const topScrollInner = topScrollInnerRef.current
    const tableScroll = tableScrollRef.current
    if (!topScroll || !topScrollInner || !tableScroll) {
      return
    }

    let isSyncingTop = false
    let isSyncingBottom = false

    const syncWidths = () => {
      const table = tableScroll.querySelector('table')
      if (!table) {
        return
      }
      topScrollInner.style.width = `${table.scrollWidth}px`
    }

    const handleTopScroll = () => {
      if (isSyncingBottom) {
        isSyncingBottom = false
        return
      }
      isSyncingTop = true
      tableScroll.scrollLeft = topScroll.scrollLeft
    }

    const handleTableScroll = () => {
      if (isSyncingTop) {
        isSyncingTop = false
        return
      }
      isSyncingBottom = true
      topScroll.scrollLeft = tableScroll.scrollLeft
    }

    syncWidths()
    topScroll.scrollLeft = tableScroll.scrollLeft

    topScroll.addEventListener('scroll', handleTopScroll)
    tableScroll.addEventListener('scroll', handleTableScroll)
    window.addEventListener('resize', syncWidths)

    return () => {
      topScroll.removeEventListener('scroll', handleTopScroll)
      tableScroll.removeEventListener('scroll', handleTableScroll)
      window.removeEventListener('resize', syncWidths)
    }
  }, [props.columns, paginatedRows])

  const handleSort = (columnKey: string) => {
    setPage(1)
    setSortDirection((currentDirection) => {
      if (sortColumn !== columnKey) {
        setSortColumn(columnKey)
        return 'asc'
      }

      return currentDirection === 'asc' ? 'desc' : 'asc'
    })
  }

  const updateFilter = (columnKey: string, nextFilter: Partial<ColumnFilter>) => {
    setPage(1)
    setColumnFilters((previous) => ({
      ...previous,
      [columnKey]: {
        ...EMPTY_FILTER,
        ...previous[columnKey],
        ...nextFilter,
      },
    }))
  }

  const renderCellValue = (row: Record<string, unknown>, columnKey: string) => {
    const value = row[columnKey]
    if (isRemoteMode) {
      return (props.formatValue ?? formatRemoteValue)(value)
    }
    return isTextValue(value) ? stringifyValue(value) : ''
  }

  const renderFilterCell = (column: DatasetColumn) => {
    const filter = columnFilters[column.key] ?? EMPTY_FILTER
    const filterKind = resolveFilterKind(column)

    switch (filterKind) {
      case 'number-range':
        return (
          <div className="data-table__filter-grid data-table__filter-grid--range">
            <input
              type="number"
              value={filter.min}
              onChange={(event) =>
                updateFilter(column.key, { min: event.target.value })
              }
              placeholder="Min"
              className="data-table__filter-input"
            />
            <input
              type="number"
              value={filter.max}
              onChange={(event) =>
                updateFilter(column.key, { max: event.target.value })
              }
              placeholder="Max"
              className="data-table__filter-input"
            />
          </div>
        )

      case 'date-range':
        return (
          <div className="data-table__filter-grid data-table__filter-grid--range">
            <input
              type="date"
              value={filter.start}
              onChange={(event) =>
                updateFilter(column.key, { start: event.target.value })
              }
              className="data-table__filter-input"
              aria-label={`${column.label} à partir du`}
            />
            <input
              type="date"
              value={filter.end}
              onChange={(event) =>
                updateFilter(column.key, { end: event.target.value })
              }
              className="data-table__filter-input"
              aria-label={`${column.label} jusqu’au`}
            />
          </div>
        )

      case 'boolean-select':
        return (
          <select
            value={filter.boolean}
            onChange={(event) =>
              updateFilter(column.key, {
                boolean: event.target.value as ColumnFilter['boolean'],
              })
            }
            className="data-table__filter-input"
            aria-label={`Filtrer ${column.label}`}
          >
            <option value="all">Tous</option>
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>
        )

      case 'text':
      default:
        return (
          <div className="data-table__filter-field">
            <input
              type="text"
              value={filter.text}
              onChange={(event) =>
                updateFilter(column.key, { text: event.target.value })
              }
              placeholder=""
              className="data-table__filter-input data-table__filter-input--with-icon"
              aria-label={`Filtrer ${column.label}`}
            />
          </div>
        )
    }
  }

  return (
    <div className="panel data-table-panel">
      <div className="data-table-toolbar">
        {isRemoteMode ? (
          <SearchBar
            query={props.searchQuery}
            onQueryChange={props.onSearchQueryChange}
          />
        ) : (
          <SearchBar
            query={searchQuery}
            onQueryChange={(query) => {
              setSearchQuery(query)
              setPage(1)
            }}
          />
        )}

        <SelectField
          label="Lignes par page"
          value={isRemoteMode ? props.pageSize : pageSize}
          onChange={(value) => {
            if (isRemoteMode) {
              props.onPageSizeChange(Number(value))
              return
            }
            setPageSize(Number(value))
            setPage(1)
          }}
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>
      </div>

      <div
        ref={topScrollRef}
        className="data-table-top-scroll"
        aria-label="Défilement horizontal du tableau"
      >
        <div ref={topScrollInnerRef} className="data-table-top-scroll__inner" />
      </div>

      <div ref={tableScrollRef} className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {props.columns.map((column) => {
                const isSortedColumn = sortColumn === column.key
                const activeDirection = isSortedColumn ? sortDirection : 'asc'
                const ariaSort =
                  isSortedColumn && activeDirection === 'asc'
                    ? 'ascending'
                    : isSortedColumn && activeDirection === 'desc'
                      ? 'descending'
                      : 'none'

                return (
                  <th key={column.key} aria-sort={ariaSort}>
                    {isRemoteMode ? (
                      <div className="data-table__header data-table__header--static">
                        <span
                          className="data-table__header-label"
                          title={column.label}
                        >
                          {column.label}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={`data-table__sort-trigger${
                          isSortedColumn ? ' data-table__sort-trigger--active' : ''
                        }`}
                        onClick={() => handleSort(column.key)}
                        aria-label={`Trier ${column.label} par ordre ${
                          activeDirection === 'asc' ? 'croissant' : 'décroissant'
                        }`}
                        title={column.label}
                      >
                        <span
                          className="data-table__header-label"
                          title={column.label}
                        >
                          {column.label}
                        </span>
                        <span className="data-table__sort-icon" aria-hidden="true">
                          {isSortedColumn
                            ? activeDirection === 'asc'
                              ? '▲'
                              : '▼'
                            : '☰'}
                        </span>
                      </button>
                    )}
                  </th>
                )
              })}
            </tr>
            {!isRemoteMode ? (
              <tr>
                {props.columns.map((column) => (
                  <th key={`${column.key}-filter`}>{renderFilterCell(column)}</th>
                ))}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {paginatedRows.map((row, rowIndex) => (
              <tr
                key={
                  isRemoteMode
                    ? props.getRowKey?.(row, rowIndex) ?? `${safePage}-${rowIndex}`
                    : `${safePage}-${rowIndex}`
                }
              >
                {props.columns.map((column) => (
                  <td key={`${rowIndex}-${column.key}`}>
                    {renderCellValue(row, column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="data-table-footer">
        <span>
          {isRemoteMode
            ? `${props.totalRows} lignes correspondantes · page ${safePage} / ${totalPages}`
            : `${sortedRows.length} lignes dans l’aperçu · page ${safePage} / ${totalPages}`}
        </span>
        <div className="data-table-footer__actions">
          <button
            type="button"
            className="data-table-footer__button"
            onClick={() => {
              if (isRemoteMode) {
                props.onPageChange(Math.max(1, safePage - 1))
                return
              }
              setPage((current) => Math.max(1, current - 1))
            }}
            disabled={safePage === 1}
          >
            Précédent
          </button>
          <button
            type="button"
            className="data-table-footer__button"
            onClick={() => {
              if (isRemoteMode) {
                props.onPageChange(Math.min(totalPages, safePage + 1))
                return
              }
              setPage((current) => Math.min(totalPages, current + 1))
            }}
            disabled={safePage === totalPages}
          >
            Suivant
          </button>
        </div>
      </div>

      {isRemoteMode && props.footnote ? (
        <p className="panel__footnote">{props.footnote}</p>
      ) : null}
    </div>
  )
}
