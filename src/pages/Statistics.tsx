import type { StatisticsPageContent } from '../types/realEstate'

type StatisticsProps = {
  content: StatisticsPageContent
}

export function Statistics({ content }: StatisticsProps) {
  return (
    <div className="page page--content">
      <section className="panel panel--hero">
        <div className="panel__content">
          <p className="eyebrow">{content.hero.eyebrow}</p>
          <h1>{content.hero.title}</h1>
          <p className="lead">{content.hero.description}</p>
        </div>
      </section>

      <section className="content-grid">
        {content.sections.map((section) => (
          <article key={section.title} className="panel">
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
