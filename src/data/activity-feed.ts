/**
 * Shared activity feed used by both the council dashboard and the
 * home page footer. Derives a chronologically-sorted list of all
 * field updates and comments across all projects.
 *
 * The dashboard shows everything; the home page shows the most recent
 * N entries as a "what's happening" widget below the map.
 */

import { loc, type Lang } from '../i18n/strings';

type Bilingual = { ar: string; en: string };
type Update = { date: Bilingual; author: Bilingual; body: Bilingual };
type Comment = { author: Bilingual; body: Bilingual; date?: string };
type ProjectShape = {
  id: string;
  title: Bilingual;
  updates?: Update[];
  comments?: Comment[];
};

export type ActivityEntry = {
  color: 'green' | 'gold' | 'blue';
  text: string;       // HTML-safe (entities already escaped)
  time: string;
  sortKey: number;
  projectId: string;  // for "go to project" linking
};

/**
 * Build the list, newest first. Pass the maximum number of entries
 * you want; defaults to 100 (effectively all of them for the dashboard).
 */
export function buildActivityFeed(projects: ProjectShape[], lang: Lang, limit = 100): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  projects.forEach(p => {
    const projectName = loc(lang, p.title);

    (p.updates || []).forEach(u => {
      const author = loc(lang, u.author);
      const body = loc(lang, u.body);
      const date = loc(lang, u.date);
      const bodyShort = body.length > 100 ? body.slice(0, 100) + '…' : body;
      entries.push({
        color: 'green',
        text: lang === 'ar'
          ? `تم رفع تحديث ميداني على مشروع <strong>${esc(projectName)}</strong> من قبل ${esc(author)}: ${esc(bodyShort)}`
          : `Field update on <strong>${esc(projectName)}</strong> by ${esc(author)}: ${esc(bodyShort)}`,
        time: date,
        sortKey: parseTimeKey(date),
        projectId: p.id,
      });
    });

    (p.comments || []).forEach(c => {
      const author = loc(lang, c.author);
      const body = loc(lang, c.body);
      const bodyShort = body.length > 100 ? body.slice(0, 100) + '…' : body;
      const time = c.date || (lang === 'ar' ? 'مؤخراً' : 'recently');
      entries.push({
        color: 'blue',
        text: lang === 'ar'
          ? `تعليق جديد على <strong>${esc(projectName)}</strong> من ${esc(author)}: ${esc(bodyShort)}`
          : `New comment on <strong>${esc(projectName)}</strong> by ${esc(author)}: ${esc(bodyShort)}`,
        time,
        sortKey: parseTimeKey(c.date || ''),
        projectId: p.id,
      });
    });
  });

  entries.sort((a, b) => b.sortKey - a.sortKey);
  return entries.slice(0, limit);
}

/**
 * parseTimeKey turns mixed-format date strings into a sortable
 * timestamp. Supports ISO dates (2026-05-26), relative English/Arabic
 * phrases ("3 days ago" / "منذ ٣ أيام"), and a few common words.
 */
export function parseTimeKey(s: string): number {
  if (!s) return 0;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const t = Date.parse(s);
    if (!isNaN(t)) return t;
  }
  const now = Date.now();
  const lower = s.toLowerCase();
  const match = s.match(/(\d+|[٠١٢٣٤٥٦٧٨٩]+)/);
  const num = match ? toArabicDigitInt(match[1]) : 0;

  if (lower.includes('minute') || s.includes('دقيق') || s.includes('دقائق')) {
    return now - num * 60 * 1000;
  }
  if (lower.includes('hour') || s.includes('ساعة') || s.includes('ساعات')) {
    return now - num * 60 * 60 * 1000;
  }
  if (lower.includes('day') || s.includes('يوم') || s.includes('أيام')) {
    return now - num * 24 * 60 * 60 * 1000;
  }
  if (lower.includes('week') || s.includes('أسبوع')) {
    return now - num * 7 * 24 * 60 * 60 * 1000;
  }
  if (lower.includes('today') || s.includes('اليوم')) return now;
  if (lower.includes('yesterday') || s.includes('أمس')) return now - 24 * 60 * 60 * 1000;
  return 0;
}

function toArabicDigitInt(s: string): number {
  const ascii = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const n = parseInt(ascii, 10);
  return isNaN(n) ? 0 : n;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
