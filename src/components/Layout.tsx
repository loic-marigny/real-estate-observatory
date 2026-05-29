import type { PropsWithChildren } from 'react'
import type { PageKey } from '../App'
import { Navbar } from './Navbar'

type NavItem = {
  key: PageKey
  label: string
}

type LayoutProps = PropsWithChildren<{
  currentPage: PageKey
  navItems: NavItem[]
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
    </div>
  )
}
