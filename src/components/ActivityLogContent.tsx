import { useState, useMemo } from 'react';
import { buildActivityFeed, type ActivityEntry } from '../data/activity-feed';
import { t, type Lang } from '../i18n/strings';

type Project = Parameters<typeof buildActivityFeed>[0][number];

type Props = {
  lang: Lang;
  basePath: string;
  projects: Project[];
};

type SortKey = 'newest' | 'oldest';
type ColorFilter = 'all' | 'green' | 'blue' | 'gold' | 'gray';

export default function ActivityLogContent({ lang, basePath, projects }: Props) {
  const [sort, setSort] = useState<SortKey>('newest');
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all');
  const [search, setSearch] = useState('');
  const ar = lang === 'ar';

  const allEntries = useMemo(() => buildActivityFeed(projects, lang, 500), [projects, lang]);

  const filtered = useMemo(() => {
    let list = [...allEntries];
    if (colorFilter !== 'all') list = list.filter(e => e.color === colorFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e => e.text.toLowerCase().includes(q));
    }
    if (sort === 'oldest') list = list.reverse();
    return list;
  }, [allEntries, colorFilter, search, sort]);

  const TYPE_LABELS: Record<ColorFilter, { ar: string; en: string }> = {
    all:   { ar: 'الكل', en: 'All' },
    green: { ar: 'تحديثات ميدانية', en: 'Field updates' },
    blue:  { ar: 'تعليقات', en: 'Comments' },
    gold:  { ar: 'تغييرات النظام', en: 'Status changes' },
    gray:  { ar: 'تنبيهات', en: 'Alerts' },
  };

  return (
    <section className="section activity-log-full">
      <div className="section-header">
        <div className="section-eyebrow">{ar ? 'لوحة المجلس' : 'Council Dashboard'}</div>
        <h1 className="section-title">{ar ? 'سجل النشاط الكامل' : 'Full Activity Log'}</h1>
        <p className="section-desc">
          {ar
            ? `${filtered.length} من ${allEntries.length} إدخال`
            : `${filtered.length} of ${allEntries.length} entries`}
        </p>
      </div>

      {/* Controls */}
      <div className="activity-log-controls">
        {/* Search */}
        <div className="activity-log-search-wrap">
          <span className="activity-log-search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            className="activity-log-search"
            placeholder={ar ? 'ابحث في النشاط…' : 'Search activity…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            dir={ar ? 'rtl' : 'ltr'}
          />
          {search && (
            <button type="button" className="activity-log-search-clear" onClick={() => setSearch('')}>×</button>
          )}
        </div>

        {/* Type filter chips */}
        <div className="activity-log-chips">
          {(Object.keys(TYPE_LABELS) as ColorFilter[]).map(k => (
            <button
              key={k}
              type="button"
              className={`activity-log-chip activity-log-chip-${k} ${colorFilter === k ? 'active' : ''}`}
              onClick={() => setColorFilter(k)}
            >
              {k !== 'all' && <span className={`activity-dot ${k}`} style={{ width: '8px', height: '8px', display: 'inline-block', borderRadius: '50%', marginInlineEnd: '5px' }} />}
              {TYPE_LABELS[k][lang]}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="activity-log-sort">
          <label className="activity-log-sort-label">{ar ? 'الترتيب:' : 'Sort:'}</label>
          <select
            className="activity-log-sort-select"
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            dir={ar ? 'rtl' : 'ltr'}
          >
            <option value="newest">{ar ? 'الأحدث أولاً' : 'Newest first'}</option>
            <option value="oldest">{ar ? 'الأقدم أولاً' : 'Oldest first'}</option>
          </select>
        </div>
      </div>

      {/* Entry list */}
      {filtered.length === 0 ? (
        <div className="activity-feed-empty" style={{ padding: '3rem', textAlign: 'center' }}>
          {ar ? 'لا توجد نتائج مطابقة.' : 'No matching entries.'}
        </div>
      ) : (
        <ul className="activity-log-list">
          {filtered.map((entry, i) => (
            <li key={i} className="activity-log-entry">
              <span className={`activity-dot ${entry.color}`} />
              <div className="activity-log-entry-body">
                <span
                  className="activity-log-entry-text"
                  dangerouslySetInnerHTML={{ __html: entry.text }}
                  dir={ar ? 'rtl' : 'ltr'}
                />
                <a
                  className="activity-log-entry-link"
                  href={`${basePath}/projects/${entry.projectId}/`}
                  title={ar ? 'انتقل إلى المشروع' : 'Go to project'}
                >
                  {ar ? '←' : '→'}
                </a>
              </div>
              <span className="activity-log-entry-time">{entry.time}</span>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <a className="btn-secondary" href={`${basePath}/`}>
          {ar ? '← العودة للرئيسية' : '← Back to home'}
        </a>
      </div>
    </section>
  );
}
