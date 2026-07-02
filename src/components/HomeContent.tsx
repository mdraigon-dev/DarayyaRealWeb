import Logo from './Logo';
import DarayyaMap from './DarayyaMap';
import ProjectCard, { type ProjectCardData } from './ProjectCard';
import ActivityFeed from './ActivityFeed';
import { useState, useEffect } from 'react';
import { t, loc, fmtNum, fmtMoney, type Lang } from '../i18n/strings';
import { loadDonations } from '../data/demo-donations';
import { applyDemoToProjects, displayStatus } from '../data/donation-math';
import { buildActivityFeed } from '../data/activity-feed';

type Bilingual = { ar: string; en: string };
type HomeProject = ProjectCardData & {
  lat: number;
  lng: number;
  health: 'healthy' | 'warning' | 'stalled' | 'completed';
  daysLeft: number;
  // Optional — used to derive the activity feed at the bottom of the home page
  updates?: Array<{ date: Bilingual; author: Bilingual; body: Bilingual }>;
  comments?: Array<{ author: Bilingual; body: Bilingual; date?: string }>;
  subs?: Array<{ id: string; budgetUSD: number; raisedUSD: number }>;
};

type Props = {
  lang: Lang;
  basePath: string; // e.g. "/darayya-platform/ar"
  baseUrl: string;  // e.g. "/darayya-platform/"
  projects: HomeProject[];
};

