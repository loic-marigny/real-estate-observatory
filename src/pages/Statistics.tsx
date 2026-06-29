import { startTransition, useEffect, useState } from 'react'
import { DepartmentChoropleth } from '../components/DepartmentChoropleth'
import EvolutionChartsSection from '../components/EvolutionChartsSection'
import { getDvfSummary } from '../services/dvfService'
import { getFilosofiSummaries } from '../services/filosofiService'
import type {
  DvfSummary,
  FilosofiSummaryCollection,
  StatisticsPageContent,
} from '../types/realEstate'

type StatisticsProps = {
  content: StatisticsPageContent
}

export function Statistics({ content }: StatisticsProps) {
  const [dvfSummary, setDvfSummary] = useState<DvfSummary | null>(null)
  const [dvfError, setDvfError] = useState<string | null>(null)
  const [isDvfLoading, setIsDvfLoading] = useState(true)

  const [filosofiSummaries, setFilosofiSummaries] =
    useState<FilosofiSummaryCollection | null>(null)
  const [filosofiError, setFilosofiError] = useState<string | null>(null)
  const [isFilosofiLoading, setIsFilosofiLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadDvfSummary = async () => {
      setIsDvfLoading(true)
      setDvfError(null)

      try {
        const summary = await getDvfSummary()

        if (!isMounted) {
          return
        }

        startTransition(() => {
          setDvfSummary(summary)
          setDvfError(null)
          setIsDvfLoading(false)
        })
      } catch (error) {
        if (!isMounted) {
          return
        }

        startTransition(() => {
          setDvfSummary(null)
          setDvfError(
            error instanceof Error
              ? error.message
              : 'Impossible de charger la carte DVF.',
          )
          setIsDvfLoading(false)
        })
      }
    }

    void loadDvfSummary()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadFilosofiSummaries = async () => {
      setIsFilosofiLoading(true)
      setFilosofiError(null)

      try {
        const summaries = await getFilosofiSummaries()

        if (!isMounted) {
          return
        }

        startTransition(() => {
          setFilosofiSummaries(summaries)
          setFilosofiError(null)
          setIsFilosofiLoading(false)
        })
      } catch (error) {
        if (!isMounted) {
          return
        }

        startTransition(() => {
          setFilosofiSummaries(null)
          setFilosofiError(
            error instanceof Error
              ? error.message
              : "Impossible de charger les séries d'évolution.",
          )
          setIsFilosofiLoading(false)
        })
      }
    }

    void loadFilosofiSummaries()

    return () => {
      isMounted = false
    }
  }, [])

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
            <p className="panel__lede">{section.description}</p>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel panel--map">
          <div className="section-heading">
            <p className="eyebrow">Carte</p>
            <h2>Distribution géographique des prix</h2>
          </div>
          <p className="panel__lede">
            La carte présente les niveaux de prix médians au m² observés dans les
            transactions résidentielles DVF, à l&apos;échelle départementale.
          </p>
          {isDvfLoading ? (
            <p className="panel__footnote">Chargement de la carte DVF…</p>
          ) : dvfError ? (
            <>
              <p className="panel__footnote">
                Impossible de charger la répartition territoriale.
              </p>
              <p className="panel__footnote">{dvfError}</p>
            </>
          ) : (
            <DepartmentChoropleth departments={dvfSummary?.departments ?? []} />
          )}
        </article>

        <article className="panel panel--placeholder">
          <div className="section-heading">
            <p className="eyebrow">Séries</p>
            <h2>Évolution des revenus et des prix</h2>
          </div>
          <p className="panel__lede">
            Ce graphique met en regard les repères nationaux de revenus issus de
            FiLoSoFi et le prix médian au m² observé dans DVF.
          </p>
          {isFilosofiLoading ? (
            <p className="panel__footnote">Chargement des séries temporelles…</p>
          ) : filosofiError ? (
            <>
              <p className="panel__footnote">
                Impossible de charger le graphique d&apos;évolution.
              </p>
              <p className="panel__footnote">{filosofiError}</p>
            </>
          ) : filosofiSummaries ? (
            <EvolutionChartsSection description="Comparaison des trajectoires nationales de revenus et de prix immobiliers à partir des millésimes publics disponibles." />
          ) : null}
        </article>
      </section>
    </div>
  )
}
