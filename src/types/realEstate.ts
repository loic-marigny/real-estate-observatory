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

export type ObservatoryContent = {
  home: HomePageContent
  explorer: ExplorerPageContent
  methodology: MethodologyPageContent
  pipeline: DataPipelinePageContent
}
