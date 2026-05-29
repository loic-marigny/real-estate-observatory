export function Methodology() {
  return (
    <div className="page page--content">
      <section className="panel panel--hero">
        <div className="panel__content">
          <p className="eyebrow">Méthodologie</p>
          <h1>Construction des indicateurs</h1>
          <p className="lead">
            Cette section décrira les jeux de données utilisés, les règles de
            nettoyage, les agrégations temporelles et les limites de lecture.
          </p>
        </div>
      </section>

      <section className="content-grid">
        <article className="panel">
          <h2>Chaîne de traitement</h2>
          <p>
            Documentation prévue pour l’ingestion, la normalisation et le calcul
            des séries.
          </p>
        </article>

        <article className="panel">
          <h2>Qualité et limites</h2>
          <p>
            Les biais de couverture, délais de publication et hypothèses de
            calcul seront explicités ici.
          </p>
        </article>
      </section>
    </div>
  )
}
