import { useState, useEffect } from 'react';
import { type Lang } from '../i18n/strings';
import {
  loadPrefs,
  savePrefs,
  defaultPrefs,
  type AdminPrefs,
  type EngineerPreset,
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
  | { kind: 'authenticated'; user: { email: string; user_metadata?: { full_name?: string } } };

const emptyPreset = (): EngineerPreset => ({
  name: { ar: '', en: '' },
  role: { ar: '', en: '' },
  email: '',
  phone: '',
});

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
      if (!ni) {
        if (++tries < 40) setTimeout(init, 100);
        else setAuth({ kind: 'anonymous' });
        return;
      }
      try { ni.init(); } catch {}
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
    const cleaned: AdminPrefs = {
      displayName: prefs.displayName.trim(),
      // Drop entirely-empty presets so the list stays tidy.
      engineerPresets: prefs.engineerPresets.filter(
        (p) => p.name.ar.trim() || p.name.en.trim() || p.role.ar.trim() || p.role.en.trim(),
      ),
    };
    savePrefs(email, cleaned);
    setPrefs(cleaned);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updatePreset = (i: number, patch: Partial<EngineerPreset>) => {
    setPrefs((p) => {
      const next = [...p.engineerPresets];
      next[i] = { ...next[i], ...patch };
      return { ...p, engineerPresets: next };
    });
  };
  const updatePresetBilingual = (i: number, field: 'name' | 'role', side: 'ar' | 'en', v: string) => {
    setPrefs((p) => {
      const next = [...p.engineerPresets];
      next[i] = { ...next[i], [field]: { ...next[i][field], [side]: v } };
      return { ...p, engineerPresets: next };
    });
  };

  return (
    <section className="profile-section">
      <div className="profile-header">
        <div>
          <h1 className="profile-title">
            {lang === 'ar' ? 'تفضيلات المسؤول' : 'Admin preferences'}
          </h1>
          <p className="profile-signed-in">
            {lang === 'ar' ? 'مسجّل دخوله كـ ' : 'Signed in as '}
            <strong>{email}</strong>
          </p>
        </div>
        <a className="profile-back" href={`${basePath}/admin/`}>
          {lang === 'ar' ? '→ لوحة المجلس' : '← Council dashboard'}
        </a>
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

      {/* Engineer presets */}
      <div className="profile-card">
        <h3 className="profile-card-title">
          {lang === 'ar' ? 'قوالب المهندسين' : 'Engineer presets'}
        </h3>
        <p className="profile-card-hint">
          {lang === 'ar'
            ? 'أعضاء فريق محفوظون مسبقاً يمكنك إضافتهم بنقرة واحدة عند إنشاء مشروع.'
            : 'Saved team members you can drop into a project with one click when creating it.'}
        </p>

        {prefs.engineerPresets.length === 0 && (
          <p className="profile-empty">
            {lang === 'ar' ? 'لا توجد قوالب بعد.' : 'No presets yet.'}
          </p>
        )}

        {prefs.engineerPresets.map((p, i) => (
          <div key={i} className="profile-preset">
            <div className="profile-preset-head">
              <span className="profile-preset-num">{i + 1}</span>
              <button
                type="button"
                className="profile-remove-btn"
                onClick={() =>
                  setPrefs((pr) => ({
                    ...pr,
                    engineerPresets: pr.engineerPresets.filter((_, j) => j !== i),
                  }))
                }
                aria-label={lang === 'ar' ? 'حذف' : 'Remove'}
              >
                ✕
              </button>
            </div>
            <div className="profile-row">
              <div className="profile-field">
                <label>{lang === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)'}</label>
                <input
                  type="text" className="profile-input" dir="rtl"
                  value={p.name.ar}
                  onChange={(e) => updatePresetBilingual(i, 'name', 'ar', e.target.value)}
                />
              </div>
              <div className="profile-field">
                <label>{lang === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)'}</label>
                <input
                  type="text" className="profile-input" dir="ltr"
                  value={p.name.en}
                  onChange={(e) => updatePresetBilingual(i, 'name', 'en', e.target.value)}
                />
              </div>
            </div>
            <div className="profile-row">
              <div className="profile-field">
                <label>{lang === 'ar' ? 'الدور (عربي)' : 'Role (Arabic)'}</label>
                <input
                  type="text" className="profile-input" dir="rtl"
                  value={p.role.ar}
                  onChange={(e) => updatePresetBilingual(i, 'role', 'ar', e.target.value)}
                />
              </div>
              <div className="profile-field">
                <label>{lang === 'ar' ? 'الدور (إنجليزي)' : 'Role (English)'}</label>
                <input
                  type="text" className="profile-input" dir="ltr"
                  value={p.role.en}
                  onChange={(e) => updatePresetBilingual(i, 'role', 'en', e.target.value)}
                />
              </div>
            </div>
            <div className="profile-row">
              <div className="profile-field">
                <label>{lang === 'ar' ? 'البريد (اختياري)' : 'Email (optional)'}</label>
                <input
                  type="email" className="profile-input" dir="ltr"
                  value={p.email || ''}
                  onChange={(e) => updatePreset(i, { email: e.target.value })}
                />
              </div>
              <div className="profile-field">
                <label>{lang === 'ar' ? 'الهاتف (اختياري)' : 'Phone (optional)'}</label>
                <input
                  type="tel" className="profile-input" dir="ltr"
                  value={p.phone || ''}
                  onChange={(e) => updatePreset(i, { phone: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="profile-add-btn"
          onClick={() => setPrefs((p) => ({ ...p, engineerPresets: [...p.engineerPresets, emptyPreset()] }))}
        >
          + {lang === 'ar' ? 'إضافة قالب مهندس' : 'Add engineer preset'}
        </button>
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
