import { t, type Lang } from '../i18n/strings';

type Props = {
  health: 'healthy' | 'warning' | 'stalled' | 'completed';
  lang: Lang;
};

export default function HealthPill({ health, lang }: Props) {
  return (
    <span className={`health-pill ${health}`}>
      <span className="health-pill-dot"></span>
      {t(lang, `health_${health}` as any)}
    </span>
  );
}
