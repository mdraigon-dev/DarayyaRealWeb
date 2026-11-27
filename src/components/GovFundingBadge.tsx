import { t, type Lang } from '../i18n/strings';
import { govFundingOf } from '../data/gov-funding';

/** "Government-funded" / "Partly government-funded" pill; nothing when not. */
export default function GovFundingBadge({ project, lang }: { project: { govFunding?: unknown }; lang: Lang }) {
  const g = govFundingOf(project);
  if (g.type === 'none') return null;
  return (
    <span className={`gov-badge gov-badge--${g.type}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10h20L12 3z" /></svg>
      {t(lang, g.type === 'full' ? 'gov_badge_full' : 'gov_badge_partial')}
    </span>
  );
}
