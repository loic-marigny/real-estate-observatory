import type { PipelineHero, PipelineStep } from '../types/realEstate'

type DataPipelineProps = {
  hero: PipelineHero
  steps: PipelineStep[]
}

export function DataPipeline({ hero, steps }: DataPipelineProps) {
  return (
    <div className="page page--content">
      <section className="panel panel--hero">
        <div className="panel__content">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1>{hero.title}</h1>
          <p className="lead">{hero.description}</p>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Pipeline cible</p>
          <h2>De la donnée brute au tableau de bord</h2>
        </div>

        <div className="pipeline-flow" aria-label="Pipeline de données">
          {steps.map((step, index) => (
            <div key={step.id} className="pipeline-flow__segment">
              <article className="pipeline-step">
                <span className="pipeline-step__index">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>

              {index < steps.length - 1 ? (
                <span className="pipeline-flow__arrow" aria-hidden="true">
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
