import { startTransition, useEffect, useState } from 'react'
import { DepartmentChoropleth } from '../components/DepartmentChoropleth'
import EvolutionChartsSection from '../components/EvolutionChartsSection'
import { MetricCard } from '../components/MetricCard'
import { getDvfSummary } from '../services/dvfService'
import { getFilosofiSummaries } from '../services/filosofiService'
import type {
  DvfSummary,
  FilosofiSummary,
  FilosofiSummaryCollection,
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
  metrics: _unusedMetrics,
  mapSection,
  chartSection,
  sources,
}: HomeProps) {
  const [displayMetrics, setDisplayMetrics] = useState<Metric[] | null>(null)
  const [dvfSummary, setDvfSummary] = useState<DvfSummary | null>(null)
  const [dvfMetricsError, setDvfMetricsError] = useState<string | null>(null)
  const [isDvfMetricsLoading, setIsDvfMetricsLoading] = useState(true)

  const [filosofiSummaries, setFilosofiSummaries] =
    useState<FilosofiSummaryCollection | null>(null)
  const [selectedFilosofiYear, setSelectedFilosofiYear] = useState<number | null>(null)
  const [filosofiError, setFilosofiError] = useState<string | null>(null)
  const [isFilosofiLoading, setIsFilosofiLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadDvfSummary = async () => {
      setIsDvfMetricsLoading(true)
      setDvfMetricsError(null)

      try {
        const summary = await getDvfSummary()

        if (!isMounted) {
          return
        }

        startTransition(() => {
          setDvfSummary(summary)
          setDisplayMetrics(buildMetricsFromDvfSummary(summary))
          setDvfMetricsError(null)
          setIsDvfMetricsLoading(false)
        })
      } catch (error) {
        if (!isMounted) {
          return
        }

        startTransition(() => {
          setDvfSummary(null)
          setDisplayMetrics(null)
          setDvfMetricsError(
            error instanceof Error
              ? error.message
              : 'Impossible de charger le résumé DVF.',
          )
          setIsDvfMetricsLoading(false)
        })
      }
    }

    void loadDvfSummary()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadFilosofiSummaries = async () => {
      setIsFilosofiLoading(true)
      setFilosofiError(null)

      try {
        const summaries = await getFilosofiSummaries()
        const availableYears = [...summaries.availableYears].sort((left, right) => left - right)
        const latestYear =
          summaries.latestYear ??
          availableYears[availableYears.length - 1] ??
          null

        if (!isMounted) {
          return
        }

        startTransition(() => {
          setFilosofiSummaries(summaries)
          setSelectedFilosofiYear(latestYear)
          setFilosofiError(null)
          setIsFilosofiLoading(false)
        })
      } catch (error) {
        if (!isMounted) {
          return
        }

        startTransition(() => {
          setFilosofiSummaries(null)
          setSelectedFilosofiYear(null)
          setFilosofiError(
            error instanceof Error
              ? error.message
              : 'Impossible de charger les résumés FiLoSoFi.',
          )
          setIsFilosofiLoading(false)
        })
      }
    }

    void loadFilosofiSummaries()

    return () => {
      isMounted = false
    }
  }, [])

  const availableFilosofiYears = [...(filosofiSummaries?.availableYears ?? [])].sort(
    (left, right) => left - right,
  )
  const selectedFilosofiYearIndex =
    selectedFilosofiYear !== null
      ? availableFilosofiYears.findIndex((year) => year === selectedFilosofiYear)
      : -1
  const selectedFilosofiSummary: FilosofiSummary | null =
    selectedFilosofiYear !== null
      ? (filosofiSummaries?.summariesByYear[String(selectedFilosofiYear)] ?? null)
      : null

  const handleFilosofiYearChange = (nextIndex: number) => {
    const nextYear = availableFilosofiYears[nextIndex]
    if (nextYear === undefined) {
      return
    }
    setSelectedFilosofiYear(nextYear)
  }

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

        {isDvfMetricsLoading ? (
          <div className="panel panel--compact">
            <p className="panel__footnote">Chargement du résumé DVF…</p>
          </div>
        ) : dvfMetricsError ? (
          <div className="panel panel--compact">
            <p className="panel__footnote">Impossible de charger les métriques DVF.</p>
            <p className="panel__footnote">{dvfMetricsError}</p>
          </div>
        ) : displayMetrics ? (
          <div className="metrics-grid">
            {displayMetrics.map((metric) => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>
        ) : null}
      </section>

      {isFilosofiLoading ? (
        <section className="panel panel--compact">
          <p className="panel__footnote">Chargement des résumés FiLoSoFi…</p>
        </section>
      ) : filosofiError ? (
        <section className="panel panel--compact">
          <p className="panel__footnote">Impossible de charger les résumés FiLoSoFi.</p>
          <p className="panel__footnote">{filosofiError}</p>
        </section>
      ) : selectedFilosofiSummary ? (
        <section className="panel panel--compact" aria-labelledby="filosofi-title">
          <div className="section-heading">
            <p className="eyebrow">FiLoSoFi</p>
            <h2 id="filosofi-title">Revenus localisés</h2>
          </div>
          {availableFilosofiYears.length > 0 ? (
            <div className="filosofi-year-control">
              <div className="filosofi-year-control__header">
                <span className="filosofi-year-control__label">Année affichée</span>
                <strong className="filosofi-year-control__value">
                  {selectedFilosofiYear ?? 'N/A'}
                </strong>
              </div>
              <input
                className="filosofi-year-control__range"
                type="range"
                min={0}
                max={Math.max(availableFilosofiYears.length - 1, 0)}
                step={1}
                value={Math.max(selectedFilosofiYearIndex, 0)}
                onChange={(event) =>
                  handleFilosofiYearChange(Number(event.currentTarget.value))
                }
                aria-label="Sélectionner l’année FiLoSoFi"
              />
              <div className="filosofi-year-control__ticks" aria-hidden="true">
                {availableFilosofiYears.map((year) => (
                  <span key={year}>{year}</span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mini-stats-grid">
            <article className="mini-stat-card">
              <span className="mini-stat-card__label">Départements couverts</span>
              <strong className="mini-stat-card__value">
                {formatInteger(selectedFilosofiSummary.departmentsCovered)}
              </strong>
            </article>
            <article className="mini-stat-card">
              <span className="mini-stat-card__label">Communes couvertes</span>
              <strong className="mini-stat-card__value">
                {formatInteger(selectedFilosofiSummary.communesCovered)}
              </strong>
            </article>
            <article className="mini-stat-card">
              <span className="mini-stat-card__label">Revenu médian national</span>
              <strong className="mini-stat-card__value">
                {selectedFilosofiSummary.nationalMedianIncome !== null
                  ? formatEuro(selectedFilosofiSummary.nationalMedianIncome)
                  : 'N/A'}
              </strong>
            </article>
            <article className="mini-stat-card">
              <span className="mini-stat-card__label">Repères D1 / Médiane / D9</span>
              <strong className="mini-stat-card__value mini-stat-card__value--stacked">
                <span>
                  D1{' '}
                  {selectedFilosofiSummary.decileSummary?.d1Income !== null &&
                  selectedFilosofiSummary.decileSummary?.d1Income !== undefined
                    ? formatEuro(selectedFilosofiSummary.decileSummary.d1Income)
                    : 'N/A'}
                </span>
                <span>
                  Médiane{' '}
                  {selectedFilosofiSummary.nationalMedianIncome !== null
                    ? formatEuro(selectedFilosofiSummary.nationalMedianIncome)
                    : 'N/A'}
                </span>
                <span>
                  D9{' '}
                  {selectedFilosofiSummary.decileSummary?.d9Income !== null &&
                  selectedFilosofiSummary.decileSummary?.d9Income !== undefined
                    ? formatEuro(selectedFilosofiSummary.decileSummary.d9Income)
                    : 'N/A'}
                </span>
              </strong>
            </article>
          </div>
          {selectedFilosofiSummary.povertyRateSummary?.mean !== null &&
          selectedFilosofiSummary.povertyRateSummary?.mean !== undefined ? (
            <p className="panel__footnote">
              Taux de pauvreté moyen disponible pour {selectedFilosofiYear} :{' '}
              {formatPercentage(selectedFilosofiSummary.povertyRateSummary.mean)}.
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
