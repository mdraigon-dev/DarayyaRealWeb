import { useState, useEffect } from 'react';
import { loc, fmtMoney, type Lang } from '../i18n/strings';
import { saveDonation } from '../data/demo-donations';
import { remainingRoom, type DemoBreakdown, type SubBudget } from '../data/donation-math';

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
  projectBudgetUSD: number;
  projectRaisedUSD: number;
  subs?: Sub[];
  /** Current demo donation totals so we can compute the room
   *  remaining for new donations. */
  demoBreakdown: DemoBreakdown;
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
  projectBudgetUSD,
  projectRaisedUSD,
  subs,
  demoBreakdown,
  lang,
  currency,
}: Props) {
  const [amount, setAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [subId, setSubId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  // Compute how much room is left for the currently selected target
  // (a specific sub, or the whole project). Updates live as the user
  // toggles the sub picker.
  const subsArr: SubBudget[] = subs || [];
  const room = remainingRoom(projectBudgetUSD, projectRaisedUSD, subsArr, demoBreakdown, subId || undefined);
  const fullyFunded = room === 0;

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      // Pick a sensible default amount: $50 if there's room, else
      // the amount that exactly fills the remaining
      const startAmount = room >= 50 ? 50 : Math.max(1, room);
      setAmount(startAmount);
      setCustomAmount('');
      setName('');
      setSubId('');
      setSubmitting(false);
      setSuccess(false);
      setValidationError('');
    }
  }, [open]);

  // When the user switches sub-project, if their current amount exceeds
  // the new room, clamp it. Don't lose their custom amount entirely —
  // just bring it down to the cap so they can see what they're getting.
  useEffect(() => {
    if (!open) return;
    if (customAmount) {
      const c = parseInt(customAmount, 10) || 0;
      if (c > room) setCustomAmount(String(room));
    } else if (amount > room && room > 0) {
      setAmount(room);
    }
    setValidationError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subId, room]);

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
    if (effectiveAmount <= 0) {
      setValidationError(lang === 'ar' ? 'يرجى إدخال مبلغ أكبر من صفر.' : 'Please enter an amount greater than zero.');
      return;
    }
    if (effectiveAmount > room) {
      setValidationError(
        lang === 'ar'
          ? `المبلغ يتجاوز المتاح. الحد الأقصى: ${fmtMoney(lang, currency, room)}.`
          : `Amount exceeds what's available. Maximum: ${fmtMoney(lang, currency, room)}.`
      );
      return;
    }
    setValidationError('');
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
        ) : fullyFunded ? (
          <div className="donate-modal-fullyfunded">
            <div className="donate-modal-fullyfunded-icon">✓</div>
            <h3>
              {lang === 'ar'
                ? (subId ? 'هذا البند ممول بالكامل' : 'تم تمويل هذا المشروع بالكامل')
                : (subId ? 'This item is fully funded' : 'This project is fully funded')}
            </h3>
            <p>
              {lang === 'ar'
                ? 'شكراً للجميع! يمكنك دعم مشاريع أخرى بدلاً من ذلك.'
                : 'Thank you to everyone! You can support other projects instead.'}
            </p>
            {subId && subs && subs.length > 1 && (
              // The user reached this screen by picking a specific sub that's
              // full. Give them a way to back out and try a different sub or
              // donate to the whole project (which may still have room).
              <button
                type="button"
                className="donate-modal-fullyfunded-back"
                onClick={() => setSubId('')}
              >
                ← {lang === 'ar' ? 'اختر بنداً آخر' : 'Pick a different item'}
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 id="donate-modal-title" className="donate-modal-title">
              {lang === 'ar' ? 'ساهم في' : 'Donate to'}{' '}
              <span className="donate-modal-project">{loc(lang, projectTitle)}</span>
            </h3>

            {/* Sub-project selection FIRST — picking a target changes the cap,
                so the user should pick before entering amount */}
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
                    {lang === 'ar' ? 'المشروع بأكمله (يُملأ البنود بالترتيب)' : 'The whole project (fills items in order)'}
                  </option>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {loc(lang, s.title)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Remaining room indicator — updates live when sub selection changes */}
            <div className="donate-modal-room">
              <span className="donate-modal-room-label">
                {lang === 'ar' ? 'المتاح للتبرع:' : 'Available to donate:'}
              </span>
              <strong className="donate-modal-room-amount">{fmtMoney(lang, currency, room)}</strong>
            </div>

            {/* Amount selection */}
            <div className="donate-modal-section">
              <label className="donate-modal-label">
                {lang === 'ar' ? 'اختر المبلغ' : 'Choose amount'}
              </label>
              <div className="donate-modal-amount-chips">
                {PRESET_AMOUNTS.map((a) => {
                  const overCap = a > room;
                  return (
                    <button
                      type="button"
                      key={a}
                      className={`donate-modal-amount-chip ${amount === a && !customAmount ? 'active' : ''}`}
                      onClick={() => {
                        setAmount(a);
                        setCustomAmount('');
                        setValidationError('');
                      }}
                      disabled={overCap}
                      title={overCap
                        ? (lang === 'ar' ? 'يتجاوز المتاح' : 'Exceeds what\'s available')
                        : undefined}
                    >
                      ${a}
                    </button>
                  );
                })}
              </div>
              <div className="donate-modal-custom-row">
                <label className="donate-modal-label-small">
                  {lang === 'ar'
                    ? `أو أدخل مبلغاً مخصصاً (الحد: ${fmtMoney(lang, currency, room)}):`
                    : `Or enter custom amount (max: ${fmtMoney(lang, currency, room)}):`}
                </label>
                <div className="donate-modal-custom-input">
                  <span className="donate-modal-currency-prefix">$</span>
                  <input
                    type="number"
                    min="1"
                    max={room}
                    step="1"
                    value={customAmount}
                    onChange={(e) => {
                      const v = e.target.value;
                      // Clamp on input so the user can't visually overflow
                      const n = parseInt(v, 10);
                      if (!isNaN(n) && n > room) {
                        setCustomAmount(String(room));
                      } else {
                        setCustomAmount(v);
                      }
                      setValidationError('');
                    }}
                    placeholder={lang === 'ar' ? 'مثلاً ٧٥' : 'e.g. 75'}
                  />
                </div>
              </div>
              {validationError && (
                <div className="donate-modal-validation-error">{validationError}</div>
              )}
            </div>

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
              disabled={effectiveAmount <= 0 || effectiveAmount > room || submitting}
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
