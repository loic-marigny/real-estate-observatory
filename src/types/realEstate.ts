import type { ReactElement } from 'react'

export type PageKey =
  | 'home'
  | 'statistics'
  | 'data-explorer'
  | 'methodology'
  | 'pipeline'

export type NavigationItem = {
  key: PageKey
  label: string
}

export type PageDefinition = NavigationItem & {
  render: () => ReactElement
}

export type Metric = {
  id: string
  label: string
  value: string
  trend: string
  description: string
}

export type SourceReference = {
  id: string
  label: string
  href: string
}

export type HeroBlock = {
  eyebrow: string
  title: string
  description: string
}

export type HomeHero = HeroBlock
export type MethodologyHero = HeroBlock
export type PipelineHero = HeroBlock

export type PlaceholderSection = {
  eyebrow: string
  title: string
  description: string
}

export type HomePageContent = {
  hero: HomeHero
  metrics: Metric[]
  mapSection: PlaceholderSection
  chartSection: PlaceholderSection
  sources: SourceReference[]
}

export type StatisticsSection = {
  title: string
  description: string
}

export type StatisticsPageContent = {
  hero: HeroBlock
  sections: StatisticsSection[]
}

export type MethodologySource = {
  id: string
  category: string
  name: string
  description: string
}

export type MethodologyPageContent = {
  hero: MethodologyHero
  sources: MethodologySource[]
}

export type PipelineStep = {
  id: string
  title: string
  description: string
}

export type DataPipelinePageContent = {
  hero: PipelineHero
  steps: PipelineStep[]
}

export type DvfDepartmentSummary = {
  departmentCode: string
  salesCount: number
  medianPricePerSquareMeter: number | null
}

export type DvfSummary = {
  availableYears?: number[]
  generatedAt: string
  sourceFile: string
  filters: {
    mutationTypes: string[]
    residentialTypes: string[]
  }
  totalSalesCount: number
  medianPricePerSquareMeter: number | null
  medianSurface: number | null
  salesCountByDepartment: Record<string, number>
  medianPricePerSquareMeterByDepartment: Record<string, number | null>
  medianPricePerSquareMeterByPropertyType: Record<string, number | null>
  departments: DvfDepartmentSummary[]
}

export type FilosofiDecileSummary = Partial<{
  d1Income: number | null
  d2Income: number | null
  d3Income: number | null
  d4Income: number | null
  d5Income: number | null
  d6Income: number | null
  d7Income: number | null
  d8Income: number | null
  d9Income: number | null
}>

export type FilosofiPovertyRateSummary = {
  mean: number | null
  median: number | null
}

export type FilosofiSummary = {
  source: string
  generatedAt: string
  availableYears: number[]
  latestYear: number | null
  dispositif?: string | null
  departmentIndicatorSource?: string | null
  communesCovered: number
  departmentsCovered: number
  nationalMedianIncome: number | null
  medianIncomeByDepartment: Record<string, number | null>
  decileSummary: FilosofiDecileSummary | null
  povertyRateSummary: FilosofiPovertyRateSummary | null
  notes: string[]
}

export type FilosofiSummaryCollection = {
  source: string
  generatedAt: string
  availableYears: number[]
  latestYear: number | null
  summariesByYear: Record<string, FilosofiSummary>
}

export type FilosofiTrendPoint = {
  year: number
  value: number | null
}

export type FilosofiTrendSeries = {
  indicator: FilosofiTrendIndicator
  label: string
  points: FilosofiTrendPoint[]
}

export type FilosofiTrendResult = {
  availableYears: number[]
  series: FilosofiTrendSeries[]
  geographyLevel: FilosofiGeographyLevel
  departmentSource: FilosofiDepartmentSource
}

export type FilosofiIndicator =
  | 'median_income'
  | 'd1_income'
  | 'd2_income'
  | 'd3_income'
  | 'd4_income'
  | 'd5_income'
  | 'd6_income'
  | 'd7_income'
  | 'd8_income'
  | 'd9_income'
  | 'poverty_rate'
  | 'tax_households'
  | 'population'

export type FilosofiTrendIndicator =
  | 'median_income'
  | 'd1_income'
  | 'd9_income'

export type DvfTrendPoint = {
  year: number
  medianPricePerSquareMeter: number | null
  d1PricePerSquareMeter?: number | null
  d9PricePerSquareMeter?: number | null
}

export type DvfTrendResult = {
  availableYears: number[]
  points: DvfTrendPoint[]
}

export type FilosofiGeographyLevel = 'commune' | 'department'
export type FilosofiDepartmentSource = 'official' | 'derived'

export type FilosofiMethodologyBreak = {
  year: number
  label: string
  comparableToPreviousYear: boolean
}

export type FilosofiMetadata = {
  source: string
  generatedAt: string
  availableYears: number[]
  missingYears: number[]
  methodologyBreaks: FilosofiMethodologyBreak[]
  datasets: {
    communeAllYears: string
    departmentOfficialAllYears: string
    departmentDerivedAllYears: string
    indicatorAvailability: string
  }
}

export type FilosofiIndicatorAvailabilityEntry = {
  available: boolean
  coverage: number
  official: boolean
  indicatorSource: string
  comparableWithPreviousYears: boolean
}

export type FilosofiIndicatorOption = FilosofiIndicatorAvailabilityEntry & {
  indicator: FilosofiIndicator
  label: string
}

export type FilosofiIndicatorAvailabilityBySource = Partial<
  Record<FilosofiIndicator, FilosofiIndicatorAvailabilityEntry>
>

export type FilosofiIndicatorAvailability = Record<
  string,
  {
    commune: FilosofiIndicatorAvailabilityBySource
    department_official: FilosofiIndicatorAvailabilityBySource
    department_derived: FilosofiIndicatorAvailabilityBySource
  }
>

export type FilosofiQueryParams = {
  year: number
  geographyLevel: FilosofiGeographyLevel
  indicator: FilosofiIndicator
  departmentSource?: FilosofiDepartmentSource
  limit?: number
  offset?: number
  search?: string
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
}

export type FilosofiQueryRow = {
  geographyCode: string | null
  geographyName: string | null
  geographyLevel: FilosofiGeographyLevel
  year: number | null
  dispositif: string | null
  sourceGeneration: string | null
  indicatorSource: string | null
  isOfficial: boolean | null
  methodologyVersion: string | null
  comparableWithPreviousYears: boolean | null
  indicatorValue: number | null
}

export type FilosofiQueryResult = {
  rows: FilosofiQueryRow[]
  totalRows: number
  limit: number
  offset: number
  parquetUrl: string
  warnings: string[]
  indicator: FilosofiIndicator
}

export type ObservatoryContent = {
  home: HomePageContent
  statistics: StatisticsPageContent
  methodology: MethodologyPageContent
  pipeline: DataPipelinePageContent
}
