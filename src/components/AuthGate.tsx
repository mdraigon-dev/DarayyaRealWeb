import { useEffect, useState, type ReactNode } from 'react';
import Logo from './Logo';
import { t, type Lang } from '../i18n/strings';

/**
 * AuthGate — protects dashboard content behind authentication.
 *
 * Uses Netlify Identity (which is what Decap CMS uses under the hood for auth).
 * This is the same login system staff use to edit content.
 *
 * IMPORTANT: This is client-side auth on a static site. It's a UI gate, not a
 * security boundary. Don't put sensitive data on this page. In v2 when real
 * donations exist, that data must come from a backend API that authorizes
 * requests server-side.
 */

// Window-level netlifyIdentity type
declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

type AuthState =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; user: { email: string; user_metadata?: { full_name?: string } } };

type Props = {
  lang: Lang;
  children: ReactNode;
};

export default function AuthGate({ lang, children }: Props) {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });

  useEffect(() => {
    // Wait for netlify-identity-widget to load. If it never loads (e.g. user
    // has not yet set up Netlify Identity), we still show a login UI that
    // explains what to do.
    let cancelled = false;
    let tries = 0;
    const maxTries = 40; // 4 seconds at 100ms

    const init = () => {
      if (cancelled) return;
      const ni = window.netlifyIdentity;
      if (!ni) {
        tries++;
        if (tries < maxTries) {
          setTimeout(init, 100);
          return;
        }
        // Library never loaded — treat as anonymous so user sees sign-in screen
        setAuth({ kind: 'anonymous' });
        return;
      }

      // Initialize the widget
      try {
        ni.init();
      } catch (e) {
        // Already initialized, that's fine
      }

      const user = ni.currentUser();
      if (user) {
        setAuth({ kind: 'authenticated', user });
      } else {
        setAuth({ kind: 'anonymous' });
      }

      // Listen for auth state changes
      ni.on('login', (u: any) => {
        setAuth({ kind: 'authenticated', user: u });
        ni.close();
      });
      ni.on('logout', () => {
        setAuth({ kind: 'anonymous' });
      });
    };

    init();

    return () => {
      cancelled = true;
      const ni = window.netlifyIdentity;
      if (ni) {
        ni.off('login');
        ni.off('logout');
      }
    };
  }, []);

  const signIn = () => {
    const ni = window.netlifyIdentity;
    if (ni && typeof ni.open === 'function') {
      ni.open();
    } else {
      // Fallback: send user to the Decap CMS where they'll be prompted to log in
      const base = (import.meta as any).env?.BASE_URL ?? '/';
      window.location.href = `${base}admin/`;
    }
  };

  const signOut = () => {
    const ni = window.netlifyIdentity;
    if (ni && typeof ni.logout === 'function') ni.logout();
  };

  if (auth.kind === 'loading') {
    return (
      <div className="auth-gate-screen">
        <div className="auth-gate-card">
          <div className="auth-gate-spinner"></div>
          <p style={{ color: 'var(--sy-muted)', marginTop: '1rem' }}>{t(lang, 'auth_loading')}</p>
        </div>
      </div>
    );
  }

  if (auth.kind === 'anonymous') {
    return (
      <div className="auth-gate-screen">
        <div className="auth-gate-card">
          <div className="auth-gate-logo">
            <Logo size={88} color="var(--sy-green-dk)" />
          </div>
          <h2 className="auth-gate-title">{t(lang, 'auth_required_title')}</h2>
          <p className="auth-gate-desc">{t(lang, 'auth_required_desc')}</p>
          <button className="btn-primary auth-gate-btn" onClick={signIn}>
            {t(lang, 'auth_signin_btn')}
          </button>
          <p className="auth-gate-note">{t(lang, 'auth_signin_note')}</p>
        </div>
      </div>
    );
  }

  // Authenticated — render the dashboard with a sign-out strip on top
  const displayName = auth.user.user_metadata?.full_name || auth.user.email;
  return (
    <>
      <div className="auth-signed-bar">
        <span className="auth-signed-info">
          <span className="auth-signed-dot"></span>
          {t(lang, 'auth_signed_in_as')} <strong>{displayName}</strong>
        </span>
        <button className="auth-signed-out-btn" onClick={signOut}>
          {t(lang, 'auth_signout_btn')}
        </button>
      </div>
      {children}
    </>
  );
}
