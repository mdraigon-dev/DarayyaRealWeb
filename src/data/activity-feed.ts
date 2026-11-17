/**
 * activity-feed.ts
 *
 * One chronological log of everything happening across the platform, shared
 * by the home page and the council dashboard:
 *   - field updates (with how many photos were posted alongside them)
 *   - notes
 *   - photos that weren't posted as part of an update
 *   - contributions recorded by admins (fundLog)
 *   - documents and reports published under Circulars
 *
 * Entries carry raw data, not pre-translated text: ordering comes from the
 * real `at` timestamps, so the Arabic and English pages always agree, and
 * "3 days ago" is computed when the entry is shown (see TimeStamp).
 *
 * Each entry also carries `ref` — exactly what an admin delete needs to remove
 * the underlying record.
 */
import { timeKey } from './time';
import type { FundEntry } from './project-file-edit';

type Bilingual = { ar: string; en?: string };

export type ActivityProject = {
  id: string;
  title: Bilingual;
  subs?: Array<{ id: string; title?: Bilingual }>;
  updates?: Array<{ at?: string; date?: Bilingual; author: Bilingual; body: Bilingual }>;
  comments?: Array<{ at?: string; date?: string; author: Bilingual; body: Bilingual }>;
  photos?: Array<{ at?: string; date?: Bilingual; caption: Bilingual; src?: string; scene?: string; status: string }>;
  fundLog?: FundEntry[];
};

export type ActivityDocument = {
  id: string;
  title: Bilingual;
  category: string;
  date: string;
  at?: string;
  file: string;
  source?: string;
};

export type ActivityKind = 'update' | 'note' | 'photo' | 'funds' | 'document';

export type ActivityRef =
  | { kind: 'item'; projectId: string; field: 'updates' | 'comments' | 'photos'; item: unknown }
  | { kind: 'fund'; projectId: string; entry: FundEntry }
  | { kind: 'document'; source: string; file: string };

export type ActivityEntry = {
  key: string;
  kind: ActivityKind;
  /** ISO timestamp or date; undefined only for legacy items with no date */
  at?: string;
  /** Legacy free-text date, shown only when there is no `at` */
  legacyDate?: Bilingual;
  sortKey: number;
  projectId?: string;
  projectTitle?: Bilingual;
  author?: Bilingual;
  body?: Bilingual;
  /** Photos posted together with an update */
  photoCount?: number;
  amountUSD?: number;
  subTitle?: Bilingual;
  by?: string;
  docTitle?: Bilingual;
  docCategory?: string;
  docId?: string;
  ref: ActivityRef;
};

/** A photo was posted with an update when both carry the same exact moment. */
const sameMoment = (a?: string, b?: string) => !!a && !!b && a.includes('T') && a === b;

export function buildActivityFeed(projects: ActivityProject[], documents: ActivityDocument[] = []): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const p of projects) {
    const base = { projectId: p.id, projectTitle: p.title };
    const photos = p.photos || [];
    const updates = p.updates || [];

    updates.forEach((u, i) => {
      entries.push({
        ...base,
        key: `${p.id}:u:${i}:${u.at || ''}`,
        kind: 'update',
        at: u.at,
        legacyDate: u.at ? undefined : u.date,
        sortKey: timeKey(u.at),
        author: u.author,
        body: u.body,
        photoCount: photos.filter((ph) => sameMoment(ph.at, u.at)).length || undefined,
        ref: { kind: 'item', projectId: p.id, field: 'updates', item: u },
      });
    });

    (p.comments || []).forEach((c, i) => {
      const at = c.at || c.date;
      entries.push({
        ...base,
        key: `${p.id}:c:${i}:${at || ''}`,
        kind: 'note',
        at,
        sortKey: timeKey(at),
        author: c.author,
        body: c.body,
        ref: { kind: 'item', projectId: p.id, field: 'comments', item: c },
      });
    });

    // Photos posted with an update are already counted on that update.
    photos.forEach((ph, i) => {
      if (updates.some((u) => sameMoment(ph.at, u.at))) return;
      entries.push({
        ...base,
        key: `${p.id}:p:${i}:${ph.at || ''}`,
        kind: 'photo',
        at: ph.at,
        legacyDate: ph.at ? undefined : ph.date,
        sortKey: timeKey(ph.at),
        body: ph.caption,
        ref: { kind: 'item', projectId: p.id, field: 'photos', item: ph },
      });
    });

    (p.fundLog || []).forEach((f, i) => {
      const sub = f.subId ? (p.subs || []).find((s) => s.id === f.subId) : undefined;
      entries.push({
        ...base,
        key: `${p.id}:f:${i}:${f.at}`,
        kind: 'funds',
        at: f.at,
        sortKey: timeKey(f.at),
        amountUSD: f.amountUSD,
        subTitle: sub?.title,
        by: f.by,
        ref: { kind: 'fund', projectId: p.id, entry: f },
      });
    });
  }

  for (const d of documents) {
    const at = d.at || d.date;
    entries.push({
      key: `doc:${d.id}`,
      kind: 'document',
      at,
      sortKey: timeKey(at),
      docTitle: d.title,
      docCategory: d.category,
      docId: d.id,
      ref: { kind: 'document', source: d.source || `${d.id}.md`, file: d.file },
    });
  }

  // Newest first; ties keep a stable, language-independent order.
  entries.sort((a, b) => b.sortKey - a.sortKey || a.key.localeCompare(b.key));
  return entries;
}

/** The most recent dated thing on a project: update, note, photo or recorded contribution. */
export function lastActivityAt(p: ActivityProject): string | undefined {
  let best: string | undefined;
  let bestKey = 0;
  const consider = (at?: string) => { const k = timeKey(at); if (k > bestKey) { bestKey = k; best = at; } };
  (p.updates || []).forEach((u) => consider(u.at));
  (p.comments || []).forEach((c) => consider(c.at || c.date));
  (p.photos || []).forEach((ph) => consider(ph.at));
  (p.fundLog || []).forEach((f) => consider(f.at));
  return best;
}
