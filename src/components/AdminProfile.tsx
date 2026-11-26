import { useState, useEffect, useRef } from 'react';
import { t, loc, type Lang, type StringKey } from '../i18n/strings';
import { can, rolesOf, type AuthUser } from '../data/permissions';
import { isAssigned, ROLE_LABELS } from '../data/roles';
import { identityStarted } from '../data/identity-ready';
import { syncJwtCookie, clearJwtCookie } from '../data/identity-cookie';
import { loadPrefs, savePrefs } from '../data/admin-prefs';
import {
  loadSettings, saveSettings, pushSettingsToAccount,
  type TextSize, type UserSettings,
} from '../data/user-settings';

declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

type ProfileProject = {
  id: string;
  title: { ar: string; en?: string };
  engineers?: Array<{ userId?: string; email?: string }>;
};

type Props = {
  lang: Lang;
  /** Localized base, e.g. "/ar" */
  basePath: string;
  /** Published projects, to list the ones this person is linked to */
  projects?: ProfileProject[];
};

type IdentityUser = AuthUser & {
  id?: string;
  update?: (attrs: Record<string, unknown>) => Promise<any>;
  jwt?: (force?: boolean) => Promise<string>;
};

type AuthState =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; user: IdentityUser };

type Note = { kind: 'ok' | 'error' | 'info'; text: string } | null;

/**
 * "My preferences": account (display name, roles, linked projects), security
 * (change password, reset link, sign out), display (text size, reduced
 * motion) and preferred language. Open to every signed-in staff member.
 */
export default function AdminProfile({ lang, basePath, projects = [] }: Props) {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });

  // Netlify Identity bootstrap — wait for the widget to start itself
  // (never call init() again: see identity-ready.ts).
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const start = () => {
      if (cancelled) return;
      const ni = window.netlifyIdentity;
      if (!ni || !identityStarted()) {
        if (++tries < 40) setTimeout(start, 100);
        else setAuth({ kind: 'anonymous' });
        return;
      }
      const user = ni.currentUser();
      setAuth(user ? { kind: 'authenticated', user } : { kind: 'anonymous' });
      ni.on('login', (u: any) => setAuth({ kind: 'authenticated', user: u }));
      ni.on('logout', () => setAuth({ kind: 'anonymous' }));
    };
    start();
    return () => { cancelled = true; };
  }, []);

  if (auth.kind === 'loading') {
    return <section className="profile-section"><div className="profile-loading">…</div></section>;
  }

  if (auth.kind === 'anonymous') {
    return (
      <section className="profile-section">
        <div className="profile-auth-gate">
          <div className="profile-auth-icon">🔒</div>
          <h2>{t(lang, 'prof_signin_title')}</h2>
          <p>{t(lang, 'prof_signin_text')}</p>
          <button type="button" className="profile-save-btn" onClick={() => window.netlifyIdentity?.open?.('login')}>
            {t(lang, 'prof_signin_btn')}
          </button>
        </div>
      </section>
    );
  }

  return <Preferences lang={lang} basePath={basePath} projects={projects} user={auth.user} />;
}

