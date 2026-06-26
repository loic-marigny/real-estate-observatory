import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import {
  FILOSOFI_TREND_INDICATORS,
  queryFilosofiTrend,
} from '../services/filosofiDataService'
import { queryDvfTrend } from '../services/dvfService'
import type {
  DvfTrendResult,
  FilosofiTrendIndicator,
  FilosofiTrendResult,
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

const INDICATOR_COLORS: Record<FilosofiTrendIndicator, string> = {
  median_income: 'rgba(198, 96, 55, 0.9)',
  d1_income: 'rgba(82, 150, 255, 0.9)',
  d9_income: 'rgba(57, 186, 116, 0.9)',
}

const DVF_SERIES = [
  {
    name: 'Décile D1 (10% plus bas)',
    field: 'd1PricePerSquareMeter' as const,
    color: 'rgba(82, 150, 255, 0.8)',
    area: 'rgba(82, 150, 255, 0.1)',
  },
  {
    name: 'Prix médian au m²',
    field: 'medianPricePerSquareMeter' as const,
    color: 'rgba(198, 96, 55, 0.8)',
    area: 'rgba(198, 96, 55, 0.1)',
  },
  {
    name: 'Décile D9 (10% plus hauts)',
    field: 'd9PricePerSquareMeter' as const,
    color: 'rgba(57, 186, 116, 0.8)',
    area: 'rgba(57, 186, 116, 0.1)',
  },
]

const buildIncomeChartOptions = (
  trendResult: FilosofiTrendResult,
  visibleIndicators: Set<FilosofiTrendIndicator>,
) => {
  const years = trendResult.availableYears.map((year) => String(year))
  const visibleSeries = trendResult.series.filter((series) =>
    visibleIndicators.has(series.indicator),
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
      show: false,
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '14%',
      top: '10%',
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
      lineStyle: {
        color: INDICATOR_COLORS[series.indicator],
      },
      itemStyle: {
        color: INDICATOR_COLORS[series.indicator],
      },
      data: series.points.map((point) =>
        point.value === null ? null : Number(point.value.toFixed(0)),
      ),
    })),
  }
}

