import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { queryFilosofiTrend, FILOSOFI_TREND_INDICATORS } from '../services/filosofiDataService'
import { queryDvfTrend } from '../services/dvfService'
import type {
  FilosofiTrendIndicator,
  FilosofiTrendResult,
  DvfTrendResult,
} from '../types/realEstate'

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(value)

const loadingMessage = 'Chargement des tendances FiLoSoFi…'
const errorMessage =
  'Impossible de charger les tendances FiLoSoFi. Vérifiez la connexion et la configuration des données.'

const INDICATOR_LABELS: Record<FilosofiTrendIndicator, string> = {
  median_income: 'Revenu médian',
  d1_income: 'Décile D1 (10% plus pauvres)',
  d9_income: 'Décile D9 (10% plus riches)',
}

const buildChartOptions = (
  trendResult: FilosofiTrendResult,
  visibleIndicators: Set<FilosofiTrendIndicator>,
) => {
  const years = trendResult.availableYears.map((year) => String(year))
  const visibleSeries = trendResult.series.filter((s) =>
    visibleIndicators.has(s.indicator),
  )

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<Record<string, unknown>>) =>
        params
          .map((item) => {
            const name = String(item.name ?? '')
            const value = item.value
            if (value === null || value === undefined) {
              return `${name}: N/A`
            }
            return `${name}: ${formatCurrency(Number(value))} €`
          })
          .join('<br/>'),
    },
    legend: {
      top: 8,
      left: 'center',
      textStyle: {
        color: 'var(--color-text)',
        fontSize: 13,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
      data: visibleSeries.map((s) => s.label),
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '14%',
      top: '18%',
    },
    xAxis: {
      type: 'category',
      data: years,
      boundaryGap: false,
      axisLine: { lineStyle: { color: 'var(--color-border)' } },
      axisLabel: { color: 'var(--color-muted)' },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'var(--color-border)' } },
      splitLine: {
        lineStyle: {
          color: 'rgba(13, 43, 64, 0.08)',
        },
      },
      axisLabel: {
        formatter: (value: number) => `${formatCurrency(value)} €`,
        color: 'var(--color-muted)',
      },
    },
    series: visibleSeries.map((series) => ({
      name: series.label,
      type: 'line',
      smooth: true,
      connectNulls: false,
      emphasis: { focus: 'series' },
      data: series.points.map((point) =>
        point.value === null ? null : Number(point.value.toFixed(0)),
      ),
    })),
  }
}

const buildDvfChartOptions = (dvfResult: DvfTrendResult) => {
  const years = dvfResult.availableYears.map((year) => String(year))

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<Record<string, unknown>>) =>
        params
          .map((item) => {
            const value = item.value
            if (value === null || value === undefined) {
              return `Prix médian: N/A`
            }
            return `Prix médian: ${formatCurrency(Number(value))} €`
          })
          .join('<br/>'),
    },
    legend: {
      top: 8,
      left: 'center',
      textStyle: {
        color: 'var(--color-text)',
        fontSize: 13,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '14%',
      top: '18%',
    },
    xAxis: {
      type: 'category',
      data: years,
      boundaryGap: false,
      axisLine: { lineStyle: { color: 'var(--color-border)' } },
      axisLabel: { color: 'var(--color-muted)' },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'var(--color-border)' } },
      splitLine: {
        lineStyle: {
          color: 'rgba(13, 43, 64, 0.08)',
        },
      },
      axisLabel: {
        formatter: (value: number) => `${formatCurrency(value)} €`,
        color: 'var(--color-muted)',
      },
    },
    series: [
      {
        name: 'Prix médian au m²',
        type: 'line',
        smooth: true,
        connectNulls: false,
        lineStyle: { color: 'rgba(198, 96, 55, 0.8)' },
        areaStyle: { color: 'rgba(198, 96, 55, 0.1)' },
        emphasis: { focus: 'series' },
        data: dvfResult.points
          .sort((a, b) => a.year - b.year)
          .map((point) =>
            point.medianPricePerSquareMeter === null
              ? null
              : Number(point.medianPricePerSquareMeter.toFixed(0)),
          ),
      },
    ],
  }
}

