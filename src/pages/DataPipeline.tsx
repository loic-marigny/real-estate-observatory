import type { PipelineHero, PipelineStep } from '../types/realEstate'

type DataPipelineProps = {
  hero: PipelineHero
  steps: PipelineStep[]
}

const DATASET_NOTES = [
  {
    title: 'DVF',
    points: [
      'Le pipeline DVF doit harmoniser deux familles de sources différentes : les anciens exports DGFiP pour 2014 à 2020 et le Geo-DVF normalisé pour 2021 et après.',
      "La couche bronze aligne les schémas historiques et récents pour permettre une exploitation commune dans l'interface.",
      "La couche silver applique le périmètre analytique résidentiel et calcule les variables dérivées comme le prix au m².",
      "La couche gold produit les indicateurs nationaux, départementaux et communaux utilisés par les cartes, graphiques et aperçus.",
    ],
  },
  {
    title: 'FiLoSoFi',
    points: [
      "Le pipeline FiLoSoFi gère des millésimes hétérogènes, des variables inégalement disponibles et des ruptures méthodologiques selon les années.",
      "Il conserve séparément les niveaux communal, départemental officiel et départemental dérivé pour ne pas mélanger des produits statistiques de nature différente.",
      "Les indicateurs manquants ne sont pas reconstruits artificiellement ; ils restent absents dans les sorties consolidées.",
      "Les fichiers consolidés multi-années servent ensuite de base au Data Explorer et aux séries de revenus affichées dans l'interface.",
    ],
  },
] as const

const ARTIFACT_GROUPS = [
  {
    title: 'Artefacts locaux versionnés',
    description:
      "Les fichiers JSON légers placés dans `public/data/` sont embarqués avec le site. Ils servent les cartes, résumés et aperçus rapides sans dépendre d'un backend applicatif.",
  },
  {
    title: 'Artefacts analytiques distants',
    description:
      "Les fichiers Parquet et métadonnées plus volumineux sont publiés sur R2. Ils peuvent être mis à jour sans changer le principe de consultation côté navigateur, tant que leurs URL publiques restent stables.",
  },
  {
    title: 'Configuration du pipeline',
    description:
      "Les années actives, les catalogues de sources et les correspondances de colonnes sont pilotés par les fichiers de configuration du dépôt, afin de limiter les réglages implicites disséminés dans le code.",
  },
] as const

const QUALITY_POINTS = [
  'La documentation distingue explicitement ce qui est issu de la source officielle, ce qui est dérivé par agrégation et ce qui est simplement indisponible.',
  "Les validations de base passent par la compilation du front, les tests du dépôt et la vérification des artefacts générés avant publication.",
  "L'architecture sans backend réduit les transformations invisibles à l'exécution : la logique principale du traitement reste lisible dans le code et la documentation.",
  "Les hypothèses de filtrage et de consolidation doivent être documentées au même niveau que les sorties elles-mêmes, afin que l'utilisateur puisse juger de leur portée.",
] as const

export function DataPipeline({ hero, steps }: DataPipelineProps) {
  return (
    <div className="page page--content">
      <section className="panel panel--hero">
        <div className="panel__content">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1>{hero.title}</h1>
          <p className="lead">{hero.description}</p>
        </div>
      </section>

      <section className="panel methodology-panel">
        <div className="section-heading">
          <p className="eyebrow">Chaîne générale</p>
          <h2>De la source brute au site public</h2>
        </div>

        <div className="pipeline-flow" aria-label="Pipeline de données">
          {steps.map((step, index) => (
            <div key={step.id} className="pipeline-flow__segment">
              <article className="pipeline-step">
                <span className="pipeline-step__index">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>

              {index < steps.length - 1 ? (
                <span className="pipeline-flow__arrow" aria-hidden="true">
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="content-grid methodology-columns">
        {DATASET_NOTES.map((dataset) => (
          <article key={dataset.title} className="panel methodology-panel">
            <div className="section-heading">
              <p className="eyebrow">Source</p>
              <h2>{dataset.title}</h2>
            </div>
            <ul className="methodology-list methodology-list--compact">
              {dataset.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="panel methodology-panel">
        <div className="section-heading">
          <p className="eyebrow">Publication</p>
          <h2>Ce qui est produit et comment c&apos;est exposé</h2>
        </div>
        <div className="methodology-card-grid">
          {ARTIFACT_GROUPS.map((group) => (
            <article key={group.title} className="methodology-card">
              <h3>{group.title}</h3>
              <p>{group.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel methodology-panel">
        <div className="section-heading">
          <p className="eyebrow">Qualité</p>
          <h2>Contrôles, traçabilité et discipline de publication</h2>
        </div>
        <ul className="methodology-list methodology-list--compact">
          {QUALITY_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
