import { useState, useEffect } from 'react';
import { loc, fmtMoney, type Lang } from '../i18n/strings';
import { saveDonation } from '../data/demo-donations';

type Bilingual = { ar: string; en: string };
type Sub = {
  id: string;
  title: Bilingual;
  budgetUSD: number;
  raisedUSD: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onDonated: () => void;
  projectId: string;
  projectTitle: Bilingual;
  subs?: Sub[];
  lang: Lang;
  currency: 'USD' | 'SYP';
};

const PRESET_AMOUNTS = [10, 25, 50, 100, 250];

export default function DonationModal({
  open,
  onClose,
  onDonated,
  projectId,
  projectTitle,
  subs,
  lang,
  currency,
}: Props) {
  const [amount, setAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [subId, setSubId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setAmount(50);
      setCustomAmount('');
      setName('');
      setSubId('');
      setSubmitting(false);
      setSuccess(false);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const effectiveAmount = customAmount
    ? Math.max(0, parseInt(customAmount, 10) || 0)
    : amount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveAmount <= 0) return;
    setSubmitting(true);

    // Brief processing delay so it feels like a real transaction
    setTimeout(() => {
      saveDonation({
        projectId,
        subId: subId || undefined,
        amountUSD: effectiveAmount,
        name: name.trim() || undefined,
        timestamp: Date.now(),
      });
      setSuccess(true);
      onDonated();
      // Auto-close after success
      setTimeout(() => onClose(), 1800);
    }, 600);
  };

  return (
    <div className="donate-modal-backdrop" onClick={onClose}>
      <div
        className="donate-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="donate-modal-title"
      >
        {/* Demo Mode banner — non-dismissible, bright yellow */}
        <div className="donate-modal-demo-banner">
          ★ {lang === 'ar'
            ? 'وضع تجريبي — لن يتم خصم أي مبلغ. التبرع يُحفظ على هذا الجهاز فقط للعرض التجريبي.'
            : 'Demo Mode — no money will be charged. Donation is saved on this device only for demonstration.'}
        </div>

        <button
          className="donate-modal-close"
          onClick={onClose}
          aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
        >
          ✕
        </button>

        {success ? (
          <div className="donate-modal-success">
            <div className="donate-modal-success-icon">✓</div>
            <h3>
              {lang === 'ar' ? 'شكراً لك!' : 'Thank you!'}
              {name && <span className="donate-modal-success-name">, {name}</span>}
            </h3>
            <p>
              {lang === 'ar'
                ? `تم تسجيل تبرعك التجريبي بقيمة ${fmtMoney(lang, currency, effectiveAmount)}`
                : `Your demo donation of ${fmtMoney(lang, currency, effectiveAmount)} has been recorded`}
            </p>
            <p className="donate-modal-success-hint">
              {lang === 'ar'
                ? 'محفوظ في متصفحك فقط — لن يراه أحد آخر'
                : 'Saved in your browser only — no one else can see it'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 id="donate-modal-title" className="donate-modal-title">
              {lang === 'ar' ? 'ساهم في' : 'Donate to'}{' '}
              <span className="donate-modal-project">{loc(lang, projectTitle)}</span>
            </h3>

            {/* Amount selection */}
            <div className="donate-modal-section">
              <label className="donate-modal-label">
                {lang === 'ar' ? 'اختر المبلغ' : 'Choose amount'}
              </label>
              <div className="donate-modal-amount-chips">
                {PRESET_AMOUNTS.map((a) => (
                  <button
                    type="button"
                    key={a}
                    className={`donate-modal-amount-chip ${amount === a && !customAmount ? 'active' : ''}`}
                    onClick={() => {
                      setAmount(a);
                      setCustomAmount('');
                    }}
                  >
                    ${a}
                  </button>
                ))}
              </div>
              <div className="donate-modal-custom-row">
                <label className="donate-modal-label-small">
                  {lang === 'ar' ? 'أو أدخل مبلغاً مخصصاً:' : 'Or enter custom amount:'}
                </label>
                <div className="donate-modal-custom-input">
                  <span className="donate-modal-currency-prefix">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثلاً ٧٥' : 'e.g. 75'}
                  />
                </div>
              </div>
            </div>

            {/* Sub-project selection if any */}
            {subs && subs.length > 0 && (
              <div className="donate-modal-section">
                <label className="donate-modal-label">
                  {lang === 'ar' ? 'تبرع لبند معيّن (اختياري)' : 'Donate to a specific item (optional)'}
                </label>
                <select
                  value={subId}
                  onChange={(e) => setSubId(e.target.value)}
                  className="donate-modal-select"
                >
                  <option value="">
                    {lang === 'ar' ? 'المشروع بأكمله' : 'The whole project'}
                  </option>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {loc(lang, s.title)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Donor name */}
            <div className="donate-modal-section">
              <label className="donate-modal-label">
                {lang === 'ar' ? 'اسمك (اختياري)' : 'Your name (optional)'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={lang === 'ar' ? 'متبرع مجهول' : 'Anonymous donor'}
                className="donate-modal-input"
                maxLength={60}
              />
            </div>

            <button
              type="submit"
              className="donate-modal-submit"
              disabled={effectiveAmount <= 0 || submitting}
            >
              {submitting
                ? (lang === 'ar' ? 'جاري المعالجة…' : 'Processing…')
                : `${lang === 'ar' ? 'تبرع بـ' : 'Donate'} ${fmtMoney(lang, currency, effectiveAmount)}`}
            </button>

            <p className="donate-modal-footnote">
              {lang === 'ar'
                ? '★ هذه عملية تجريبية — لا يتم استخدام أي بطاقة ائتمان ولا يتم خصم أي مبلغ.'
                : '★ This is a demo flow — no credit card is used and no money is charged.'}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
