import { MetricCard } from '../components/MetricCard'
import type {
  HomeHero,
  Metric,
  PlaceholderSection,
  SourceReference,
} from '../types/realEstate'

type HomeProps = {
  hero: HomeHero
  metrics: Metric[]
  mapSection: PlaceholderSection
  chartSection: PlaceholderSection
  sources: SourceReference[]
}

export function Home({
  hero,
  metrics,
  mapSection,
  chartSection,
  sources,
}: HomeProps) {
  return (
    <div className="page">
      <section className="hero-panel">
        <div className="hero-panel__content">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1>{hero.title}</h1>
          <p className="lead">{hero.description}</p>
        </div>
      </section>

      <section className="metrics-section" aria-labelledby="metrics-title">
        <div className="section-heading">
          <p className="eyebrow">Indicateurs clés</p>
          <h2 id="metrics-title">Vue d’ensemble</h2>
        </div>

        <div className="metrics-grid">
          {metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>
      </section>

      <section className="content-grid">
        <article className="panel panel--placeholder">
          <div className="section-heading">
            <p className="eyebrow">{mapSection.eyebrow}</p>
            <h2>{mapSection.title}</h2>
          </div>
          <div className="placeholder-block placeholder-block--map">
            {mapSection.description}
          </div>
        </article>

        <article className="panel panel--placeholder">
          <div className="section-heading">
            <p className="eyebrow">{chartSection.eyebrow}</p>
            <h2>{chartSection.title}</h2>
          </div>
          <div className="placeholder-block placeholder-block--chart">
            {chartSection.description}
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
            <span key={source.id} className="source-pill">
              {source.label}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
