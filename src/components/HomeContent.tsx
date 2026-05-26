import Logo from './Logo';
import DarayyaMap from './DarayyaMap';
import ProjectCard, { type ProjectCardData } from './ProjectCard';
import { useState, useEffect } from 'react';
import { t, loc, fmtNum, fmtMoney, type Lang } from '../i18n/strings';
import { loadDonations } from '../data/demo-donations';
import { applyDemoToProjects } from '../data/donation-math';

type HomeProject = ProjectCardData & {
  lat: number;
  lng: number;
  health: 'healthy' | 'warning' | 'stalled' | 'completed';
  daysLeft: number;
};

type Props = {
  lang: Lang;
  basePath: string; // e.g. "/darayya-platform/ar"
  baseUrl: string;  // e.g. "/darayya-platform/"
  projects: HomeProject[];
};

export default function HomeContent({ lang, basePath, baseUrl, projects: rawProjects }: Props) {
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
  const open = projects.filter(p => p.status === 'funding').length;

  const featured = projects
    .filter(p => p.status === 'funding')
    .sort((a, b) => (a.raisedUSD / a.budgetUSD) - (b.raisedUSD / b.budgetUSD))
    .slice(0, 3);

  const urgent = featured[0];

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
    </>
  );
}
