import type { PageKey } from '../App'

type NavbarProps = {
  currentPage: PageKey
  items: Array<{
    key: PageKey
    label: string
  }>
  onNavigate: (page: PageKey) => void
}

export function Navbar({ currentPage, items, onNavigate }: NavbarProps) {
  return (
    <header className="navbar">
      <div className="navbar__brand">
        <span className="navbar__eyebrow">Données publiques</span>
        <a
          className="navbar__title"
          href="#"
          onClick={(event) => {
            event.preventDefault()
            onNavigate('home')
          }}
        >
          Observatoire immobilier France
        </a>
      </div>

      <nav className="navbar__nav" aria-label="Navigation principale">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`navbar__link${
              currentPage === item.key ? ' navbar__link--active' : ''
            }`}
            onClick={() => onNavigate(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
