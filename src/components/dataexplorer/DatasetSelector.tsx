import type { DatasetDescriptor } from '../../services/dataExplorerService'
import type { BusinessDatasetId } from '../../data/datasetRegistry'

type DatasetSelectorProps = {
  datasets: DatasetDescriptor[]
  selectedDatasetId: BusinessDatasetId
  onSelect: (datasetId: BusinessDatasetId) => void
}

export function DatasetSelector({
  datasets,
  selectedDatasetId,
  onSelect,
}: DatasetSelectorProps) {
  return (
    <div className="dataset-selector" role="tablist" aria-label="Jeux de données">
      {datasets.map((dataset) => (
        <button
          key={dataset.id}
          type="button"
          className={
            dataset.id === selectedDatasetId
              ? 'dataset-selector__button dataset-selector__button--active'
              : 'dataset-selector__button'
          }
          onClick={() => onSelect(dataset.id)}
        >
          <span className="dataset-selector__label">{dataset.label}</span>
          <span className="dataset-selector__meta">
            {dataset.availableYears.length
              ? `${dataset.availableYears.at(-1)} · ${dataset.rows ?? '—'} lignes`
              : 'Aperçu indisponible'}
          </span>
        </button>
      ))}
    </div>
  )
}
