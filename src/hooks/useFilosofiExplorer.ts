import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { DatasetColumn } from '../services/dataExplorerService'
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

const DEFAULT_PAGE_SIZE = 20

export const formatFilosofiValue = (value: unknown): string => {
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

export function useFilosofiExplorer(isActive: boolean) {
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [geographyLevel, setGeographyLevel] =
    useState<FilosofiGeographyLevel>('commune')
  const [departmentSource, setDepartmentSource] =
    useState<FilosofiDepartmentSource>('official')
  const [indicatorOptions, setIndicatorOptions] = useState<FilosofiIndicatorOption[]>([])
  const [selectedIndicator, setSelectedIndicator] =
    useState<FilosofiIndicator | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sortBy, setSortBy] = useState('geography_name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [result, setResult] = useState<FilosofiQueryResult | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const requestSequenceRef = useRef(0)

  const deferredSearchQuery = useDeferredValue(searchQuery)

  useEffect(() => {
    if (!isActive) {
      return
    }

    let isMounted = true
    const loadCatalog = async () => {
      try {
        setError(null)
        const [metadata, availability, nextYears] = await Promise.all([
          getMetadata(),
          getIndicatorAvailability(),
          getAvailableYears(),
        ])
        if (!isMounted) {
          return
        }

        void availability
        startTransition(() => {
          setYears(nextYears)
          setSelectedYear((current) =>
            current && nextYears.includes(current)
              ? current
              : metadata.availableYears.at(-1) ?? nextYears.at(-1) ?? null,
          )
        })
      } catch {
        if (isMounted) {
          setYears([])
          setSelectedYear(null)
          setError(
            'Impossible de charger les métadonnées FiLoSoFi. Vérifiez l’accès aux fichiers JSON sur R2.',
          )
        }
      }
    }

    void loadCatalog()

    return () => {
      isMounted = false
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive || !selectedYear) {
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
          setError(null)
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
          setError(
            'Impossible de déterminer les indicateurs FiLoSoFi disponibles pour cette sélection.',
          )
        }
      }
    }

    void loadIndicators()

    return () => {
      isMounted = false
    }
  }, [departmentSource, geographyLevel, isActive, selectedYear])

  useEffect(() => {
    if (!isActive || !selectedYear || !selectedIndicator) {
      setResult(null)
      setWarnings([])
      setIsLoading(false)
      return
    }

    const sequence = ++requestSequenceRef.current
    setIsLoading(true)
    setError(null)

    const loadData = async () => {
      try {
        const nextResult = await queryFilosofiData({
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
          setResult(nextResult)
          setWarnings(nextResult.warnings)
        })
      } catch {
        if (requestSequenceRef.current === sequence) {
          setResult(null)
          setWarnings([])
          setError(
            'Impossible d’interroger les Parquet FiLoSoFi. Vérifiez la configuration R2, CORS et le support des requêtes Range.',
          )
        }
      } finally {
        if (requestSequenceRef.current === sequence) {
          setIsLoading(false)
        }
      }
    }

    void loadData()
  }, [
    deferredSearchQuery,
    departmentSource,
    geographyLevel,
    isActive,
    page,
    pageSize,
    selectedIndicator,
    selectedYear,
    sortBy,
    sortDirection,
  ])

  const resultColumns = useMemo<FilosofiResultColumn[]>(() => {
    if (!selectedIndicator) {
      return RESULT_COLUMNS
    }

    return RESULT_COLUMNS.map((column) =>
      column.key === 'indicatorValue'
        ? {
            ...column,
            label:
              indicatorOptions.find(
                (option) => option.indicator === selectedIndicator,
              )?.label ?? column.label,
          }
        : column,
    )
  }, [indicatorOptions, selectedIndicator])

  const tableColumns = useMemo<DatasetColumn[]>(
    () =>
      resultColumns.map((column) => ({
        key: column.key,
        label: column.label,
        type: column.type,
      })),
    [resultColumns],
  )

  const tableRows = useMemo<Array<Record<string, unknown>>>(
    () => result?.rows.map((row) => ({ ...row })) ?? [],
    [result],
  )

  return {
    years,
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
    result,
    warnings,
    error,
    isLoading,
    tableColumns,
    tableRows,
  }
}
