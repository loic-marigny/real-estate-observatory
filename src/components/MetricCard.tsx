type MetricCardProps = {
  label: string
  value: string
  trend: string
  description: string
}

export function MetricCard({
  label,
  value,
  trend,
  description,
}: MetricCardProps) {
  return (
    <article className="metric-card">
      <p className="metric-card__label">{label}</p>
      <div className="metric-card__header">
        <strong className="metric-card__value">{value}</strong>
        <span className="metric-card__trend">{trend}</span>
      </div>
      <p className="metric-card__description">{description}</p>
    </article>
  )
}
