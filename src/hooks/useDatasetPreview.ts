import { useEffect, useState } from 'react'
import type { BusinessDatasetId } from '../data/datasetRegistry'
import {
  getDatasetPreview,
  type DatasetPreview,
} from '../services/dataExplorerService'

const getLatestYear = (years: number[]): number | null =>
  years.length > 0 ? [...years].sort((left, right) => left - right).at(-1) ?? null : null

type UseDatasetPreviewArgs = {
  datasetId: BusinessDatasetId
  dvfYear: number | null
  onResolvedDvfYear?: (year: number | null) => void
}

type UseDatasetPreviewResult = {
  preview: DatasetPreview | null
  isLoading: boolean
  error: string | null
}

export function useDatasetPreview({
  datasetId,
  dvfYear,
  onResolvedDvfYear,
}: UseDatasetPreviewArgs): UseDatasetPreviewResult {
  const [preview, setPreview] = useState<DatasetPreview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    setError(null)

    const loadPreview = async () => {
      try {
        const nextPreview = await getDatasetPreview(
          datasetId,
          datasetId === 'dvf' ? dvfYear ?? undefined : undefined,
        )

        if (!isMounted) {
          return
        }

        setPreview(nextPreview)

        if (datasetId === 'dvf' && onResolvedDvfYear) {
          const latestDvfYear = getLatestYear(nextPreview.dataset.availableYears)
          onResolvedDvfYear(
            dvfYear && nextPreview.dataset.availableYears.includes(dvfYear)
              ? dvfYear
              : latestDvfYear,
          )
        }
      } catch {
        if (isMounted) {
          setError("Impossible de charger l’aperçu du jeu de données sélectionné.")
          setPreview(null)
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
  }, [datasetId, dvfYear, onResolvedDvfYear])

  return {
    preview,
    isLoading,
    error,
  }
}
