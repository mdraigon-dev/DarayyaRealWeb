import { useCallback, useState } from 'react';
import Logo from './Logo';
import FeedbackModal, { CONTACT_EMAIL } from './FeedbackModal';
import { t, type Lang } from '../i18n/strings';

type Props = { lang: Lang };

export default function Footer({ lang }: Props) {
  const base = (import.meta as any).env?.BASE_URL ?? '/';
  const link = (path: string) => `${base}${lang}${path}`;
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const closeFeedback = useCallback(() => setFeedbackOpen(false), []);

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
          <a href={link('/contribute/')}>{t(lang, 'nav_donate')}</a>
        </div>
        <div className="footer-col">
          <h4>{t(lang, 'footer_contact')}</h4>
          <span>{t(lang, 'footer_council')}</span>
          <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr">{CONTACT_EMAIL}</a>
          <button type="button" className="footer-feedback-btn" onClick={() => setFeedbackOpen(true)}>
            {t(lang, 'footer_feedback')}
          </button>
        </div>
      </div>
      <div className="footer-bottom">
        <span>{t(lang, 'footer_copyright')}</span>
        <span>{t(lang, 'footer_design')}</span>
      </div>
      {feedbackOpen && <FeedbackModal lang={lang} onClose={closeFeedback} />}
    </footer>
  );
}
