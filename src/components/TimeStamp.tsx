import { formatAbsolute, formatRelative, useNow } from '../data/time';
import type { Lang } from '../i18n/strings';

type Props = {
  at?: string;
  lang: Lang;
  /** 'full' = "3 days ago · 17 Nov 2026, 09:07"; 'relative' = "3 days ago"; 'date' = absolute only */
  mode?: 'full' | 'relative' | 'date';
  /** Shown when the item has no timestamp at all */
  fallback?: string;
  className?: string;
};

/**
 * A timestamp that stays correct after the page is built.
 *
 * The server can't know when someone will read the page, so it renders only
 * the absolute date (in UTC). Once the page is running in the visitor's
 * browser, this switches to their local time and adds the live relative part
 * ("3 days ago"), refreshed every minute by the shared clock.
 */
export default function TimeStamp({ at, lang, mode = 'full', fallback = '', className = 'timestamp' }: Props) {
  const now = useNow();
  if (!at) return fallback ? <span className={className}>{fallback}</span> : null;

  const absolute = now ? formatAbsolute(at, lang) : formatAbsolute(at, lang, 'UTC');
  let text = absolute;
  if (now && mode !== 'date') {
    const rel = formatRelative(at, lang, now);
    text = mode === 'relative' ? rel : `${rel} · ${absolute}`;
  }
  return (
    <time className={className} dateTime={at} title={absolute}>
      {text}
    </time>
  );
}
