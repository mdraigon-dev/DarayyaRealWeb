import { useState, useEffect } from 'react';
import Logo from './Logo';
import { t, type Lang } from '../i18n/strings';

declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

type AuthUser = {
  email: string;
  user_metadata?: { full_name?: string };
};

type Props = {
  lang: Lang;
  currentPage: 'home' | 'projects' | 'transparency' | 'circulars' | 'admin';
  /** Current pathname passed in by Astro so the lang toggle can preserve it
   *  even before JS hydrates. Without this, the SSR-rendered toggle URL
   *  falls back to the locale homepage, which means the toggle "only works
   *  on home" if the user clicks before hydration. */
  pathname?: string;
};

export default function Nav({ lang, currentPage, pathname }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Auth state for the nav login button. `undefined` while Identity widget
  // is still loading (we hide the button briefly to avoid a "Login → Hi
  // John" flicker on hard refresh while signed in).
  const [authUser, setAuthUser] = useState<AuthUser | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const init = () => {
      if (cancelled) return;
      const ni = window.netlifyIdentity;
      if (!ni) {
        tries++;
        if (tries < 40) setTimeout(init, 100);
        else setAuthUser(null);
        return;
      }
      try { ni.init(); } catch {}
      setAuthUser(ni.currentUser() || null);
      ni.on('login', (u: any) => {
        setAuthUser(u);
        // Close the Identity widget after login so the user goes back
        // to the page they were on instead of staring at the modal.
        try { ni.close(); } catch {}
      });
      ni.on('logout', () => setAuthUser(null));
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = () => {
    const ni = window.netlifyIdentity;
    if (ni && ni.open) ni.open('login');
  };
  const handleLogout = () => {
    const ni = window.netlifyIdentity;
    if (ni && ni.logout) ni.logout();
  };

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
    { id: 'circulars',    label: t(lang, 'nav_circulars'),    href: link('/circulars/') },
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
        <div className="lang-toggle" title="Language / اللغة" role="group" aria-label="Language">
          <a className={lang === 'ar' ? 'active' : ''} href={arHref} aria-current={lang === 'ar' ? 'page' : undefined}>AR</a>
          <a className={lang === 'en' ? 'active' : ''} href={enHref} aria-current={lang === 'en' ? 'page' : undefined}>EN</a>
        </div>

        {/* Auth button — Login when anonymous, signed-in chip when authenticated.
            Hidden during the brief moment Netlify Identity is still loading so
            we don't flash "Login" to a user who's already signed in. */}
        {authUser === null && (
          <button
            type="button"
            className="nav-auth-btn"
            onClick={handleLogin}
            title={lang === 'ar' ? 'تسجيل الدخول للمسؤولين والمهندسين' : 'Sign in for admins and engineers'}
          >
            <span className="nav-auth-icon" aria-hidden="true">👤</span>
            <span>{lang === 'ar' ? 'تسجيل الدخول' : 'Login'}</span>
          </button>
        )}
        {authUser && (
          <div className="nav-auth-chip" title={authUser.email}>
            <a
              className="nav-auth-chip-link"
              href={link('/admin/profile/')}
              title={lang === 'ar' ? 'التفضيلات' : 'Preferences'}
            >
              <span className="nav-auth-chip-avatar" aria-hidden="true">
                {(authUser.user_metadata?.full_name || authUser.email).charAt(0).toUpperCase()}
              </span>
              <span className="nav-auth-chip-name">
                {firstName(authUser.user_metadata?.full_name) || firstEmailPart(authUser.email)}
              </span>
            </a>
            <button
              type="button"
              className="nav-auth-chip-logout"
              onClick={handleLogout}
              title={lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
              aria-label={lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
            >
              ⏻
            </button>
          </div>
        )}

        <a className="btn-donate-nav" href={link('/projects/')}>
          {t(lang, 'nav_donate')}
        </a>
      </div>
    </nav>
  );
}

/**
 * Best-effort "what to call this person in the nav" extractors.
 * Identity gives us either full_name (set during invite) or just email.
 * Showing just the first name or the email's local part is short and
 * keeps the chip from blowing up the nav width.
 */
function firstName(fullName: string | undefined): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0] || '';
}
function firstEmailPart(email: string | undefined): string {
  if (!email) return '';
  return email.split('@')[0] || email;
}
