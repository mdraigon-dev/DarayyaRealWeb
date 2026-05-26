import { useState, useEffect } from 'react';
import { type Lang } from '../i18n/strings';
import { classifyUser, type AuthUser, type ProjectEngineer } from '../data/permissions';

declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

type Props = {
  projectId: string;
  lang: Lang;
  engineers: ProjectEngineer[];
  basePath: string;
};

/**
 * AdminEditProjectButton
 *
 * Visible only to users classified as 'admin' (via permissions.ts). A
 * prominent button at the top of the project page that opens the
 * custom editor — same destination as the link inside the auth-note
 * bar lower down, but easier to find for admins arriving on a project
 * page to fix something.
 *
 * Engineers-of-this-project do NOT see this button (they can post inline
 * notes/updates but can't change project settings).
 */
export default function AdminEditProjectButton({ projectId, lang, engineers, basePath }: Props) {
  const [auth, setAuth] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const init = () => {
      if (cancelled) return;
      const ni = window.netlifyIdentity;
      if (!ni) {
        tries++;
        if (tries < 40) setTimeout(init, 100);
        else setAuth(null);
        return;
      }
      try { ni.init(); } catch {}
      setAuth(ni.currentUser() || null);
      ni.on('login', (u: any) => setAuth(u));
      ni.on('logout', () => setAuth(null));
    };
    init();
    return () => { cancelled = true; };
  }, []);

  // Loading or anonymous: render nothing (no flash for public visitors)
  if (auth === undefined || auth === null) return null;

  const role = classifyUser(auth, engineers);
  if (role !== 'admin') return null;

  const editUrl = `${basePath}/admin/edit/${projectId}/`;

  return (
    <a className="admin-edit-pill" href={editUrl}>
      <span className="admin-edit-pill-icon">✎</span>
      <span>{lang === 'ar' ? 'تعديل المشروع' : 'Edit project'}</span>
      <span className="admin-edit-pill-arrow">→</span>
    </a>
  );
}
