import type { DvfSummary, ObservatoryContent } from '../types/realEstate'

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
        value: '3 420 €',
        trend: 'DVF local',
        description: 'Estimation de référence en attendant le chargement du résumé DVF.',
      },
      {
        id: 'transactions',
        label: 'Ventes résidentielles',
        value: '842',
        trend: 'Échantillon',
        description: 'Nombre de ventes utilisé comme valeur de repli côté interface.',
      },
      {
        id: 'median-surface',
        label: 'Surface médiane',
        value: '71 m²',
        trend: 'DVF local',
        description: 'Surface bâtie médiane sur les ventes résidentielles retenues.',
      },
      {
        id: 'departments-covered',
        label: 'Départements couverts',
        value: '12',
        trend: 'Échantillon',
        description: 'Nombre de départements présents dans le jeu de données chargé.',
      },
    ],
    mapSection: {
      eyebrow: 'Carte',
      title: 'Répartition territoriale',
      description: 'Carte interactive France à intégrer',
    },
    chartSection: {
      eyebrow: 'Graphique',
      title: 'Évolution temporelle',
      description: 'Visualisation de tendance à intégrer',
    },
    sources: [
      { id: 'dvf', label: 'DVF / Etalab' },
      { id: 'insee-filosofi', label: 'INSEE FiLoSoFi' },
      { id: 'ademe-dpe', label: 'ADEME DPE' },
      { id: 'banque-de-france', label: 'Banque de France' },
      { id: 'sdes-sitadel', label: 'SDES Sitadel' },
    ],
  },
  explorer: {
    hero: {
      eyebrow: 'Explorer',
      title: 'Explorer le marché immobilier',
      description:
        'Cette page accueillera les filtres géographiques, les comparaisons par territoire et les visualisations détaillées.',
    },
    sections: [
      {
        title: 'Filtres à venir',
        description:
          'Sélection par région, département, commune, période et type de bien.',
      },
      {
        title: 'Visualisations prévues',
        description:
          'Cartes choroplèthes, séries temporelles, distributions de prix et tableaux comparatifs.',
      },
    ],
  },
  methodology: {
    hero: {
      eyebrow: 'Méthodologie',
      title: 'Construction des indicateurs',
      description:
        'Les premières versions s’appuieront sur un socle de jeux de données ouverts couvrant transactions, revenus, performance énergétique, crédit et construction neuve.',
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
          'Diagnostics de performance énergétique pour enrichir l’analyse sur la qualité énergétique du parc résidentiel.',
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
          'Permis de construire et mises en chantier pour suivre la production neuve et la pression sur l’offre future.',
      },
    ],
  },
  pipeline: {
    hero: {
      eyebrow: 'Pipeline',
      title: 'Préparer l’intégration des données',
      description:
        'Le tableau de bord sera alimenté par une chaîne simple et traçable, de l’open data brut jusqu’aux indicateurs servis à l’interface.',
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
          'Calcul des séries, agrégats territoriaux et métriques produits pour l’observatoire.',
      },
      {
        id: 'api',
        title: 'API',
        description:
          'Exposition d’un contrat de données stable pour les pages publiques et les futurs filtres interactifs.',
      },
      {
        id: 'dashboard',
        title: 'Dashboard',
        description:
          'Consommation des indicateurs par l’interface React pour l’exploration et la communication publique.',
      },
    ],
  },
}

export const mockDvfSummary: DvfSummary = {
  generatedAt: '2026-05-30T00:00:00Z',
  sourceFile: 'data/raw/dvf_sample.csv',
  filters: {
    mutationTypes: ['Vente'],
    residentialTypes: ['Maison', 'Appartement'],
  },
  totalSalesCount: 842,
  medianPricePerSquareMeter: 3420,
  medianSurface: 71,
  salesCountByDepartment: {
    '13': 210,
    '33': 126,
    '59': 184,
    '69': 176,
    '75': 146,
  },
  medianPricePerSquareMeterByDepartment: {
    '13': 3530,
    '33': 3210,
    '59': 2480,
    '69': 4280,
    '75': 10850,
  },
  medianPricePerSquareMeterByPropertyType: {
    Appartement: 4180,
    Maison: 2870,
  },
  departments: [
    {
      departmentCode: '13',
      salesCount: 210,
      medianPricePerSquareMeter: 3530,
    },
    {
      departmentCode: '33',
      salesCount: 126,
      medianPricePerSquareMeter: 3210,
    },
    {
      departmentCode: '59',
      salesCount: 184,
      medianPricePerSquareMeter: 2480,
    },
    {
      departmentCode: '69',
      salesCount: 176,
      medianPricePerSquareMeter: 4280,
    },
    {
      departmentCode: '75',
      salesCount: 146,
      medianPricePerSquareMeter: 10850,
    },
  ],
}
