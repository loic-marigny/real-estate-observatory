import type { DatasetDescriptor } from '../../services/dataExplorerService'

type DatasetInfoCardProps = {
  dataset: DatasetDescriptor
}

export function DatasetInfoCard({ dataset }: DatasetInfoCardProps) {
  const yearsLabel = dataset.availableYears.length
    ? dataset.availableYears.join(', ')
    : 'Non disponible'

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
          <span className="dataset-info-card__label">Colonnes</span>
          <strong>{dataset.columns ?? 'Non disponible'}</strong>
        </div>
        <div>
          <span className="dataset-info-card__label">Dernière mise à jour</span>
          <strong>{dataset.lastUpdate ?? 'Non disponible'}</strong>
        </div>
        <div>
          <span className="dataset-info-card__label">Aperçu chargé depuis</span>
          <strong>{dataset.sourceFileLocation || 'Non disponible'}</strong>
        </div>
      </div>
    </article>
  )
}
