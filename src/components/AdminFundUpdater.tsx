import { useState, useEffect } from 'react';
import { t, loc, fmtMoney, type Lang } from '../i18n/strings';
import { addProjectFunds } from '../data/project-file-edit';
import { can, type ProjectEngineer, type AuthUser } from '../data/permissions';
import { loadPrefs, preferredAuthorName } from '../data/admin-prefs';
import { commitName } from '../data/admin-prefs';
import { saveErrorMessage } from '../data/repo';

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
  if (!can(auth.user, 'record-funds')) return null;

  const currentRaised = hasSubs
    ? subs.reduce((a, s) => a + s.raisedUSD, 0)
    : projectRaisedUSD;

  // The most that can still be added to the chosen target without passing its
  // budget. Contributions can only go up, and never beyond what was planned.
  const targetSub = hasSubs ? subs.find((s) => s.id === target) : undefined;
  const remaining = Math.max(
    0,
    targetSub
      ? targetSub.budgetUSD - targetSub.raisedUSD
      : totalBudgetUSD - projectRaisedUSD,
  );
  const fullyFunded = remaining <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setSave({ kind: 'error', message: t(lang, 'fund_invalid') });
      return;
    }
    if (amt > remaining) {
      setSave({
        kind: 'error',
        message: t(lang, 'fund_exceeds', { max: fmtMoney(lang, currency, remaining) }),
      });
      return;
    }
    setSave({ kind: 'saving' });
    try {
      const subId = hasSubs ? target : undefined;
      const targetLabel = subId
        ? loc(lang, subs.find((s) => s.id === subId)!.title)
        : 'project';
      const who = commitName(auth.user);
      const message = `Update funds: +$${amt} to ${targetLabel} (${projectId}) by ${who}`;

      // Recorded under the admin's chosen display name (never their email),
      // since fund records appear in the public activity log.
      const name = preferredAuthorName(auth.user, loadPrefs(auth.user.email));
      const by = name.includes('@') ? undefined : name;
      await addProjectFunds({ projectId, subId, amountUSD: amt, message, by });

      onUpdated({ subId, amount: amt });
      setSave({ kind: 'idle' });
      setAmount('');
      setFlash(true);
      setTimeout(() => setFlash(false), 4000);
    } catch (err: any) {
      const raw = err?.code === 'EXCEEDS_BUDGET' ? 'EXCEEDS_BUDGET' : (err?.message || 'Save failed');
      const message =
        raw === 'NOT_FOUND'
          ? (lang === 'ar' ? 'لم يتم العثور على ملف المشروع' : 'Project file not found')
          : raw === 'EXCEEDS_BUDGET'
            ? t(lang, 'fund_exceeds_live')
          : raw === 'INVALID_AMOUNT'
            ? t(lang, 'fund_invalid')
          : raw === 'CONFLICT'
            ? (lang === 'ar'
                ? 'تعذّر الحفظ بسبب تعارض مستمر. حدّث الصفحة وحاول مجدداً.'
                : "Couldn't save due to a persistent conflict. Refresh and try again.")
          : err?.name === 'PermissionError' || err?.name === 'SaveError'
            ? saveErrorMessage(err, lang)
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

      {/* noValidate: our own checks show a bilingual message naming the
          maximum, instead of the browser's generic min/max bubble. */}
      <form className="fund-admin-form" onSubmit={handleSubmit} noValidate>
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
          <div className="fund-admin-amount-row">
            <input
              type="number"
              className="fund-admin-input"
              dir="ltr"
              inputMode="decimal"
              min={1}
              max={remaining}
              step="any"
              value={amount}
              // Strip any minus sign so a negative "donation" can't be typed.
              onChange={(e) => { setAmount(e.target.value.replace(/-/g, '')); setSave({ kind: 'idle' }); }}
              onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
              placeholder={t(lang, 'fund_amount_ph')}
              disabled={save.kind === 'saving' || fullyFunded}
            />
            <button
              type="button"
              className="fund-admin-max"
              onClick={() => setAmount(String(remaining))}
              disabled={save.kind === 'saving' || fullyFunded}
            >
              {t(lang, 'fund_max_btn')}
            </button>
          </div>
          <span className="fund-admin-remaining">
            {fullyFunded
              ? t(lang, 'fund_target_full')
              : t(lang, 'fund_remaining', { amount: fmtMoney(lang, currency, remaining) })}
          </span>
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
          disabled={save.kind === 'saving' || !amount.trim() || fullyFunded}
        >
          {save.kind === 'saving' ? t(lang, 'fund_adding') : t(lang, 'fund_add_btn')}
        </button>
      </form>
    </div>
  );
}
