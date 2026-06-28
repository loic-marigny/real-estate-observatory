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

const loadingMessage = 'Chargement des tendances FiLoSoFi...'
const errorMessage =
  'Impossible de charger les tendances FiLoSoFi. Vérifiez la connexion et la configuration des données.'

const INDICATOR_LABELS: Record<FilosofiTrendIndicator, string> = {
  d1_income: 'Décile D1 (10% plus pauvres)',
  median_income: 'Revenu médian',
  d9_income: 'Décile D9 (10% plus riches)',
}

const INDICATOR_COLORS: Record<FilosofiTrendIndicator, string> = {
  d1_income: 'rgba(82, 150, 255, 0.95)',
  median_income: 'rgba(198, 96, 55, 0.95)',
  d9_income: 'rgba(57, 186, 116, 0.95)',
}

const DVF_SERIES = [
  {
    id: 'dvf_d1',
    name: 'Prix D1 au m²',
    field: 'd1PricePerSquareMeter' as const,
    color: 'rgba(82, 150, 255, 0.55)',
  },
  {
    id: 'dvf_median',
    name: 'Prix médian au m²',
    field: 'medianPricePerSquareMeter' as const,
    color: 'rgba(198, 96, 55, 0.55)',
  },
  {
    id: 'dvf_d9',
    name: 'Prix D9 au m²',
    field: 'd9PricePerSquareMeter' as const,
    color: 'rgba(57, 186, 116, 0.55)',
  },
] as const

type CombinedSeriesId =
  | FilosofiTrendIndicator
  | (typeof DVF_SERIES)[number]['id']

type CombinedLegendItem = {
  id: CombinedSeriesId
  label: string
  color: string
  axis: 'left' | 'right'
}

const INCOME_LEGEND_ORDER: FilosofiTrendIndicator[] = [
  'd1_income',
  'median_income',
  'd9_income',
]

const PRICE_LEGEND_ORDER: Array<(typeof DVF_SERIES)[number]['id']> = [
  'dvf_d1',
  'dvf_median',
  'dvf_d9',
]

const DEFAULT_VISIBLE_SERIES = new Set<CombinedSeriesId>([
  ...INCOME_LEGEND_ORDER,
  ...PRICE_LEGEND_ORDER,
])

const COMBINED_LEGEND: CombinedLegendItem[] = [
  ...INCOME_LEGEND_ORDER.map((indicator) => ({
    id: indicator,
    label: INDICATOR_LABELS[indicator],
    color: INDICATOR_COLORS[indicator],
    axis: 'left' as const,
  })),
  ...PRICE_LEGEND_ORDER.map((seriesId) => {
    const series = DVF_SERIES.find((entry) => entry.id === seriesId)!
    return {
      id: series.id,
      label: series.name,
      color: series.color,
      axis: 'right' as const,
    }
  }),
]

const LEFT_AXIS_LEGEND = COMBINED_LEGEND.filter((series) => series.axis === 'left')
const RIGHT_AXIS_LEGEND = COMBINED_LEGEND.filter((series) => series.axis === 'right')