export default function HomeContent({ lang, basePath, projects: rawProjects }: Props) {
  const [currency] = useState<'USD' | 'SYP'>('USD');

  // Hold the RAW demo donation array in state, not augmented projects.
  // Augment-projects-on-every-render is cheap and avoids a state-flap bug
  // where the previous architecture briefly showed raw values when Astro
  // re-rendered the React island.
  const [donations, setDonations] = useState<{ projectId: string; subId?: string; amountUSD: number }[]>([]);
  useEffect(() => {
    const refresh = () => setDonations(loadDonations().donations);
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  // Derive augmented projects fresh each render. Pure, deterministic,
  // no race conditions. For ~20 projects × handful of donations this
  // is microseconds of work.
  const projects = applyDemoToProjects(rawProjects, donations);

  const totalRaised = projects.reduce((s, p) => s + p.raisedUSD, 0);
  const totalBudget = projects.reduce((s, p) => s + p.budgetUSD, 0);
  const totalDonors = projects.reduce((s, p) => s + p.donors, 0);
  const completed = projects.filter(p => p.status === 'completed').length;
  const open = projects.filter(p => displayStatus(p) === 'funding').length;

  // Featured = open-for-funding (not yet fully funded), shown least-funded first
  const featured = projects
    .filter(p => displayStatus(p) === 'funding')
    .sort((a, b) => (a.raisedUSD / a.budgetUSD) - (b.raisedUSD / b.budgetUSD))
    .slice(0, 3);

  const urgent = featured[0];

  // Activity feed for the bottom section — up to 10 most recent items
  // across all projects. Mirrors what the dashboard shows.
  const activityEntries = buildActivityFeed(projects, lang, 10);

  const heroTagLines = t(lang, 'hero_h1_tag').split('\n');

  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          <div>
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-dot"></span>
              <span>{t(lang, 'hero_eyebrow')}</span>
            </div>
            <h1>
              {t(lang, 'hero_h1_a')}<span className="gold">{t(lang, 'hero_h1_b')}</span>
              {heroTagLines.map((line, i) => (
                <span key={i}>{i > 0 && <br />}{line}</span>
              ))}
            </h1>
            <p className="hero-tag">{t(lang, 'hero_tag')}</p>
            <div className="hero-actions">
              <a className="btn-primary" href={`${basePath}/projects/`}>
                {t(lang, 'hero_btn_browse', { n: fmtNum(lang, open) })}
              </a>
              <a className="btn-secondary" href={`${basePath}/transparency/`}>
                {t(lang, 'hero_btn_reports')}
              </a>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-emblem">
              <Logo size={90} color="var(--sy-gold-deep)" />
            </div>
            <div className="hero-visual-title">{t(lang, 'hero_stats_title')}</div>
            <div className="stat-row">
              <span className="stat-label">{t(lang, 'hero_stat_raised')}</span>
              <span className="stat-value">{fmtMoney(lang, currency, totalRaised)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">{t(lang, 'hero_stat_target')}</span>
              <span className="stat-value">{fmtMoney(lang, currency, totalBudget)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">{t(lang, 'hero_stat_donors')}</span>
              <span className="stat-value">{fmtNum(lang, totalDonors)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">{t(lang, 'hero_stat_open')}</span>
              <span className="stat-value">{fmtNum(lang, open)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">{t(lang, 'hero_stat_completed')}</span>
              <span className="stat-value">{fmtNum(lang, completed)}</span>
            </div>
          </div>
        </div>
      </section>

      {urgent && (
        <div className="urgent-banner">
          <div className="urgent-banner-content">
            <div className="urgent-banner-eyebrow">{t(lang, 'urgent_eyebrow')}</div>
            <h3>{loc(lang, urgent.title)}</h3>
            <p>
              {loc(lang, urgent.location)} • {t(lang, 'urgent_meta', {
                pct: fmtNum(lang, Math.round((urgent.raisedUSD / urgent.budgetUSD) * 100)),
                days: fmtNum(lang, urgent.daysLeft),
              })}
            </p>
          </div>
          <a className="urgent-banner-btn" href={`${basePath}/projects/${urgent.id}/`}>
            {t(lang, 'urgent_btn')}
          </a>
        </div>
      )}

      <div className="star-divider">★ ★ ★</div>

      <div className="map-section">
        <div className="section-header" style={{ marginBottom: '1.5rem' }}>
          <div className="section-eyebrow">{t(lang, 'map_eyebrow')}</div>
          <h2 className="section-title">{t(lang, 'map_title')}</h2>
          <p className="section-desc">{t(lang, 'map_desc')}</p>
        </div>
        <DarayyaMap projects={projects} lang={lang} basePath={basePath} />
      </div>

      <section className="section">
        <div className="section-header">
          <div className="section-eyebrow">{t(lang, 'featured_eyebrow')}</div>
          <h2 className="section-title">{t(lang, 'featured_title')}</h2>
          <p className="section-desc">{t(lang, 'featured_desc')}</p>
        </div>
        <div className="projects-grid">
          {featured.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              href={`${basePath}/projects/${p.id}/`}
              lang={lang}
              currency={currency}
            />
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <a className="btn-secondary" href={`${basePath}/projects/`}>
            {t(lang, 'featured_all_btn', { n: fmtNum(lang, projects.length) })}
          </a>
        </div>
      </section>

      {/* Activity log — a mirror of the council dashboard's feed, placed
          at the bottom of the home page so anyone can see what's been
          happening on the projects (field updates + comments, newest first).
          Derived from the same data, via the shared buildActivityFeed. */}
      <section className="section home-activity-section">
        <div className="section-header">
          <h2 className="section-title">
            {lang === 'ar' ? 'النشاط الأخير' : 'Recent Activity'}
          </h2>
        </div>
        <ActivityFeed
          entries={activityEntries}
          lang={lang}
          basePath={basePath}
          emptyText={lang === 'ar'
            ? 'لا توجد أنشطة بعد. عندما ينشر فريقنا تحديثات أو تعليقات على المشاريع، ستظهر هنا.'
            : "No activity yet. When our team posts updates or comments on projects, they'll show up here."}
        />
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <a className="btn-secondary" href={`${basePath}/admin/`}>
            {lang === 'ar' ? 'عرض لوحة المجلس الكاملة ←' : 'View full council dashboard →'}
          </a>
        </div>
      </section>
    </>
  );
}
