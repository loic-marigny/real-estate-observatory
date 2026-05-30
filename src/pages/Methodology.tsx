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
    </div>
  )
}
