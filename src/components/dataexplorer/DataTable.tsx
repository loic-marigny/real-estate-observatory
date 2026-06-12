import { useMemo, useState } from 'react'
import type { DatasetColumn } from '../../services/dataExplorerService'
import { SearchBar } from './SearchBar'

type SortDirection = 'asc' | 'desc'

type ColumnFilter = {
  text: string
  min: string
  max: string
}

type DataTableProps = {
  columns: DatasetColumn[]
  rows: Array<Record<string, unknown>>
}

const PAGE_SIZE_OPTIONS = [50, 100, 200]

const isTextValue = (value: unknown): boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

const stringifyValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
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

export function DataTable({ columns, rows }: DataTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({})

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        columns.some(
          (column) =>
            column.type === 'text' &&
            stringifyValue(row[column.key]).toLowerCase().includes(normalizedQuery),
        )

      if (!matchesQuery) {
        return false
      }

      return columns.every((column) => {
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
  }, [columnFilters, columns, rows, searchQuery])

  const sortedRows = useMemo(() => {
    if (!sortColumn) {
      return filteredRows
    }

    const column = columns.find((item) => item.key === sortColumn)
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
        comparison = (Number.isFinite(leftNumber) ? leftNumber : -Infinity) -
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
  }, [columns, filteredRows, sortColumn, sortDirection])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleSort = (columnKey: string) => {
    setPage(1)
    if (sortColumn === columnKey) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortColumn(columnKey)
    setSortDirection('asc')
  }

  const updateFilter = (
    columnKey: string,
    nextFilter: Partial<ColumnFilter>,
  ) => {
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

  return (
    <div className="panel data-table-panel">
      <div className="data-table-toolbar">
        <SearchBar
          query={searchQuery}
          onQueryChange={(query) => {
            setSearchQuery(query)
            setPage(1)
          }}
        />

        <label className="page-size-selector">
          <span className="search-bar__label">Lignes par page</span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value))
              setPage(1)
            }}
            className="page-size-selector__select"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>
                  <button
                    type="button"
                    className="data-table__sort"
                    onClick={() => handleSort(column.key)}
                  >
                    <span>{column.label}</span>
                    {sortColumn === column.key ? (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
            <tr>
              {columns.map((column) => {
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
          </thead>
          <tbody>
            {paginatedRows.map((row, rowIndex) => (
              <tr key={`${safePage}-${rowIndex}`}>
                {columns.map((column) => (
                  <td key={`${rowIndex}-${column.key}`}>
                    {isTextValue(row[column.key])
                      ? stringifyValue(row[column.key])
                      : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="data-table-footer">
        <span>
          {sortedRows.length} lignes dans l’aperçu · page {safePage} / {totalPages}
        </span>
        <div className="data-table-footer__actions">
          <button
            type="button"
            className="data-table-footer__button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={safePage === 1}
          >
            Précédent
          </button>
          <button
            type="button"
            className="data-table-footer__button"
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            disabled={safePage === totalPages}
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  )
}
