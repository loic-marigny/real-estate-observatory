import type { MethodologyHero } from '../types/realEstate'

type MethodologyProps = {
  hero: MethodologyHero
}

const OVERVIEW_POINTS = [
  {
    title: 'Ce que mesure le site',
    description:
      "L'observatoire rapproche deux familles d'indicateurs publics : les prix observés dans les transactions immobilières et les niveaux de vie publiés par l'Insee.",
  },
  {
    title: 'Ce qu’il ne mesure pas',
    description:
      "Le site ne reconstitue ni l'ensemble du marché immobilier réel, ni la distribution complète des revenus individuels. Il présente des indicateurs synthétiques issus de sources publiques agrégées.",
  },
  {
    title: 'Principe éditorial',
    description:
      "Quand une donnée manque, n'est pas publiée ou n'est pas suffisamment comparable, elle n'est pas remplacée artificiellement. L'absence fait partie de l'information.",
  },
] as const

const SOURCE_CARDS = [
  {
    category: 'Immobilier',
    title: 'DVF',
    body: "Les indicateurs de prix reposent sur les Demandes de valeurs foncières. Cette source permet d'observer des transactions effectivement enregistrées, mais seulement dans le périmètre publié par l'administration.",
  },
  {
    category: 'Revenus',
    title: 'FiLoSoFi',
    body: "Les indicateurs de revenus et de pauvreté proviennent de FiLoSoFi. Ils décrivent des niveaux de vie agrégés et non des revenus individuels ligne à ligne.",
  },
  {
    category: 'Comparaison',
    title: 'Lecture croisée',
    body: "Le rapprochement entre prix et revenus permet de documenter des écarts territoriaux, sans prétendre résumer à lui seul l'accessibilité réelle au logement.",
  },
] as const

const READING_POINTS = [
  {
    title: 'Médiane',
    description:
      "La médiane partage une distribution en deux moitiés égales. Elle est souvent plus robuste qu'une moyenne lorsque quelques valeurs extrêmes tirent artificiellement le résultat.",
  },
  {
    title: 'Décile D1',
    description:
      "Le premier décile correspond à un seuil bas de la distribution : 10 % des observations se situent en dessous. Ce n'est ni un minimum ni une valeur atypique isolée.",
  },
  {
    title: 'Décile D9',
    description:
      "Le neuvième décile représente un seuil haut de la distribution : 90 % des observations se situent en dessous. Il éclaire la partie supérieure sans se confondre avec les extrêmes absolus.",
  },
  {
    title: 'Séries incomplètes',
    description:
      "Une rupture visuelle dans une courbe peut refléter une absence réelle de publication, un changement de méthode statistique ou un choix volontaire de ne pas afficher une valeur jugée fragile.",
  },
] as const

const LIMITS = [
  "Les résultats portent sur l'Hexagone et la Corse, sous réserve des limites propres aux jeux de données mobilisés.",
  "Les indicateurs immobiliers sont issus d'un sous-ensemble analytique des transactions, pas d'une restitution brute et exhaustive de toutes les mutations possibles.",
  "Les comparaisons temporelles doivent être faites avec prudence lorsque la source change de génération ou de champ statistique.",
  "Les revenus publiés ici sont des indicateurs agrégés de niveau de vie ; ils ne remplacent pas une analyse microéconomique complète des ménages.",
] as const

export function Methodology({ hero }: MethodologyProps) {
  return (
    <div className="page page--content">
      <section className="panel panel--hero">
        <div className="panel__content">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1>{hero.title}</h1>
          <p className="lead">{hero.description}</p>
        </div>
      </section>

      <section className="panel methodology-panel">
        <div className="section-heading">
          <p className="eyebrow">Vue d&apos;ensemble</p>
          <h2>Ce qu&apos;il faut comprendre avant de lire les chiffres</h2>
        </div>
        <div className="methodology-card-grid">
          {OVERVIEW_POINTS.map((point) => (
            <article key={point.title} className="methodology-card">
              <h3>{point.title}</h3>
              <p>{point.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel methodology-panel">
        <div className="section-heading">
          <p className="eyebrow">Sources</p>
          <h2>Les deux familles de données utilisées</h2>
        </div>
        <div className="methodology-card-grid">
          {SOURCE_CARDS.map((source) => (
            <article key={source.title} className="methodology-card">
              <p className="eyebrow">{source.category}</p>
              <h3>{source.title}</h3>
              <p>{source.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-grid methodology-columns">
        <article className="panel methodology-panel">
          <div className="section-heading">
            <p className="eyebrow">Lecture</p>
            <h2>Comment interpréter les indicateurs</h2>
          </div>
          <div className="methodology-reading-grid">
            {READING_POINTS.map((point) => (
              <article key={point.title} className="methodology-reading-card">
                <h3>{point.title}</h3>
                <p>{point.description}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="panel methodology-panel">
          <div className="section-heading">
            <p className="eyebrow">Limites</p>
            <h2>Précautions d&apos;interprétation</h2>
          </div>
          <ul className="methodology-list methodology-list--compact">
            {LIMITS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="panel methodology-panel">
        <div className="section-heading">
          <p className="eyebrow">Complément</p>
          <h2>Pour les détails techniques</h2>
        </div>
        <p className="panel__lede">
          Cette page présente le sens des indicateurs et leurs limites
          d&apos;interprétation. Les détails opérationnels sur les fichiers,
          filtres, transformations, publications et validations ont été déplacés
          vers la page <strong>Pipeline</strong>, qui documente la chaîne de
          traitement complète.
        </p>
      </section>
    </div>
  )
}
