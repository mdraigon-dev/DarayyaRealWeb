import { useMemo, useState } from 'react';
import { t, loc, fmtMoney, fmtNum, type Lang } from '../i18n/strings';
import type { ActivityEntry, ActivityKind } from '../data/activity-feed';
import { deleteActivity } from '../data/activity-delete';
import { classifyUser } from '../data/permissions';
import { useIdentity } from '../data/use-identity';
import TimeStamp from './TimeStamp';
import AdminDeleteButton from './AdminDeleteButton';
import { commitName } from '../data/admin-prefs';

type Props = {
  entries: ActivityEntry[];
  lang: Lang;
  basePath: string;
  /** How many entries to show at first, and per "Show more" click */
  pageSize?: number;
  /** Show the type filter chips (dashboard) */
  showFilters?: boolean;
  emptyText?: string;
};

const KINDS: ActivityKind[] = ['update', 'note', 'photo', 'funds', 'document'];
const excerpt = (s: string, n = 180) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

/**
 * The public activity log: every field update, note, photo, recorded
 * contribution and published document, newest first, each with its time.
 * Everyone can read it; signed-in admins also get a delete button per entry
 * (which deletes the record behind it — see data/activity-delete.ts).
 */
export default function ActivityFeed({ entries, lang, basePath, pageSize = 10, showFilters = false, emptyText }: Props) {
  const identity = useIdentity();
  const isAdmin = identity.kind === 'authenticated' && classifyUser(identity.user, []) === 'admin';
  const [filter, setFilter] = useState<ActivityKind | 'all'>('all');
  const [shown, setShown] = useState(pageSize);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState(false);

  const live = useMemo(() => entries.filter((e) => !hidden.has(e.key)), [entries, hidden]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: live.length };
    for (const e of live) c[e.kind] = (c[e.kind] || 0) + 1;
    return c;
  }, [live]);
  const filtered = filter === 'all' ? live : live.filter((e) => e.kind === filter);
  const visible = filtered.slice(0, shown);

  const remove = async (e: ActivityEntry) => {
    const who = commitName(identity.kind === 'authenticated' ? identity.user : null);
    await deleteActivity(e.ref, who);
    setHidden((h) => new Set(h).add(e.key));
    setToast(true);
    setTimeout(() => setToast(false), 5000);
  };

  if (live.length === 0) {
    return <div className="activity-feed-empty">{emptyText || t(lang, 'activity_empty')}</div>;
  }

  return (
    <div className="activity-log">
      {showFilters && (
        <div className="activity-filters" role="group" aria-label={t(lang, 'activity_filter_label')}>
          {(['all', ...KINDS] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`activity-filter ${filter === k ? 'active' : ''}`}
              onClick={() => { setFilter(k); setShown(pageSize); }}
              disabled={k !== 'all' && !counts[k]}
            >
              {k === 'all' ? t(lang, 'activity_filter_all') : t(lang, `activity_kind_${k}` as any)}
              <span className="activity-filter-count">{fmtNum(lang, counts[k] || 0)}</span>
            </button>
          ))}
        </div>
      )}

      <ol className="activity-feed">
        {visible.map((e) => (
          <li key={e.key} className={`activity-item activity-${e.kind}`}>
            <span className={`activity-dot activity-dot-${e.kind}`} aria-hidden="true"></span>
            <div className="activity-body">
              <div className="activity-head">
                <span className="activity-kind">
                  {e.kind === 'document'
                    ? t(lang, `circ_cat_${e.docCategory}` as any)
                    : t(lang, `activity_kind_${e.kind}` as any)}
                </span>
                <a
                  className="activity-target"
                  href={e.kind === 'document'
                    ? `${basePath}/circulars/#doc-${e.docId}`
                    : `${basePath}/projects/${e.projectId}/`}
                >
                  {loc(lang, e.kind === 'document' ? e.docTitle : e.projectTitle)}
                </a>
                {e.kind === 'funds' && e.amountUSD !== undefined && (
                  <span className="activity-amount">+{fmtMoney(lang, 'USD', e.amountUSD)}</span>
                )}
              </div>

              {e.kind === 'funds' && e.subTitle && (
                <div className="activity-text">→ {loc(lang, e.subTitle)}</div>
              )}
              {(e.kind === 'update' || e.kind === 'note' || e.kind === 'photo') && e.body && (
                <div className="activity-text">{excerpt(loc(lang, e.body))}</div>
              )}

              <div className="activity-meta">
                <TimeStamp at={e.at} lang={lang} fallback={e.legacyDate ? loc(lang, e.legacyDate) : ''} className="activity-time" />
                {e.author && loc(lang, e.author) && (
                  <span className="activity-who">{t(lang, 'activity_by', { name: loc(lang, e.author) })}</span>
                )}
                {e.kind === 'funds' && e.by && (
                  <span className="activity-who">{t(lang, 'activity_recorded_by', { name: e.by })}</span>
                )}
                {e.photoCount ? <span className="activity-photos">📷 {fmtNum(lang, e.photoCount)}</span> : null}
              </div>
            </div>

            {isAdmin && (
              <AdminDeleteButton
                lang={lang}
                what={t(lang, `activity_kind_${e.kind}` as any)}
                warning={e.kind === 'funds'
                  ? t(lang, 'activity_del_funds_warning', { amount: fmtMoney(lang, 'USD', e.amountUSD || 0) })
                  : e.kind === 'document'
                    ? t(lang, 'activity_del_doc_warning')
                    : undefined}
                onConfirm={() => remove(e)}
              />
            )}
          </li>
        ))}
      </ol>

      {filtered.length > shown && (
        <div className="activity-more">
          <button type="button" className="btn-secondary" onClick={() => setShown((n) => n + pageSize)}>
            {t(lang, 'activity_show_more', { n: fmtNum(lang, filtered.length - shown) })}
          </button>
        </div>
      )}

      {toast && <div className="admin-toast" role="status">✓ {t(lang, 'activity_deleted_toast')}</div>}
    </div>
  );
}
