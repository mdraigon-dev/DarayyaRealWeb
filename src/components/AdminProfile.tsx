import { useState, useEffect } from 'react';
import { type Lang } from '../i18n/strings';
import { can, rolesText, type AuthUser } from '../data/permissions';
import { identityStarted } from '../data/identity-ready';
import {
  loadPrefs,
  savePrefs,
  defaultPrefs,
  type AdminPrefs,
} from '../data/admin-prefs';

declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

type Props = {
  lang: Lang;
  /** Localized base, e.g. "/ar" — used to link back to admin */
  basePath: string;
};

type AuthState =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; user: AuthUser };

export default function AdminProfile({ lang, basePath }: Props) {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });
  const [prefs, setPrefs] = useState<AdminPrefs>(defaultPrefs());
  const [saved, setSaved] = useState(false);

  // Netlify Identity bootstrap — same pattern as the other admin islands.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const init = () => {
      if (cancelled) return;
      const ni = window.netlifyIdentity;
      if (!ni || !identityStarted()) {
        if (++tries < 40) setTimeout(init, 100);
        else setAuth({ kind: 'anonymous' });
        return;
      }
      const user = ni.currentUser();
      setAuth(user ? { kind: 'authenticated', user } : { kind: 'anonymous' });
      ni.on('login', (u: any) => setAuth({ kind: 'authenticated', user: u }));
      ni.on('logout', () => setAuth({ kind: 'anonymous' }));
    };
    init();
    return () => { cancelled = true; };
  }, []);

  // Load this account's saved prefs once we know who they are. Seed the
  // display name from their Identity full name if they've never set one.
  useEffect(() => {
    if (auth.kind !== 'authenticated') return;
    const loaded = loadPrefs(auth.user.email);
    if (!loaded.displayName) {
      loaded.displayName = auth.user.user_metadata?.full_name || '';
    }
    setPrefs(loaded);
  }, [auth]);

  if (auth.kind === 'loading') {
    return <section className="profile-section"><div className="profile-loading">…</div></section>;
  }

  if (auth.kind === 'anonymous') {
    return (
      <section className="profile-section">
        <div className="profile-auth-gate">
          <div className="profile-auth-icon">🔒</div>
          <h2>{lang === 'ar' ? 'يجب تسجيل الدخول' : 'Sign-in required'}</h2>
          <p>
            {lang === 'ar'
              ? 'صفحة التفضيلات متاحة للمسؤولين المسجّلين فقط.'
              : 'The preferences page is available to signed-in admins only.'}
          </p>
          <button
            type="button"
            className="profile-save-btn"
            onClick={() => window.netlifyIdentity?.open?.('login')}
          >
            {lang === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
          </button>
        </div>
      </section>
    );
  }

  const email = auth.user.email;

  const handleSave = () => {
    const cleaned: AdminPrefs = { displayName: prefs.displayName.trim() };
    savePrefs(email, cleaned);
    setPrefs(cleaned);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <section className="profile-section">
      <div className="profile-header">
        <div>
          <h1 className="profile-title">
            {lang === 'ar' ? 'تفضيلاتي' : 'My preferences'}
          </h1>
          <p className="profile-signed-in">
            {lang === 'ar' ? 'مسجّل دخوله كـ ' : 'Signed in as '}
            <strong>{email}</strong>
          </p>
          <p className="profile-signed-in">
            {lang === 'ar' ? 'صلاحياتك: ' : 'Your roles: '}
            <strong>{rolesText(auth.user, lang) || (lang === 'ar' ? 'لا توجد' : 'none')}</strong>
          </p>
        </div>
        {can(auth.user, 'view-dashboard') && (
          <a className="profile-back" href={`${basePath}/admin/`}>
            {lang === 'ar' ? '→ لوحة المجلس' : '← Council dashboard'}
          </a>
        )}
      </div>

      <p className="profile-storage-note">
        {lang === 'ar'
          ? 'تُحفظ هذه التفضيلات في هذا المتصفح على هذا الجهاز.'
          : 'These preferences are saved in this browser on this device.'}
      </p>

      {/* Display name */}
      <div className="profile-card">
        <h3 className="profile-card-title">
          {lang === 'ar' ? 'الاسم المعروض' : 'Display name'}
        </h3>
        <p className="profile-card-hint">
          {lang === 'ar'
            ? 'الاسم الذي يظهر ككاتب عند إضافة ملاحظة أو تحديث ميداني.'
            : 'The name shown as the author when you add a note or a field update.'}
        </p>
        <input
          type="text"
          className="profile-input"
          value={prefs.displayName}
          onChange={(e) => setPrefs((p) => ({ ...p, displayName: e.target.value }))}
          placeholder={auth.user.user_metadata?.full_name || email}
          maxLength={80}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        />
      </div>

      <div className="profile-actions">
        {saved && (
          <span className="profile-saved">
            ✓ {lang === 'ar' ? 'تم الحفظ' : 'Saved'}
          </span>
        )}
        <button type="button" className="profile-save-btn" onClick={handleSave}>
          {lang === 'ar' ? 'حفظ التفضيلات' : 'Save preferences'}
        </button>
      </div>
    </section>
  );
}