function Preferences({ lang, basePath, projects, user }: { lang: Lang; basePath: string; projects: ProfileProject[]; user: IdentityUser }) {
  const roles = rolesOf(user);
  const mine = projects.filter((p) => isAssigned(user, p.engineers || []));

  return (
    <section className="profile-section">
      <div className="profile-header">
        <h1 className="profile-title">{t(lang, 'prof_title')}</h1>
        {can(user, 'view-dashboard') && (
          <a className="profile-back" href={`${basePath}/admin/`}>{t(lang, 'prof_back')}</a>
        )}
      </div>

      {/* ── Account ── */}
      <h2 className="profile-group">{t(lang, 'prof_account')}</h2>
      <DisplayNameCard lang={lang} user={user} />

      <div className="profile-card profile-facts">
        <div>
          <div className="profile-fact-label">{t(lang, 'prof_email')}</div>
          <div className="profile-fact-value" dir="ltr">{user.email}</div>
          <div className="profile-card-hint">{t(lang, 'prof_email_hint')}</div>
        </div>
        <div>
          <div className="profile-fact-label">{t(lang, 'prof_roles')}</div>
          {roles.length ? (
            <div className="profile-role-chips">
              {roles.map((r) => <span key={r} className="profile-role-chip">{ROLE_LABELS[r][lang]}</span>)}
            </div>
          ) : (
            <div className="profile-card-hint">{t(lang, 'prof_roles_none')}</div>
          )}
        </div>
      </div>

      {(roles.includes('engineer') || mine.length > 0) && (
        <div className="profile-card">
          <h3 className="profile-card-title">{t(lang, 'prof_projects')}</h3>
          <p className="profile-card-hint">{t(lang, 'prof_projects_hint')}</p>
          {mine.length ? (
            <ul className="profile-project-list">
              {mine.map((p) => (
                <li key={p.id}><a href={`${basePath}/projects/${p.id}/`}>{loc(lang, p.title)}</a></li>
              ))}
            </ul>
          ) : (
            <p className="profile-empty">{t(lang, 'prof_projects_none')}</p>
          )}
        </div>
      )}

      {/* ── Security ── */}
      <h2 className="profile-group">{t(lang, 'prof_security')}</h2>
      <PasswordCard lang={lang} user={user} />
      <ResetCard lang={lang} user={user} />
      <div className="profile-card profile-signout">
        <button
          type="button"
          className="profile-secondary-btn"
          onClick={() => {
            clearJwtCookie();
            window.netlifyIdentity?.logout?.();
            window.location.href = `${basePath}/`;
          }}
        >
          {t(lang, 'prof_signout')}
        </button>
      </div>

      {/* ── Display & language ── */}
      <h2 className="profile-group">{t(lang, 'prof_display')}</h2>
      <SettingsCards lang={lang} user={user} />
    </section>
  );
}

function Flash({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p className={`profile-note profile-note--${note.kind}`} role={note.kind === 'error' ? 'alert' : 'status'}>
      {note.kind === 'ok' ? '✓ ' : ''}{note.text}
    </p>
  );
}

function DisplayNameCard({ lang, user }: { lang: Lang; user: IdentityUser }) {
  const initial = () => {
    const local = loadPrefs(user.email).displayName;
    const account = user.user_metadata?.full_name || '';
    const n = (account || local).trim();
    return n.includes('@') ? '' : n;
  };
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const save = async () => {
    const n = name.trim();
    if (n.includes('@')) { setNote({ kind: 'error', text: t(lang, 'prof_name_err_email') }); return; }
    setBusy(true); setNote(null);
    savePrefs(user.email, { displayName: n });
    let onAccount = false;
    try {
      if (user.update) {
        await user.update({ data: { full_name: n } });
        onAccount = true;
        // A fresh token carries the new name to the save service and the page cookie.
        const fresh = window.netlifyIdentity?.currentUser?.();
        if (fresh?.jwt) { await fresh.jwt(true).catch(() => {}); await syncJwtCookie(fresh); }
      }
    } catch { /* saved locally only */ }
    setBusy(false);
    setNote(onAccount ? { kind: 'ok', text: t(lang, 'prof_saved') } : { kind: 'info', text: t(lang, 'prof_saved_local') });
  };

  return (
    <div className="profile-card">
      <h3 className="profile-card-title">{t(lang, 'prof_name')}</h3>
      <p className="profile-card-hint">{t(lang, 'prof_name_hint')}</p>
      <div className="profile-inline">
        <input
          type="text"
          className="profile-input"
          value={name}
          onChange={(e) => { setName(e.target.value); setNote(null); }}
          maxLength={80}
          dir="auto"
          aria-label={t(lang, 'prof_name')}
        />
        <button type="button" className="profile-save-btn" onClick={save} disabled={busy}>
          {busy ? t(lang, 'prof_working') : t(lang, 'prof_name_save')}
        </button>
      </div>
      <Flash note={note} />
    </div>
  );
}

function PasswordCard({ lang, user }: { lang: Lang; user: IdentityUser }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { setNote({ kind: 'error', text: t(lang, 'prof_pw_short') }); return; }
    if (pw !== pw2) { setNote({ kind: 'error', text: t(lang, 'prof_pw_mismatch') }); return; }
    setBusy(true); setNote(null);
    try {
      if (!user.update) throw new Error('no update');
      await user.update({ password: pw });
      setPw(''); setPw2('');
      setNote({ kind: 'ok', text: t(lang, 'prof_pw_done') });
    } catch {
      setNote({ kind: 'error', text: t(lang, 'prof_pw_failed') });
    }
    setBusy(false);
  };

  return (
    <form className="profile-card" onSubmit={save} noValidate>
      <h3 className="profile-card-title">{t(lang, 'prof_pw_title')}</h3>
      <div className="profile-pw-grid">
        <label className="profile-field">
          <span>{t(lang, 'prof_pw_new')}</span>
          <input type="password" className="profile-input" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setNote(null); }} dir="ltr" />
        </label>
        <label className="profile-field">
          <span>{t(lang, 'prof_pw_confirm')}</span>
          <input type="password" className="profile-input" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setNote(null); }} dir="ltr" />
        </label>
      </div>
      <p className="profile-card-hint">{t(lang, 'prof_pw_hint')}</p>
      <button type="submit" className="profile-save-btn" disabled={busy || !pw}>
        {busy ? t(lang, 'prof_working') : t(lang, 'prof_pw_save')}
      </button>
      <Flash note={note} />
    </form>
  );
}

