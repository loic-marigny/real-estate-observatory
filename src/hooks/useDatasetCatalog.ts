import { useEffect, useState } from 'react'
import type { DatasetDescriptor } from '../services/dataExplorerService'
import { listDatasets } from '../services/dataExplorerService'

const getLatestYear = (years: number[]): number | null =>
  years.length > 0 ? [...years].sort((left, right) => left - right).at(-1) ?? null : null

type UseDatasetCatalogResult = {
  datasets: DatasetDescriptor[]
  defaultDvfYear: number | null
  error: string | null
}

export function useDatasetCatalog(): UseDatasetCatalogResult {
  const [datasets, setDatasets] = useState<DatasetDescriptor[]>([])
  const [defaultDvfYear, setDefaultDvfYear] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadDatasets = async () => {
      try {
        const descriptors = await listDatasets()
        if (!isMounted) {
          return
        }

        setDatasets(descriptors)
        const dvfDataset = descriptors.find((dataset) => dataset.id === 'dvf')
        setDefaultDvfYear(getLatestYear(dvfDataset?.availableYears ?? []))
        setError(null)
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

  return {
    datasets,
    defaultDvfYear,
    error,
  }
}
