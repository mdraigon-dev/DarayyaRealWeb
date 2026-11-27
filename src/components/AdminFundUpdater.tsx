import { useState, useEffect } from 'react';
import { t, loc, fmtMoney, type Lang } from '../i18n/strings';
import { addProjectFunds, setGovFundingAmount } from '../data/project-file-edit';
import { govFundingOf, govCoveredUSD } from '../data/gov-funding';
import { can, type ProjectEngineer, type AuthUser } from '../data/permissions';
import { loadPrefs, preferredAuthorName } from '../data/admin-prefs';
import { commitName } from '../data/admin-prefs';
import { saveErrorMessage } from '../data/repo';
import { identityStarted } from '../data/identity-ready';

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
  /** The project's government funding (live, see src/data/gov-funding.ts) */
  govFunding?: unknown;
  /** Called after a successful commit so the page can update its totals now */
  onUpdated: (r: { subId?: string; amount: number }) => void;
  /** Called after the government amount is saved */
  onGovUpdated?: (amountUSD: number) => void;
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
  govFunding,
  onUpdated,
  onGovUpdated,
}: Props) {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });
  const hasSubs = subs.length > 0;
  const [target, setTarget] = useState<string>(hasSubs ? subs[0].id : '');
  const [amount, setAmount] = useState('');
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [flash, setFlash] = useState(false);
  const [govAmount, setGovAmount] = useState('');
  const [govSave, setGovSave] = useState<SaveState>({ kind: 'idle' });
  const [govFlash, setGovFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const init = () => {
      if (cancelled) return;
      const ni = window.netlifyIdentity;
      if (!ni || !identityStarted()) {
        if (++tries < 40) setTimeout(init, 100);
        else setAuth({ kind: 'anonymous' });
        return;
      }
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

  const gov = govFundingOf({ govFunding });
  // A fully government-funded project takes no contributions.
  if (gov.type === 'full') {
    return (
      <div className="fund-admin">
        <div className="fund-admin-head">
          <span className="fund-admin-icon">＄</span>
          <div>
            <strong>{t(lang, 'fund_admin_title')}</strong>
            <div className="fund-admin-sub">{t(lang, 'fund_gov_full_note')}</div>
          </div>
        </div>
      </div>
    );
  }

  const currentRaised = hasSubs
    ? subs.reduce((a, s) => a + s.raisedUSD, 0)
    : projectRaisedUSD;
  const govCovered = govCoveredUSD({ govFunding }, totalBudgetUSD);
  // What contributions can still add to the whole project once the
  // government's share is counted.
  const projectRoom = Math.max(0, totalBudgetUSD - govCovered - currentRaised);
  const canEditProject = can(auth.user, 'edit-projects');

  // The most that can still be added to the chosen target without passing its
  // budget. Contributions can only go up, and never beyond what was planned.
  const targetSub = hasSubs ? subs.find((s) => s.id === target) : undefined;
  const remaining = Math.min(projectRoom, Math.max(
    0,
    targetSub
      ? targetSub.budgetUSD - targetSub.raisedUSD
      : totalBudgetUSD - projectRaisedUSD,
  ));
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
      const raw = err?.code === 'EXCEEDS_BUDGET' || err?.code === 'GOV_FUNDED' ? err.code : (err?.message || 'Save failed');
      const message =
        raw === 'NOT_FOUND'
          ? (lang === 'ar' ? 'لم يتم العثور على ملف المشروع' : 'Project file not found')
          : raw === 'EXCEEDS_BUDGET'
            ? t(lang, 'fund_exceeds_live')
          : raw === 'GOV_FUNDED'
            ? t(lang, 'fund_gov_full_note')
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

  // Government share: Finance may only raise it; project editors may set any
  // amount. The save service applies the same rules.
  const handleGovSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(govAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setGovSave({ kind: 'error', message: t(lang, 'fund_invalid') });
      return;
    }
    if (!canEditProject && amt <= gov.amountUSD) {
      setGovSave({ kind: 'error', message: t(lang, 'fund_gov_must_increase', { current: fmtMoney(lang, currency, gov.amountUSD) }) });
      return;
    }
    const govMax = Math.max(0, totalBudgetUSD - currentRaised);
    if (amt > govMax) {
      setGovSave({ kind: 'error', message: t(lang, 'fund_gov_exceeds', { max: fmtMoney(lang, currency, govMax) }) });
      return;
    }
    setGovSave({ kind: 'saving' });
    try {
      const message = `Update government funding: $${amt} on ${projectId} by ${commitName(auth.user)}`;
      await setGovFundingAmount({ projectId, amountUSD: amt, message });
      onGovUpdated?.(amt);
      setGovSave({ kind: 'idle' });
      setGovAmount('');
      setGovFlash(true);
      setTimeout(() => setGovFlash(false), 4000);
    } catch (err: any) {
      const code = err?.code || err?.message;
      const message =
        code === 'EXCEEDS_BUDGET' ? t(lang, 'fund_exceeds_live')
        : code === 'GOV_FUNDED' ? t(lang, 'fund_gov_full_note')
        : code === 'INVALID_AMOUNT' ? t(lang, 'fund_invalid')
        : err?.name === 'PermissionError' ? t(lang, 'fund_gov_not_allowed')
        : err?.name === 'SaveError' ? saveErrorMessage(err, lang)
        : (err?.message || 'Save failed');
      setGovSave({ kind: 'error', message });
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

      <form className="fund-admin-form fund-admin-gov" onSubmit={handleGovSubmit} noValidate>
        <div className="fund-admin-gov-head">
          <strong>{t(lang, 'fund_gov_title')}</strong>
          <div className="fund-admin-sub">{t(lang, 'fund_gov_hint')}</div>
          <div className="fund-admin-current">
            {gov.type === 'partial' && gov.amountUSD > 0
              ? t(lang, 'fund_gov_current', { amount: fmtMoney(lang, currency, gov.amountUSD) })
              : t(lang, 'fund_gov_none')}
          </div>
        </div>
        <label className="fund-admin-field">
          <span>{t(lang, 'fund_gov_amount_label')}</span>
          <input
            type="number"
            className="fund-admin-input"
            dir="ltr"
            inputMode="decimal"
            min={1}
            step="any"
            value={govAmount}
            onChange={(e) => { setGovAmount(e.target.value.replace(/-/g, '')); setGovSave({ kind: 'idle' }); }}
            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
            placeholder={t(lang, 'fund_amount_ph')}
            disabled={govSave.kind === 'saving'}
          />
        </label>
        {govSave.kind === 'error' && (
          <div className="fund-admin-error">⚠ {govSave.message}</div>
        )}
        {govFlash && govSave.kind !== 'error' && (
          <div className="fund-admin-flash">✓ {t(lang, 'fund_gov_saved')}</div>
        )}
        <button
          type="submit"
          className="fund-admin-btn"
          disabled={govSave.kind === 'saving' || !govAmount.trim()}
        >
          {govSave.kind === 'saving' ? t(lang, 'fund_gov_saving') : t(lang, 'fund_gov_save')}
        </button>
      </form>
    </div>
  );
}