const buildDvfChartOptions = (dvfResult: DvfTrendResult) => {
  const years = dvfResult.availableYears.map((year) => String(year))

  const series = DVF_SERIES.map((template) => ({
    ...template,
    values: [...dvfResult.points]
      .sort((left, right) => left.year - right.year)
      .map((point) =>
        point[template.field] === null || point[template.field] === undefined
          ? null
          : Number((point[template.field] as number).toFixed(0)),
      ),
  }))
    .filter((seriesEntry) => seriesEntry.values.some((value) => value !== null))
    .map((seriesEntry) => ({
      name: seriesEntry.name,
      type: 'line',
      smooth: true,
      connectNulls: false,
      lineStyle: { color: seriesEntry.color },
      areaStyle: { color: seriesEntry.area },
      emphasis: { focus: 'series' },
      data: seriesEntry.values,
    }))

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<Record<string, unknown>>) =>
        params
          .map((item) => {
            const seriesName = String(item.seriesName ?? 'Valeur')
            const value = item.value
            if (value === null || value === undefined) {
              return `${seriesName}: N/A`
            }
            return `${seriesName}: ${formatCurrency(Number(value))} €`
          })
          .join('<br/>'),
    },
    legend: {
      show: false,
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '14%',
      top: '10%',
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
    series,
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
  const [filosofiLoadError, setFilosofiLoadError] = useState(false)
  const [dvfLoadError, setDvfLoadError] = useState(false)
  const [visibleIndicators, setVisibleIndicators] = useState<Set<FilosofiTrendIndicator>>(
    new Set(FILOSOFI_TREND_INDICATORS),
  )

  useEffect(() => {
    let active = true

    Promise.allSettled([
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

        if (filosofiResult.status === 'fulfilled') {
          setTrendResult(filosofiResult.value)
          setFilosofiLoadError(false)
        } else {
          setTrendResult(null)
          setFilosofiLoadError(true)
        }

        if (dvfData.status === 'fulfilled') {
          setDvfResult(dvfData.value)
          setDvfLoadError(false)
        } else {
          setDvfResult(null)
          setDvfLoadError(true)
        }
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
    setVisibleIndicators((currentIndicators) => {
      const nextIndicators = new Set(currentIndicators)

      if (nextIndicators.has(indicator)) {
        nextIndicators.delete(indicator)
      } else {
        nextIndicators.add(indicator)
      }

      return nextIndicators
    })
  }

  const incomeChartOptions = useMemo(
    () => (trendResult ? buildIncomeChartOptions(trendResult, visibleIndicators) : null),
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
      ) : filosofiLoadError && dvfLoadError ? (
        <p className="panel__footnote">{errorMessage}</p>
      ) : trendResult || dvfResult ? (
        <div className="evolution-charts-grid">
          {trendResult ? (
            <div className="evolution-chart-container">
              <h3 className="evolution-chart-title">Revenus (FiLoSoFi)</h3>

              <div className="evolution-chart-wrapper">
                <ReactECharts
                  option={incomeChartOptions ?? {}}
                  notMerge
                  style={{ width: '100%', height: '340px' }}
                />
              </div>

              <div className="evolution-control-panel">
                <p className="evolution-control-panel__title">Indicateurs</p>
                <div className="evolution-indicators-legend" aria-hidden="true">
                  {FILOSOFI_TREND_INDICATORS.map((indicator) => (
                    <span
                      key={`${indicator}-legend`}
                      className="evolution-indicators-legend__item"
                    >
                      <span
                        className="evolution-indicators-legend__swatch"
                        style={{ backgroundColor: INDICATOR_COLORS[indicator] }}
                      />
                      <span>{INDICATOR_LABELS[indicator]}</span>
                    </span>
                  ))}
                </div>
                <div className="indicators-checkboxes">
                  {FILOSOFI_TREND_INDICATORS.map((indicator) => (
                    <label key={indicator} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={visibleIndicators.has(indicator)}
                        onChange={() => toggleIndicator(indicator)}
                        className="checkbox-input"
                      />
                      <span className="checkbox-text">{INDICATOR_LABELS[indicator]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <p className="panel__footnote">
                Données disponibles pour les années : {trendResult.availableYears.join(', ')}.
              </p>
            </div>
          ) : filosofiLoadError ? (
            <div className="evolution-chart-container">
              <h3 className="evolution-chart-title">Revenus (FiLoSoFi)</h3>
              <p className="panel__footnote">{errorMessage}</p>
            </div>
          ) : null}

          {dvfResult ? (
            <div className="evolution-chart-container">
              <h3 className="evolution-chart-title">Prix immobilier (DVF)</h3>

              <div className="evolution-chart-wrapper">
                <ReactECharts
                  option={dvfChartOptions ?? {}}
                  style={{ width: '100%', height: '340px' }}
                />
              </div>

              <div className="evolution-control-panel">
                <p className="evolution-control-panel__title">Repères</p>
                <div className="evolution-indicators-legend evolution-indicators-legend--standalone">
                  {DVF_SERIES.map((series) => (
                    <span key={series.name} className="evolution-indicators-legend__item">
                      <span
                        className="evolution-indicators-legend__swatch"
                        style={{ backgroundColor: series.color }}
                      />
                      <span>{series.name}</span>
                    </span>
                  ))}
                </div>
              </div>

              <p className="panel__footnote">
                Données disponibles pour les années : {dvfResult.availableYears.join(', ')}.
              </p>
            </div>
          ) : dvfLoadError ? (
            <div className="evolution-chart-container">
              <h3 className="evolution-chart-title">Prix immobilier (DVF)</h3>
              <p className="panel__footnote">Impossible de charger les tendances DVF.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="panel__footnote">Aucune donnée de tendance disponible.</p>
      )}
    </div>
  )
}
