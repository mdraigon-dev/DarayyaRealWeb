import { useEffect, useState } from 'react';
import { t, type Lang } from '../i18n/strings';
import { useIdentity } from '../data/use-identity';
import { setJwtCookie, syncJwtCookie } from '../data/identity-cookie';
import { hasAnyRole, pageRoles, ROLES, ROLE_LABELS, rolesOf, type Role } from '../data/roles';

type State = 'loading' | 'signed-out' | 'no-access';

function openLogin() {
  const ni = (window as any).netlifyIdentity;
  if (!ni) return;
  ni.on('login', async (u: any) => {
    await syncJwtCookie(u); // so Netlify lets the reloaded page through
    ni.close?.();
    window.location.reload();
  });
  ni.open('login');
}

/** Shown in place of a staff-only page section. */
export default function AccessNotice({ lang, state, roles }: { lang: Lang; state: State; roles?: Role[] }) {
  if (state === 'loading') {
    return <section className="section access-notice" aria-busy="true"><p className="access-muted">{t(lang, 'access_loading')}</p></section>;
  }
  const base = `/${lang}/`;
  return (
    <section className="section access-notice">
      <div className="access-card">
        <div className="access-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
        </div>
        <h1 className="access-title">{t(lang, state === 'signed-out' ? 'access_title_signin' : 'access_title_denied')}</h1>
        <p className="access-text">{t(lang, state === 'signed-out' ? 'access_text_signin' : 'access_text_denied')}</p>
        {roles && roles.length > 0 && roles.length < ROLES.length && (
          <p className="access-muted">{t(lang, 'access_needs')}: {roles.map((r) => ROLE_LABELS[r][lang]).join(lang === 'ar' ? '، ' : ', ')}</p>
        )}
        <div className="access-actions">
          {state === 'signed-out' && (
            <button type="button" className="btn-primary" onClick={openLogin}>{t(lang, 'access_signin_btn')}</button>
          )}
          <a className="btn-secondary" href={base}>{t(lang, 'access_home')}</a>
        </div>
      </div>
    </section>
  );
}

/** Roles in the token itself (fresh after a refresh), falling back to the user record. */
function tokenRoles(token: string): string[] | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const r = payload?.app_metadata?.roles;
    return Array.isArray(r) ? r : null;
  } catch {
    return null;
  }
}

const RETRY_KEY = 'access-retry:';

/**
 * The page Netlify serves (with status 401) when someone opens a staff page
 * without the right role in their sign-in cookie. If they're signed in and
 * their role does allow it, the cookie was just missing or stale: refresh it
 * and reload once. Otherwise explain what's needed.
 */
export function SignInGate({ lang }: { lang: Lang }) {
  const identity = useIdentity();
  const [state, setState] = useState<State | 'retrying'>('loading');
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const needed: Role[] = path.startsWith('/admin')
    ? ['admin']
    : (pageRoles(path.replace(/^\/(ar|en)(?=\/)/, '')) ?? []);

  useEffect(() => {
    if (identity.kind === 'loading') return;
    if (identity.kind === 'anonymous') { setState('signed-out'); return; }
    let cancelled = false;
    (async () => {
      const user: any = identity.user;
      let token = '';
      try { token = await user.jwt(true); } catch { try { token = await user.jwt(); } catch { /* offline */ } }
      if (cancelled) return;
      const roles = (token && tokenRoles(token)) || rolesOf(user);
      const allowed = needed.length > 0 && hasAnyRole({ app_metadata: { roles } }, needed);
      if (!allowed) { setState('no-access'); return; }
      // Their role allows it: the cookie Netlify checks was missing or old.
      let last = 0;
      try { last = Number(sessionStorage.getItem(RETRY_KEY + path) || 0); } catch { /* storage blocked */ }
      if (Date.now() - last < 20_000) { setState('no-access'); return; }
      try { sessionStorage.setItem(RETRY_KEY + path, String(Date.now())); } catch { /* ignore */ }
      if (token) setJwtCookie(token);
      setState('retrying');
      window.location.reload();
    })();
    return () => { cancelled = true; };
  }, [identity.kind]);

  if (state === 'retrying' || state === 'loading') return <AccessNotice lang={lang} state="loading" />;
  return <AccessNotice lang={lang} state={state} roles={needed} />;
}
