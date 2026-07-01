const normalizeBaseUrl = (value: string | undefined): string | null => {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  return trimmed.replace(/\/+$/, '')
}

export const DATA_ASSET_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_DATA_ASSET_BASE_URL,
)

const FALLBACK_RUNTIME_BASE_URL = 'http://localhost/'

const resolveRuntimeBaseUrl = (): string => {
  if (typeof document !== 'undefined' && document.baseURI) {
    return document.baseURI
  }

  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href
  }

  const configuredBaseUrl = import.meta.env.BASE_URL?.trim()
  if (!configuredBaseUrl) {
    return FALLBACK_RUNTIME_BASE_URL
  }

  return new URL(configuredBaseUrl, FALLBACK_RUNTIME_BASE_URL).toString()
}

export const getBundledAssetUrl = (relativePath: string): string => {
  const normalizedPath = relativePath.replace(/^\/+/, '')
  return new URL(normalizedPath, resolveRuntimeBaseUrl()).toString()
}

export const getDataAssetUrl = (relativePath: string): string => {
  const normalizedPath = relativePath.replace(/^\/+/, '')
  if (DATA_ASSET_BASE_URL) {
    return `${DATA_ASSET_BASE_URL}/${normalizedPath}`
  }
  return getBundledAssetUrl(normalizedPath)
}

export const filosofiAssetUrls = {
  metadata: () => getDataAssetUrl('gold/filosofi/metadata.json'),
  indicatorAvailability: () =>
    getDataAssetUrl('gold/filosofi/indicator_availability.json'),
  communeParquet: () => getDataAssetUrl('gold/filosofi/commune_all_years.parquet'),
  departmentOfficialParquet: () =>
    getDataAssetUrl('gold/filosofi/department_official/department_all_years.parquet'),
  departmentDerivedParquet: () =>
    getDataAssetUrl('gold/filosofi/department_derived/department_all_years.parquet'),
}

export const getFilosofiParquetUrl = (
  geographyLevel: 'commune' | 'department',
  departmentSource: 'official' | 'derived' = 'official',
): string => {
  if (geographyLevel === 'commune') {
    return filosofiAssetUrls.communeParquet()
  }
  return departmentSource === 'derived'
    ? filosofiAssetUrls.departmentDerivedParquet()
    : filosofiAssetUrls.departmentOfficialParquet()
}

export const dvfAssetUrls = {
  allYearsParquetGlob: () => getDataAssetUrl('gold/dvf/year=*/dvf_national.parquet'),
  yearParquet: (year: number) => getDataAssetUrl(`gold/dvf/year=${year}/dvf_national.parquet`),
  yearSilverParquet: (year: number) =>
    getDataAssetUrl(`silver/dvf/year=${year}/dvf_silver.parquet`),
}
