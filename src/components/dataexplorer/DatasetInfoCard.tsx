import type { DatasetDescriptor } from '../../services/dataExplorerService'

type DatasetInfoCardProps = {
  dataset: DatasetDescriptor
  displayedColumnsCount?: number | null
  displayedSourceLocation?: string | null
}

export function DatasetInfoCard({
  dataset,
  displayedColumnsCount,
  displayedSourceLocation,
}: DatasetInfoCardProps) {
  const yearsLabel = dataset.availableYears.length
    ? dataset.availableYears.join(', ')
    : 'Non disponible'

  const columnsCount = displayedColumnsCount ?? dataset.columns
  const sourceLocation = displayedSourceLocation ?? dataset.sourceFileLocation

  return (
    <article className="panel dataset-info-card">
      <div className="section-heading">
        <p className="eyebrow">Jeu de données</p>
        <h2>{dataset.label}</h2>
      </div>
      <p className="dataset-info-card__description">{dataset.description}</p>
      <div className="dataset-info-card__grid">
        <div>
          <span className="dataset-info-card__label">Organisation source</span>
          <strong>{dataset.sourceOrganization}</strong>
        </div>
        <div>
          <span className="dataset-info-card__label">Années disponibles</span>
          <strong>{yearsLabel}</strong>
        </div>
        <div>
          <span className="dataset-info-card__label">Lignes</span>
          <strong>{dataset.rows ?? 'Non disponible'}</strong>
        </div>
        <div>
          <span className="dataset-info-card__label">Colonnes affichées</span>
          <strong>{columnsCount ?? 'Non disponible'}</strong>
        </div>
        <div>
          <span className="dataset-info-card__label">Aperçu chargé depuis</span>
          <strong>{sourceLocation || 'Non disponible'}</strong>
        </div>
      </div>
    </article>
  )
}
