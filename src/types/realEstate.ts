import type { ReactElement } from 'react'

export type PageKey = 'home' | 'explorer' | 'methodology' | 'pipeline'

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

export type ExplorerSection = {
  title: string
  description: string
}

export type ExplorerPageContent = {
  hero: HeroBlock
  sections: ExplorerSection[]
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
  communesCovered: number
  departmentsCovered: number
  nationalMedianIncome: number | null
  medianIncomeByDepartment: Record<string, number | null>
  decileSummary: FilosofiDecileSummary | null
  povertyRateSummary: FilosofiPovertyRateSummary | null
  notes: string[]
}

export type ObservatoryContent = {
  home: HomePageContent
  explorer: ExplorerPageContent
  methodology: MethodologyPageContent
  pipeline: DataPipelinePageContent
}
