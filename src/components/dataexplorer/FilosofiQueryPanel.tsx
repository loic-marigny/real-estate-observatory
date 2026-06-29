import type {
  FilosofiDepartmentSource,
  FilosofiGeographyLevel,
  FilosofiIndicator,
  FilosofiIndicatorOption,
} from '../../types/realEstate'
import { SelectField } from './SelectField'

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
  sortBy: string
  sortDirection: 'asc' | 'desc'
  onSortChange: (sortBy: string, sortDirection: 'asc' | 'desc') => void
  warnings: string[]
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
  sortBy,
  sortDirection,
  onSortChange,
  warnings,
}: FilosofiQueryPanelProps) {
  const hasYears = years.length > 0
  const hasIndicators = indicators.length > 0
  const canQuery = selectedYear !== null && selectedIndicator !== null

  return (
    <section className="panel data-explorer-year-panel filosofi-query-panel">
      <div className="filosofi-query-controls">
        <SelectField
          label="Année"
          value={selectedYear ?? ''}
          disabled={!hasYears}
          onChange={(value) => onYearChange(Number(value))}
        >
          {!hasYears ? <option value="">Aucune année disponible</option> : null}
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Maille"
          value={geographyLevel}
          onChange={(value) =>
            onGeographyLevelChange(value as FilosofiGeographyLevel)
          }
        >
          <option value="commune">Commune</option>
          <option value="department">Département</option>
        </SelectField>

        {geographyLevel === 'department' ? (
          <SelectField
            label="Source départementale"
            value={departmentSource}
            onChange={(value) =>
              onDepartmentSourceChange(value as FilosofiDepartmentSource)
            }
          >
            <option value="official">Officielle</option>
            <option value="derived">Dérivée des communes</option>
          </SelectField>
        ) : null}

        <SelectField
          label="Indicateur"
          value={selectedIndicator ?? ''}
          disabled={!hasIndicators}
          onChange={(value) => onIndicatorChange(value as FilosofiIndicator)}
        >
          {!hasIndicators ? <option value="">Aucun indicateur disponible</option> : null}
          {indicators.map((indicator) => (
            <option key={indicator.indicator} value={indicator.indicator}>
              {indicator.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Tri"
          value={`${sortBy}:${sortDirection}`}
          disabled={!canQuery}
          onChange={(value) => {
            const [nextSortBy, nextDirection] = value.split(':')
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
        </SelectField>
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

      {!hasYears ? (
        <p className="filosofi-query-error">
          Aucune année FiLoSoFi n’a été trouvée dans les métadonnées chargées.
        </p>
      ) : null}

      {hasYears && !hasIndicators ? (
        <p className="filosofi-query-error">
          Aucun indicateur n’est disponible pour cette combinaison année / maille.
        </p>
      ) : null}

      <p className="panel__footnote panel__footnote--compact">
        Les sélecteurs sont pilotés par les métadonnées FiLoSoFi et les résultats
        sont chargés à la demande depuis les fichiers Parquet distants.
      </p>
    </section>
  )
}
