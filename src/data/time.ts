/**
 * time.ts — one place for timestamps across the site.
 *
 * Every dated item (field update, note, photo, fund record, document) carries
 * an `at` string:
 *   - "2026-11-17T15:07:12.000Z" when the exact moment is known (anything
 *     posted through the site), or
 *   - "2026-05-22" when only the day is known (migrated older content, or a
 *     date an engineer picked for an update that happened earlier).
 *
 * Relative text ("3 days ago") is NEVER stored. It's computed in the visitor's
 * browser from `at`, so it stays true however long ago the page was built.
 */
import { useEffect, useState } from 'react';
import type { Lang } from '../i18n/strings';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(at: string | undefined | null): boolean {
  return !!at && DATE_ONLY.test(at);
}

/**
 * Milliseconds since epoch, for sorting. Date-only values sort at midday UTC
 * so they land in the right day in every time zone. Unknown → 0 (sorts last).
 */
export function timeKey(at: string | undefined | null): number {
  if (!at) return 0;
  const t = Date.parse(isDateOnly(at) ? `${at}T12:00:00Z` : at);
  return Number.isNaN(t) ? 0 : t;
}

/** Today's date in the browser's time zone, as YYYY-MM-DD (for date pickers). */
export function localToday(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * The `at` to store for something dated `pickedDay` (YYYY-MM-DD, local).
 * Picking today records the exact moment; an earlier day records the day only
 * — we don't know the hour, so we don't invent one.
 */
export function atForPickedDay(pickedDay: string, now = new Date()): string {
  return pickedDay === localToday(now) ? now.toISOString() : pickedDay;
}

// Syrian Arabic month names (تشرين الثاني, not نوفمبر) and Arabic-Indic digits,
// pinned explicitly so every browser renders the same thing.
const locale = (lang: Lang) => (lang === 'ar' ? 'ar-SY-u-nu-arab' : 'en-GB');

/**
 * Absolute date, plus time when known — e.g. "17 Nov 2026, 09:07".
 * `timeZone` lets the server render a stable value (UTC) before hydration.
 */
export function formatAbsolute(at: string, lang: Lang, timeZone?: string): string {
  const k = timeKey(at);
  if (!k) return at || '';
  const d = new Date(k);
  if (isDateOnly(at)) {
    return d.toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  return d.toLocaleString(locale(lang), {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    ...(timeZone ? { timeZone } : {}),
  });
}

/** Calendar-day difference between a date-only `at` and `now` in local time. */
function daysAgoCalendar(at: string, now: Date): number {
  const [y, m, d] = at.split('-').map(Number);
  const then = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - then) / 86400000);
}

/**
 * "3 days ago" / "منذ ٣ أيام", "yesterday" / "أمس", "in 2 days" for future
 * dates. Date-only values never go finer than days ("today"), since the hour
 * isn't known.
 */
export function formatRelative(at: string, lang: Lang, now: Date): string {
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' });
  if (isDateOnly(at)) {
    const days = daysAgoCalendar(at, now);
    if (Math.abs(days) < 7) return rtf.format(-days, 'day');
    if (Math.abs(days) < 30) return rtf.format(-Math.round(days / 7), 'week');
    if (Math.abs(days) < 365) return rtf.format(-Math.round(days / 30.44), 'month');
    return rtf.format(-Math.round(days / 365.25), 'year');
  }
  const k = timeKey(at);
  if (!k) return '';
  const sec = Math.round((now.getTime() - k) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return lang === 'ar' ? 'الآن' : 'just now';
  if (abs < 3600) return rtf.format(-Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(-Math.round(sec / 3600), 'hour');
  const days = sec / 86400;
  if (Math.abs(days) < 7) return rtf.format(-Math.round(days), 'day');
  if (Math.abs(days) < 30) return rtf.format(-Math.round(days / 7), 'week');
  if (Math.abs(days) < 365) return rtf.format(-Math.round(days / 30.44), 'month');
  return rtf.format(-Math.round(days / 365.25), 'year');
}

/** Whole days from today until a YYYY-MM-DD deadline (negative once passed). */
export function daysUntil(deadline: string, now: Date): number {
  return -daysAgoCalendar(deadline, now);
}

// ── Shared clock ───────────────────────────────────────────────────────
// One timer for the whole page instead of one per timestamp. Returns null
// during the server render and the first client render (so the HTML matches
// and hydration is clean), then the current time, refreshed every minute.
let current: Date | null = null;
const listeners = new Set<(d: Date) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    current = new Date();
    setNow(current);
    listeners.add(setNow);
    if (!timer) {
      timer = setInterval(() => {
        current = new Date();
        listeners.forEach((l) => l(current!));
      }, 60_000);
    }
    return () => {
      listeners.delete(setNow);
      if (listeners.size === 0 && timer) { clearInterval(timer); timer = null; }
    };
  }, []);
  return now;
}
