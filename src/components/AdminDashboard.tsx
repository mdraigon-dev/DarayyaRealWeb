import { useState, useEffect } from 'react';
import { t, loc, fmtNum, fmtMoney, type Lang } from '../i18n/strings';
import { adminData } from '../data/admin-sample';
import { loadDonations, type DemoDonation } from '../data/demo-donations';
import { applyDemoToProjects } from '../data/donation-math';

type Bilingual = { ar: string; en: string };
type Update = { date: Bilingual; author: Bilingual; body: Bilingual };
type Comment = { author: Bilingual; body: Bilingual; date?: string };
type Sub = { id: string; budgetUSD: number; raisedUSD: number; title?: Bilingual };
type Project = {
  id: string;
  category: string;
  status: 'funding' | 'active' | 'completed' | 'planning';
  title: Bilingual;
  statusLabel?: never;
  budgetUSD: number;
  raisedUSD: number;
  donors: number;
  daysLeft?: number;
  updates?: Update[];
  comments?: Comment[];
  subs?: Sub[];
};

type Props = {
  lang: Lang;          // URL-based default
  basePath: string;
  projects: Project[];
};

export default function AdminDashboard({ lang: urlLang, basePath, projects: rawProjects }: Props) {
  // Dashboard language follows the URL (/ar/admin/ vs /en/admin/).
  const lang: Lang = urlLang;

  const [currency] = useState<'USD' | 'SYP'>('USD');
  const { donations: sampleDonations, alerts, activities: sampleActivities, topDonors, weekData: sampleWeekData } = adminData(lang);

  // Load demo donations on mount. The dashboard reads them in three ways:
  //  - augmented project list (per-project raised reflects demos)
  //  - real 7-day chart data
  //  - real today's donations
  const [demoDonations, setDemoDonations] = useState<DemoDonation[]>([]);
  useEffect(() => {
    setDemoDonations(loadDonations().donations);
    const onVis = () => setDemoDonations(loadDonations().donations);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Augmented projects — each project's raisedUSD and donors reflect
  // demo donations applied via waterfall (for projects with subs)
  const projects = applyDemoToProjects(rawProjects, demoDonations);

  // Derive REAL activity feed from project data: every update and every comment
  // across all projects, most recent first. Falls back to sample activities
  // when there are no real ones (so the dashboard isn't empty on day 1).
  type ActivityEntry = { color: 'green' | 'gold' | 'blue'; text: string; time: string; sortKey: number };
  const realActivities: ActivityEntry[] = [];
  projects.forEach(p => {
    const projectName = loc(lang, p.title);
    (p.updates || []).forEach((u) => {
      const author = loc(lang, u.author);
      const body = loc(lang, u.body);
      const date = loc(lang, u.date);
      const bodyShort = body.length > 100 ? body.slice(0, 100) + '…' : body;
      realActivities.push({
        color: 'green',
        text: lang === 'ar'
          ? `تم رفع تحديث ميداني على مشروع <strong>${escapeHtml(projectName)}</strong> من قبل ${escapeHtml(author)}: ${escapeHtml(bodyShort)}`
          : `Field update on <strong>${escapeHtml(projectName)}</strong> by ${escapeHtml(author)}: ${escapeHtml(bodyShort)}`,
        time: date,
        sortKey: parseTimeKey(date),
      });
    });
    (p.comments || []).forEach((c) => {
      const author = loc(lang, c.author);
      const body = loc(lang, c.body);
      const bodyShort = body.length > 100 ? body.slice(0, 100) + '…' : body;
      const time = c.date || (lang === 'ar' ? 'مؤخراً' : 'recently');
      realActivities.push({
        color: 'blue',
        text: lang === 'ar'
          ? `تعليق جديد على <strong>${escapeHtml(projectName)}</strong> من ${escapeHtml(author)}: ${escapeHtml(bodyShort)}`
          : `New comment on <strong>${escapeHtml(projectName)}</strong> by ${escapeHtml(author)}: ${escapeHtml(bodyShort)}`,
        time,
        sortKey: parseTimeKey(c.date || ''),
      });
    });
  });
  realActivities.sort((a, b) => b.sortKey - a.sortKey);
  const realActivitiesTop = realActivities.slice(0, 8);
  const activities = realActivitiesTop.length > 0 ? realActivitiesTop : sampleActivities;

  // ──────────────────────────────────────────────────────────────────
  // Demo donations from localStorage → Recent Donations + Top Donors
  // ──────────────────────────────────────────────────────────────────
  // demoDonations is already loaded above (used to augment projects).
  // Reuse the same state here for the recent/top donors widgets.

  // Build a quick project-id → title lookup so we can show "donated to <name>"
  const projectById = new Map<string, Project>();
  projects.forEach(p => projectById.set(p.id, p));

  // Recent demo donations — sorted by timestamp DESC, mapped to display shape
  type RecentDonation = { name: string; location: string; target: string; time: string; amountUSD: number; color: string; isDemo: boolean };
  const demoRecent: RecentDonation[] = [...demoDonations]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8)
    .map((d) => {
      const project = projectById.get(d.projectId);
      const projectName = project ? loc(lang, project.title) : d.projectId;
      const name = d.name?.trim() || (lang === 'ar' ? 'متبرع مجهول' : 'Anonymous donor');
      const ageMs = Date.now() - d.timestamp;
      const time = formatRelativeTime(ageMs, lang);
      // Pick a deterministic color from name hash
      const colors = ['green', 'gold', 'blue', 'red'];
      const colorIdx = Math.abs(hashStr(name)) % colors.length;
      return {
        name,
        location: lang === 'ar' ? 'وضع تجريبي' : 'Demo Mode',
        target: lang === 'ar' ? `لمشروع: ${projectName}` : `to: ${projectName}`,
        time,
        amountUSD: d.amountUSD,
        color: colors[colorIdx],
        isDemo: true,
      };
    });
  const recentDonationsDisplay = demoRecent.length > 0
    ? demoRecent
    : sampleDonations.slice(0, 8).map(d => ({ ...d, isDemo: false } as RecentDonation));

  // Top donors — group demo donations by donor name, sum amounts
  const demoDonorTotals = new Map<string, number>();
  demoDonations.forEach(d => {
    const name = d.name?.trim() || (lang === 'ar' ? 'متبرع مجهول' : 'Anonymous donor');
    demoDonorTotals.set(name, (demoDonorTotals.get(name) || 0) + d.amountUSD);
  });
  type TopDonor = { name: string; amountUSD: number; isDemo: boolean };
  const demoTopDonors: TopDonor[] = [...demoDonorTotals.entries()]
    .map(([name, amountUSD]) => ({ name, amountUSD, isDemo: true }))
    .sort((a, b) => b.amountUSD - a.amountUSD)
    .slice(0, 5);
  const topDonorsDisplay = demoTopDonors.length > 0
    ? demoTopDonors
    : topDonors.map(d => ({ ...d, isDemo: false } as TopDonor));

  // Search & filter state for the project table — makes the dashboard feel
  // like a real working tool for non-technical staff
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'funding' | 'active' | 'completed' | 'stalled'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'pct' | 'donors' | 'amount'>('default');

  const totalRaised = projects.reduce((s, p) => s + p.raisedUSD, 0);
  const totalDonors = projects.reduce((s, p) => s + p.donors, 0);
  const openCount = projects.filter(p => p.status === 'funding').length;
  const isShowingDemoDonations = demoDonations.length > 0;

  // ──────────────────────────────────────────────────────────────────
  // Last-7-days chart: derived from real demo-donation timestamps,
  // with TODAY highlighted. Days are computed in the user's local time.
  // Sample chart shown when no demo donations exist.
  // ──────────────────────────────────────────────────────────────────
  type DayBucket = { label: string; amount: number; isToday: boolean };
  const realWeekData: DayBucket[] = (() => {
    const now = new Date();
    // Buckets keyed by YYYY-MM-DD local date string
    const buckets: { dateKey: string; date: Date; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      buckets.push({ dateKey, date: d, amount: 0 });
    }
    // Sum each demo donation into its day bucket
    for (const don of demoDonations) {
      const dd = new Date(don.timestamp);
      dd.setHours(0, 0, 0, 0);
      const key = `${dd.getFullYear()}-${dd.getMonth() + 1}-${dd.getDate()}`;
      const bucket = buckets.find(b => b.dateKey === key);
      if (bucket) bucket.amount += don.amountUSD;
    }
    // Pretty labels — short weekday name in the active language
    const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const weekdayFmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' });
    return buckets.map(b => ({
      label: weekdayFmt.format(b.date),
      amount: b.amount,
      isToday: b.dateKey === todayKey,
    }));
  })();

  // Use real data when we have any donations; otherwise fall back to sample
  // so the chart isn't blank on day one. Sample is shaped like
  // [{label, amount}] so we map isToday=false onto it.
  const weekData: DayBucket[] = isShowingDemoDonations
    ? realWeekData
    : sampleWeekData.map((d, i, arr) => ({
        label: d.label,
        amount: d.amount,
        isToday: i === arr.length - 1, // last entry of sample is "today"
      }));
  const weekTotal = weekData.reduce((s, d) => s + d.amount, 0);
  const maxBar = Math.max(1, ...weekData.map(d => d.amount));

  // "Today's donations" headline: sum of today's bucket (real if we have
  // any demo donations, else sample's last day)
  const todayBucket = weekData.find(d => d.isToday);
  const todayDonations = todayBucket ? todayBucket.amount : 0;

  // "Needs attention" — projects that are at risk and should be acted on
  // (under-funded with little time left, stalled, or with low donor count)
  const needsAttention = projects
    .map(p => {
      const pct = Math.round((p.raisedUSD / p.budgetUSD) * 100);
      const reasons: string[] = [];
      if (p.status === 'funding' && pct < 20 && p.daysLeft < 30 && p.daysLeft > 0) {
        reasons.push(lang === 'ar' ? 'تمويل منخفض ووقت قليل' : 'Low funding, little time');
      }
      if (p.status === 'funding' && pct < 10) {
        reasons.push(lang === 'ar' ? 'لم يبدأ التمويل بعد' : 'Funding not yet started');
      }
      // Cast for status comparison — runtime check is what matters
      if ((p as any).health === 'stalled') {
        reasons.push(lang === 'ar' ? 'متعثّر' : 'Stalled');
      }
      return reasons.length > 0 ? { project: p, reasons, pct } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 3);

  // Apply search, filter, and sort to the project list before rendering the table
  const filteredProjects = projects
    .filter(p => {
      if (statusFilter !== 'all') {
        // Stalled is health, not status — separate logic
        if (statusFilter === 'stalled') return (p as any).health === 'stalled';
        if (p.status !== statusFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.title.ar.toLowerCase().includes(q) ||
          (p.title.en || '').toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'pct') {
        const pa = a.raisedUSD / a.budgetUSD;
        const pb = b.raisedUSD / b.budgetUSD;
        return pb - pa;
      }
      if (sortBy === 'donors') return b.donors - a.donors;
      if (sortBy === 'amount') return b.raisedUSD - a.raisedUSD;
      return 0;
    });

  const initials = (name: string) => {
    if (name.includes('مجهول') || name.toLowerCase().includes('anonymous')) return '?';
    const parts = name.trim().split(/\s+/);
    return parts[0].charAt(0) + (parts[1] ? parts[1].charAt(0) : '');
  };

  return (
    <section className="section">
      {/* Demo data warning */}
      <div className="admin-demo-banner">
        {t(lang, 'admin_demo_note')}
      </div>

      {/* Needs Attention — projects requiring action.
          Helps staff start their day by seeing what's at risk. */}
      {needsAttention.length > 0 && (
        <div className="needs-attention">
          <div className="needs-attention-header">
            <span className="needs-attention-icon">⚠</span>
            <h3>{lang === 'ar' ? 'مشاريع تحتاج اهتمامك' : 'Projects needing your attention'}</h3>
          </div>
          <div className="needs-attention-list">
            {needsAttention.map(({ project: p, reasons, pct }) => {
              const editUrl = `${(import.meta as any).env?.BASE_URL ?? '/'}${lang}/admin/edit/${p.id}/`;
              return (
                <a key={p.id} href={editUrl} className="needs-attention-item">
                  <div className="needs-attention-name">{loc(lang, p.title)}</div>
                  <div className="needs-attention-meta">
                    {reasons.join(' · ')} · {fmtNum(lang, pct)}% {lang === 'ar' ? 'ممول' : 'funded'}
                  </div>
                  <div className="needs-attention-action">✎ {t(lang, 'admin_btn_edit')}</div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      <div className="admin-hero">
        <h2>{t(lang, 'admin_welcome')}</h2>
        <p>{t(lang, 'admin_role')}</p>
        <div className="admin-stats">
          <div className="admin-stat-card">
            <div className="admin-stat-label">{t(lang, 'admin_stat_today')}</div>
            <div className="admin-stat-val">{fmtMoney(lang, currency, todayDonations)}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">{t(lang, 'admin_stat_total')}</div>
            <div className="admin-stat-val">{fmtMoney(lang, currency, totalRaised)}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">{t(lang, 'admin_stat_donors')}</div>
            <div className="admin-stat-val">{fmtNum(lang, totalDonors)}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">{t(lang, 'admin_stat_open')}</div>
            <div className="admin-stat-val">{fmtNum(lang, openCount)}</div>
          </div>
        </div>
      </div>

      {/* Row 1: recent donations + (chart + alerts) */}
      <div className="admin-grid">
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <span style={{ color: 'var(--sy-gold)' }}>◆</span>
              {t(lang, 'admin_recent_donations')}
              {isShowingDemoDonations ? (
                <span className="admin-card-badge admin-card-badge-demo">
                  ★ {lang === 'ar' ? 'وضع تجريبي' : 'Demo Mode'}
                </span>
              ) : (
                <span className="admin-card-badge admin-card-badge-sample">
                  {lang === 'ar' ? 'بيانات عيّنة' : 'Sample data'}
                </span>
              )}
            </div>
            <span className="admin-card-link">{t(lang, 'admin_view_all')}</span>
          </div>
          <div className="admin-card-body">
            {recentDonationsDisplay.length === 0 && (
              <p className="admin-card-empty">
                {lang === 'ar' ? 'لا توجد تبرعات بعد.' : 'No donations yet.'}
              </p>
            )}
            {recentDonationsDisplay.slice(0, 8).map((d, i) => (
              <div className="feed-item" key={i}>
                <div className={`feed-avatar ${d.color}`}>{initials(d.name)}</div>
                <div className="feed-content">
                  <div className="feed-name">
                    {d.name}
                    <span style={{ color: 'var(--sy-muted)', fontWeight: 400, fontSize: '12px' }}> — {d.location}</span>
                  </div>
                  <div className="feed-target">{d.target}</div>
                  <div className="feed-time">{d.time}</div>
                </div>
                <div className="feed-amount">{fmtMoney(lang, currency, d.amountUSD)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                <span style={{ color: 'var(--sy-gold)' }}>◆</span>
                {t(lang, 'admin_week_chart')}
                {isShowingDemoDonations ? (
                  <span className="admin-card-badge admin-card-badge-live">
                    ● {lang === 'ar' ? 'مباشر' : 'Live'}
                  </span>
                ) : (
                  <span className="admin-card-badge admin-card-badge-sample">
                    {lang === 'ar' ? 'بيانات عيّنة' : 'Sample data'}
                  </span>
                )}
              </div>
            </div>
            <div className="chart-week">
              <div className="chart-bars">
                {weekData.map((d, i) => (
                  <div key={i}
                       className={`chart-bar ${d.isToday ? 'today' : ''}`}
                       style={{ height: `${(d.amount / maxBar) * 100}%` }}>
                    <span className="chart-bar-tooltip">{fmtMoney(lang, currency, d.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="chart-labels">
                {weekData.map((d, i) => (
                  <span key={i} className={`chart-label ${d.isToday ? 'today' : ''}`}>{d.label}</span>
                ))}
              </div>
              <div className="chart-summary">
                <span>{t(lang, 'admin_week_total')} <strong>{fmtMoney(lang, currency, weekTotal)}</strong></span>
                {isShowingDemoDonations && todayDonations > 0 && (
                  <span style={{ color: 'var(--sy-gold)', fontWeight: 700 }}>
                    {lang === 'ar' ? 'اليوم: ' : 'Today: '}{fmtMoney(lang, currency, todayDonations)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                <span style={{ color: 'var(--sy-gold)' }}>◆</span>
                {t(lang, 'admin_alerts')}
              </div>
              <span className="admin-card-link">
                {t(lang, 'admin_alerts_new', { n: fmtNum(lang, alerts.length) })}
              </span>
            </div>
            <div className="admin-card-body">
              {alerts.map((a, i) => (
                <div className="alert-item" key={i}>
                  <div className={`alert-icon ${a.type}`}>{a.icon}</div>
                  <div className="alert-body">
                    <div className="alert-title">{a.title}</div>
                    <div className="alert-meta">{a.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: activity log + top donors */}
      <div className="admin-grid">
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <span style={{ color: 'var(--sy-gold)' }}>◆</span>
              {t(lang, 'admin_activity')}
              {realActivitiesTop.length > 0 ? (
                <span className="admin-card-badge admin-card-badge-live">
                  ● {lang === 'ar' ? 'مباشر' : 'Live'}
                </span>
              ) : (
                <span className="admin-card-badge admin-card-badge-sample">
                  {lang === 'ar' ? 'بيانات عيّنة' : 'Sample data'}
                </span>
              )}
            </div>
            <span className="admin-card-link">{t(lang, 'admin_full_log')}</span>
          </div>
          <div className="admin-card-body">
            {activities.length === 0 && (
              <p className="admin-card-empty">
                {lang === 'ar' ? 'لا يوجد نشاط بعد.' : 'No activity yet.'}
              </p>
            )}
            {activities.map((a, i) => (
              <div className="activity-item" key={i}>
                <div className={`activity-dot ${a.color}`}></div>
                <div className="activity-body">
                  <div className="activity-text" dangerouslySetInnerHTML={{ __html: a.text }} />
                  <div className="activity-time">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <span style={{ color: 'var(--sy-gold)' }}>◆</span>
              {t(lang, 'admin_top_donors')}
              {isShowingDemoDonations ? (
                <span className="admin-card-badge admin-card-badge-demo">
                  ★ {lang === 'ar' ? 'وضع تجريبي' : 'Demo Mode'}
                </span>
              ) : (
                <span className="admin-card-badge admin-card-badge-sample">
                  {lang === 'ar' ? 'بيانات عيّنة' : 'Sample data'}
                </span>
              )}
            </div>
          </div>
          <div className="admin-card-body">
            {topDonorsDisplay.length === 0 && (
              <p className="admin-card-empty">
                {lang === 'ar' ? 'لم يقم أحد بالتبرع بعد.' : 'No donors yet.'}
              </p>
            )}
            {topDonorsDisplay.map((d, i) => (
              <div className="leader-item" key={i}>
                <div className={`leader-rank ${i === 0 ? 'gold' : ''}`}>{fmtNum(lang, i + 1)}</div>
                <div className="leader-name">{d.name}</div>
                <div className="leader-amount">{fmtMoney(lang, currency, d.amountUSD)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Project management — fast access to Decap CMS for editing */}
      <div className="section-header" style={{ marginTop: '0.5rem' }}>
        <h2 className="section-title" style={{ fontSize: '1.6rem' }}>{t(lang, 'admin_manage')}</h2>
        <p className="section-desc" style={{ fontSize: '1rem' }}>
          {t(lang, 'admin_manage_desc_v2')}
        </p>
      </div>

      {/* Primary action: create a new project using the custom editor. */}
      <div className="admin-actions-bar">
        <a
          className="btn-primary admin-new-project-btn"
          href={`${(import.meta as any).env?.BASE_URL ?? '/'}${lang}/admin/new/`}
        >
          + {t(lang, 'admin_new_project')}
        </a>
        <a
          className="btn-secondary"
          href={`${(import.meta as any).env?.BASE_URL ?? '/'}admin/#/collections/projects`}
        >
          {t(lang, 'admin_open_cms')}
        </a>
        <span className="admin-actions-hint">{t(lang, 'admin_actions_hint')}</span>
      </div>

      {/* Search + filter + sort toolbar */}
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
            <button
              className="admin-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label={lang === 'ar' ? 'مسح البحث' : 'Clear search'}
            >
              ✕
            </button>
          )}
        </div>

        <div className="admin-filter-chips">
          {([
            { v: 'all',       label_ar: 'الكل',        label_en: 'All' },
            { v: 'funding',   label_ar: 'مفتوح للتبرع', label_en: 'Funding' },
            { v: 'active',    label_ar: 'قيد التنفيذ',  label_en: 'Active' },
            { v: 'completed', label_ar: 'مكتمل',        label_en: 'Done' },
            { v: 'stalled',   label_ar: 'متعثّر',       label_en: 'Stalled' },
          ] as const).map(o => (
            <button
              key={o.v}
              className={`admin-filter-chip ${statusFilter === o.v ? 'active' : ''}`}
              onClick={() => setStatusFilter(o.v)}
            >
              {lang === 'ar' ? o.label_ar : o.label_en}
            </button>
          ))}
        </div>

        <div className="admin-sort">
          <label className="admin-sort-label">
            {lang === 'ar' ? 'الترتيب:' : 'Sort:'}
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="admin-sort-select"
            aria-label={lang === 'ar' ? 'ترتيب المشاريع' : 'Sort projects'}
          >
            <option value="default">{lang === 'ar' ? 'افتراضي' : 'Default'}</option>
            <option value="pct">{lang === 'ar' ? 'الأكثر تمويلاً %' : 'Most funded %'}</option>
            <option value="donors">{lang === 'ar' ? 'الأكثر متبرعين' : 'Most donors'}</option>
            <option value="amount">{lang === 'ar' ? 'الأكثر تحصيلاً $' : 'Most raised $'}</option>
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
          <div>{t(lang, 'admin_col_donors')}</div>
          <div>{t(lang, 'admin_col_status')}</div>
          <div></div>
        </div>
        {filteredProjects.length === 0 ? (
          <div className="admin-table-empty">
            {lang === 'ar' ? 'لا توجد مشاريع تطابق البحث' : 'No projects match your search'}
          </div>
        ) : filteredProjects.map(p => {
          const pct = Math.round((p.raisedUSD / p.budgetUSD) * 100);
          const statusLabel = t(lang, `status_${p.status}` as any);
          const categoryLabel = t(lang, `cat_${p.category}` as any);
          const editUrl = `${(import.meta as any).env?.BASE_URL ?? '/'}${lang}/admin/edit/${p.id}/`;
          const publicUrl = `${basePath}/projects/${p.id}/`;
          return (
            <div className="admin-table-row" key={p.id}>
              <div>
                <div className="admin-table-name">{loc(lang, p.title)}</div>
                <div className="admin-table-cat">{categoryLabel}</div>
              </div>
              <div>{fmtMoney(lang, currency, p.budgetUSD)}</div>
              <div>
                <div>{fmtMoney(lang, currency, p.raisedUSD)}</div>
                <div style={{ fontSize: '12px', color: 'var(--sy-gold)', fontWeight: 700 }}>{fmtNum(lang, pct)}%</div>
              </div>
              <div>{fmtNum(lang, p.donors)}</div>
              <div>
                <span className={`status-chip status-chip-${p.status}`}>{statusLabel}</span>
              </div>
              <div className="admin-table-actions">
                <a className="admin-edit" href={editUrl} title={t(lang, 'admin_btn_edit_hint')}>
                  ✎ {t(lang, 'admin_btn_edit')}
                </a>
                <a className="admin-view" href={publicUrl} title={t(lang, 'admin_btn_view_hint')}>
                  {t(lang, 'admin_btn_view')}
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Help footer — what staff can edit in the CMS */}
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
    </section>
  );
}

/**
 * Convert a date-ish string to a sortable number. Higher = more recent.
 * Handles ISO dates, Arabic/English relative times ("3 days ago", "منذ ٣ أيام"),
 * and "today"/"yesterday"/"اليوم"/"أمس".
 */
function parseTimeKey(s: string): number {
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0; // 32-bit
  }
  return h;
}

function formatRelativeTime(ms: number, lang: Lang): string {
  if (ms < 60000) return lang === 'ar' ? 'منذ ثوانٍ' : 'just now';
  const min = Math.floor(ms / 60000);
  if (min < 60) return lang === 'ar' ? `منذ ${min} دقيقة` : `${min} min ago`;
  const hr = Math.floor(ms / 3600000);
  if (hr < 24) return lang === 'ar' ? `منذ ${hr} ساعة` : `${hr} hr ago`;
  const day = Math.floor(ms / 86400000);
  return lang === 'ar' ? `منذ ${day} يوم` : `${day} day ago`;
}
