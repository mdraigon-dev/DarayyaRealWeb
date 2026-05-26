import { t, loc, fmtNum, fmtMoney, isAutoTranslated, type Lang } from '../i18n/strings';
import { displayStatus } from '../data/donation-math';

type BilingualMaybeAuto = { ar: string; en?: string; en_auto?: boolean };

export type ProjectCardData = {
  id: string;
  status: 'funding' | 'active' | 'completed' | 'planning';
  category: string; // enum value
  title: BilingualMaybeAuto;
  location: BilingualMaybeAuto;
  description: BilingualMaybeAuto;
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
  // Effective status: 'funding' that's at 100% reads as 'active' to visitors
  const effStatus = displayStatus(project);
  const isUrgent = effStatus === 'funding' && pct < 20;
  const categoryLabel = t(lang, `cat_${project.category}` as any);
  const statusLabel = t(lang, `status_${effStatus}` as any);

  // If any of the displayed bilingual fields is machine-translated for this
  // language, show a single small badge so readers know to take rough phrasing
  // with a grain of salt and report mistranslations.
  const hasAutoTranslation =
    isAutoTranslated(lang, project.title) ||
    isAutoTranslated(lang, project.location) ||
    isAutoTranslated(lang, project.description);

  return (
    <a className={`project-card ${isUrgent ? 'urgent' : ''}`} href={href}>
      {isUrgent && <span className="project-card-urgent-badge">{t(lang, 'urgent_badge')}</span>}
      <div className="project-card-header">
        <span className="project-category">{categoryLabel}</span>
        <span className={`project-status status-${effStatus}`}>{statusLabel}</span>
      </div>
      <h3 className="project-card-title">{loc(lang, project.title)}</h3>
      {hasAutoTranslation && (
        <span className="auto-translated-pill" title={t(lang, 'auto_translated_hint')}>
          ⚙ {t(lang, 'auto_translated_label')}
        </span>
      )}
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
