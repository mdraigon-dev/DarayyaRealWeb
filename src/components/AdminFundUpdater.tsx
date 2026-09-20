import { useState, useEffect } from 'react';
import { t, loc, fmtMoney, type Lang } from '../i18n/strings';
import { addProjectFunds } from '../data/project-file-edit';
import { classifyUser, type ProjectEngineer, type AuthUser } from '../data/permissions';

declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

type Bilingual = { ar: string; en: string };
type FundSub = { id: string; title: Bilingual; budgetUSD: number; raisedUSD: number };

type Props = {
  projectId: string;
  /** Live subs (may already reflect this session's optimistic updates) */
  subs: FundSub[];
  /** Live project-level raised total (used when the project has no subs) */
  projectRaisedUSD: number;
  totalBudgetUSD: number;
  engineers: ProjectEngineer[];
  lang: Lang;
  currency: 'USD' | 'SYP';
  /** Called after a successful commit so the page can update its totals now */
  onUpdated: (r: { subId?: string; amount: number }) => void;
};

type AuthState =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; user: AuthUser };

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'error'; message: string };

/**
 * AdminFundUpdater
 *
 * Admin-only inline panel that records a real contribution against a project.
 * It commits the project's raisedUSD (or a chosen sub's) to the repo via Git
 * Gateway, so the number becomes public on the next rebuild. This is the
 * persistent replacement for the removed public "donate" flow — only signed-in
 * admins can move the funding number.
 */
export default function AdminFundUpdater({
  projectId,
  subs,
  projectRaisedUSD,
  totalBudgetUSD,
  engineers,
  lang,
  currency,
  onUpdated,
}: Props) {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });
  const hasSubs = subs.length > 0;
  const [target, setTarget] = useState<string>(hasSubs ? subs[0].id : '');
  const [amount, setAmount] = useState('');
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const init = () => {
      if (cancelled) return;
      const ni = window.netlifyIdentity;
      if (!ni) {
        if (++tries < 40) setTimeout(init, 100);
        else setAuth({ kind: 'anonymous' });
        return;
      }
      try { ni.init(); } catch {}
      const user = ni.currentUser();
      setAuth(user ? { kind: 'authenticated', user } : { kind: 'anonymous' });
      ni.on('login', (u: any) => setAuth({ kind: 'authenticated', user: u }));
      ni.on('logout', () => setAuth({ kind: 'anonymous' }));
    };
    init();
    return () => { cancelled = true; };
  }, []);

  // Keep a valid default target if the subs list changes.
  useEffect(() => {
    if (hasSubs && !subs.some((s) => s.id === target)) setTarget(subs[0].id);
  }, [subs, hasSubs, target]);

  if (auth.kind !== 'authenticated') return null;
  // Funds are admin-only (money is sensitive) — engineers-of-project can post
  // notes/updates but not move the funding number.
  if (classifyUser(auth.user, engineers) !== 'admin') return null;

  const currentRaised = hasSubs
    ? subs.reduce((a, s) => a + s.raisedUSD, 0)
    : projectRaisedUSD;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt === 0) {
      setSave({ kind: 'error', message: t(lang, 'fund_invalid') });
      return;
    }
    setSave({ kind: 'saving' });
    try {
      const subId = hasSubs ? target : undefined;
      const targetLabel = subId
        ? loc(lang, subs.find((s) => s.id === subId)!.title)
        : 'project';
      const who = auth.user.email;
      const sign = amt > 0 ? '+' : '';
      const message = `Update funds: ${sign}$${amt} to ${targetLabel} (${projectId}) by ${who}`;

      await addProjectFunds({ projectId, subId, amountUSD: amt, message });

      onUpdated({ subId, amount: amt });
      setSave({ kind: 'idle' });
      setAmount('');
      setFlash(true);
      setTimeout(() => setFlash(false), 4000);
    } catch (err: any) {
      const raw = err?.message || 'Save failed';
      const message =
        raw === 'NOT_FOUND'
          ? (lang === 'ar' ? 'لم يتم العثور على ملف المشروع' : 'Project file not found')
          : raw === 'CONFLICT'
            ? (lang === 'ar'
                ? 'تعذّر الحفظ بسبب تعارض مستمر. حدّث الصفحة وحاول مجدداً.'
                : "Couldn't save due to a persistent conflict. Refresh and try again.")
            : raw;
      setSave({ kind: 'error', message });
    }
  };

  return (
    <div className="fund-admin">
      <div className="fund-admin-head">
        <span className="fund-admin-icon">＄</span>
        <div>
          <strong>{t(lang, 'fund_admin_title')}</strong>
          <div className="fund-admin-sub">{t(lang, 'fund_admin_hint')}</div>
        </div>
      </div>

      <div className="fund-admin-current">
        {t(lang, 'fund_current')}: <strong>{fmtMoney(lang, currency, currentRaised)}</strong>
        {' / '}
        {fmtMoney(lang, currency, totalBudgetUSD)}
      </div>

      <form className="fund-admin-form" onSubmit={handleSubmit}>
        {hasSubs && (
          <label className="fund-admin-field">
            <span>{t(lang, 'fund_target_label')}</span>
            <select
              className="fund-admin-select"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={save.kind === 'saving'}
            >
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {loc(lang, s.title)} — {fmtMoney(lang, currency, s.raisedUSD)} / {fmtMoney(lang, currency, s.budgetUSD)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="fund-admin-field">
          <span>{t(lang, 'fund_amount_label')}</span>
          <input
            type="number"
            className="fund-admin-input"
            dir="ltr"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t(lang, 'fund_amount_ph')}
            step="1"
            disabled={save.kind === 'saving'}
          />
        </label>

        {save.kind === 'error' && (
          <div className="fund-admin-error">⚠ {save.message}</div>
        )}
        {flash && save.kind !== 'error' && (
          <div className="fund-admin-flash">✓ {t(lang, 'fund_added')}</div>
        )}

        <button
          type="submit"
          className="fund-admin-btn"
          disabled={save.kind === 'saving' || !amount.trim()}
        >
          {save.kind === 'saving' ? t(lang, 'fund_adding') : t(lang, 'fund_add_btn')}
        </button>
      </form>
    </div>
  );
}
