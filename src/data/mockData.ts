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
          'Les visualisations publiées couvrent la France métropolitaine et la Corse, avec des indicateurs issus des sources publiques consolidées dans le projet.',
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
      title: 'Construction des indicateurs',
      description:
        "Les premières versions s'appuieront sur un socle de jeux de données ouverts couvrant transactions, revenus, performance énergétique, crédit et construction neuve.",
    },
    sources: [
      {
        id: 'dvf',
        category: 'Transactions',
        name: 'DVF',
        description:
          'Demandes de valeurs foncières pour les mutations immobilières, les prix de vente et les caractéristiques principales des biens.',
      },
      {
        id: 'filosofi',
        category: 'Revenus',
        name: 'INSEE FiLoSoFi',
        description:
          'Indicateurs locaux de niveau de vie et de revenus pour mettre en regard les prix immobiliers et la solvabilité des ménages.',
      },
      {
        id: 'dpe',
        category: 'Énergie',
        name: 'ADEME DPE',
        description:
          "Diagnostics de performance énergétique pour enrichir l'analyse sur la qualité énergétique du parc résidentiel.",
      },
      {
        id: 'credit',
        category: 'Financement',
        name: 'Banque de France',
        description:
          'Séries macroéconomiques et de crédit pour contextualiser les conditions de financement et la dynamique de marché.',
      },
      {
        id: 'construction',
        category: 'Offre neuve',
        name: 'SDES Sitadel',
        description:
          "Permis de construire et mises en chantier pour suivre la production neuve et la pression sur l'offre future.",
      },
    ],
  },
  pipeline: {
    hero: {
      eyebrow: 'Pipeline',
      title: "Préparer l'intégration des données",
      description:
        "Le tableau de bord sera alimenté par une chaîne simple et traçable, de l'open data brut jusqu'aux indicateurs servis à l'interface.",
    },
    steps: [
      {
        id: 'raw-open-data',
        title: 'Raw open data',
        description:
          'Collecte des fichiers sources publiés par les administrations et opérateurs publics.',
      },
      {
        id: 'cleaned-data',
        title: 'Cleaned data',
        description:
          'Nettoyage, normalisation, contrôle qualité et alignement géographique des jeux de données.',
      },
      {
        id: 'indicators',
        title: 'Indicators',
        description:
          "Calcul des séries, agrégats territoriaux et métriques produits pour l'observatoire.",
      },
      {
        id: 'api',
        title: 'API',
        description:
          "Exposition d'un contrat de données stable pour les pages publiques et les futurs filtres interactifs.",
      },
      {
        id: 'dashboard',
        title: 'Dashboard',
        description:
          "Consommation des indicateurs par l'interface React pour l'exploration et la communication publique.",
      },
    ],
  },
}
