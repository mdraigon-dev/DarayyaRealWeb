import { useState } from 'react';
import Logo from './Logo';
import { t, type Lang } from '../i18n/strings';

type Props = {
  lang: Lang;
  currentPage: 'home' | 'projects' | 'transparency' | 'admin';
};

export default function Nav({ lang, currentPage }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Build paths preserving the current locale and respecting the configured base
  const base = (import.meta as any).env?.BASE_URL ?? '/';
  const otherLang: Lang = lang === 'ar' ? 'en' : 'ar';
  const otherLangHref = `${base}${otherLang}/`;

  const link = (path: string) => `${base}${lang}${path}`;

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
          <a className={lang === 'ar' ? 'active' : ''} href={`${base}ar/`}>عر</a>
          <a className={lang === 'en' ? 'active' : ''} href={`${base}en/`}>EN</a>
        </div>
        <a className="btn-donate-nav" href={link('/projects/')}>
          {t(lang, 'nav_donate')}
        </a>
      </div>
    </nav>
  );
}
