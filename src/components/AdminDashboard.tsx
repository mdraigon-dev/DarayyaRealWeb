import { useMemo, useState } from 'react';
import { t, loc, fmtNum, fmtMoney, type Lang } from '../i18n/strings';
import { displayStatus } from '../data/donation-math';
import { buildActivityFeed, lastActivityAt, type ActivityProject, type ActivityDocument } from '../data/activity-feed';
import { can } from '../data/permissions';
import AccessNotice from './AccessNotice';
import { useIdentity } from '../data/use-identity';
import { timeKey, daysUntil, useNow } from '../data/time';
import ActivityFeed from './ActivityFeed';
import TimeStamp from './TimeStamp';

type Bilingual = { ar: string; en?: string };
type Project = ActivityProject & {
  title: Bilingual;
  category: string;
  status: 'funding' | 'active' | 'completed' | 'planning';
  health: 'healthy' | 'warning' | 'stalled' | 'completed';
  budgetUSD: number;
  raisedUSD: number;
  deadline?: string;
};

type Props = {
  lang: Lang;
  basePath: string;
  projects: Project[];
  documents?: ActivityDocument[];
};

type Reason = { level: 'serious' | 'warning' | 'info'; text: string };

const DAY = 86400000;
const STALE_DAYS = 30;

/**
 * Council dashboard. Everything here is computed from recorded data — project
 * budgets and raised amounts, contributions recorded by admins, and dated
 * activity. Nothing is sampled or simulated.
 */
export default function AdminDashboard(props: Props) {
  // Team managers and administrators only. Netlify also blocks the page for
  // everyone else (see public/_redirects); this covers local previews and
  // keeps the dashboard out of the page's static HTML.
  const identity = useIdentity();
  if (identity.kind === 'loading') return <AccessNotice lang={props.lang} state="loading" />;
  if (identity.kind !== 'authenticated') return <AccessNotice lang={props.lang} state="signed-out" />;
  if (!can(identity.user, 'view-dashboard')) return <AccessNotice lang={props.lang} state="no-access" />;
  return <Dashboard {...props} canEdit={can(identity.user, 'edit-projects')} canUseCms={can(identity.user, 'reverse-funds')} />;
}

