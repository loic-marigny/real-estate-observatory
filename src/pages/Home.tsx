import { MetricCard } from '../components/MetricCard'

const metrics = [
  {
    label: 'Prix médian au m²',
    value: '3 420 €',
    trend: '+2,8 %',
    description: 'Évolution annuelle estimée à l’échelle nationale.',
  },
  {
    label: 'Transactions',
    value: '842 k',
    trend: '-4,1 %',
    description: 'Volume annuel de ventes anciennes observées.',
  },
  {
    label: 'Délai de vente',
    value: '71 jours',
    trend: '+5 jours',
    description: 'Temps moyen entre publication et signature.',
  },
  {
    label: 'Rendement locatif brut',
    value: '5,1 %',
    trend: '+0,2 pt',
    description: 'Indicateur agrégé sur les principales métropoles.',
  },
]

const sources = [
  'DVF / Etalab',
  'INSEE',
  'Base logements et loyers',
  'Notaires de France',
]

export function Home() {
  return (
    <div className="page">
      <section className="hero-panel">
        <div className="hero-panel__content">
          <p className="eyebrow">Plateforme publique</p>
          <h1>Observatoire immobilier France</h1>
          <p className="lead">
            Suivre les dynamiques de prix, de transactions et de tension
            immobilière à partir de sources publiques consolidées.
          </p>
        </div>
      </section>

      <section className="metrics-section" aria-labelledby="metrics-title">
        <div className="section-heading">
          <p className="eyebrow">Indicateurs clés</p>
          <h2 id="metrics-title">Vue d’ensemble</h2>
        </div>

        <div className="metrics-grid">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      <section className="content-grid">
        <article className="panel panel--placeholder">
          <div className="section-heading">
            <p className="eyebrow">Carte</p>
            <h2>Répartition territoriale</h2>
          </div>
          <div className="placeholder-block placeholder-block--map">
            Carte interactive France à intégrer
          </div>
        </article>

        <article className="panel panel--placeholder">
          <div className="section-heading">
            <p className="eyebrow">Graphique</p>
            <h2>Évolution temporelle</h2>
          </div>
          <div className="placeholder-block placeholder-block--chart">
            Visualisation de tendance à intégrer
          </div>
        </article>
      </section>

      <section className="panel sources-panel" aria-labelledby="sources-title">
        <div className="section-heading">
          <p className="eyebrow">Sources</p>
          <h2 id="sources-title">Jeux de données de référence</h2>
        </div>

        <div className="sources-list">
          {sources.map((source) => (
            <span key={source} className="source-pill">
              {source}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
