export function Explorer() {
  return (
    <div className="page page--content">
      <section className="panel panel--hero">
        <div className="panel__content">
          <p className="eyebrow">Explorer</p>
          <h1>Explorer le marché immobilier</h1>
          <p className="lead">
            Cette page accueillera les filtres géographiques, les comparaisons
            par territoire et les visualisations détaillées.
          </p>
        </div>
      </section>

      <section className="content-grid">
        <article className="panel">
          <h2>Filtres à venir</h2>
          <p>
            Sélection par région, département, commune, période et type de
            bien.
          </p>
        </article>

        <article className="panel">
          <h2>Visualisations prévues</h2>
          <p>
            Cartes choroplèthes, séries temporelles, distributions de prix et
            tableaux comparatifs.
          </p>
        </article>
      </section>
    </div>
  )
}
