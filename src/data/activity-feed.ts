/**
 * Shared activity feed used by both the council dashboard and the
 * home page footer. Derives a chronologically-sorted list of all
 * field updates, comments, and notable project status changes
 * across all projects.
 *
 * The dashboard shows everything; the home page shows the most recent
 * N entries as a "what's happening" widget below the map.
 */

import { loc, type Lang } from '../i18n/strings';

// Bilingual matches what loc() actually accepts: ar is the only required
// side, en can be undefined or empty (loc falls back to ar in that case).
type Bilingual = { ar: string; en?: string };
type Update = { date: Bilingual; author: Bilingual; body: Bilingual };
type Comment = { author: Bilingual; body: Bilingual; date?: string };
type ProjectShape = {
  id: string;
  title: Bilingual;
  status?: string;
  health?: string;
  updates?: Update[];
  comments?: Comment[];
};

export type ActivityEntry = {
  color: 'green' | 'gold' | 'blue' | 'gray';
  text: string;       // HTML-safe (entities already escaped)
  time: string;
  sortKey: number;
  projectId: string;  // for "go to project" linking
};

/**
 * Convert a stored date string to a human-readable relative label.
 * Handles ISO dates (2026-05-27), relative phrases, and raw "today"/"اليوم".
 * Always returns something suitable for display in the given language.
 */
