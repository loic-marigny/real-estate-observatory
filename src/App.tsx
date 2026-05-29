import { useEffect, useState, type ReactElement } from 'react'
import './App.css'
import { Layout } from './components/Layout'
import { Explorer } from './pages/Explorer'
import { Home } from './pages/Home'
import { Methodology } from './pages/Methodology'

export type PageKey = 'home' | 'explorer' | 'methodology'

const NAV_ITEMS: Array<{ key: PageKey; label: string }> = [
  { key: 'home', label: 'Accueil' },
  { key: 'explorer', label: 'Explorer' },
  { key: 'methodology', label: 'Méthodologie' },
]

const PAGE_COMPONENTS: Record<PageKey, ReactElement> = {
  home: <Home />,
  explorer: <Explorer />,
  methodology: <Methodology />,
}

const getPageFromHash = (hash: string): PageKey => {
  const normalizedHash = hash.replace('#', '') as PageKey

  if (normalizedHash in PAGE_COMPONENTS) {
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
      {PAGE_COMPONENTS[currentPage]}
    </Layout>
  )
}

export default App