export default function EvolutionChartsSection({
  description,
}: {
  description: string
}) {
  const [trendResult, setTrendResult] = useState<FilosofiTrendResult | null>(null)
  const [dvfResult, setDvfResult] = useState<DvfTrendResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [visibleIndicators, setVisibleIndicators] = useState<Set<FilosofiTrendIndicator>>(
    new Set(FILOSOFI_TREND_INDICATORS),
  )

  useEffect(() => {
    let active = true

    Promise.all([
      queryFilosofiTrend({
        geographyLevel: 'commune',
        departmentSource: 'official',
        indicators: FILOSOFI_TREND_INDICATORS,
      }),
      queryDvfTrend(),
    ])
      .then(([filosofiResult, dvfData]) => {
        if (!active) {
          return
        }
        console.log('FiLoSoFi trend loaded:', filosofiResult)
        console.log('DVF trend loaded:', dvfData)
        setTrendResult(filosofiResult)
        setDvfResult(dvfData)
      })
      .catch((error) => {
        if (!active) {
          return
        }
        console.error('Trend data error:', error)
        setLoadError(true)
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const toggleIndicator = (indicator: FilosofiTrendIndicator) => {
    const newVisible = new Set(visibleIndicators)
    if (newVisible.has(indicator)) {
      newVisible.delete(indicator)
    } else {
      newVisible.add(indicator)
    }
    setVisibleIndicators(newVisible)
  }

  const filosofiChartOptions = useMemo(
    () => (trendResult ? buildChartOptions(trendResult, visibleIndicators) : null),
    [trendResult, visibleIndicators],
  )

  const dvfChartOptions = useMemo(
    () => (dvfResult ? buildDvfChartOptions(dvfResult) : null),
    [dvfResult],
  )

  return (
    <div className="evolution-charts-section">
      <p className="panel__lede">{description}</p>

      {isLoading ? (
        <p className="panel__footnote">{loadingMessage}</p>
      ) : loadError ? (
        <p className="panel__footnote">{errorMessage}</p>
      ) : trendResult || dvfResult ? (
        <>
          <div className="evolution-chart-summary">
            <p>Données nationales sur l'évolution des revenus et des prix immobiliers.</p>
          </div>

          <div className="evolution-charts-grid">
            {trendResult && (
              <div className="evolution-chart-container">
                <h3 className="evolution-chart-title">Revenus (FiLoSoFi)</h3>

                <fieldset className="evolution-indicators-selector">
                  <legend>Indicateurs</legend>
                  <div className="indicators-checkboxes">
                    {FILOSOFI_TREND_INDICATORS.map((indicator) => (
                      <label key={indicator} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={visibleIndicators.has(indicator)}
                          onChange={() => toggleIndicator(indicator)}
                          className="checkbox-input"
                        />
                        <span className="checkbox-text">
                          {INDICATOR_LABELS[indicator]}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="evolution-chart-wrapper">
                  <ReactECharts
                    option={filosofiChartOptions ?? {}}
                    style={{ width: '100%', height: '340px' }}
                  />
                </div>

                <p className="panel__footnote">
                  Données disponibles pour les années : {trendResult.availableYears.join(', ')}.
                </p>
              </div>
            )}

            {dvfResult && (
              <div className="evolution-chart-container">
                <h3 className="evolution-chart-title">Prix immobilier (DVF)</h3>

                <div className="evolution-indicators-selector evolution-indicators-selector--disabled">
                  <p className="evolution-chart-label">Prix médian au m²</p>
                </div>

                <div className="evolution-chart-wrapper">
                  <ReactECharts
                    option={dvfChartOptions ?? {}}
                    style={{ width: '100%', height: '340px' }}
                  />
                </div>

                <p className="panel__footnote">
                  Données disponibles pour les années : {dvfResult.availableYears.join(', ')}.
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="panel__footnote">Aucune donnée de tendance disponible.</p>
      )}
    </div>
  )
}
