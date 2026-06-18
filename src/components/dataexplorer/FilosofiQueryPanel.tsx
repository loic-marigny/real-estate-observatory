import type {
  FilosofiDepartmentSource,
  FilosofiGeographyLevel,
  FilosofiIndicator,
  FilosofiIndicatorOption,
  FilosofiQueryResult,
} from '../../types/realEstate'
import type { FilosofiResultColumn } from '../../services/filosofiDataService'
import { SearchBar } from './SearchBar'

type FilosofiQueryPanelProps = {
  years: number[]
  selectedYear: number | null
  onYearChange: (year: number) => void
  geographyLevel: FilosofiGeographyLevel
  onGeographyLevelChange: (level: FilosofiGeographyLevel) => void
  departmentSource: FilosofiDepartmentSource
  onDepartmentSourceChange: (source: FilosofiDepartmentSource) => void
  indicators: FilosofiIndicatorOption[]
  selectedIndicator: FilosofiIndicator | null
  onIndicatorChange: (indicator: FilosofiIndicator) => void
  search: string
  onSearchChange: (query: string) => void
  sortBy: string
  sortDirection: 'asc' | 'desc'
  onSortChange: (sortBy: string, sortDirection: 'asc' | 'desc') => void
  pageSize: number
  page: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  columns: FilosofiResultColumn[]
  result: FilosofiQueryResult | null
  warnings: string[]
  isLoading: boolean
  error: string | null
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

export function FilosofiQueryPanel({
  years,
  selectedYear,
  onYearChange,
  geographyLevel,
  onGeographyLevelChange,
  departmentSource,
  onDepartmentSourceChange,
  indicators,
  selectedIndicator,
  onIndicatorChange,
  search,
  onSearchChange,
  sortBy,
  sortDirection,
  onSortChange,
  pageSize,
  page,
  onPageChange,
  onPageSizeChange,
  columns,
  result,
  warnings,
  isLoading,
  error,
}: FilosofiQueryPanelProps) {
  const totalRows = result?.totalRows ?? 0
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPage = Math.min(page, totalPages)

  return (
    <section className="panel filosofi-query-panel" aria-labelledby="filosofi-query-title">
      <div className="section-heading">
        <p className="eyebrow">FiLoSoFi</p>
        <h2 id="filosofi-query-title">Requête DuckDB-Wasm</h2>
      </div>

      <p className="dataset-info-card__description">
        Les sélecteurs sont pilotés par les métadonnées FiLoSoFi et les résultats
        sont chargés à la demande depuis les fichiers Parquet distants.
      </p>

      <div className="filosofi-query-controls">
        <label className="page-size-selector">
          <span className="search-bar__label">Année</span>
          <select
            className="page-size-selector__select"
            value={selectedYear ?? ''}
            onChange={(event) => onYearChange(Number(event.target.value))}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className="page-size-selector">
          <span className="search-bar__label">Maille</span>
          <select
            className="page-size-selector__select"
            value={geographyLevel}
            onChange={(event) =>
              onGeographyLevelChange(event.target.value as FilosofiGeographyLevel)
            }
          >
            <option value="commune">Commune</option>
            <option value="department">Département</option>
          </select>
        </label>

        {geographyLevel === 'department' ? (
          <label className="page-size-selector">
            <span className="search-bar__label">Source départementale</span>
            <select
              className="page-size-selector__select"
              value={departmentSource}
              onChange={(event) =>
                onDepartmentSourceChange(
                  event.target.value as FilosofiDepartmentSource,
                )
              }
            >
              <option value="official">Officielle</option>
              <option value="derived">Dérivée des communes</option>
            </select>
          </label>
        ) : null}

        <label className="page-size-selector">
          <span className="search-bar__label">Indicateur</span>
          <select
            className="page-size-selector__select"
            value={selectedIndicator ?? ''}
            onChange={(event) =>
              onIndicatorChange(event.target.value as FilosofiIndicator)
            }
          >
            {indicators.map((indicator) => (
              <option key={indicator.indicator} value={indicator.indicator}>
                {indicator.label}
              </option>
            ))}
          </select>
        </label>

        <label className="page-size-selector">
          <span className="search-bar__label">Tri</span>
          <select
            className="page-size-selector__select"
            value={`${sortBy}:${sortDirection}`}
            onChange={(event) => {
              const [nextSortBy, nextDirection] = event.target.value.split(':')
              onSortChange(nextSortBy, nextDirection as 'asc' | 'desc')
            }}
          >
            <option value={`${selectedIndicator ?? 'median_income'}:desc`}>
              Valeur décroissante
            </option>
            <option value={`${selectedIndicator ?? 'median_income'}:asc`}>
              Valeur croissante
            </option>
            <option value="geography_name:asc">Libellé A → Z</option>
            <option value="geography_name:desc">Libellé Z → A</option>
            <option value="geography_code:asc">Code croissant</option>
            <option value="geography_code:desc">Code décroissant</option>
          </select>
        </label>

        <label className="page-size-selector">
          <span className="search-bar__label">Lignes par page</span>
          <select
            className="page-size-selector__select"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="data-table-toolbar">
        <SearchBar query={search} onQueryChange={onSearchChange} />
      </div>

      {warnings.length ? (
        <div className="filosofi-query-warnings">
          {warnings.map((warning) => (
            <p key={warning} className="filosofi-query-warning">
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      {error ? <p className="filosofi-query-error">{error}</p> : null}

      {isLoading ? <p>Chargement des données FiLoSoFi…</p> : null}

      {result ? (
        <>
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
                      <td key={`${rowIndex}-${column.key}`}>
                        {formatValue(row[column.key])}
                      </td>
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
        </>
      ) : null}
    </section>
  )
}