const buildCombinedChartOptions = (
  trendResult: FilosofiTrendResult | null,
  dvfResult: DvfTrendResult | null,
  visibleSeries: Set<CombinedSeriesId>,
) => {
  const years = Array.from(
    new Set([
      ...(trendResult?.availableYears ?? []),
      ...(dvfResult?.availableYears ?? []),
    ]),
  ).sort((left, right) => left - right)

  const incomeSeries = (trendResult?.series ?? [])
    .filter((series) => visibleSeries.has(series.indicator))
    .map((series) => {
      const pointsByYear = new Map(series.points.map((point) => [point.year, point.value]))

      return {
        name: series.label,
        type: 'line',
        yAxisIndex: 0,
        smooth: true,
        connectNulls: series.indicator === 'median_income',
        emphasis: { focus: 'series' },
        lineStyle: {
          color: INDICATOR_COLORS[series.indicator],
          width: 2.5,
        },
        itemStyle: {
          color: INDICATOR_COLORS[series.indicator],
        },
        data: years.map((year) => {
          const value = pointsByYear.get(year)
          return value === null || value === undefined ? null : Number(value.toFixed(0))
        }),
      }
    })

  const priceSeries = DVF_SERIES.filter((series) => visibleSeries.has(series.id))
    .map((series) => {
      const pointsByYear = new Map((dvfResult?.points ?? []).map((point) => [point.year, point]))

      return {
        name: series.name,
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        connectNulls: false,
        emphasis: { focus: 'series' },
        lineStyle: {
          color: series.color,
          width: 2,
          type: 'dashed',
        },
        itemStyle: {
          color: series.color,
        },
        data: years.map((year) => {
          const point = pointsByYear.get(year)
          const value = point?.[series.field]
          return value === null || value === undefined
            ? null
            : Number((value as number).toFixed(0))
        }),
      }
    })
    .filter((series) => series.data.some((value) => value !== null))

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
      data: years.map(String),
      boundaryGap: false,
      axisLine: { lineStyle: { color: 'var(--color-border)' } },
      axisLabel: { color: 'var(--color-muted)' },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Revenu',
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
      {
        type: 'value',
        name: 'Prix du m²',
        axisLine: { lineStyle: { color: 'var(--color-border)' } },
        splitLine: { show: false },
        axisLabel: {
          formatter: (value: number) => `${formatCurrency(value)} €`,
          color: 'var(--color-muted)',
        },
      },
    ],
    series: [...incomeSeries, ...priceSeries],
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
  const [visibleSeries, setVisibleSeries] = useState<Set<CombinedSeriesId>>(
    DEFAULT_VISIBLE_SERIES,
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

  const toggleSeries = (seriesId: CombinedSeriesId) => {
    setVisibleSeries((currentSeries) => {
      const nextSeries = new Set(currentSeries)

      if (nextSeries.has(seriesId)) {
        nextSeries.delete(seriesId)
      } else {
        nextSeries.add(seriesId)
      }

      return nextSeries
    })
  }

  const chartOptions = useMemo(
    () => buildCombinedChartOptions(trendResult, dvfResult, visibleSeries),
    [trendResult, dvfResult, visibleSeries],
  )

  const hasAnySeries = chartOptions.series.some(
    (series: { data?: Array<number | null> }) =>
      Array.isArray(series.data) && series.data.some((value) => value !== null),
  )

  return (
    <div className="evolution-charts-section">
      <p className="panel__lede">{description}</p>

      {isLoading ? (
        <p className="panel__footnote">{loadingMessage}</p>
      ) : filosofiLoadError && dvfLoadError ? (
        <p className="panel__footnote">{errorMessage}</p>
      ) : hasAnySeries ? (
        <div className="evolution-chart-container evolution-chart-container--merged">
          <h3 className="evolution-chart-title">Revenus et prix immobiliers</h3>

          <div className="evolution-chart-wrapper">
            <ReactECharts
              option={chartOptions}
              notMerge
              style={{ width: '100%', height: '400px' }}
            />
          </div>

          <div className="evolution-control-panel">
            <p className="evolution-control-panel__title">Séries affichées</p>
            <div className="evolution-legend-columns">
              <div className="evolution-legend-column">
                <p className="evolution-legend-column__title">Revenu</p>
                <div className="evolution-indicators-legend evolution-indicators-legend--stacked">
                  {LEFT_AXIS_LEGEND.map((series) => (
                    <label key={series.id} className="checkbox-label checkbox-label--legend">
                      <input
                        type="checkbox"
                        checked={visibleSeries.has(series.id)}
                        onChange={() => toggleSeries(series.id)}
                        className="checkbox-input"
                      />
                      <span
                        className="evolution-indicators-legend__swatch"
                        style={{ backgroundColor: series.color }}
                      />
                      <span className="checkbox-text">{series.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="evolution-legend-column">
                <p className="evolution-legend-column__title">Prix du m²</p>
                <div className="evolution-indicators-legend evolution-indicators-legend--stacked">
                  {RIGHT_AXIS_LEGEND.map((series) => (
                    <label key={series.id} className="checkbox-label checkbox-label--legend">
                      <input
                        type="checkbox"
                        checked={visibleSeries.has(series.id)}
                        onChange={() => toggleSeries(series.id)}
                        className="checkbox-input"
                      />
                      <span
                        className="evolution-indicators-legend__swatch"
                        style={{ backgroundColor: series.color }}
                      />
                      <span className="checkbox-text">{series.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="panel__footnote panel__footnote--compact">
            FiLoSoFi : {trendResult?.availableYears.join(', ') ?? 'indisponible'}. DVF :{' '}
            {dvfResult?.availableYears.join(', ') ?? 'indisponible'}.
          </p>
        </div>
      ) : (
        <p className="panel__footnote">Aucune donnée de tendance disponible.</p>
      )}
    </div>
  )
}
