import { useEffect, useState } from 'react';
import type { AuthUser } from './permissions';

export type IdentityState =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; user: AuthUser };

/**
 * Current Netlify Identity user, for islands that need to change what they
 * render for signed-in staff. Starts as 'loading' — which is also what the
 * server render sees — so admin-only UI never ends up in the static HTML.
 * The widget script loads asynchronously, so poll briefly for it.
 */
export function useIdentity(): IdentityState {
  const [state, setState] = useState<IdentityState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const init = () => {
      if (cancelled) return;
      const ni = (window as any).netlifyIdentity;
      if (!ni) {
        if (++tries < 40) setTimeout(init, 100);
        else setState({ kind: 'anonymous' });
        return;
      }
      try { ni.init(); } catch {}
      const user = ni.currentUser();
      setState(user ? { kind: 'authenticated', user } : { kind: 'anonymous' });
      ni.on('login', (u: any) => { if (!cancelled) setState({ kind: 'authenticated', user: u }); });
      ni.on('logout', () => { if (!cancelled) setState({ kind: 'anonymous' }); });
    };
    init();
    return () => { cancelled = true; };
  }, []);

  return state;
}
