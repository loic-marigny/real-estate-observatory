import type { FilosofiResultColumn } from '../../services/filosofiDataService'
import type { FilosofiQueryResult } from '../../types/realEstate'
import { SearchBar } from './SearchBar'
import { SelectField } from './SelectField'

type FilosofiResultsTableProps = {
  search: string
  onSearchChange: (query: string) => void
  pageSize: number
  page: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  columns: FilosofiResultColumn[]
  result: FilosofiQueryResult
}

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200]

const formatValue = (value: unknown): string => {
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

export function FilosofiResultsTable({
  search,
  onSearchChange,
  pageSize,
  page,
  onPageChange,
  onPageSizeChange,
  columns,
  result,
}: FilosofiResultsTableProps) {
  const totalRows = result.totalRows
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPage = Math.min(page, totalPages)

  return (
    <div className="panel data-table-panel">
      <div className="data-table-toolbar">
        <SearchBar query={search} onQueryChange={onSearchChange} />
        <SelectField
          label="Lignes par page"
          value={pageSize}
          onChange={(value) => onPageSizeChange(Number(value))}
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, rowIndex) => (
              <tr key={`${row.geographyCode ?? rowIndex}-${rowIndex}`}>
                {columns.map((column) => (
                  <td key={`${rowIndex}-${column.key}`}>{formatValue(row[column.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="data-table-footer">
        <span>
          {totalRows} lignes correspondantes · page {currentPage} / {totalPages}
        </span>
        <div className="data-table-footer__actions">
          <button
            type="button"
            className="data-table-footer__button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          >
            Précédent
          </button>
          <button
            type="button"
            className="data-table-footer__button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          >
            Suivant
          </button>
        </div>
      </div>

      <p className="panel__footnote">
        Requête exécutée sur : <code>{result.parquetUrl}</code>
      </p>
    </div>
  )
}
