import { useEffect, useRef, useState, type FormEvent } from 'react';
import { t, type Lang } from '../i18n/strings';

// Submissions go to Netlify Forms. The form is registered at build time by the
// static skeleton in public/__forms.html — field names here must match it exactly.
export const FEEDBACK_FORM_NAME = 'feedback';
export const CONTACT_EMAIL = 'info@darayyacitycouncil.com';

type Props = { lang: Lang; onClose: () => void };
type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function FeedbackModal({ lang, onClose }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    setStatus('sending');
    try {
      const body = new URLSearchParams(new FormData(form) as any).toString();
      const res = await fetch('/__forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  const req = <span className="feedback-required" aria-hidden="true"> *</span>;

  return (
    <div
      className="donate-modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="donate-modal feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <button type="button" className="donate-modal-close feedback-modal-close" onClick={onClose} aria-label={t(lang, 'feedback_close')}>
          ✕
        </button>

        {status === 'sent' ? (
          <div className="success-box">
            <div className="success-icon">✓</div>
            <div className="success-title" id="feedback-modal-title">{t(lang, 'feedback_thanks_title')}</div>
            <p className="success-msg">{t(lang, 'feedback_thanks_msg')}</p>
            <button type="button" className="btn-primary" onClick={onClose}>{t(lang, 'feedback_close')}</button>
          </div>
        ) : (
          <form
            name={FEEDBACK_FORM_NAME}
            method="POST"
            data-netlify="true"
            netlify-honeypot="bot-field"
            onSubmit={handleSubmit}
          >
            <input type="hidden" name="form-name" value={FEEDBACK_FORM_NAME} />
            <input type="hidden" name="subject" value="اقتراحات وملاحظات — Website feedback (%{submissionId})" />
            <input type="hidden" name="language" value={lang} />
            <p className="feedback-honeypot" aria-hidden="true">
              <label>Leave empty <input name="bot-field" tabIndex={-1} autoComplete="off" /></label>
            </p>

            <h2 className="donate-modal-title" id="feedback-modal-title">{t(lang, 'feedback_title')}</h2>
            <p className="feedback-intro">{t(lang, 'feedback_intro')}</p>

            <label className="feedback-field">
              <span className="donate-modal-label">{t(lang, 'feedback_name')}</span>
              <input ref={firstFieldRef} type="text" name="name" autoComplete="name" maxLength={120} />
            </label>

            <label className="feedback-field">
              <span className="donate-modal-label">{t(lang, 'feedback_email')}{req}</span>
              <input type="email" name="email" required autoComplete="email" dir="ltr" maxLength={200} />
            </label>

            <label className="feedback-field">
              <span className="donate-modal-label">{t(lang, 'feedback_phone')}{req}</span>
              <input
                type="tel"
                name="phone"
                required
                autoComplete="tel"
                dir="ltr"
                inputMode="tel"
                pattern="[+0-9()\-\s]{6,}"
                maxLength={30}
              />
            </label>

            <label className="feedback-field">
              <span className="donate-modal-label">{t(lang, 'feedback_message')}{req}</span>
              <textarea name="message" required rows={5} maxLength={5000} placeholder={t(lang, 'feedback_message_ph')} />
            </label>

            {status === 'error' && (
              <div className="donate-modal-validation-error" role="alert">
                {t(lang, 'feedback_error')}{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr">{CONTACT_EMAIL}</a>
              </div>
            )}

            <div className="feedback-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>{t(lang, 'feedback_cancel')}</button>
              <button type="submit" className="btn-primary" disabled={status === 'sending'}>
                {status === 'sending' ? t(lang, 'feedback_sending') : t(lang, 'feedback_send')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
