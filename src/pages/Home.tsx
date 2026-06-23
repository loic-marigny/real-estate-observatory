import { startTransition, useEffect, useState } from 'react'
import { DepartmentChoropleth } from '../components/DepartmentChoropleth'
import { MetricCard } from '../components/MetricCard'
import EvolutionChartsSection from '../components/EvolutionChartsSection'
import { getDvfSummary } from '../services/dvfService'
import { getFilosofiSummary } from '../services/filosofiService'
import type {
  DvfSummary,
  FilosofiSummary,
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
  `${formatInteger(value)} €/m²`

const formatEuro = (value: number): string => `${formatInteger(value)} €`

const formatPercentage = (value: number): string =>
  `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)} %`

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
  const [filosofiSummary, setFilosofiSummary] = useState<FilosofiSummary | null>(
    null,
  )

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

  useEffect(() => {
    let isMounted = true

    const loadFilosofiSummary = async () => {
      const summary = await getFilosofiSummary()

      if (!isMounted) {
        return
      }

      startTransition(() => {
        setFilosofiSummary(summary)
      })
    }

    void loadFilosofiSummary()

    return () => {
      isMounted = false
    }
  }, [])

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

      {filosofiSummary ? (
        <section className="panel panel--compact" aria-labelledby="filosofi-title">
          <div className="section-heading">
            <p className="eyebrow">FiLoSoFi</p>
            <h2 id="filosofi-title">Revenus localisés</h2>
          </div>
          <div className="mini-stats-grid">
            <article className="mini-stat-card">
              <span className="mini-stat-card__label">Dernier millésime</span>
              <strong className="mini-stat-card__value">
                {filosofiSummary.latestYear ?? 'N/A'}
              </strong>
            </article>
            <article className="mini-stat-card">
              <span className="mini-stat-card__label">Communes couvertes</span>
              <strong className="mini-stat-card__value">
                {formatInteger(filosofiSummary.communesCovered)}
              </strong>
            </article>
            <article className="mini-stat-card">
              <span className="mini-stat-card__label">Revenu médian national</span>
              <strong className="mini-stat-card__value">
                {filosofiSummary.nationalMedianIncome !== null
                  ? formatEuro(filosofiSummary.nationalMedianIncome)
                  : 'N/A'}
              </strong>
            </article>
            <article className="mini-stat-card">
              <span className="mini-stat-card__label">Déciles D1 / D5 / D9</span>
              <strong className="mini-stat-card__value mini-stat-card__value--stacked">
                <span>
                  D1{' '}
                  {filosofiSummary.decileSummary?.d1Income !== null &&
                  filosofiSummary.decileSummary?.d1Income !== undefined
                    ? formatEuro(filosofiSummary.decileSummary.d1Income)
                    : 'N/A'}
                </span>
                <span>
                  D5{' '}
                  {filosofiSummary.decileSummary?.d5Income !== null &&
                  filosofiSummary.decileSummary?.d5Income !== undefined
                    ? formatEuro(filosofiSummary.decileSummary.d5Income)
                    : 'N/A'}
                </span>
                <span>
                  D9{' '}
                  {filosofiSummary.decileSummary?.d9Income !== null &&
                  filosofiSummary.decileSummary?.d9Income !== undefined
                    ? formatEuro(filosofiSummary.decileSummary.d9Income)
                    : 'N/A'}
                </span>
              </strong>
            </article>
          </div>
          {filosofiSummary.povertyRateSummary?.mean !== null &&
          filosofiSummary.povertyRateSummary?.mean !== undefined ? (
            <p className="panel__footnote">
              Taux de pauvreté moyen disponible pour le dernier millésime :{' '}
              {formatPercentage(filosofiSummary.povertyRateSummary.mean)}.
            </p>
          ) : null}
        </section>
      ) : null}

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
          <EvolutionChartsSection description={chartSection.description} />
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
