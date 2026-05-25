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

  const totalRaised = projects.reduce((s, p) => s + p.raisedUSD, 0);
  const totalDonors = projects.reduce((s, p) => s + p.donors, 0);
  const openCount = projects.filter(p => p.status === 'funding').length;
  const weekTotal = weekData.reduce((s, d) => s + d.amount, 0);
  const maxBar = Math.max(...weekData.map(d => d.amount));
  // Today's donations from feed approximation (first 3 entries' sum, since they're "minutes ago")
  const todayDonations = donations.slice(0, 4).reduce((s, d) => s + d.amountUSD, 0);

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

      {/* Project management — read-only list with link to Decap CMS */}
      <div className="section-header" style={{ marginTop: '0.5rem' }}>
        <h2 className="section-title" style={{ fontSize: '1.6rem' }}>{t(lang, 'admin_manage')}</h2>
        <p className="section-desc" style={{ fontSize: '1rem' }}>
          {t(lang, 'admin_manage_desc').split('{link}').map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <a href={`${(import.meta as any).env?.BASE_URL ?? '/'}admin/`}
                   style={{ color: 'var(--sy-green-dk)', fontWeight: 700, textDecoration: 'underline' }}>
                  {t(lang, 'admin_cms_link')}
                </a>
              )}
            </span>
          ))}
        </p>
      </div>

      <div className="admin-table">
        <div className="admin-table-head">
          <div>{t(lang, 'admin_col_project')}</div>
          <div>{t(lang, 'admin_col_budget')}</div>
          <div>{t(lang, 'admin_col_raised')}</div>
          <div>{t(lang, 'admin_col_donors')}</div>
          <div></div>
        </div>
        {projects.map(p => {
          const pct = Math.round((p.raisedUSD / p.budgetUSD) * 100);
          const statusLabel = t(lang, `status_${p.status}` as any);
          const categoryLabel = t(lang, `cat_${p.category}` as any);
          return (
            <div className="admin-table-row" key={p.id}>
              <div>
                <div className="admin-table-name">{loc(lang, p.title)}</div>
                <div className="admin-table-cat">{categoryLabel} • {statusLabel}</div>
              </div>
              <div>{fmtMoney(lang, currency, p.budgetUSD)}</div>
              <div>
                <div>{fmtMoney(lang, currency, p.raisedUSD)}</div>
                <div style={{ fontSize: '12px', color: 'var(--sy-gold)', fontWeight: 700 }}>{fmtNum(lang, pct)}%</div>
              </div>
              <div>{fmtNum(lang, p.donors)}</div>
              <div>
                <a className="admin-edit" href={`${basePath}/projects/${p.id}/`}>
                  {t(lang, 'admin_btn_edit')}
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
