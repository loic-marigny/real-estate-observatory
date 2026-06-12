import type { MethodologyHero, MethodologySource } from '../types/realEstate'

type MethodologyProps = {
  hero: MethodologyHero
  sources: MethodologySource[]
}

export function Methodology({ hero, sources }: MethodologyProps) {
  return (
    <div className="page page--content">
      <section className="panel panel--hero">
        <div className="panel__content">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1>{hero.title}</h1>
          <p className="lead">{hero.description}</p>
        </div>
      </section>

      <section className="content-grid content-grid--stacked">
        {sources.map((source) => (
          <article key={source.id} className="panel">
            <p className="eyebrow">{source.category}</p>
            <h2>{source.name}</h2>
            <p>{source.description}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Data sources</p>
          <h2>Open public datasets</h2>
        </div>
        <p>
          The observatory relies on public open data sources. DVF comes from the
          French tax administration and documents property transactions. FiLoSoFi
          comes from INSEE and documents income distribution and poverty indicators.
        </p>
        <p>
          Internal processing steps exist to harmonize these sources before
          publication, but those technical details are intentionally hidden from the
          public-facing exploration interface.
        </p>
      </section>
    </div>
  )
}
