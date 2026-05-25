import Logo from './Logo';
import { t, type Lang } from '../i18n/strings';

type Props = { lang: Lang };

export default function Footer({ lang }: Props) {
  const base = (import.meta as any).env?.BASE_URL ?? '/';
  const link = (path: string) => `${base}${lang}${path}`;

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">
            <Logo size={64} color="var(--sy-gold)" />
          </div>
          <div>
            <h3>{t(lang, 'footer_brand')}</h3>
            <p>{t(lang, 'footer_about')}</p>
          </div>
        </div>
        <div className="footer-col">
          <h4>{t(lang, 'footer_nav')}</h4>
          <a href={link('/')}>{t(lang, 'nav_home')}</a>
          <a href={link('/projects/')}>{t(lang, 'nav_projects')}</a>
          <a href={link('/transparency/')}>{t(lang, 'nav_transparency')}</a>
        </div>
        <div className="footer-col">
          <h4>{t(lang, 'footer_contact')}</h4>
          <span>{t(lang, 'footer_council')}</span>
          <span>info@darayya-council.sy</span>
          <span>+963 11 445 6789</span>
          <a href={`mailto:info@darayya-council.sy?subject=${encodeURIComponent(t(lang, 'footer_feedback'))}`}>
            {t(lang, 'footer_feedback')}
          </a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>{t(lang, 'footer_copyright')}</span>
        <span>{t(lang, 'footer_design')}</span>
      </div>
    </footer>
  );
}
