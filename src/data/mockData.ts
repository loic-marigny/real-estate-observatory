import type { ObservatoryContent } from '../types/realEstate'

export const mockObservatoryContent: ObservatoryContent = {
  home: {
    hero: {
      eyebrow: 'Plateforme publique',
      title: 'Observatoire immobilier France',
      description:
        'Suivre les dynamiques de prix, de transactions et de tension immobilière à partir de sources publiques consolidées.',
    },
    metrics: [
      {
        id: 'median-price',
        label: 'Prix médian au m²',
        value: 'Erreur',
        trend: 'DVF local',
        description:
          'Estimation de référence en attendant le chargement du résumé DVF.',
      },
      {
        id: 'transactions',
        label: 'Ventes résidentielles',
        value: 'Erreur',
        trend: 'Échantillon',
        description:
          "Nombre de ventes utilisé comme valeur de repli côté interface.",
      },
      {
        id: 'median-surface',
        label: 'Surface médiane',
        value: 'Erreur',
        trend: 'DVF local',
        description:
          'Surface bâtie médiane sur les ventes résidentielles retenues.',
      },
      {
        id: 'departments-covered',
        label: 'Départements couverts',
        value: 'Erreur',
        trend: 'Échantillon',
        description:
          'Nombre de départements présents dans le jeu de données chargé.',
      },
    ],
    mapSection: {
      eyebrow: 'Carte',
      title: 'Répartition territoriale',
      description: 'Distribution géographique des prix',
    },
    chartSection: {
      eyebrow: 'Graphique',
      title: 'Évolution temporelle',
      description: 'Visualisation de tendance à intégrer',
    },
    sources: [
      {
        id: 'dvf',
        label: 'DVF / Etalab',
        href: 'https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/',
      },
      {
        id: 'insee-filosofi',
        label: 'INSEE FiLoSoFi',
        href: 'https://www.insee.fr/fr/statistiques/8984752',
      },
    ],
  },
  statistics: {
    hero: {
      eyebrow: 'Statistiques',
      title: 'Statistiques du marché immobilier',
      description:
        "Cette page présente les principaux visuels publics de l'observatoire pour suivre les écarts territoriaux et les tendances de long terme.",
    },
    sections: [
      {
        title: 'Périmètre',
        description:
          "Les visualisations publiées couvrent la France hexagonale et la Corse, avec des indicateurs issus des sources publiques consolidées dans le projet.",
      },
      {
        title: 'Lecture',
        description:
          "Les prix proviennent des transactions DVF filtrées sur le résidentiel ; les revenus reposent sur les millésimes FiLoSoFi publiés par l'Insee.",
      },
    ],
  },
  methodology: {
    hero: {
      eyebrow: 'Méthodologie',
      title: 'Que mesurent les indicateurs ?',
      description:
        "Cette page explique le sens des indicateurs, leur portée et leurs limites, dans un langage accessible à un public non technique.",
    },
  },
  pipeline: {
    hero: {
      eyebrow: 'Pipeline',
      title: 'Comment les données sont préparées',
      description:
        "Cette page documente la chaîne technique du projet : récupération des fichiers, normalisation, filtrage, production des indicateurs et publication des artefacts utilisés par le site.",
    },
    steps: [
      {
        id: 'raw-open-data',
        title: 'Raw',
        description:
          'Collecte des fichiers bruts tels que publiés par les producteurs de données.',
      },
      {
        id: 'cleaned-data',
        title: 'Bronze',
        description:
          'Normalisation des formats, schémas et colonnes pour rendre les sources comparables.',
      },
      {
        id: 'indicators',
        title: 'Silver',
        description:
          "Application du périmètre d'analyse, des filtres qualité et des variables dérivées.",
      },
      {
        id: 'api',
        title: 'Gold',
        description:
          'Production des tables analytiques finales utilisées par les cartes, graphiques et explorations.',
      },
      {
        id: 'dashboard',
        title: 'Publication',
        description:
          "Génération des aperçus publics et diffusion des artefacts vers l'interface et le stockage distant.",
      },
    ],
  },
}
