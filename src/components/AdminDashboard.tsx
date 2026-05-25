import { useState, useEffect } from 'react';
import { t, loc, fmtNum, fmtMoney, type Lang } from '../i18n/strings';
import { adminData } from '../data/admin-sample';

type Bilingual = { ar: string; en: string };
type Project = {
  id: string;
  category: string;
  status: 'funding' | 'active' | 'completed' | 'planning';
  title: Bilingual;
  statusLabel?: never;
  budgetUSD: number;
  raisedUSD: number;
  donors: number;
};

type Props = {
  lang: Lang;          // URL-based default
  basePath: string;
  projects: Project[];
};

// Where we persist the admin's preferred dashboard language
const ADMIN_LANG_STORAGE_KEY = 'darayya-admin-lang';

export default function AdminDashboard({ lang: urlLang, basePath, projects }: Props) {
  // Effective dashboard language. Priority:
  //   1. Saved preference in localStorage (if any)
  //   2. The URL-based language passed as prop
  const [lang, setLang] = useState<Lang>(urlLang);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Read preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ADMIN_LANG_STORAGE_KEY);
      if (saved === 'ar' || saved === 'en') {
        setLang(saved);
      }
    } catch {
      // localStorage might be disabled; fall back to URL lang
    }
    setPrefsLoaded(true);
  }, []);

  // Persist whenever the admin changes their preference
  const changeLang = (newLang: Lang) => {
    setLang(newLang);
    try {
      localStorage.setItem(ADMIN_LANG_STORAGE_KEY, newLang);
    } catch {
      // localStorage might be disabled; the change still takes effect for this session
    }
    // Also update the document direction so RTL/LTR layout flips immediately
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLang;
      document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    }
  };

  const [currency] = useState<'USD' | 'SYP'>('USD');
  const { donations, alerts, activities, topDonors, weekData } = adminData(lang);

  // Search & filter state for the project table — makes the dashboard feel
  // like a real working tool for non-technical staff
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'funding' | 'active' | 'completed' | 'stalled'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'pct' | 'donors' | 'amount'>('default');

  const totalRaised = projects.reduce((s, p) => s + p.raisedUSD, 0);
  const totalDonors = projects.reduce((s, p) => s + p.donors, 0);
  const openCount = projects.filter(p => p.status === 'funding').length;
  const weekTotal = weekData.reduce((s, d) => s + d.amount, 0);
  const maxBar = Math.max(...weekData.map(d => d.amount));
  // Today's donations from feed approximation (first 3 entries' sum, since they're "minutes ago")
  const todayDonations = donations.slice(0, 4).reduce((s, d) => s + d.amountUSD, 0);

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
      {/* Preference bar — language picker for the admin */}
      <div className="admin-prefs-bar">
        <span className="admin-prefs-label">
          {lang === 'ar' ? 'لغة لوحة المجلس:' : 'Dashboard language:'}
        </span>
        <div className="admin-prefs-toggle">
          <button
            className={lang === 'ar' ? 'active' : ''}
            onClick={() => changeLang('ar')}
            aria-pressed={lang === 'ar'}
          >
            العربية
          </button>
          <button
            className={lang === 'en' ? 'active' : ''}
            onClick={() => changeLang('en')}
            aria-pressed={lang === 'en'}
          >
            English
          </button>
        </div>
        <span className="admin-prefs-hint">
          {lang === 'ar' ? '★ يُحفَظ تفضيلك تلقائياً' : '★ Your preference is saved automatically'}
        </span>
      </div>

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
              const cmsUrl = `${(import.meta as any).env?.BASE_URL ?? '/'}admin/#/collections/projects/entries/${p.id}`;
              return (
                <a key={p.id} href={cmsUrl} className="needs-attention-item">
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
            </div>
            <span className="admin-card-link">{t(lang, 'admin_view_all')}</span>
          </div>
          <div className="admin-card-body">
            {donations.slice(0, 8).map((d, i) => (
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
              </div>
            </div>
            <div className="chart-week">
              <div className="chart-bars">
                {weekData.map((d, i) => (
                  <div key={i}
                       className={`chart-bar ${d.today ? 'today' : ''}`}
                       style={{ height: `${(d.amount / maxBar) * 100}%` }}>
                    <span className="chart-bar-tooltip">{fmtMoney(lang, currency, d.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="chart-labels">
                {weekData.map((d, i) => (
                  <span key={i} className={`chart-label ${d.today ? 'today' : ''}`}>{d.short}</span>
                ))}
              </div>
              <div className="chart-summary">
                <span>{t(lang, 'admin_week_total')} <strong>{fmtMoney(lang, currency, weekTotal)}</strong></span>
                <span style={{ color: 'var(--sy-green)', fontWeight: 700 }}>{t(lang, 'admin_week_trend')}</span>
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
            </div>
            <span className="admin-card-link">{t(lang, 'admin_full_log')}</span>
          </div>
          <div className="admin-card-body">
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
            </div>
          </div>
          <div className="admin-card-body">
            {topDonors.map((d, i) => (
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

      {/* Primary action: create a new project. Links straight to Decap's new-entry form. */}
      <div className="admin-actions-bar">
        <a
          className="btn-primary admin-new-project-btn"
          href={`${(import.meta as any).env?.BASE_URL ?? '/'}admin/#/collections/projects/new`}
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
          const cmsEditUrl = `${(import.meta as any).env?.BASE_URL ?? '/'}admin/#/collections/projects/entries/${p.id}`;
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
                <a className="admin-edit" href={cmsEditUrl} title={t(lang, 'admin_btn_edit_hint')}>
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
