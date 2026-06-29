import type { Metric } from '../types/realEstate'

type MetricCardProps = {
  metric: Metric
}

export function MetricCard({ metric }: MetricCardProps) {
  return (
    <article className="metric-card">
      <p className="metric-card__label">{metric.label}</p>
      <div className="metric-card__header">
        <strong className="metric-card__value">{metric.value}</strong>
        {metric.trend ? <span className="metric-card__trend">{metric.trend}</span> : null}
      </div>
      <p className="metric-card__description">{metric.description}</p>
    </article>
  )
}
