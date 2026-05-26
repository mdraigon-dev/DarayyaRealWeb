import { useState, useEffect } from 'react';
import { t, type Lang } from '../i18n/strings';

declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

type Props = {
  projectId: string;
  lang: Lang;
};

type AuthState =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; user: { email: string; user_metadata?: { full_name?: string; roles?: string[] } } };

/**
 * AuthAwareNoteAdder
 *
 * Renders an "✎ Add note" button on a project page IF the visitor is
 * logged into Netlify Identity. Clicking it deep-links them into Decap CMS
 * with the project preselected and scrolled to the comments section.
 *
 * Why deep-link instead of inline form?
 * Posting a comment requires committing a file to GitHub via Git Gateway.
 * Decap already handles all of that auth + commit + validation correctly.
 * Rebuilding that in this component would be ~2 days of work and would
 * duplicate Decap. The deep-link is one click away from typing the note.
 *
 * Role-awareness: Netlify Identity supports user_metadata.roles. If you
 * want to restrict note-posting to specific roles (e.g. only "engineer"
 * or "manager"), set roles on each user in the Netlify dashboard
 * (Identity → Users → click user → User metadata → roles: ["engineer"]).
 * This component shows the button to anyone logged in by default; tweak
 * ALLOWED_ROLES below to restrict.
 */

const ALLOWED_ROLES: string[] | null = null; // null = any logged-in user

export default function AuthAwareNoteAdder({ projectId, lang }: Props) {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const maxTries = 40;

    const init = () => {
      if (cancelled) return;
      const ni = window.netlifyIdentity;
      if (!ni) {
        tries++;
        if (tries < maxTries) {
          setTimeout(init, 100);
          return;
        }
        // Widget never loaded — assume anonymous (no button)
        setAuth({ kind: 'anonymous' });
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

  // Loading or anonymous — don't render anything (no flash)
  if (auth.kind !== 'authenticated') return null;

  // Role check (if ALLOWED_ROLES is set)
  if (ALLOWED_ROLES) {
    const userRoles = auth.user.user_metadata?.roles || [];
    if (!ALLOWED_ROLES.some(r => userRoles.includes(r))) return null;
  }

  const cmsUrl = `/admin/#/collections/projects/entries/${projectId}`;
  const userName = auth.user.user_metadata?.full_name || auth.user.email;

  const handleSignIn = () => {
    if (window.netlifyIdentity) window.netlifyIdentity.open();
  };

  return (
    <div className="auth-note-bar">
      <span className="auth-note-info">
        <span className="auth-note-dot"></span>
        {lang === 'ar'
          ? <>مسجّل دخوله كـ <strong>{userName}</strong></>
          : <>Signed in as <strong>{userName}</strong></>}
      </span>
      <a className="auth-note-btn" href={cmsUrl}>
        ✎ {lang === 'ar' ? 'إضافة ملاحظة أو تعديل' : 'Add note / edit'}
      </a>
    </div>
  );
}