function ResetCard({ lang, user }: { lang: Lang; user: IdentityUser }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const send = async () => {
    setBusy(true); setNote(null);
    try {
      // Netlify Identity's own recovery endpoint: it emails a reset link.
      const res = await fetch('/.netlify/identity/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      setNote(res.ok ? { kind: 'ok', text: t(lang, 'prof_reset_sent') } : { kind: 'error', text: t(lang, 'prof_reset_failed') });
    } catch {
      setNote({ kind: 'error', text: t(lang, 'prof_reset_failed') });
    }
    setBusy(false);
  };
  return (
    <div className="profile-card">
      <h3 className="profile-card-title">{t(lang, 'prof_reset_title')}</h3>
      <p className="profile-card-hint">{t(lang, 'prof_reset_text')}</p>
      <button type="button" className="profile-secondary-btn" onClick={send} disabled={busy}>
        {busy ? t(lang, 'prof_working') : t(lang, 'prof_reset_btn')}
      </button>
      <Flash note={note} />
    </div>
  );
}

function SettingsCards({ lang, user }: { lang: Lang; user: IdentityUser }) {
  const [s, setS] = useState<UserSettings>(() => loadSettings());
  const [note, setNote] = useState<Note>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const change = (patch: Partial<UserSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveSettings(next); // applies immediately
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const ok = await pushSettingsToAccount(user, next);
      setNote(ok ? { kind: 'ok', text: t(lang, 'prof_saved') } : { kind: 'info', text: t(lang, 'prof_saved_local') });
    }, 600);
  };

  const sizes: Array<[TextSize, StringKey]> = [['normal', 'prof_size_normal'], ['large', 'prof_size_large'], ['larger', 'prof_size_larger']];

  return (
    <>
      <div className="profile-card">
        <p className="profile-card-hint">{t(lang, 'prof_display_hint')}</p>
        <fieldset className="profile-fieldset">
          <legend className="profile-card-title">{t(lang, 'prof_text_size')}</legend>
          <div className="profile-choice-row">
            {sizes.map(([v, key], i) => (
              <label key={v} className={`profile-choice${s.textSize === v ? ' is-selected' : ''}`}>
                <input type="radio" name="text-size" value={v} checked={s.textSize === v} onChange={() => change({ textSize: v })} />
                <span className="profile-choice-sample" style={{ fontSize: `${[16, 19, 22][i]}px` }} aria-hidden="true">{lang === 'ar' ? 'أ ب' : 'Aa'}</span>
                <span>{t(lang, key)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="profile-toggle">
          <input type="checkbox" checked={s.reduceMotion} onChange={(e) => change({ reduceMotion: e.target.checked })} />
          <span>
            <strong>{t(lang, 'prof_motion')}</strong>
            <span className="profile-card-hint">{t(lang, 'prof_motion_hint')}</span>
          </span>
        </label>
      </div>

      <div className="profile-card">
        <fieldset className="profile-fieldset">
          <legend className="profile-card-title">{t(lang, 'prof_language')}</legend>
          <p className="profile-card-hint">{t(lang, 'prof_language_hint')}</p>
          <div className="profile-choice-row">
            {([['ar', 'prof_lang_ar'], ['en', 'prof_lang_en']] as Array<['ar' | 'en', StringKey]>).map(([v, key]) => (
              <label key={v} className={`profile-choice${(s.language || 'ar') === v ? ' is-selected' : ''}`}>
                <input type="radio" name="language" value={v} checked={(s.language || 'ar') === v} onChange={() => change({ language: v })} />
                <span lang={v} dir={v === 'ar' ? 'rtl' : 'ltr'}>{t(lang, key)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <Flash note={note} />
    </>
  );
}
