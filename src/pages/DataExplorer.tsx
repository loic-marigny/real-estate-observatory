import { useEffect, useMemo, useState } from 'react'
import { DatasetInfoCard } from '../components/dataexplorer/DatasetInfoCard'
import { DatasetSelector } from '../components/dataexplorer/DatasetSelector'
import { DataTable } from '../components/dataexplorer/DataTable'
import {
  getDatasetPreview,
  listDatasets,
  type DatasetDescriptor,
  type DatasetPreview,
} from '../services/dataExplorerService'
import type { BusinessDatasetId } from '../data/datasetRegistry'

export function DataExplorer() {
  const [datasets, setDatasets] = useState<DatasetDescriptor[]>([])
  const [selectedDatasetId, setSelectedDatasetId] =
    useState<BusinessDatasetId>('dvf')
  const [selectedPreview, setSelectedPreview] = useState<DatasetPreview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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

  const selectedDataset = useMemo(
    () =>
      selectedPreview?.dataset ??
      datasets.find((dataset) => dataset.id === selectedDatasetId) ??
      null,
    [datasets, selectedDatasetId, selectedPreview],
  )

  return (
    <div className="page page--content">
      <section className="panel panel--hero">
        <div className="panel__content">
          <p className="eyebrow">Data Explorer</p>
          <h1>Explorer les jeux de données publics</h1>
          <p className="lead">
            Consultez un aperçu tabulaire des principales sources ouvertes utilisées
            par l’observatoire, avec tri, recherche et filtres sur les colonnes.
          </p>
        </div>
      </section>

      <section className="data-explorer-layout">
        <DatasetSelector
          datasets={datasets}
          selectedDatasetId={selectedDatasetId}
          onSelect={setSelectedDatasetId}
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

        {selectedPreview ? (
          <DataTable columns={selectedPreview.columns} rows={selectedPreview.records} />
        ) : null}
      </section>
    </div>
  )
}
