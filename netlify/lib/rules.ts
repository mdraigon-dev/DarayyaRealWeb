/**
 * rules.ts — what the save service allows, per role.
 *
 * Every save arrives as a list of file changes. Each change is classified by
 * its path, and project files are compared field by field with the version
 * currently in the repo, so the service knows exactly what kind of change it
 * is (a new note, a budget edit, a recorded contribution…) and can check it
 * against the person's roles. The site's own buttons follow the same rules
 * (src/data/roles.ts); this is the part that can't be bypassed.
 */
import { parse as parseYaml } from 'yaml';
import { canPostOn, capsOf, rolesOf, type RoleUser } from '../../src/data/roles';

export type FileChange = {
  path: string;
  /** new file contents (text); absent for deletes and binary uploads */
  text?: string;
  /** blob SHA of an uploaded binary */
  blob?: string;
  delete?: boolean;
  /** blob SHA the client based its change on; null = must not exist yet */
  expectSha?: string | null;
};

export type PathClass =
  | { kind: 'project'; id: string }
  | { kind: 'project-image'; id: string }
  | { kind: 'document-meta' }
  | { kind: 'document-file' }
  | { kind: 'contribute-page' }
  | { kind: 'contribute-image' }
  | { kind: 'team-directory' }
  | { kind: 'other-content' }
  | { kind: 'forbidden' };

const ID = '[a-z0-9][a-z0-9-]{0,80}';
export const TEAM_DIRECTORY_PATH = 'src/content/team/directory.json';
const FILE = '[A-Za-z0-9][A-Za-z0-9._-]{0,120}';
const IMG = '\\.(png|jpe?g|webp|gif)';

export function classifyPath(path: string): PathClass {
  if (!path || path.startsWith('/') || path.includes('..') || path.includes('\\') || /\/\//.test(path)) {
    return { kind: 'forbidden' };
  }
  let m: RegExpMatchArray | null;
  if ((m = path.match(new RegExp(`^src/content/projects/(${ID})\\.md$`)))) return { kind: 'project', id: m[1] };
  if ((m = path.match(new RegExp(`^public/uploads/projects/(${ID})/${FILE}${IMG}$`, 'i')))) return { kind: 'project-image', id: m[1] };
  if (new RegExp(`^src/content/circulars/${FILE}\\.md$`).test(path)) return { kind: 'document-meta' };
  // Documents: an allowlist of types. No SVG or HTML — served from the site's
  // own address they could run scripts with a signed-in person's session.
  if (new RegExp(`^public/circulars/files/${FILE}\\.(pdf|png|jpe?g|gif|webp|docx?|xlsx?|pptx?|txt|csv)$`, 'i').test(path)) return { kind: 'document-file' };
  if (path === 'src/content/contribute/page.json') return { kind: 'contribute-page' };
  if (new RegExp(`^public/uploads/contribute/${FILE}${IMG}$`, 'i').test(path)) return { kind: 'contribute-image' };
  if (path === TEAM_DIRECTORY_PATH) return { kind: 'team-directory' };
  if (/\.(svg|html?|xhtml|js|mjs|xml)$/i.test(path) && path.startsWith('public/')) return { kind: 'forbidden' };
  if (/^src\/content\/[\w./-]+$/.test(path) || /^public\/uploads\/[\w./-]+$/.test(path)) return { kind: 'other-content' };
  return { kind: 'forbidden' };
}

// ── Project files: what kind of change is this? ────────────────────────

export type ProjectNeed =
  | 'create-project' | 'delete-project' | 'edit-project'
  | 'post' | 'moderate' | 'funds' | 'reverse-funds';

type FM = Record<string, any>;

export function parseProject(text: string): { fm: FM; body: string } {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new RuleError('INVALID_FORMAT', 'Project file has no frontmatter.');
  const fm = parseYaml(m[1]);
  if (!fm || typeof fm !== 'object' || Array.isArray(fm)) throw new RuleError('INVALID_FORMAT', 'Project frontmatter is not an object.');
  return { fm: fm as FM, body: m[2].trim() };
}

export class RuleError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

