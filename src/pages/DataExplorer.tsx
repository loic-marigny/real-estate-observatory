import { useCallback, useEffect, useMemo, useState } from 'react'
import { DataTable } from '../components/dataexplorer/DataTable'
import { CustomSelectField } from '../components/dataexplorer/CustomSelectField'
import { DatasetInfoCard } from '../components/dataexplorer/DatasetInfoCard'
import { DatasetSelector } from '../components/dataexplorer/DatasetSelector'
import { FilosofiQueryPanel } from '../components/dataexplorer/FilosofiQueryPanel'
import { StatusPanel } from '../components/dataexplorer/StatusPanel'
import type { BusinessDatasetId } from '../data/datasetRegistry'
import { useDatasetCatalog } from '../hooks/useDatasetCatalog'
import { useDatasetPreview } from '../hooks/useDatasetPreview'
import {
  formatFilosofiValue,
  useFilosofiExplorer,
} from '../hooks/useFilosofiExplorer'

export function DataExplorer() {
  const [selectedDatasetId, setSelectedDatasetId] =
    useState<BusinessDatasetId>('dvf')
  const [selectedDvfYear, setSelectedDvfYear] = useState<number | null>(null)
  const [isDvfYearMenuOpen, setIsDvfYearMenuOpen] = useState(false)

  const {
    datasets,
    defaultDvfYear,
    error: catalogError,
  } = useDatasetCatalog()

  useEffect(() => {
    setSelectedDvfYear((current) => current ?? defaultDvfYear)
  }, [defaultDvfYear])

  const handleResolvedDvfYear = useCallback((year: number | null) => {
    setSelectedDvfYear((current) => (current === year ? current : year))
  }, [])

  const {
    preview: selectedPreview,
    isLoading,
    error,
  } = useDatasetPreview({
    datasetId: selectedDatasetId,
    dvfYear: selectedDvfYear,
    onResolvedDvfYear: handleResolvedDvfYear,
  })

  const hasFilosofiInterface = selectedDatasetId === 'filosofi'
  const hasDvfInterface = selectedDatasetId === 'dvf'

  const {
    years: filosofiYears,
    selectedYear,
    setSelectedYear,
    geographyLevel,
    setGeographyLevel,
    departmentSource,
    setDepartmentSource,
    indicatorOptions,
    selectedIndicator,
    setSelectedIndicator,
    searchQuery,
    setSearchQuery,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    result: filosofiResult,
    warnings: filosofiWarnings,
    error: filosofiError,
    isLoading: isFilosofiLoading,
    tableColumns: filosofiTableColumns,
    tableRows: filosofiTableRows,
  } = useFilosofiExplorer(hasFilosofiInterface)

  const selectedDataset = useMemo(
    () =>
      selectedPreview?.dataset ??
      datasets.find((dataset) => dataset.id === selectedDatasetId) ??
      null,
    [datasets, selectedDatasetId, selectedPreview],
  )

  const dvfAvailableYears =
    datasets.find((dataset) => dataset.id === 'dvf')?.availableYears ??
    selectedPreview?.dataset.availableYears ??
    []

  const dvfYearOptions = useMemo(
    () =>
      dvfAvailableYears
        .slice()
        .sort((left, right) => right - left)
        .map((year) => ({
          label: String(year),
          value: year,
        })),
    [dvfAvailableYears],
  )

  return (
    <div className="page page--content">
      <section className="panel panel--hero">
        <div className="panel__content">
          <p className="eyebrow">Data Explorer</p>
          <h1>Explorer les jeux de données publics</h1>
          <p className="lead">
            Consultez un aperçu tabulaire des principales sources ouvertes utilisées
            par l’observatoire, puis interrogez FiLoSoFi directement dans le
            navigateur avec DuckDB-Wasm.
          </p>
        </div>
      </section>

      <section className="data-explorer-layout">
        <DatasetSelector
          datasets={datasets}
          selectedDatasetId={selectedDatasetId}
          onSelect={(datasetId) => {
            setSelectedDatasetId(datasetId)
            setIsDvfYearMenuOpen(false)
          }}
        />

        {hasFilosofiInterface ? (
          <>
            <FilosofiQueryPanel
              years={filosofiYears}
              selectedYear={selectedYear}
              onYearChange={(year) => {
                setSelectedYear(year)
                setPage(1)
              }}
              geographyLevel={geographyLevel}
              onGeographyLevelChange={(level) => {
                setGeographyLevel(level)
                setDepartmentSource('official')
                setPage(1)
              }}
              departmentSource={departmentSource}
              onDepartmentSourceChange={(source) => {
                setDepartmentSource(source)
                setPage(1)
              }}
              indicators={indicatorOptions}
              selectedIndicator={selectedIndicator}
              onIndicatorChange={(indicator) => {
                setSelectedIndicator(indicator)
                setSortBy(indicator)
                setSortDirection('desc')
                setPage(1)
              }}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSortChange={(nextSortBy, nextDirection) => {
                setSortBy(nextSortBy)
                setSortDirection(nextDirection)
                setPage(1)
              }}
              warnings={filosofiWarnings}
            />

            {filosofiError ? <StatusPanel message={filosofiError} /> : null}
            {isFilosofiLoading ? (
              <StatusPanel message="Chargement des données FiLoSoFi…" />
            ) : null}
            {filosofiResult && selectedIndicator ? (
              <DataTable
                mode="remote"
                searchQuery={searchQuery}
                onSearchQueryChange={(query) => {
                  setSearchQuery(query)
                  setPage(1)
                }}
                pageSize={pageSize}
                page={page}
                totalRows={filosofiResult.totalRows}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
                columns={filosofiTableColumns}
                rows={filosofiTableRows}
                formatValue={formatFilosofiValue}
                getRowKey={(row, rowIndex) =>
                  `${String(row.geographyCode ?? rowIndex)}-${rowIndex}`
                }
                footnote={
                  <>
                    Requête exécutée sur : <code>{filosofiResult.parquetUrl}</code>
                  </>
                }
              />
            ) : null}
          </>
        ) : hasDvfInterface ? (
          <>
            <section className="panel data-explorer-year-panel">
              <CustomSelectField
                label="Année DVF"
                value={selectedDvfYear}
                options={dvfYearOptions}
                isOpen={isDvfYearMenuOpen}
                onToggle={() => setIsDvfYearMenuOpen((current) => !current)}
                onClose={() => setIsDvfYearMenuOpen(false)}
                onChange={(value) => setSelectedDvfYear(Number(value))}
              />
              <p className="panel__footnote panel__footnote--compact">
                Les millésimes DVF historiques peuvent exposer moins de colonnes que
                les années récentes. L’aperçu s’adapte automatiquement au schéma
                disponible pour l’année sélectionnée.
              </p>
            </section>

            {error ? <StatusPanel message={error} /> : null}
            {isLoading ? (
              <StatusPanel message="Chargement de l’aperçu du jeu de données…" />
            ) : null}
            {selectedPreview ? (
              <DataTable columns={selectedPreview.columns} rows={selectedPreview.records} />
            ) : null}
          </>
        ) : selectedPreview ? (
          <DataTable columns={selectedPreview.columns} rows={selectedPreview.records} />
        ) : null}

        {!hasDvfInterface && !hasFilosofiInterface && (error ?? catalogError) ? (
          <StatusPanel message={(error ?? catalogError) as string} />
        ) : null}

        {!hasDvfInterface && !hasFilosofiInterface && isLoading ? (
          <StatusPanel message="Chargement de l’aperçu du jeu de données…" />
        ) : null}

        {selectedDataset ? <DatasetInfoCard dataset={selectedDataset} /> : null}
      </section>
    </div>
  )
}
