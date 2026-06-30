import { getBundledAssetUrl } from '../services/dataAssetConfig'

const socialLinks = {
  instagram: 'https://instagram.com/loic_marigny',
  x: 'https://x.com/LoicMarigny',
  linkedin: 'https://linkedin.com/in/loic-marigny',
  github: 'https://github.com/loic-marigny',
  kofi: 'https://ko-fi.com/loicmarigny',
} as const

const sourceLinks = [
  {
    label: 'DVF / Etalab',
    href: 'https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/',
  },
  {
    label: 'INSEE FiLoSoFi',
    href: 'https://www.insee.fr/fr/statistiques/8984752',
  },
] as const

const currentYear = new Date().getFullYear()

const socialItems = [
  {
    href: socialLinks.instagram,
    label: 'Instagram',
    icon: getBundledAssetUrl('logos/Instagram_logo_2022.svg'),
    className: 'site-footer__social-link',
  },
  {
    href: socialLinks.x,
    label: 'X',
    icon: getBundledAssetUrl('logos/X_logo_2023.svg'),
    className: 'site-footer__social-link',
  },
  {
    href: socialLinks.linkedin,
    label: 'LinkedIn',
    icon: getBundledAssetUrl('logos/linkedin-svgrepo-com.svg'),
    className: 'site-footer__social-link',
  },
  {
    href: socialLinks.github,
    label: 'GitHub',
    icon: getBundledAssetUrl('logos/github-svgrepo-com.svg'),
    className: 'site-footer__social-link',
  },
  {
    href: socialLinks.kofi,
    label: 'Ko-fi',
    icon: getBundledAssetUrl('logos/kofi_symbol.png'),
    className: 'site-footer__social-link site-footer__social-link--kofi',
  },
] as const

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__content">
        <div className="site-footer__copy">
          <p className="site-footer__title">Observatoire immobilier public</p>
          <p className="site-footer__meta">
            Conception et développement : Loïc Marigny · {currentYear}
          </p>
        </div>

        <div className="site-footer__sources">
          <p className="site-footer__sources-label">Sources de données</p>
          <div className="site-footer__sources-list">
            {sourceLinks.map((source) => (
              <a
                key={source.label}
                className="site-footer__source-pill"
                href={source.href}
                target="_blank"
                rel="noreferrer"
              >
                {source.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <nav className="site-footer__socials" aria-label="Profils publics">
        {socialItems.map((item) => (
          <a
            key={item.label}
            className={item.className}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            aria-label={item.label}
            title={item.label}
          >
            <img src={item.icon} alt="" aria-hidden="true" />
          </a>
        ))}
      </nav>
    </footer>
  )
}
