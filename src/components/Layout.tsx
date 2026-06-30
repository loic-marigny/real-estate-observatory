import type { PropsWithChildren } from 'react'
import type { NavigationItem, PageKey } from '../types/realEstate'
import { Footer } from './Footer'
import { Navbar } from './Navbar'

type LayoutProps = PropsWithChildren<{
  currentPage: PageKey
  navItems: NavigationItem[]
  onNavigate: (page: PageKey) => void
}>

export function Layout({
  children,
  currentPage,
  navItems,
  onNavigate,
}: LayoutProps) {
  return (
    <div className="app-shell">
      <Navbar
        currentPage={currentPage}
        items={navItems}
        onNavigate={onNavigate}
      />
      <main className="app-main">{children}</main>
      <div className="app-footer-wrap">
        <Footer />
      </div>
    </div>
  )
}
