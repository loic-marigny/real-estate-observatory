export type BusinessDatasetId = 'dvf' | 'filosofi'

export type DatasetRegistryEntry = {
  id: BusinessDatasetId
  label: string
  description: string
  sourceOrganization: string
  previewUrl: string
}

export const datasetRegistry: Record<BusinessDatasetId, DatasetRegistryEntry> = {
  dvf: {
    id: 'dvf',
    label: 'Transactions immobilières (DVF)',
    description:
      'Property transactions from the French tax administration.',
    sourceOrganization: 'Direction générale des Finances publiques',
    previewUrl: '/data/dvf_preview.json',
  },
  filosofi: {
    id: 'filosofi',
    label: 'Revenus et pauvreté (FiLoSoFi)',
    description:
      'Income distribution and poverty indicators published by INSEE.',
    sourceOrganization: 'INSEE',
    previewUrl: '/data/filosofi_preview.json',
  },
}

export const datasetRegistryList = Object.values(datasetRegistry)
