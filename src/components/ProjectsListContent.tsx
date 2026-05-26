import { useMemo, useState, useEffect } from 'react';
import ProjectCard, { type ProjectCardData } from './ProjectCard';
import { t, fmtNum, type Lang } from '../i18n/strings';
import { loadDonations } from '../data/demo-donations';
import { applyDemoToProjects } from '../data/donation-math';

type Props = {
  lang: Lang;
  basePath: string;
  projects: ProjectCardData[];
};

const CATEGORIES = ['all', 'roads', 'water', 'sewer', 'lighting', 'communications', 'facilities'] as const;
const STATUSES = ['all', 'funding', 'active', 'completed'] as const;

export default function ProjectsListContent({ lang, basePath, projects: rawProjects }: Props) {
  const [catKey, setCatKey] = useState<typeof CATEGORIES[number]>('all');
  const [statusKey, setStatusKey] = useState<typeof STATUSES[number]>('funding');
  const [currency] = useState<'USD' | 'SYP'>('USD');

  // Hold the RAW donation array in state, not augmented projects.
  // Derive on every render to avoid state-flap bugs.
  const [donations, setDonations] = useState<{ projectId: string; subId?: string; amountUSD: number }[]>([]);
  useEffect(() => {
    const refresh = () => setDonations(loadDonations().donations);
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  const projects = applyDemoToProjects(rawProjects, donations);

  const filtered = useMemo(() => projects.filter(p =>
    (catKey === 'all' || p.category === catKey) &&
    (statusKey === 'all' || p.status === statusKey)
  ), [catKey, statusKey, projects]);

  return (
    <section className="section">
      <div className="section-header">
        <div className="section-eyebrow">{t(lang, 'projects_eyebrow')}</div>
        <h2 className="section-title">{t(lang, 'projects_title')}</h2>
        <p className="section-desc">{t(lang, 'projects_desc')}</p>
      </div>

      <div className="filters">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
          {CATEGORIES.map(k => (
            <button key={k}
                    className={`filter-chip ${catKey === k ? 'active' : ''}`}
                    onClick={() => setCatKey(k)}>
              {t(lang, `cat_${k}` as any)}
            </button>
          ))}
        </div>
      </div>

      <div className="filters">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
          {STATUSES.map(k => (
            <button key={k}
                    className={`filter-chip ${statusKey === k ? 'active' : ''}`}
                    onClick={() => setStatusKey(k)}>
              {t(lang, `status_${k}` as any)}
            </button>
          ))}
        </div>
      </div>

      <div className="results-count">
        {t(lang, 'projects_results')} <strong>{fmtNum(lang, filtered.length)}</strong> {t(lang, 'projects_count_label')}
        {catKey !== 'all' && <> — {t(lang, 'projects_in_cat')} <strong>{t(lang, `cat_${catKey}` as any)}</strong></>}
      </div>

      <div className="projects-grid">
        {filtered.map(p => (
          <ProjectCard key={p.id} project={p} href={`${basePath}/projects/${p.id}/`} lang={lang} currency={currency} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--sy-muted)' }}>
          {t(lang, 'projects_empty')}
        </div>
      )}
    </section>
  );
}
