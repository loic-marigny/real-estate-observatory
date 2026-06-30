import { getBundledAssetUrl } from '../services/dataAssetConfig'

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
      'Transactions immobilières issues de la Direction générale des Finances publiques.',
    sourceOrganization: 'Direction générale des Finances publiques',
    previewUrl: getBundledAssetUrl('data/dvf_preview.json'),
  },
  filosofi: {
    id: 'filosofi',
    label: 'Revenus et pauvreté (FiLoSoFi)',
    description:
      "Indicateurs de revenus et de pauvreté publiés par l'Insee.",
    sourceOrganization: 'INSEE',
    previewUrl: getBundledAssetUrl('data/filosofi_preview.json'),
  },
}

export const datasetRegistryList = Object.values(datasetRegistry)