export function formatTimeDisplay(s: string, lang: Lang): string {
  if (!s) return lang === 'ar' ? 'مؤخراً' : 'recently';
  // Already a nice relative phrase (not an ISO date) — keep it as-is
  if (!s.match(/^\d{4}-\d{2}-\d{2}/)) return s;
  // ISO date or full timestamp — convert to relative label with Latin digits
  const date = Date.parse(s.includes('T') ? s : s + 'T00:00:00Z');
  if (isNaN(date)) return s;
  const diffMs = Date.now() - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  // Sub-hour precision for very recent system events
  if (diffMins < 1)  return lang === 'ar' ? 'الآن' : 'just now';
  if (diffMins < 60) return lang === 'ar' ? `منذ ${diffMins} دقيقة` : `${diffMins} min ago`;
  if (diffHours < 24) return lang === 'ar' ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
  if (diffDays <= 0) return lang === 'ar' ? 'اليوم' : 'today';
  if (diffDays === 1) return lang === 'ar' ? 'أمس' : 'yesterday';
  if (diffDays < 7)  return lang === 'ar' ? `منذ ${diffDays} أيام` : `${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return lang === 'ar' ? 'منذ أسبوع' : '1 week ago';
  if (diffWeeks < 5)  return lang === 'ar' ? `منذ ${diffWeeks} أسابيع` : `${diffWeeks} weeks ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return lang === 'ar' ? 'منذ شهر' : '1 month ago';
  return lang === 'ar' ? `منذ ${diffMonths} أشهر` : `${diffMonths} months ago`;
}

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
      // Use EN date for sortKey — ISO timestamp if available (system entries),
      // ISO date or relative phrase otherwise.
      const sortDate = (u.date.en && u.date.en.trim()) ? u.date.en : u.date.ar;
      // Display date: always format in the reader's language, but keep
      // digits Latin even on AR pages (consistent with site-wide number style).
      const displayDate = formatTimeDisplay(sortDate, lang);
      const bodyShort = body.length > 100 ? body.slice(0, 100) + '…' : body;

      // System entries are marked with __SYSTEM__ — strip the marker and
      // render without the "by author" attribution so it reads cleanly.
      const isSystem = bodyShort.startsWith('__SYSTEM__');
      const cleanBody = isSystem ? bodyShort.replace('__SYSTEM__ ', '').replace('__SYSTEM__', '') : bodyShort;

      entries.push({
        color: isSystem ? 'gold' : 'green',
        text: isSystem
          ? (lang === 'ar'
              ? `⚙ <strong>${esc(projectName)}</strong>: ${esc(cleanBody)}`
              : `⚙ <strong>${esc(projectName)}</strong>: ${esc(cleanBody)}`)
          : (lang === 'ar'
              ? `تم رفع تحديث ميداني على مشروع <strong>${esc(projectName)}</strong> من قبل ${esc(author)}: ${esc(cleanBody)}`
              : `Field update on <strong>${esc(projectName)}</strong> by ${esc(author)}: ${esc(cleanBody)}`),
        time: displayDate,
        sortKey: parseTimeKey(sortDate),
        projectId: p.id,
      });
    });

    (p.comments || []).forEach(c => {
      const author = loc(lang, c.author);
      const body = loc(lang, c.body);
      const bodyShort = body.length > 100 ? body.slice(0, 100) + '…' : body;
      const rawDate = c.date || '';
      const displayDate = rawDate
        ? formatTimeDisplay(rawDate, lang)
        : (lang === 'ar' ? 'مؤخراً' : 'recently');
      entries.push({
        color: 'blue',
        text: lang === 'ar'
          ? `تعليق جديد على <strong>${esc(projectName)}</strong> من ${esc(author)}: ${esc(bodyShort)}`
          : `New comment on <strong>${esc(projectName)}</strong> by ${esc(author)}: ${esc(bodyShort)}`,
        time: displayDate,
        sortKey: parseTimeKey(rawDate),
        projectId: p.id,
      });
    });

    // Track notable project status changes so they appear in the feed.
    // We use the most recent update's date as a proxy for when the
    // status changed (since we don't store a separate statusChangedAt field).
    // Only completed and stalled states generate a feed event.
    if (p.status === 'completed') {
      const latestUpdate = (p.updates || [])[0];
      const sortDate = latestUpdate
        ? ((latestUpdate.date.en && latestUpdate.date.en.trim()) ? latestUpdate.date.en : latestUpdate.date.ar)
        : '';
      const displayDate = sortDate
        ? formatTimeDisplay(sortDate, lang)
        : (lang === 'ar' ? 'مؤخراً' : 'recently');
      entries.push({
        color: 'gold',
        text: lang === 'ar'
          ? `✓ اكتمل مشروع <strong>${esc(projectName)}</strong> — شكراً لجميع المتبرعين والمهندسين`
          : `✓ Project <strong>${esc(projectName)}</strong> completed — thank you to all donors and engineers`,
        time: displayDate,
        // Place slightly before latest update so it doesn't override the update
        sortKey: parseTimeKey(sortDate) - 1,
        projectId: p.id,
      });
    } else if (p.health === 'stalled') {
      entries.push({
        color: 'gray',
        text: lang === 'ar'
          ? `⚠ مشروع <strong>${esc(projectName)}</strong> في وضع التعثّر — يحتاج متابعة`
          : `⚠ Project <strong>${esc(projectName)}</strong> is stalled — needs attention`,
        time: lang === 'ar' ? 'مؤخراً' : 'recently',
        sortKey: Date.now() - 3 * 24 * 60 * 60 * 1000, // treat as ~3 days ago
        projectId: p.id,
      });
    }
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
  // Full ISO timestamp (2026-05-27T14:32:00.000Z) — most precise, used for system entries
  if (s.includes('T')) {
    const t = Date.parse(s);
    if (!isNaN(t)) return t;
  }
  // ISO date only (2026-05-27)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const t = Date.parse(s);
    if (!isNaN(t)) return t;
  }
  const now = Date.now();
  const lower = s.toLowerCase();
  const match = s.match(/(\d+|[٠١٢٣٤٥٦٧٨٩]+)/);
  // Default to 1 — Arabic singular phrases like "منذ يوم", "منذ أسبوع",
  // "منذ شهر" carry no digit but mean exactly 1 unit. Using 0 collapses
  // them all to `now` and breaks sort order.
  const num = match ? toArabicDigitInt(match[1]) : 1;

  if (lower.includes('minute') || s.includes('دقيق') || s.includes('دقائق') || s.includes('دقيقة')) {
    return now - num * 60 * 1000;
  }
  if (lower.includes('hour') || s.includes('ساعتين') || s.includes('ساعة') || s.includes('ساعات')) {
    const n = s.includes('ساعتين') ? 2 : num;
    return now - n * 60 * 60 * 1000;
  }
  if (lower.includes('day') || s.includes('يومين') || s.includes('يوم') || s.includes('أيام')) {
    const n = s.includes('يومين') ? 2 : num;
    return now - n * 24 * 60 * 60 * 1000;
  }
  if (lower.includes('week') || s.includes('أسبوعين') || s.includes('أسبوع') || s.includes('أسابيع')) {
    const n = s.includes('أسبوعين') ? 2 : num;
    return now - n * 7 * 24 * 60 * 60 * 1000;
  }
  if (lower.includes('month') || s.includes('شهرين') || s.includes('شهر') || s.includes('أشهر')) {
    const n = s.includes('شهرين') ? 2 : num;
    return now - n * 30 * 24 * 60 * 60 * 1000;
  }
  if (lower.includes('today') || s.includes('اليوم')) return now;
  if (lower.includes('yesterday') || s.includes('أمس')) return now - 24 * 60 * 60 * 1000;
  if (lower.includes('recently') || s.includes('مؤخراً') || s.includes('مؤخرا')) {
    return now - 2 * 24 * 60 * 60 * 1000;
  }
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
