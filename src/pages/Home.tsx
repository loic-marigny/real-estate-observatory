import { startTransition, useEffect, useState } from 'react'
import { DepartmentChoropleth } from '../components/DepartmentChoropleth'
import { MetricCard } from '../components/MetricCard'
import { getDvfSummary } from '../services/dvfService'
import type {
  DvfSummary,
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

const formatInteger = (value: number): string =>
  new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(value)

const formatSurface = (value: number): string => `${formatInteger(value)} m²`

const formatCurrencyPerSquareMeter = (value: number): string =>
  `${formatInteger(value)} €`

const buildMetricsFromDvfSummary = (summary: DvfSummary): Metric[] => [
  {
    id: 'median-price',
    label: 'Prix médian au m²',
    value:
      summary.medianPricePerSquareMeter !== null
        ? formatCurrencyPerSquareMeter(summary.medianPricePerSquareMeter)
        : 'N/A',
    trend: 'DVF chargé',
    description:
      'Calculé sur les ventes résidentielles filtrées dans le fichier DVF local.',
  },
  {
    id: 'transactions',
    label: 'Ventes résidentielles',
    value: formatInteger(summary.totalSalesCount),
    trend: 'DVF chargé',
    description:
      'Nombre total de mutations conservées après filtrage des ventes résidentielles.',
  },
  {
    id: 'median-surface',
    label: 'Surface médiane',
    value:
      summary.medianSurface !== null ? formatSurface(summary.medianSurface) : 'N/A',
    trend: 'DVF chargé',
    description:
      'Surface bâtie médiane des ventes résidentielles retenues dans l’échantillon.',
  },
  {
    id: 'departments-covered',
    label: 'Départements couverts',
    value: formatInteger(summary.departments.length),
    trend: 'DVF chargé',
    description:
      'Nombre de départements présents dans le résumé local généré à partir de DVF.',
  },
]

export function Home({
  hero,
  metrics,
  mapSection,
  chartSection,
  sources,
}: HomeProps) {
  const [displayMetrics, setDisplayMetrics] = useState<Metric[]>(metrics)
  const [dvfSummary, setDvfSummary] = useState<DvfSummary | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadDvfSummary = async () => {
      try {
        const summary = await getDvfSummary()

        if (!isMounted) {
          return
        }

        startTransition(() => {
          setDvfSummary(summary)
          setDisplayMetrics(buildMetricsFromDvfSummary(summary))
        })
      } catch {
        if (isMounted) {
          startTransition(() => {
            setDvfSummary(null)
            setDisplayMetrics(metrics)
          })
        }
      }
    }

    void loadDvfSummary()

    return () => {
      isMounted = false
    }
  }, [metrics])

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
          {displayMetrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>
      </section>

      <section className="content-grid">
        <article className="panel panel--map">
          <div className="section-heading">
            <p className="eyebrow">{mapSection.eyebrow}</p>
            <h2>{mapSection.title}</h2>
          </div>
          <p className="panel__lede">{mapSection.description}</p>
          <DepartmentChoropleth departments={dvfSummary?.departments ?? []} />
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
