/**
 * Save service tests: linking engineers by Identity user ID and the staff
 * list. Runs the real service (netlify/lib/service.ts) against an in-memory
 * GitHub and a fake Identity admin API. Run with `npm test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { handle, type ChunkStore } from '../netlify/lib/service';
import type { GitHub } from '../netlify/lib/github';
import { isAssigned, LEGACY_EMAIL_MATCH } from '../src/data/roles';

const PROJECT = 'src/content/projects/demo.md';

function project(engineers: string): string {
  return `---
id: "demo"
category: "roads"
status: "active"
health: "healthy"
title:
  ar: "مشروع"
  en: "Demo"
location: { ar: "داريا", en: "Darayya" }
description: { ar: "وصف", en: "Desc" }
budgetUSD: 1000
raisedUSD: 0
engineers:
${engineers}
comments: []
---
`;
}

const LINKED_TEAM = `  - name: { ar: "م. رنا", en: "Eng. Rana" }
    role: { ar: "مهندسة", en: "Engineer" }
    userId: "user-rana"`;

/** A tiny in-memory repository with the same surface as github.ts. */
function fakeGitHub(files: Record<string, string>) {
  let n = 0;
  const blobs = new Map<string, string>();
  const shaOf = (text: string) => {
    for (const [k, v] of blobs) if (v === text) return k;
    const sha = (++n).toString(16).padStart(40, '0');
    blobs.set(sha, text);
    return sha;
  };
  const tree = new Map<string, string>(Object.entries(files).map(([p, t]) => [p, shaOf(t)]));
  const commits: string[] = [];
  const gh: GitHub = {
    head: async () => 'head',
    file: async (path) => (tree.has(path) ? { sha: tree.get(path)!, text: blobs.get(tree.get(path)!) ?? null } : null),
    createBlob: async (content) => shaOf(content),
    treeOf: async () => 'tree',
    createTree: async (_base, entries) => {
      for (const e of entries) e.sha ? tree.set(e.path, e.sha) : tree.delete(e.path);
      return 'tree2';
    },
    createCommit: async (message) => { commits.push(message); return 'c'.repeat(40); },
    moveBranch: async () => {},
  } as GitHub;
  return { gh, commits, text: (p: string) => blobs.get(tree.get(p)!) };
}

const chunks: ChunkStore = { set: async () => {}, get: async () => null, delete: async () => {} };

const engineer = (sub: string, email: string) => ({ sub, email, app_metadata: { roles: ['engineer'] }, user_metadata: { full_name: 'Someone' } });
const pm = { sub: 'user-pm', email: 'pm@example.org', app_metadata: { roles: ['project-manager'] } };

function postNote(text: string): string {
  return text.replace('comments: []', 'comments:\n  - author: { ar: "رنا", en: "Rana" }\n    body: { ar: "ملاحظة", en: "A note" }\n    at: "2026-11-25T10:00:00.000Z"');
}

