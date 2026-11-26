/**
 * team-directory.ts — the shared team directory and the staff account list.
 *
 * The directory (src/content/team/directory.json) holds team members project
 * managers add to projects: name, role, optional public phone, and the
 * Identity account they're linked to (userId). It is read and saved through
 * the save service like every other file (writing it needs edit-projects).
 *
 * The staff list comes from the save service's `staff` action: { id, name,
 * roles } for engineers and project managers. It never includes emails.
 */
import { useCallback, useEffect, useState } from 'react';
import { commitChanges, getFileContent, listStaff, type StaffAccount } from './repo';

export const TEAM_DIRECTORY_PATH = 'src/content/team/directory.json';

type Bilingual = { ar: string; en: string };

export type TeamMember = {
  id: string;
  name: Bilingual;
  role: Bilingual;
  userId?: string;
  phone?: string;
};

const bl = (v: any): Bilingual => ({
  ar: typeof v?.ar === 'string' ? v.ar : '',
  en: typeof v?.en === 'string' ? v.en : '',
});

export function newMemberId(): string {
  return `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Anything malformed is skipped, the same way the build's schema does. */
export function parseDirectory(text: string): TeamMember[] {
  let data: any;
  try { data = JSON.parse(text); } catch { return []; }
  const list = Array.isArray(data?.members) ? data.members : [];
  return list
    .filter((m: any) => m && typeof m === 'object')
    .map((m: any) => ({
      id: typeof m.id === 'string' && m.id ? m.id : newMemberId(),
      name: bl(m.name),
      role: bl(m.role),
      ...(typeof m.userId === 'string' && m.userId.trim() ? { userId: m.userId.trim() } : {}),
      ...(typeof m.phone === 'string' && m.phone.trim() ? { phone: m.phone.trim() } : {}),
    }));
}

/** Members as written to the file: blank rows dropped, empty optionals left out. */
export function cleanMembers(members: TeamMember[]): TeamMember[] {
  return members
    .filter((m) => m.name.ar.trim() || m.name.en.trim())
    .map((m) => ({
      id: m.id,
      name: { ar: m.name.ar.trim(), en: m.name.en.trim() },
      role: { ar: m.role.ar.trim(), en: m.role.en.trim() },
      ...(m.userId ? { userId: m.userId } : {}),
      ...(m.phone && m.phone.trim() ? { phone: m.phone.trim() } : {}),
    }));
}

export function serializeDirectory(members: TeamMember[]): string {
  return `${JSON.stringify({ members: cleanMembers(members) }, null, 2)}\n`;
}

/** The live directory, and the version it was read at (null = no file yet). */
export async function loadDirectory(): Promise<{ members: TeamMember[]; sha: string | null }> {
  const f = await getFileContent(TEAM_DIRECTORY_PATH);
  return f ? { members: parseDirectory(f.content), sha: f.sha } : { members: [], sha: null };
}

/** Save the whole directory in one commit, pinned to the version it was based on. */
export async function saveDirectory(members: TeamMember[], baseSha: string | null, message: string): Promise<string | null> {
  const shas = await commitChanges(message, [
    { path: TEAM_DIRECTORY_PATH, text: serializeDirectory(members), expectSha: baseSha },
  ]);
  return shas[TEAM_DIRECTORY_PATH] ?? null;
}

// ── Staff accounts ─────────────────────────────────────────────────────

export type StaffState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; staff: StaffAccount[] }
  | { kind: 'error' };

const staffCache = new Map<string, Promise<StaffAccount[]>>();

/** Engineers and project managers, loaded once per page and language. */
export function useStaff(lang: 'ar' | 'en', enabled: boolean): { state: StaffState; reload: () => void } {
  const [state, setState] = useState<StaffState>({ kind: 'idle' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    let p = staffCache.get(lang);
    if (!p) {
      p = listStaff(lang).then((r) => r.staff);
      staffCache.set(lang, p);
    }
    p.then(
      (staff) => { if (!cancelled) setState({ kind: 'ready', staff }); },
      () => {
        staffCache.delete(lang);
        if (!cancelled) setState({ kind: 'error' });
      },
    );
    return () => { cancelled = true; };
  }, [lang, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload };
}
