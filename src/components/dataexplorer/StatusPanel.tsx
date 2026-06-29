type StatusPanelProps = {
  message: string
}

export function StatusPanel({ message }: StatusPanelProps) {
  return (
    <section className="panel">
      <p>{message}</p>
    </section>
  )
}