/** Key-order-independent JSON, so YAML re-serialisation never looks like a change. */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort()
      .filter((k) => (v as any)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canon((v as any)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** Items in `a` that aren't in `b`, counting duplicates. */
function minus(a: unknown[], b: unknown[]): unknown[] {
  const counts = new Map<string, number>();
  for (const x of b) counts.set(canon(x), (counts.get(canon(x)) || 0) + 1);
  const out: unknown[] = [];
  for (const x of a) {
    const k = canon(x);
    const n = counts.get(k) || 0;
    if (n > 0) counts.set(k, n - 1);
    else out.push(x);
  }
  return out;
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const subsOf = (fm: FM): FM[] => list(fm.subs).filter((s) => s && typeof s === 'object') as FM[];

/** Everything except the lists people add to and the money figures. */
function coreOf(fm: FM, body: string): string {
  const { updates, comments, photos, fundLog, raisedUSD, subs, ...rest } = fm;
  return canon({ ...rest, subs: subsOf(fm).map(({ raisedUSD: _r, ...s }) => s), __body: body });
}

/** Raised amount per funding target: each line item, or the project itself. */
function raisedMap(fm: FM, collapse: boolean): Map<string, number> {
  const m = new Map<string, number>();
  const subs = subsOf(fm);
  if (subs.length === 0 || collapse) {
    m.set('_', subs.length ? subs.reduce((a, s) => a + num(s.raisedUSD), 0) : num(fm.raisedUSD));
  } else {
    for (const s of subs) m.set(String(s.id), num(s.raisedUSD));
  }
  return m;
}

function budgetOf(fm: FM, target: string): number {
  if (target === '_') return subsOf(fm).length ? subsOf(fm).reduce((a, s) => a + num(s.budgetUSD), 0) : num(fm.budgetUSD);
  return num(subsOf(fm).find((s) => String(s.id) === target)?.budgetUSD);
}

const EPS = 0.005;

/**
 * Work out which permissions a change to one project file needs.
 * `before`/`after` are file texts; null means absent (create / delete).
 */
export function projectNeeds(before: string | null, after: string | null): Set<ProjectNeed> {
  const needs = new Set<ProjectNeed>();
  if (before === null && after === null) return needs;
  if (before === null) {
    needs.add('create-project');
    const { fm } = parseProject(after!);
    // A new project starts with nothing raised unless contributions are recorded.
    const raised = [...raisedMap(fm, true).values()].reduce((x, y) => x + y, 0);
    if (raised > EPS || list(fm.fundLog).length) needs.add('reverse-funds');
    return needs;
  }
  if (after === null) { needs.add('delete-project'); return needs; }

  const a = parseProject(before);
  const b = parseProject(after);

  if (coreOf(a.fm, a.body) !== coreOf(b.fm, b.body)) needs.add('edit-project');

  for (const field of ['updates', 'comments', 'photos']) {
    const added = minus(list(b.fm[field]), list(a.fm[field]));
    const removed = minus(list(a.fm[field]), list(b.fm[field]));
    if (added.length) needs.add('post');
    if (removed.length) needs.add('moderate');
  }

  // Money: every change to a raised amount must be explained by contribution
  // records added (or, for admins, removed) in the same save.
  const addedFunds = minus(list(b.fm.fundLog), list(a.fm.fundLog)) as FM[];
  const removedFunds = minus(list(a.fm.fundLog), list(b.fm.fundLog)) as FM[];
  if (addedFunds.length) needs.add('funds');
  if (removedFunds.length) needs.add('reverse-funds');
  for (const e of addedFunds) {
    if (!(num(e?.amountUSD) > 0)) throw new RuleError('INVALID_AMOUNT', 'A contribution must be a positive amount.');
  }

  const collapse = (subsOf(a.fm).length > 0) !== (subsOf(b.fm).length > 0);
  const ra = raisedMap(a.fm, collapse);
  const rb = raisedMap(b.fm, collapse);
  const explained = new Map<string, number>();
  const key = (e: FM) => (collapse || e?.subId == null || e.subId === '' ? '_' : String(e.subId));
  for (const e of addedFunds) explained.set(key(e), (explained.get(key(e)) || 0) + num(e.amountUSD));
  for (const e of removedFunds) explained.set(key(e), (explained.get(key(e)) || 0) - num(e.amountUSD));

  const targets = new Set([...ra.keys(), ...rb.keys(), ...explained.keys()]);
  for (const t of targets) {
    const delta = (rb.get(t) || 0) - (ra.get(t) || 0);
    if (Math.abs(delta - (explained.get(t) || 0)) > EPS) {
      // A raised figure changed without a matching record: only admins.
      needs.add('reverse-funds');
    }
    if ((explained.get(t) || 0) > EPS && (rb.get(t) || 0) - budgetOf(b.fm, t) > EPS) {
      throw new RuleError('EXCEEDS_BUDGET', 'This contribution would take the amount raised above the budget.');
    }
  }
  return needs;
}

// ── Authorisation ──────────────────────────────────────────────────────

export type Lookup = (path: string) => Promise<{ text: string | null; exists: boolean }>;

const deny = (code: string, message: string) => new RuleError(code, message);

/**
 * Throw a RuleError unless this person may make all of these changes.
 * `lookup` returns the file as it is now in the repo.
 */
export async function authorize(user: RoleUser, changes: FileChange[], lookup: Lookup): Promise<void> {
  const roles = rolesOf(user);
  if (roles.length === 0) throw deny('NO_ROLE', 'Your account has no role on this site yet. Ask an administrator.');
  const caps = capsOf(user);
  const isAdmin = roles.includes('admin');

  for (const c of changes) {
    const cls = classifyPath(c.path);
    const what = c.delete ? 'delete' : 'write';
    const need = (ok: boolean, msg: string) => { if (!ok) throw deny('FORBIDDEN', `${msg} (${c.path})`); };

    switch (cls.kind) {
      case 'forbidden':
        throw deny('FORBIDDEN_PATH', `The site cannot change this file: ${c.path}`);

      case 'other-content':
        need(isAdmin, 'Only administrators can change this file');
        break;

      case 'project': {
        const now = await lookup(c.path);
        const after = c.delete ? null : (c.text ?? null);
        if (!c.delete && after === null) throw deny('INVALID_CHANGE', 'Project files must be saved as text.');
        const needs = projectNeeds(now.exists ? now.text : null, after);
        // Assignment is always checked against the team as it is in the
        // repository now, never the one in this save, so an engineer can't
        // add themselves (changing the team also needs edit-projects).
        const engineers = now.exists && now.text ? safeEngineers(now.text) : [];
        if (after !== null) noNewTeamEmails(now.exists ? now.text : null, after);
        for (const n of needs) {
          if (n === 'create-project' || n === 'edit-project') need(caps.has('edit-projects'), 'Your role cannot create or edit projects');
          if (n === 'delete-project') need(isAdmin, 'Only administrators can delete a project');
          if (n === 'post') need(canPostOn(user, engineers), 'You can only post on projects you are assigned to');
          if (n === 'moderate') need(caps.has('moderate-projects'), 'Your role cannot delete notes, updates or photos');
          if (n === 'funds') need(caps.has('record-funds'), 'Only Finance can record contributions');
          if (n === 'reverse-funds') need(caps.has('reverse-funds'), 'Only administrators can reverse or adjust recorded amounts');
        }
        break;
      }

      case 'project-image': {
        if (what === 'delete') { need(caps.has('moderate-projects'), 'Your role cannot delete photos'); break; }
        const proj = await lookup(`src/content/projects/${cls.id}.md`);
        if (!proj.exists) { need(caps.has('edit-projects'), 'Your role cannot add photos to a new project'); break; }
        need(canPostOn(user, safeEngineers(proj.text || '')), 'You can only add photos to projects you are assigned to');
        break;
      }

      case 'document-meta':
      case 'document-file': {
        const now = await lookup(c.path);
        if (what === 'delete' || now.exists) need(caps.has('delete-documents'), 'Only administrators can delete or replace documents');
        else need(caps.has('upload-documents'), 'Your role cannot upload documents');
        break;
      }

      case 'team-directory':
        need(caps.has('edit-projects'), 'Your role cannot change the team directory');
        if (!c.delete) checkDirectory(c.text ?? null);
        break;

      case 'contribute-page':
      case 'contribute-image':
        need(caps.has('edit-contribute-page'), 'Your role cannot edit the "How to contribute" page');
        break;
    }
  }
}

function safeEngineers(text: string): unknown {
  try { return parseProject(text).fm.engineers; } catch { return []; }
}

const emailsOf = (engineers: unknown): Set<string> => new Set(
  list(engineers)
    .map((e: any) => (typeof e?.email === 'string' ? e.email.trim().toLowerCase() : ''))
    .filter(Boolean),
);

/**
 * Team entries link accounts by Identity user ID; the repository is public,
 * so a save may keep a legacy email that is already there (until the
 * migration removes it) but never add one.
 */
function noNewTeamEmails(before: string | null, after: string): void {
  const had = before ? emailsOf(safeEngineers(before)) : new Set<string>();
  for (const e of emailsOf(parseProject(after).fm.engineers)) {
    if (!had.has(e)) throw new RuleError('INVALID_CHANGE', 'Team members are linked by account, not by email address.');
  }
}

/** The shared team directory: JSON with a members list, and no email addresses. */
function checkDirectory(text: string | null): void {
  let data: any;
  try { data = JSON.parse(text ?? ''); } catch { throw new RuleError('INVALID_FORMAT', 'The team directory must be valid JSON.'); }
  if (!data || typeof data !== 'object' || !Array.isArray(data.members)) {
    throw new RuleError('INVALID_FORMAT', 'The team directory needs a members list.');
  }
  if (/@[^\s"]+\.[a-z]{2,}/i.test(text ?? '') || data.members.some((m: any) => m && typeof m === 'object' && 'email' in m)) {
    throw new RuleError('INVALID_CHANGE', 'The team directory must not contain email addresses.');
  }
}