test('an engineer linked by userId can post on that project', async () => {
  const before = project(LINKED_TEAM);
  const repo = fakeGitHub({ [PROJECT]: before });
  const r = await handle({
    user: engineer('user-rana', 'rana.personal@example.com'), gh: repo.gh, chunks,
    body: { action: 'commit', message: 'Add note', changes: [{ path: PROJECT, text: postNote(before) }] },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(repo.text(PROJECT)!, /A note/);
  assert.doesNotMatch(repo.commits[0], /@/, 'commit message must not contain an email');
});

test('an unlinked engineer is refused by the save service', async () => {
  const before = project(LINKED_TEAM);
  const repo = fakeGitHub({ [PROJECT]: before });
  const r = await handle({
    user: engineer('user-someone-else', 'other@example.com'), gh: repo.gh, chunks,
    body: { action: 'commit', message: 'Add note', changes: [{ path: PROJECT, text: postNote(before) }] },
  });
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'FORBIDDEN');
  assert.equal(repo.commits.length, 0);
});

test('an engineer cannot add themselves to a team and post in the same save', async () => {
  const before = project(LINKED_TEAM);
  const repo = fakeGitHub({ [PROJECT]: before });
  const after = postNote(before).replace('userId: "user-rana"', 'userId: "user-rana"\n  - name: { ar: "أنا", en: "Me" }\n    role: { ar: "", en: "" }\n    userId: "user-intruder"');
  const r = await handle({
    user: engineer('user-intruder', 'intruder@example.com'), gh: repo.gh, chunks,
    body: { action: 'commit', message: 'x', changes: [{ path: PROJECT, text: after }] },
  });
  assert.equal(r.status, 403);
  assert.equal(repo.commits.length, 0);
});

test('team entries cannot gain an email address', async () => {
  const before = project(LINKED_TEAM);
  const repo = fakeGitHub({ [PROJECT]: before });
  const after = before.replace('userId: "user-rana"', 'userId: "user-rana"\n    email: "rana.personal@example.com"');
  const r = await handle({ user: pm, gh: repo.gh, chunks, body: { action: 'commit', message: 'x', changes: [{ path: PROJECT, text: after }] } });
  assert.equal(r.status, 422);
  assert.equal(r.body.error, 'INVALID_CHANGE');
});

test('team directory: project managers may write it, engineers may not, emails refused', async () => {
  const path = 'src/content/team/directory.json';
  const good = JSON.stringify({ members: [{ id: 'm-1', name: { ar: 'رنا', en: 'Rana' }, role: { ar: '', en: '' }, userId: 'user-rana' }] });
  const ok = await handle({ user: pm, gh: fakeGitHub({}).gh, chunks, body: { action: 'commit', message: 'x', changes: [{ path, text: good }] } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const eng = await handle({ user: engineer('user-rana', 'r@example.com'), gh: fakeGitHub({}).gh, chunks, body: { action: 'commit', message: 'x', changes: [{ path, text: good }] } });
  assert.equal(eng.status, 403);
  const withEmail = JSON.stringify({ members: [{ id: 'm-1', name: { ar: 'رنا', en: '' }, role: { ar: '', en: '' }, phone: 'rana@example.com' }] });
  const bad = await handle({ user: pm, gh: fakeGitHub({}).gh, chunks, body: { action: 'commit', message: 'x', changes: [{ path, text: withEmail }] } });
  assert.equal(bad.status, 422);
});

// ── Staff action ──────────────────────────────────────────────────────

const IDENTITY_USERS = Array.from({ length: 130 }, (_, i) => ({
  id: `u-${i}`,
  email: `person${i}@example.com`,
  app_metadata: { roles: i % 3 === 0 ? ['engineer'] : i % 3 === 1 ? ['project-manager', 'finance'] : ['secretary'] },
  user_metadata: { full_name: i === 0 ? '' : i === 3 ? 'someone@example.com' : `Person ${i}` },
  created_at: '2026-01-01',
}));

function fakeIdentityFetch(calls: string[]): typeof fetch {
  return (async (url: string, init: any) => {
    calls.push(url);
    assert.equal(init.headers.Authorization, 'Bearer admin-token');
    const u = new URL(url);
    const page = Number(u.searchParams.get('page'));
    const per = Number(u.searchParams.get('per_page'));
    const users = IDENTITY_USERS.slice((page - 1) * per, page * per);
    return new Response(JSON.stringify({ aud: '', users }), { status: 200 });
  }) as any;
}

const identity = { url: 'https://example.netlify.app/.netlify/identity', token: 'admin-token' };

test('the staff action never returns an email field', async () => {
  const calls: string[] = [];
  const r = await handle({ user: pm, gh: fakeGitHub({}).gh, chunks, identity, fetch: fakeIdentityFetch(calls), body: { action: 'staff', lang: 'en' } });
  assert.equal(r.status, 200);
  assert.equal(calls.length, 2, 'paginates through every page');
  assert.ok(calls[0].startsWith(`${identity.url}/admin/users?`));
  const staff = r.body.staff as any[];
  // engineers (i%3==0) + project managers (i%3==1) among 130 users; secretaries excluded
  assert.equal(staff.length, IDENTITY_USERS.filter((u) => !u.app_metadata.roles.includes('secretary')).length);
  for (const s of staff) assert.deepEqual(Object.keys(s).sort(), ['id', 'name', 'roles']);
  assert.ok(!staff.some((s) => s.roles.includes('finance')), 'only engineer / project-manager roles are listed');
  assert.doesNotMatch(JSON.stringify(r.body), /@/, 'no email anywhere in the reply');
  assert.equal(staff.find((s) => s.id === 'u-0').name, 'Unnamed account');
  assert.equal(staff.find((s) => s.id === 'u-3').name, 'Unnamed account');
  const ar = await handle({ user: pm, gh: fakeGitHub({}).gh, chunks, identity, fetch: fakeIdentityFetch([]), body: { action: 'staff', lang: 'ar' } });
  assert.equal((ar.body.staff as any[]).find((s) => s.id === 'u-0').name, 'حساب بلا اسم');
});

test('a non–project manager gets 403 from the staff action', async () => {
  for (const roles of [['engineer'], ['finance'], ['secretary'], ['team-manager']]) {
    const calls: string[] = [];
    const r = await handle({
      user: { sub: 'x', email: 'x@example.com', app_metadata: { roles } }, gh: fakeGitHub({}).gh, chunks,
      identity, fetch: fakeIdentityFetch(calls), body: { action: 'staff', resolveEmails: ['person0@example.com'] },
    });
    assert.equal(r.status, 403, roles.join());
    assert.equal(calls.length, 0, 'Identity is never called');
  }
});

test('staff action: resolveEmails maps known addresses to user IDs', async () => {
  const r = await handle({
    user: pm, gh: fakeGitHub({}).gh, chunks, identity, fetch: fakeIdentityFetch([]),
    body: { action: 'staff', resolveEmails: ['Person3@Example.com', 'nobody@example.com'] },
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.matches, { 'person3@example.com': 'u-3' });
  for (const s of r.body.staff as any[]) assert.equal('email' in s, false);
});

test('staff action: a failing Identity API gives a clear error code', async () => {
  const failing = (async () => new Response('nope', { status: 500 })) as any;
  const r = await handle({ user: pm, gh: fakeGitHub({}).gh, chunks, identity, fetch: failing, body: { action: 'staff' } });
  assert.equal(r.status, 502);
  assert.equal(r.body.error, 'STAFF_UNAVAILABLE');
  const none = await handle({ user: pm, gh: fakeGitHub({}).gh, chunks, identity: undefined, body: { action: 'staff' } });
  assert.equal(none.body.error, 'STAFF_UNAVAILABLE');
});

// ── isAssigned ────────────────────────────────────────────────────────

test('isAssigned: browser user id and service sub both match userId', () => {
  const team = [{ name: { ar: 'x' }, userId: 'abc' }];
  assert.equal(isAssigned({ id: 'abc', email: 'a@b.c' }, team), true);
  assert.equal(isAssigned({ sub: 'abc' }, team), true);
  assert.equal(isAssigned({ sub: 'zzz', email: 'a@b.c' }, team), false);
  // A linked entry never falls back to email.
  assert.equal(isAssigned({ sub: 'zzz', email: 'a@b.c' }, [{ userId: 'abc', email: 'a@b.c' }]), false);
});

test('migration status: legacy email fallback is on only while project files still hold emails', () => {
  const dir = 'src/content/projects';
  const withEmails = readdirSync(dir).filter((f) => /^\s+email:/m.test(readFileSync(`${dir}/${f}`, 'utf8')));
  if (withEmails.length === 0) {
    assert.equal(LEGACY_EMAIL_MATCH, false, 'No project file has a team email any more: set LEGACY_EMAIL_MATCH to false in src/data/roles.ts');
  } else {
    console.log(`# ${withEmails.length} project file(s) still use team emails; run "Link existing project teams" on /ar/admin/team/`);
  }
});

// ── Migration (browser helper → save service, end to end) ────────────

test('"Link existing project teams" links by userId, drops every email, in one commit', async () => {
  const { linkProjectTeams } = await import('../src/data/project-file-edit');
  const { listStaff } = await import('../src/data/repo');
  const a = 'src/content/projects/alpha.md';
  const b = 'src/content/projects/beta.md';
  const c = 'src/content/projects/gamma.md';
  const repo = fakeGitHub({
    [a]: project(`  - name: { ar: "س", en: "P3" }\n    role: { ar: "", en: "" }\n    email: "Person3@example.com"`),
    [b]: project(`  - name: { ar: "ل", en: "Lost" }\n    role: { ar: "", en: "" }\n    phone: "123"\n    email: "nobody@example.com"`),
    [c]: project(LINKED_TEAM),
  });
  const admin = { sub: 'user-admin', email: 'admin@example.org', app_metadata: { roles: ['admin'] }, user_metadata: { full_name: 'Admin' } };
  (globalThis as any).window = { netlifyIdentity: { currentUser: () => ({ jwt: async () => 'jwt' }) } };
  const realFetch = globalThis.fetch;
  (globalThis as any).fetch = async (_url: string, init: any) => {
    const r = await handle({ user: admin, gh: repo.gh, chunks, identity, fetch: fakeIdentityFetch([]), body: JSON.parse(init.body) });
    return new Response(JSON.stringify(r.body), { status: r.status });
  };
  try {
    const result = await linkProjectTeams({
      projectIds: ['alpha', 'beta', 'gamma'],
      resolve: async (emails) => (await listStaff('en', emails)).matches,
      message: 'Link project teams to staff accounts',
    });
    assert.deepEqual(result, { projects: 2, linked: 1, unmatched: 1 });
    assert.equal(repo.commits.length, 1, 'one commit for all project files');
    assert.doesNotMatch(repo.commits[0], /@/);
    for (const p of [a, b, c]) assert.doesNotMatch(repo.text(p)!, /email|@/, p);
    assert.match(repo.text(a)!, /userId: "u-3"/);
    assert.match(repo.text(b)!, /phone: "123"/);
    assert.equal(repo.text(c), project(LINKED_TEAM), 'files without emails are untouched');
  } finally {
    (globalThis as any).fetch = realFetch;
    delete (globalThis as any).window;
  }
});

// ── Government funding ─────────────────────────────────────────────────

const finance = { sub: 'user-fin', email: 'fin@example.org', app_metadata: { roles: ['finance'] } };

/** The demo project (budget 1000, nothing raised) with a govFunding entry. */
function withGov(text: string, gov: string): string {
  return text.replace('raisedUSD: 0\n', `raisedUSD: 0\ngovFunding: ${gov}\n`);
}

/** Record a contribution of `amount` with its fundLog entry. */
function contribute(text: string, amount: number): string {
  return text.replace('raisedUSD: 0\n', `raisedUSD: ${amount}\nfundLog:\n  - at: "2026-11-27T10:00:00.000Z"\n    amountUSD: ${amount}\n`);
}

async function saveAs(user: object, before: string, after: string) {
  const repo = fakeGitHub({ [PROJECT]: before });
  const r = await handle({ user, gh: repo.gh, chunks, body: { action: 'commit', message: 'Save', changes: [{ path: PROJECT, text: after }] } });
  return { r, repo };
}

test('government funding: a fully funded project takes no contributions', async () => {
  const before = withGov(project(LINKED_TEAM), '{ type: "full" }');
  const { r, repo } = await saveAs(finance, before, contribute(before, 100));
  assert.equal(r.status, 422);
  assert.equal(r.body.error, 'GOV_FUNDED');
  assert.equal(repo.commits.length, 0);
});

test('government funding: contributions only fill what the government does not cover', async () => {
  const before = withGov(project(LINKED_TEAM), '{ type: "partial", amountUSD: 700 }');
  const tooMuch = await saveAs(finance, before, contribute(before, 301));
  assert.equal(tooMuch.r.status, 422);
  assert.equal(tooMuch.r.body.error, 'EXCEEDS_BUDGET');
  const fits = await saveAs(finance, before, contribute(before, 300));
  assert.equal(fits.r.status, 200, JSON.stringify(fits.r.body));
});

test('government funding: Finance can record and raise the amount, but not lower it', async () => {
  const none = project(LINKED_TEAM);
  const set = await saveAs(finance, none, withGov(none, '{ type: "partial", amountUSD: 400 }'));
  assert.equal(set.r.status, 200, JSON.stringify(set.r.body));

  const at400 = withGov(none, '{ type: "partial", amountUSD: 400 }');
  const raise = await saveAs(finance, at400, withGov(none, '{ type: "partial", amountUSD: 600 }'));
  assert.equal(raise.r.status, 200, JSON.stringify(raise.r.body));

  const lower = await saveAs(finance, at400, withGov(none, '{ type: "partial", amountUSD: 100 }'));
  assert.equal(lower.r.status, 403);
  const full = await saveAs(finance, at400, withGov(none, '{ type: "full" }'));
  assert.equal(full.r.status, 403, 'marking a project fully funded is a project edit');
});

test('government funding: a project manager can lower the amount', async () => {
  const none = project(LINKED_TEAM);
  const { r } = await saveAs(pm, withGov(none, '{ type: "partial", amountUSD: 400 }'), withGov(none, '{ type: "partial", amountUSD: 100 }'));
  assert.equal(r.status, 200, JSON.stringify(r.body));
});

test('government funding: the government amount plus contributions cannot pass the budget', async () => {
  const raised = contribute(project(LINKED_TEAM), 600);
  const after = contribute(withGov(project(LINKED_TEAM), '{ type: "partial", amountUSD: 401 }'), 600);
  assert.match(after, /amountUSD: 401/);
  const { r } = await saveAs(finance, raised, after);
  assert.equal(r.status, 422);
  assert.equal(r.body.error, 'EXCEEDS_BUDGET');
});

// ── Government share per line item ──────────────────────────────────────
import { govBySub, splitByNeed } from '../src/data/gov-funding';

test('government share: an older project amount is spread over items by what each still needs', () => {
  const subs = [
    { id: 'a', budgetUSD: 28000, raisedUSD: 5500 },
    { id: 'b', budgetUSD: 18000, raisedUSD: 3000 },
    { id: 'c', budgetUSD: 12000, raisedUSD: 1200 },
  ];
  const shares = govBySub({ govFunding: { type: 'partial', amountUSD: 30000 }, subs });
  assert.equal(Object.values(shares).reduce((a, b) => a + b, 0), 30000);
  for (const s of subs) assert.ok(s.raisedUSD + shares[s.id] <= s.budgetUSD);
  assert.ok(shares.a > shares.b && shares.b > shares.c);
  assert.deepEqual(splitByNeed(subs, 999999), { a: 22500, b: 15000, c: 10800 });
});

test('government share: saved per-item shares are used as they are; full covers what each item needs', () => {
  const subs = [
    { id: 'a', budgetUSD: 1000, raisedUSD: 100, govUSD: 400 },
    { id: 'b', budgetUSD: 500, raisedUSD: 0 },
  ];
  assert.deepEqual(govBySub({ govFunding: { type: 'partial', amountUSD: 400 }, subs }), { a: 400, b: 0 });
  assert.deepEqual(govBySub({ govFunding: { type: 'full' }, subs }), { a: 900, b: 500 });
});

/** A project with two line items (a: 600 budget, 100 raised; b: 400 budget). */
function withItems(gov: string, a: string = '', b: string = '', raisedA = 100, logA = ''): string {
  return project(LINKED_TEAM)
    .replace('budgetUSD: 1000\nraisedUSD: 0\n', `budgetUSD: 1000\nraisedUSD: ${raisedA}\n${gov ? `govFunding: ${gov}\n` : ''}${logA}subs:
  - { id: "a", title: { ar: "أ", en: "A" }, budgetUSD: 600, raisedUSD: ${raisedA}${a} }
  - { id: "b", title: { ar: "ب", en: "B" }, budgetUSD: 400, raisedUSD: 0${b} }
`);
}

test('government share per item: Finance can raise one item on an older file (spread saved per item)', async () => {
  // Older file: 300 for the project. Spread by need (500 / 400): a 167, b 133.
  const before = withItems('{ type: "partial", amountUSD: 300 }');
  const after = withItems('{ type: "partial", amountUSD: 333 }', ', govUSD: 200', ', govUSD: 133');
  const { r } = await saveAs(finance, before, after);
  assert.equal(r.status, 200, JSON.stringify(r.body));
});

test('government share per item: Finance cannot move money from one item to another', async () => {
  const before = withItems('{ type: "partial", amountUSD: 300 }', ', govUSD: 200', ', govUSD: 100');
  const after = withItems('{ type: "partial", amountUSD: 350 }', ', govUSD: 300', ', govUSD: 50');
  const { r } = await saveAs(finance, before, after);
  assert.equal(r.status, 403);
  const pmSave = await saveAs(pm, before, after);
  assert.equal(pmSave.r.status, 200, 'a project manager may re-allocate');
});

test('government share per item: an item cannot be funded past its own budget', async () => {
  const before = withItems('{ type: "partial", amountUSD: 100 }', ', govUSD: 100', '');
  const after = withItems('{ type: "partial", amountUSD: 501 }', ', govUSD: 501', '');
  const { r } = await saveAs(finance, before, after);
  assert.equal(r.status, 422);
  assert.equal(r.body.error, 'EXCEEDS_BUDGET');
});

test('government share per item: a contribution cannot take an item past its budget', async () => {
  const log = (n: number) => `fundLog:\n  - { at: "2026-11-27T10:00:00.000Z", amountUSD: ${n}, subId: "a" }\n`;
  const before = withItems('{ type: "partial", amountUSD: 450 }', ', govUSD: 450', '', 100, '');
  const ok = withItems('{ type: "partial", amountUSD: 450 }', ', govUSD: 450', '', 150, log(50));
  assert.equal((await saveAs(finance, before, ok)).r.status, 200);
  const over = withItems('{ type: "partial", amountUSD: 450 }', ', govUSD: 450', '', 151, log(51));
  const { r } = await saveAs(finance, before, over);
  assert.equal(r.status, 422);
  assert.equal(r.body.error, 'EXCEEDS_BUDGET');
});
