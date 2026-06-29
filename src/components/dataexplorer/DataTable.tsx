import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DatasetColumn } from '../../services/dataExplorerService'
import { SearchBar } from './SearchBar'
import { SelectField } from './SelectField'

type SortDirection = 'asc' | 'desc'

type ColumnFilter = {
  text: string
  min: string
  max: string
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

const parseNumericFilter = (value: string): number | null => {
  if (!value.trim()) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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
        props.columns.some(
          (column) =>
            column.type === 'text' &&
            stringifyValue(row[column.key]).toLowerCase().includes(normalizedQuery),
        )

      if (!matchesQuery) {
        return false
      }

      return props.columns.every((column) => {
        const filter = columnFilters[column.key]
        if (!filter) {
          return true
        }

        const rawValue = row[column.key]
        if (column.type === 'number') {
          const numericValue =
            typeof rawValue === 'number' ? rawValue : Number(rawValue)
          if (!Number.isFinite(numericValue)) {
            return !filter.min && !filter.max
          }

          const min = parseNumericFilter(filter.min)
          const max = parseNumericFilter(filter.max)
          if (min !== null && numericValue < min) {
            return false
          }
          if (max !== null && numericValue > max) {
            return false
          }
          return true
        }

        return stringifyValue(rawValue)
          .toLowerCase()
          .includes(filter.text.trim().toLowerCase())
      })
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
      const leftValue = left[sortColumn]
      const rightValue = right[sortColumn]

      let comparison = 0
      if (column.type === 'number') {
        const leftNumber =
          typeof leftValue === 'number' ? leftValue : Number(leftValue)
        const rightNumber =
          typeof rightValue === 'number' ? rightValue : Number(rightValue)
        comparison =
          (Number.isFinite(leftNumber) ? leftNumber : -Infinity) -
          (Number.isFinite(rightNumber) ? rightNumber : -Infinity)
      } else {
        comparison = stringifyValue(leftValue).localeCompare(
          stringifyValue(rightValue),
          'fr',
          { sensitivity: 'base' },
        )
      }

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

  const handleSort = (columnKey: string, direction: SortDirection) => {
    setPage(1)
    setSortColumn(columnKey)
    setSortDirection(direction)
  }

  const updateFilter = (columnKey: string, nextFilter: Partial<ColumnFilter>) => {
    setPage(1)
    setColumnFilters((previous) => ({
      ...previous,
      [columnKey]: {
        text: previous[columnKey]?.text ?? '',
        min: previous[columnKey]?.min ?? '',
        max: previous[columnKey]?.max ?? '',
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
              {props.columns.map((column) => (
                <th key={column.key}>
                  {isRemoteMode ? (
                    column.label
                  ) : (
                    <div className="data-table__header">
                      <span className="data-table__header-label">{column.label}</span>
                      <div className="data-table__sort-actions">
                        <button
                          type="button"
                          className={`data-table__sort-button${
                            sortColumn === column.key && sortDirection === 'asc'
                              ? ' data-table__sort-button--active'
                              : ''
                          }`}
                          onClick={() => handleSort(column.key, 'asc')}
                          aria-label={`Trier ${column.label} par ordre croissant`}
                          title="Tri croissant"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={`data-table__sort-button${
                            sortColumn === column.key && sortDirection === 'desc'
                              ? ' data-table__sort-button--active'
                              : ''
                          }`}
                          onClick={() => handleSort(column.key, 'desc')}
                          aria-label={`Trier ${column.label} par ordre décroissant`}
                          title="Tri décroissant"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  )}
                </th>
              ))}
            </tr>
            {!isRemoteMode ? (
              <tr>
                {props.columns.map((column) => {
                  const filter = columnFilters[column.key] ?? {
                    text: '',
                    min: '',
                    max: '',
                  }

                  return (
                    <th key={`${column.key}-filter`}>
                      {column.type === 'number' ? (
                        <div className="data-table__numeric-filter">
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
                      ) : (
                        <input
                          type="text"
                          value={filter.text}
                          onChange={(event) =>
                            updateFilter(column.key, { text: event.target.value })
                          }
                          placeholder="Filtrer"
                          className="data-table__filter-input"
                        />
                      )}
                    </th>
                  )
                })}
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
