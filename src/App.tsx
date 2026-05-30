import { useEffect, useState, type ReactElement } from 'react'
import { Layout } from './components/Layout'
import { getObservatoryContent } from './services/realEstateContent'
import { DataPipeline } from './pages/DataPipeline'
import { Explorer } from './pages/Explorer'
import { Home } from './pages/Home'
import { Methodology } from './pages/Methodology'
import type { PageDefinition, PageKey } from './types/realEstate'
import './styles/app.css'

const observatoryContent = getObservatoryContent()

const PAGE_DEFINITIONS: Record<PageKey, PageDefinition> = {
  home: {
    key: 'home',
    label: 'Accueil',
    render: (): ReactElement => (
      <Home
        hero={observatoryContent.home.hero}
        metrics={observatoryContent.home.metrics}
        mapSection={observatoryContent.home.mapSection}
        chartSection={observatoryContent.home.chartSection}
        sources={observatoryContent.home.sources}
      />
    ),
  },
  explorer: {
    key: 'explorer',
    label: 'Explorer',
    render: (): ReactElement => <Explorer content={observatoryContent.explorer} />,
  },
  methodology: {
    key: 'methodology',
    label: 'Méthodologie',
    render: (): ReactElement => (
      <Methodology
        hero={observatoryContent.methodology.hero}
        sources={observatoryContent.methodology.sources}
      />
    ),
  },
  pipeline: {
    key: 'pipeline',
    label: 'Pipeline',
    render: (): ReactElement => (
      <DataPipeline
        hero={observatoryContent.pipeline.hero}
        steps={observatoryContent.pipeline.steps}
      />
    ),
  },
}

const NAV_ITEMS = Object.values(PAGE_DEFINITIONS).map(({ key, label }) => ({
  key,
  label,
}))

const getPageFromHash = (hash: string): PageKey => {
  const normalizedHash = hash.replace('#', '') as PageKey

  if (normalizedHash in PAGE_DEFINITIONS) {
    return normalizedHash
  }

  return 'home'
}

function App() {
  const [currentPage, setCurrentPage] = useState<PageKey>(() =>
    getPageFromHash(window.location.hash),
  )

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPage(getPageFromHash(window.location.hash))
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const handleNavigate = (page: PageKey) => {
    window.location.hash = page === 'home' ? '' : page
    setCurrentPage(page)
  }

  return (
    <Layout
      currentPage={currentPage}
      navItems={NAV_ITEMS}
      onNavigate={handleNavigate}
    >
      {PAGE_DEFINITIONS[currentPage].render()}
    </Layout>
  )
}

export default App
