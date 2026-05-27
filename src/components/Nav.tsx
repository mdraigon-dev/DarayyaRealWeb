import { useState, useEffect, useRef } from 'react';
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
  pathname?: string;
};

// ─── User-profile preferences persisted in localStorage ──────────────────────
const PROFILE_KEY = 'darayya-user-profile-v1';

type UserProfile = {
  displayName: string;   // preferred author name for updates/notes
  notifyEmail: boolean;  // placeholder for future email notifications
};

function loadProfile(): UserProfile {
  if (typeof window === 'undefined') return { displayName: '', notifyEmail: false };
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { displayName: '', notifyEmail: false };
    return { displayName: '', notifyEmail: false, ...JSON.parse(raw) };
  } catch { return { displayName: '', notifyEmail: false }; }
}

function saveProfile(p: UserProfile): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
}

/**
 * Public accessor so AuthAwareUpdateAdder / AuthAwareNoteAdder can read the
 * preferred display name without knowing about the nav component.
 */
export function getProfileDisplayName(): string {
  return loadProfile().displayName;
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Nav({ lang, currentPage, pathname }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null | undefined>(undefined);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({ displayName: '', notifyEmail: false });
  const [profileDraft, setProfileDraft] = useState<UserProfile>({ displayName: '', notifyEmail: false });
  const [profileSaved, setProfileSaved] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load profile from localStorage on mount
  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    setProfileDraft(p);
  }, []);

  // Netlify Identity init
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
        try { ni.close(); } catch {}
      });
      ni.on('logout', () => setAuthUser(null));
    };
    init();
    return () => { cancelled = true; };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  const handleLogin = () => {
    const ni = window.netlifyIdentity;
    if (ni && ni.open) ni.open('login');
  };
  const handleLogout = () => {
    const ni = window.netlifyIdentity;
    if (ni && ni.logout) ni.logout();
    setProfileOpen(false);
  };

  const handleProfileSave = () => {
    saveProfile(profileDraft);
    setProfile(profileDraft);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const base = (import.meta as any).env?.BASE_URL ?? '/';
  const link = (path: string) => `${base}${lang}${path}`;

  const [currentPath, setCurrentPath] = useState<string>(pathname || `${base}${lang}/`);
  useEffect(() => {
    if (typeof window !== 'undefined') setCurrentPath(window.location.pathname);
  }, []);

  const swapLocaleHref = (target: Lang): string => {
    const src = `/${lang}/`;
    if (currentPath.includes(src)) return currentPath.replace(src, `/${target}/`);
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

  // Resolved display name: preference > Identity full_name > email local part
  const identityName = authUser
    ? (authUser.user_metadata?.full_name || firstEmailPart(authUser.email))
    : '';
  const resolvedDisplayName = profile.displayName.trim() || identityName;
  const avatarChar = resolvedDisplayName.charAt(0).toUpperCase() || '?';

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

        {/* Login button when anonymous */}
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

        {/* Profile dropdown when authenticated */}
        {authUser && (
          <div className="nav-profile-wrap" ref={dropdownRef}>
            <button
              type="button"
              className={`nav-auth-chip nav-auth-chip-btn ${profileOpen ? 'open' : ''}`}
              onClick={() => setProfileOpen(o => !o)}
              title={authUser.email}
              aria-expanded={profileOpen}
              aria-haspopup="true"
            >
              <span className="nav-auth-chip-avatar" aria-hidden="true">{avatarChar}</span>
              <span className="nav-auth-chip-name">{firstName(resolvedDisplayName) || firstEmailPart(authUser.email)}</span>
              <span className="nav-auth-chip-chevron" aria-hidden="true">{profileOpen ? '▲' : '▾'}</span>
            </button>

            {profileOpen && (
              <div className={`nav-profile-dropdown ${lang === 'ar' ? 'rtl' : 'ltr'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                {/* Identity info header */}
                <div className="npd-header">
                  <div className="npd-avatar-lg" aria-hidden="true">{avatarChar}</div>
                  <div className="npd-header-text">
                    <div className="npd-name">{resolvedDisplayName || authUser.email}</div>
                    <div className="npd-email">{authUser.email}</div>
                  </div>
                </div>

                <div className="npd-divider" />

                {/* Display name preference */}
                <div className="npd-section">
                  <div className="npd-section-title">
                    {lang === 'ar' ? '✏ الاسم المعروض' : '✏ Display name'}
                  </div>
                  <div className="npd-section-desc">
                    {lang === 'ar'
                      ? 'يظهر هذا الاسم عند إضافة تحديثات أو ملاحظات على المشاريع.'
                      : 'Shown when you add field updates or notes to projects.'}
                  </div>
                  <input
                    type="text"
                    className="npd-input"
                    value={profileDraft.displayName}
                    onChange={e => setProfileDraft(d => ({ ...d, displayName: e.target.value }))}
                    placeholder={identityName || (lang === 'ar' ? 'اكتب اسمك هنا…' : 'Your name…')}
                    maxLength={60}
                    dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  />
                  <div className="npd-hint">
                    {lang === 'ar'
                      ? `إذا تُرك فارغاً، يُستخدم: ${identityName || authUser.email}`
                      : `If blank, uses: ${identityName || authUser.email}`}
                  </div>
                </div>

                <div className="npd-divider" />

                {/* Save + Sign out row */}
                <div className="npd-actions">
                  <button
                    type="button"
                    className="npd-btn-save"
                    onClick={handleProfileSave}
                  >
                    {profileSaved
                      ? (lang === 'ar' ? '✓ تم الحفظ' : '✓ Saved')
                      : (lang === 'ar' ? 'حفظ' : 'Save')}
                  </button>
                  <button
                    type="button"
                    className="npd-btn-logout"
                    onClick={handleLogout}
                  >
                    {lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <a className="btn-donate-nav" href={link('/projects/')}>
          {t(lang, 'nav_donate')}
        </a>
      </div>
    </nav>
  );
}

function firstName(fullName: string | undefined): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0] || '';
}
function firstEmailPart(email: string | undefined): string {
  if (!email) return '';
  return email.split('@')[0] || email;
}