function Dashboard({ lang, basePath, projects, documents = [], canEdit, canUseCms }: Props & { canEdit: boolean; canUseCms: boolean }) {
  const currency = 'USD' as const;
  const isAdmin = canEdit;
  const now = useNow(); // null until the page runs in the browser
  const base = `${(import.meta as any).env?.BASE_URL ?? '/'}${lang}`.replace(/\/{2,}/g, '/');
  const projectHref = (id: string) => (isAdmin ? `${base}/admin/edit/${id}/` : `${basePath}/projects/${id}/`);

  // ── Headline figures ──────────────────────────────────────────────
  const totalBudget = projects.reduce((s, p) => s + p.budgetUSD, 0);
  const totalRaised = projects.reduce((s, p) => s + Math.min(p.raisedUSD, p.budgetUSD), 0);
  const gap = Math.max(0, totalBudget - totalRaised);
  const pctFunded = totalBudget > 0 ? Math.round((totalRaised / totalBudget) * 100) : 0;
  const underFunded = projects.filter((p) => p.raisedUSD < p.budgetUSD).length;
  const byStatus = projects.reduce<Record<string, number>>((acc, p) => {
    const s = displayStatus(p); acc[s] = (acc[s] || 0) + 1; return acc;
  }, {});

  const contributions = projects.flatMap((p) => p.fundLog || []);
  const recordedTotal = contributions.reduce((s, f) => s + f.amountUSD, 0);
  const recent30 = now
    ? contributions.filter((f) => now.getTime() - timeKey(f.at) <= 30 * DAY).reduce((s, f) => s + f.amountUSD, 0)
    : null;

  // ── Funding by sector: one meter per sector, largest remaining need first ──
  const sectors = useMemo(() => {
    const m = new Map<string, { budget: number; raised: number; count: number }>();
    for (const p of projects) {
      const r = m.get(p.category) || { budget: 0, raised: 0, count: 0 };
      r.budget += p.budgetUSD; r.raised += Math.min(p.raisedUSD, p.budgetUSD); r.count += 1;
      m.set(p.category, r);
    }
    return [...m.entries()]
      .map(([category, r]) => ({ category, ...r, gap: r.budget - r.raised, pct: Math.round((r.raised / Math.max(1, r.budget)) * 100) }))
      .sort((a, b) => b.gap - a.gap);
  }, [projects]);

  // ── Needs attention: concrete, checkable reasons per project ─────────
  // Staleness and deadlines depend on today's date, so they appear once the
  // page is running in the browser (now !== null).
  const attention = useMemo(() => {
    return projects
      .map((p) => {
        const reasons: Reason[] = [];
        const pct = Math.round((p.raisedUSD / Math.max(1, p.budgetUSD)) * 100);
        if (p.health === 'stalled') reasons.push({ level: 'serious', text: t(lang, 'dash_reason_stalled') });
        if (now && p.deadline && daysUntil(p.deadline, now) < 0 && p.raisedUSD < p.budgetUSD) {
          reasons.push({ level: 'serious', text: t(lang, 'dash_reason_deadline') });
        }
        if (p.health === 'warning') reasons.push({ level: 'warning', text: t(lang, 'dash_reason_warning') });
        if (p.status === 'funding' && p.raisedUSD >= p.budgetUSD) {
          reasons.push({ level: 'warning', text: t(lang, 'dash_reason_funded_open') });
        }
        if (p.status === 'completed' && p.raisedUSD < p.budgetUSD) {
          reasons.push({ level: 'warning', text: t(lang, 'dash_reason_completed_unfunded', { pct: fmtNum(lang, pct) }) });
        }
        if (now && p.status !== 'completed') {
          const last = lastActivityAt(p);
          if (!last) reasons.push({ level: 'info', text: t(lang, 'dash_reason_never') });
          else {
            const days = Math.floor((now.getTime() - timeKey(last)) / DAY);
            if (days > STALE_DAYS) reasons.push({ level: 'info', text: t(lang, 'dash_reason_stale', { days: fmtNum(lang, days) }) });
          }
        }
        const rank = reasons.reduce((s, r) => s + (r.level === 'serious' ? 100 : r.level === 'warning' ? 10 : 1), 0);
        return { p, reasons, rank, pct };
      })
      .filter((x) => x.reasons.length > 0)
      .sort((a, b) => b.rank - a.rank);
  }, [projects, now, lang]);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const attentionShown = showAllAttention ? attention : attention.slice(0, 6);

  const activity = useMemo(() => buildActivityFeed(projects, documents), [projects, documents]);

  // ── Project table (admins) ─────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'funding' | 'active' | 'completed' | 'stalled'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'pct' | 'amount' | 'stale'>('default');
  const filteredProjects = projects
    .filter((p) => {
      if (statusFilter === 'stalled') { if (p.health !== 'stalled') return false; }
      else if (statusFilter !== 'all' && displayStatus(p) !== statusFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return [p.title.ar, p.title.en || '', p.id, p.category].some((s) => s.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === 'pct') return b.raisedUSD / b.budgetUSD - a.raisedUSD / a.budgetUSD;
      if (sortBy === 'amount') return b.raisedUSD - a.raisedUSD;
      if (sortBy === 'stale') return timeKey(lastActivityAt(a)) - timeKey(lastActivityAt(b));
      return 0;
    });

  return (
    <section className="section">
      <div className="admin-hero">
        <h2>{t(lang, 'admin_welcome')}</h2>
        <p>{t(lang, 'admin_role')}</p>
      </div>

      {/* KPI row */}
      <div className="dash-tiles">
        <div className="dash-tile">
          <div className="dash-tile-label">{t(lang, 'dash_tile_funded')}</div>
          <div className="dash-tile-value">{fmtMoney(lang, currency, totalRaised)}</div>
          <div className="dash-tile-sub">{t(lang, 'dash_tile_funded_sub', { budget: fmtMoney(lang, currency, totalBudget), pct: fmtNum(lang, pctFunded) })}</div>
          <div className="dash-meter" role="img" aria-label={`${pctFunded}%`}>
            <div className="dash-meter-fill" style={{ width: `${pctFunded}%` }} />
          </div>
        </div>
        <div className="dash-tile">
          <div className="dash-tile-label">{t(lang, 'dash_tile_gap')}</div>
          <div className="dash-tile-value">{fmtMoney(lang, currency, gap)}</div>
          <div className="dash-tile-sub">{t(lang, 'dash_tile_gap_sub', { n: fmtNum(lang, underFunded) })}</div>
        </div>
        <div className="dash-tile">
          <div className="dash-tile-label">{t(lang, 'dash_tile_projects')}</div>
          <div className="dash-tile-value">{fmtNum(lang, projects.length)}</div>
          <div className="dash-tile-sub">{t(lang, 'dash_tile_projects_sub', {
            open: fmtNum(lang, byStatus.funding || 0),
            active: fmtNum(lang, byStatus.active || 0),
            done: fmtNum(lang, byStatus.completed || 0),
          })}</div>
        </div>
        <div className="dash-tile">
          <div className="dash-tile-label">{t(lang, 'dash_tile_recorded')}</div>
          <div className="dash-tile-value">{fmtMoney(lang, currency, recordedTotal)}</div>
          <div className="dash-tile-sub">
            {contributions.length === 0
              ? t(lang, 'dash_tile_recorded_none')
              : t(lang, 'dash_tile_recorded_sub', {
                  n: fmtNum(lang, contributions.length),
                  recent: recent30 === null ? '…' : fmtMoney(lang, currency, recent30),
                })}
          </div>
        </div>
        <div className="dash-tile">
          <div className="dash-tile-label">{t(lang, 'dash_tile_attention')}</div>
          <div className="dash-tile-value">{now ? fmtNum(lang, attention.length) : '…'}</div>
          <div className="dash-tile-sub">{t(lang, 'dash_tile_attention_sub')}</div>
        </div>
      </div>

      <div className="admin-grid dash-grid">
        {/* Funding by sector — meter list */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <span style={{ color: 'var(--sy-gold)' }}>◆</span>
              {t(lang, 'dash_sectors_title')}
            </div>
          </div>
          <div className="admin-card-body padded">
            <p className="dash-card-desc">{t(lang, 'dash_sectors_desc')}</p>
            <ul className="dash-meter-list">
              {sectors.map((s) => {
                const label = t(lang, `cat_${s.category}` as any);
                const summary = `${label}: ${fmtMoney(lang, currency, s.raised)} / ${fmtMoney(lang, currency, s.budget)} (${s.pct}%)`;
                return (
                  <li key={s.category} className="dash-meter-row" title={summary} tabIndex={0} aria-label={summary}>
                    <div className="dash-meter-name">
                      {label} <span className="dash-meter-count">· {fmtNum(lang, s.count)}</span>
                    </div>
                    <div className="dash-meter" aria-hidden="true">
                      <div className="dash-meter-fill" style={{ width: `${s.pct}%` }} />
                    </div>
                    <div className="dash-meter-figures">
                      <strong>{fmtNum(lang, s.pct)}%</strong>
                      <span>{t(lang, 'dash_sector_needed', { gap: fmtMoney(lang, currency, s.gap) })}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Needs attention */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <span style={{ color: 'var(--sy-gold)' }}>◆</span>
              {t(lang, 'dash_attention_title')}
            </div>
          </div>
          <div className="admin-card-body padded">
            {now && attention.length === 0 && <p className="admin-card-empty">{t(lang, 'dash_attention_none')}</p>}
            <ul className="dash-attention">
              {attentionShown.map(({ p, reasons }) => (
                <li key={p.id} className="dash-attention-item">
                  <a className="dash-attention-name" href={projectHref(p.id)}>{loc(lang, p.title)}</a>
                  <ul className="dash-reasons">
                    {reasons.map((r, i) => (
                      <li key={i} className={`dash-reason dash-reason-${r.level}`}>
                        <span className="dash-reason-icon" aria-hidden="true">
                          {r.level === 'serious' ? '⛔' : r.level === 'warning' ? '⚠' : '⏱'}
                        </span>
                        {r.text}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            {attention.length > 6 && !showAllAttention && (
              <button type="button" className="dash-link-btn" onClick={() => setShowAllAttention(true)}>
                {t(lang, 'dash_show_all', { n: fmtNum(lang, attention.length) })}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Activity log — public; delete is admin-only inside the feed */}
      <div className="admin-card dash-activity">
        <div className="admin-card-header">
          <div className="admin-card-title">
            <span style={{ color: 'var(--sy-gold)' }}>◆</span>
            {t(lang, 'activity_log_title')}
          </div>
        </div>
        <div className="admin-card-body padded">
          <p className="dash-card-desc">{t(lang, 'activity_log_desc')}</p>
          <ActivityFeed entries={activity} lang={lang} basePath={basePath} pageSize={25} showFilters />
        </div>
      </div>

      {/* Project management — admin-only */}
      {isAdmin && (
        <>
          <div className="section-header" style={{ marginTop: '2.5rem' }}>
            <h2 className="section-title" style={{ fontSize: '1.6rem' }}>{t(lang, 'admin_manage')}</h2>
            <p className="section-desc" style={{ fontSize: '1rem' }}>{t(lang, 'admin_manage_desc_v2')}</p>
          </div>

          <div className="admin-actions-bar">
            <a className="btn-primary admin-new-project-btn" href={`${base}/admin/new/`}>
              + {t(lang, 'admin_new_project')}
            </a>
            {canUseCms && (
              <a className="btn-secondary" href={`${(import.meta as any).env?.BASE_URL ?? '/'}admin/#/collections/projects`}>
                {t(lang, 'admin_open_cms')}
              </a>
            )}
            <span className="admin-actions-hint">{t(lang, 'admin_actions_hint')}</span>
          </div>

          <div className="admin-toolbar">
            <div className="admin-search">
              <span className="admin-search-icon">🔍</span>
              <input
                type="text"
                placeholder={lang === 'ar' ? 'ابحث عن مشروع…' : 'Search projects…'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="admin-search-input"
                aria-label={lang === 'ar' ? 'البحث عن مشروع' : 'Search projects'}
              />
              {searchQuery && (
                <button className="admin-search-clear" onClick={() => setSearchQuery('')}
                  aria-label={lang === 'ar' ? 'مسح البحث' : 'Clear search'}>✕</button>
              )}
            </div>
            <div className="admin-filter-chips">
              {([
                { v: 'all',       ar: 'الكل',          en: 'All' },
                { v: 'funding',   ar: 'مفتوح للتمويل', en: 'Open for funding' },
                { v: 'active',    ar: 'قيد التنفيذ',   en: 'In progress' },
                { v: 'completed', ar: 'مكتمل',         en: 'Completed' },
                { v: 'stalled',   ar: 'متعثّر',        en: 'Stalled' },
              ] as const).map((o) => (
                <button key={o.v} className={`admin-filter-chip ${statusFilter === o.v ? 'active' : ''}`}
                  onClick={() => setStatusFilter(o.v)}>
                  {lang === 'ar' ? o.ar : o.en}
                </button>
              ))}
            </div>
            <div className="admin-sort">
              <label className="admin-sort-label">{lang === 'ar' ? 'الترتيب:' : 'Sort:'}</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="admin-sort-select"
                aria-label={lang === 'ar' ? 'ترتيب المشاريع' : 'Sort projects'}>
                <option value="default">{lang === 'ar' ? 'افتراضي' : 'Default'}</option>
                <option value="pct">{lang === 'ar' ? 'الأكثر تمويلاً %' : 'Most funded %'}</option>
                <option value="amount">{lang === 'ar' ? 'الأكثر تحصيلاً $' : 'Most raised $'}</option>
                <option value="stale">{t(lang, 'dash_sort_stale')}</option>
              </select>
            </div>
            <div className="admin-results-count">
              {lang === 'ar'
                ? `${fmtNum(lang, filteredProjects.length)} من ${fmtNum(lang, projects.length)}`
                : `${fmtNum(lang, filteredProjects.length)} of ${fmtNum(lang, projects.length)}`}
            </div>
          </div>

          <div className="admin-table">
            <div className="admin-table-head">
              <div>{t(lang, 'admin_col_project')}</div>
              <div>{t(lang, 'admin_col_budget')}</div>
              <div>{t(lang, 'admin_col_raised')}</div>
              <div>{t(lang, 'dash_col_last_update')}</div>
              <div>{t(lang, 'admin_col_status')}</div>
              <div></div>
            </div>
            {filteredProjects.length === 0 ? (
              <div className="admin-table-empty">
                {lang === 'ar' ? 'لا توجد مشاريع تطابق البحث' : 'No projects match your search'}
              </div>
            ) : filteredProjects.map((p) => {
              const pct = Math.round((p.raisedUSD / p.budgetUSD) * 100);
              const effStatus = displayStatus(p);
              return (
                <div className="admin-table-row" key={p.id}>
                  <div>
                    <div className="admin-table-name">{loc(lang, p.title)}</div>
                    <div className="admin-table-cat">{t(lang, `cat_${p.category}` as any)}</div>
                  </div>
                  <div>{fmtMoney(lang, currency, p.budgetUSD)}</div>
                  <div>
                    <div>{fmtMoney(lang, currency, p.raisedUSD)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--sy-gold)', fontWeight: 700 }}>{fmtNum(lang, pct)}%</div>
                  </div>
                  <div className="admin-table-updated">
                    <TimeStamp at={lastActivityAt(p)} lang={lang} mode="relative" fallback="—" />
                  </div>
                  <div><span className={`status-chip status-chip-${effStatus}`}>{t(lang, `status_${effStatus}` as any)}</span></div>
                  <div className="admin-table-actions">
                    <a className="admin-edit" href={`${base}/admin/edit/${p.id}/`} title={t(lang, 'admin_btn_edit_hint')}>
                      ✎ {t(lang, 'admin_btn_edit')}
                    </a>
                    <a className="admin-view" href={`${basePath}/projects/${p.id}/`} title={t(lang, 'admin_btn_view_hint')}>
                      {t(lang, 'admin_btn_view')}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="admin-help-card">
            <h4>{t(lang, 'admin_help_title')}</h4>
            <ul>
              <li>{t(lang, 'admin_help_funding')}</li>
              <li>{t(lang, 'admin_help_status')}</li>
              <li>{t(lang, 'admin_help_photos')}</li>
              <li>{t(lang, 'admin_help_engineers')}</li>
              <li>{t(lang, 'admin_help_comments')}</li>
              <li>{t(lang, 'admin_help_new')}</li>
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
