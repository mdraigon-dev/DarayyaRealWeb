import { t, loc, fmtNum, fmtMoney, type Lang } from '../i18n/strings';

export type ProjectCardData = {
  id: string;
  status: 'funding' | 'active' | 'completed' | 'planning';
  category: string; // enum value
  title: { ar: string; en: string };
  location: { ar: string; en: string };
  description: { ar: string; en: string };
  budgetUSD: number;
  raisedUSD: number;
  donors: number;
};

type Props = {
  project: ProjectCardData;
  href: string;
  lang: Lang;
  currency: 'USD' | 'SYP';
};

export default function ProjectCard({ project, href, lang, currency }: Props) {
  const pct = Math.round((project.raisedUSD / project.budgetUSD) * 100);
  const isUrgent = project.status === 'funding' && pct < 20;
  const categoryLabel = t(lang, `cat_${project.category}` as any);
  const statusLabel = t(lang, `status_${project.status}` as any);

  return (
    <a className={`project-card ${isUrgent ? 'urgent' : ''}`} href={href}>
      {isUrgent && <span className="project-card-urgent-badge">{t(lang, 'urgent_badge')}</span>}
      <div className="project-card-header">
        <span className="project-category">{categoryLabel}</span>
        <span className={`project-status status-${project.status}`}>{statusLabel}</span>
      </div>
      <h3 className="project-card-title">{loc(lang, project.title)}</h3>
      <div className="project-card-location">
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        {loc(lang, project.location)}
      </div>
      <p className="project-card-desc">{loc(lang, project.description)}</p>
      <div className="progress">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }}></div>
        </div>
        <div className="progress-meta">
          <span className="progress-percent">{fmtNum(lang, pct)}%</span>
          <span className="progress-amount">
            <span className="raised">{fmtMoney(lang, currency, project.raisedUSD)}</span>{' '}
            {t(lang, 'progress_of')} {fmtMoney(lang, currency, project.budgetUSD)}
          </span>
        </div>
      </div>
    </a>
  );
}
