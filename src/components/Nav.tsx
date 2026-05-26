import { useState, useEffect } from 'react';
import Logo from './Logo';
import { t, type Lang } from '../i18n/strings';

type Props = {
  lang: Lang;
  currentPage: 'home' | 'projects' | 'transparency' | 'admin';
  /** Current pathname passed in by Astro so the lang toggle can preserve it
   *  even before JS hydrates. Without this, the SSR-rendered toggle URL
   *  falls back to the locale homepage, which means the toggle "only works
   *  on home" if the user clicks before hydration. */
  pathname?: string;
};

export default function Nav({ lang, currentPage, pathname }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Build paths preserving the current locale and respecting the configured base
  const base = (import.meta as any).env?.BASE_URL ?? '/';
  const link = (path: string) => `${base}${lang}${path}`;

  // Initial path comes from Astro (set on the server). On the client, we
  // re-read window.location after mount in case the user navigated client-side.
  const [currentPath, setCurrentPath] = useState<string>(
    pathname || `${base}${lang}/`
  );
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
    }
  }, []);

  // Build the AR/EN toggle URLs. Replace the locale segment in the current path;
  // if the segment isn't present (e.g. on a route without a locale), fall back
  // to the locale homepage.
  const swapLocaleHref = (target: Lang): string => {
    const src = `/${lang}/`;
    if (currentPath.includes(src)) {
      return currentPath.replace(src, `/${target}/`);
    }
    return `${base}${target}/`;
  };
  const arHref = swapLocaleHref('ar');
  const enHref = swapLocaleHref('en');

  const links: Array<{ id: typeof currentPage; label: string; href: string }> = [
    { id: 'home',         label: t(lang, 'nav_home'),         href: link('/') },
    { id: 'projects',     label: t(lang, 'nav_projects'),     href: link('/projects/') },
    { id: 'transparency', label: t(lang, 'nav_transparency'), href: link('/transparency/') },
    { id: 'admin',        label: t(lang, 'nav_admin'),        href: link('/admin/') },
  ];

  return (
    <nav className="nav">
      <div className="nav-inner">
        <a className="brand" href={link('/')}>
          <div className="brand-logo" style={{ color: 'var(--sy-green-dk)' }}>
            <Logo size={56} color="var(--sy-green-dk)" />
          </div>
          <div className="brand-text">
            <span className="brand-title">{t(lang, 'brand_title')}</span>
            <span className="brand-sub">{t(lang, 'brand_sub')}</span>
          </div>
        </a>
        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={t(lang, 'nav_menu')}
        >
          <span className="menu-toggle-bar"></span>
        </button>
        <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
          {links.map(l => (
            <a key={l.id}
               className={`nav-link ${currentPage === l.id ? 'active' : ''}`}
               href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
        <div className="lang-toggle" title="Language / اللغة">
          <a className={lang === 'ar' ? 'active' : ''} href={arHref}>عر</a>
          <a className={lang === 'en' ? 'active' : ''} href={enHref}>EN</a>
        </div>
        <a className="btn-donate-nav" href={link('/projects/')}>
          {t(lang, 'nav_donate')}
        </a>
      </div>
    </nav>
  );
}
