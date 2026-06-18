import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { DatasetInfoCard } from '../components/dataexplorer/DatasetInfoCard'
import { DatasetSelector } from '../components/dataexplorer/DatasetSelector'
import { DataTable } from '../components/dataexplorer/DataTable'
import { FilosofiQueryPanel } from '../components/dataexplorer/FilosofiQueryPanel'
import type { BusinessDatasetId } from '../data/datasetRegistry'
import {
  getDatasetPreview,
  listDatasets,
  type DatasetDescriptor,
  type DatasetPreview,
} from '../services/dataExplorerService'
import {
  getAvailableIndicators,
  getAvailableYears,
  getIndicatorAvailability,
  getMetadata,
  queryFilosofiData,
  RESULT_COLUMNS,
  type FilosofiResultColumn,
} from '../services/filosofiDataService'
import type {
  FilosofiDepartmentSource,
  FilosofiGeographyLevel,
  FilosofiIndicator,
  FilosofiIndicatorOption,
  FilosofiQueryResult,
} from '../types/realEstate'

const DEFAULT_PAGE_SIZE = 50

export function DataExplorer() {
  const [datasets, setDatasets] = useState<DatasetDescriptor[]>([])
  const [selectedDatasetId, setSelectedDatasetId] =
    useState<BusinessDatasetId>('dvf')
  const [selectedPreview, setSelectedPreview] = useState<DatasetPreview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filosofiYears, setFilosofiYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [geographyLevel, setGeographyLevel] =
    useState<FilosofiGeographyLevel>('commune')
  const [departmentSource, setDepartmentSource] =
    useState<FilosofiDepartmentSource>('official')
  const [indicatorOptions, setIndicatorOptions] = useState<FilosofiIndicatorOption[]>(
    [],
  )
  const [selectedIndicator, setSelectedIndicator] =
    useState<FilosofiIndicator | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sortBy, setSortBy] = useState('geography_name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filosofiResult, setFilosofiResult] = useState<FilosofiQueryResult | null>(
    null,
  )
  const [filosofiWarnings, setFilosofiWarnings] = useState<string[]>([])
  const [filosofiError, setFilosofiError] = useState<string | null>(null)
  const [isFilosofiLoading, setIsFilosofiLoading] = useState(false)
  const requestSequenceRef = useRef(0)

  const deferredSearchQuery = useDeferredValue(searchQuery)

  useEffect(() => {
    let isMounted = true

    const loadDatasets = async () => {
      try {
        const descriptors = await listDatasets()
        if (!isMounted) {
          return
        }
        setDatasets(descriptors)
      } catch {
        if (isMounted) {
          setError('Impossible de charger le catalogue des jeux de données.')
        }
      }
    }

    void loadDatasets()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    setError(null)

    const loadPreview = async () => {
      try {
        const preview = await getDatasetPreview(selectedDatasetId)
        if (!isMounted) {
          return
        }
        setSelectedPreview(preview)
      } catch {
        if (isMounted) {
          setError('Impossible de charger l’aperçu du jeu de données sélectionné.')
          setSelectedPreview(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadPreview()

    return () => {
      isMounted = false
    }
  }, [selectedDatasetId])

  useEffect(() => {
    if (selectedDatasetId !== 'filosofi') {
      return
    }

    let isMounted = true
    const loadFilosofiCatalog = async () => {
      try {
        const [metadata, availability, years] = await Promise.all([
          getMetadata(),
          getIndicatorAvailability(),
          getAvailableYears(),
        ])
        if (!isMounted) {
          return
        }
        void availability
        startTransition(() => {
          setFilosofiYears(years)
          setSelectedYear((current) =>
            current && years.includes(current)
              ? current
              : metadata.availableYears.at(-1) ?? years.at(-1) ?? null,
          )
        })
      } catch {
        if (isMounted) {
          setFilosofiError(
            'Impossible de charger les métadonnées FiLoSoFi. Vérifiez l’accès aux fichiers JSON sur R2.',
          )
        }
      }
    }

    void loadFilosofiCatalog()

    return () => {
      isMounted = false
    }
  }, [selectedDatasetId])

  useEffect(() => {
    if (selectedDatasetId !== 'filosofi' || !selectedYear) {
      return
    }

    let isMounted = true
    const loadIndicators = async () => {
      try {
        const options = await getAvailableIndicators(
          selectedYear,
          geographyLevel,
          departmentSource,
        )
        if (!isMounted) {
          return
        }
        startTransition(() => {
          setIndicatorOptions(options)
          setSelectedIndicator((current) =>
            current && options.some((option) => option.indicator === current)
              ? current
              : options[0]?.indicator ?? null,
          )
        })
      } catch {
        if (isMounted) {
          setIndicatorOptions([])
          setSelectedIndicator(null)
        }
      }
    }

    void loadIndicators()

    return () => {
      isMounted = false
    }
  }, [departmentSource, geographyLevel, selectedDatasetId, selectedYear])

  useEffect(() => {
    if (selectedDatasetId !== 'filosofi' || !selectedYear || !selectedIndicator) {
      return
    }

    const sequence = ++requestSequenceRef.current
    setIsFilosofiLoading(true)
    setFilosofiError(null)

    const loadData = async () => {
      try {
        const result = await queryFilosofiData({
          year: selectedYear,
          geographyLevel,
          indicator: selectedIndicator,
          departmentSource,
          limit: pageSize,
          offset: (page - 1) * pageSize,
          search: deferredSearchQuery,
          sortBy,
          sortDirection,
        })

        if (requestSequenceRef.current !== sequence) {
          return
        }

        startTransition(() => {
          setFilosofiResult(result)
          setFilosofiWarnings(result.warnings)
        })
      } catch {
        if (requestSequenceRef.current === sequence) {
          setFilosofiResult(null)
          setFilosofiWarnings([])
          setFilosofiError(
            'Impossible d’interroger les Parquet FiLoSoFi. Vérifiez la configuration R2, CORS et le support des requêtes Range.',
          )
        }
      } finally {
        if (requestSequenceRef.current === sequence) {
          setIsFilosofiLoading(false)
        }
      }
    }

    void loadData()
  }, [
    deferredSearchQuery,
    departmentSource,
    geographyLevel,
    page,
    pageSize,
    selectedDatasetId,
    selectedIndicator,
    selectedYear,
    sortBy,
    sortDirection,
  ])

  const selectedDataset = useMemo(
    () =>
      selectedPreview?.dataset ??
      datasets.find((dataset) => dataset.id === selectedDatasetId) ??
      null,
    [datasets, selectedDatasetId, selectedPreview],
  )

  const hasFilosofiInterface =
    selectedDatasetId === 'filosofi' &&
    selectedYear !== null &&
    selectedIndicator !== null

  const resultColumns = useMemo<FilosofiResultColumn[]>(() => {
    if (!selectedIndicator) {
      return RESULT_COLUMNS
    }
    return RESULT_COLUMNS.map((column) =>
      column.key === 'indicatorValue'
        ? { ...column, label: indicatorOptions.find((option) => option.indicator === selectedIndicator)?.label ?? column.label }
        : column,
    )
  }, [indicatorOptions, selectedIndicator])

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
            setPage(1)
            setSearchQuery('')
          }}
        />

        {selectedDataset ? <DatasetInfoCard dataset={selectedDataset} /> : null}

        {error ? (
          <section className="panel">
            <p>{error}</p>
          </section>
        ) : null}

        {isLoading ? (
          <section className="panel">
            <p>Chargement de l’aperçu du jeu de données…</p>
          </section>
        ) : null}

        {hasFilosofiInterface ? (
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
            search={searchQuery}
            onSearchChange={(query) => {
              setSearchQuery(query)
              setPage(1)
            }}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSortChange={(nextSortBy, nextDirection) => {
              setSortBy(nextSortBy)
              setSortDirection(nextDirection)
              setPage(1)
            }}
            pageSize={pageSize}
            page={page}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            columns={resultColumns}
            result={filosofiResult}
            warnings={filosofiWarnings}
            isLoading={isFilosofiLoading}
            error={filosofiError}
          />
        ) : selectedPreview ? (
          <DataTable columns={selectedPreview.columns} rows={selectedPreview.records} />
        ) : null}
      </section>
    </div>
  )
}
