/**
 * gov-funding.ts — projects funded by the government, fully or partly.
 *
 * Stored on a project as
 *   govFunding: { type: 'partial' | 'full', amountUSD?, note: { ar, en } }
 * (absent = not government-funded).
 *
 * - full: the government pays the whole budget. The project shows as fully
 *   funded and takes no contributions.
 * - partial: the government pays `amountUSD`. The project shows that amount
 *   plus recorded contributions, and contributions can only fill the rest.
 *
 * The government's share is never added to raisedUSD, which stays the sum
 * of recorded contributions (each with a fundLog entry). The save service
 * (netlify/lib/rules.ts) applies the same rules.
 */
export type GovFundingType = 'none' | 'partial' | 'full';
export type GovFunding = { type: GovFundingType; amountUSD: number; note: { ar: string; en: string } };

export function govFundingOf(p: { govFunding?: unknown } | null | undefined): GovFunding {
  const g = (p?.govFunding && typeof p.govFunding === 'object' ? p.govFunding : {}) as Record<string, any>;
  const type: GovFundingType = g.type === 'full' || g.type === 'partial' ? g.type : 'none';
  const amount = typeof g.amountUSD === 'number' && Number.isFinite(g.amountUSD) && g.amountUSD > 0 ? g.amountUSD : 0;
  const note = g.note && typeof g.note === 'object' ? g.note : {};
  return {
    type,
    amountUSD: type === 'partial' ? amount : 0,
    note: { ar: String(note.ar ?? ''), en: String(note.en ?? '') },
  };
}

export const isFullyGovFunded = (p: { govFunding?: unknown }) => govFundingOf(p).type === 'full';

/** How much of `budgetUSD` the government covers. */
export function govCoveredUSD(p: { govFunding?: unknown }, budgetUSD: number): number {
  const g = govFundingOf(p);
  if (g.type === 'full') return Math.max(0, budgetUSD);
  if (g.type === 'partial') return Math.min(Math.max(0, budgetUSD), g.amountUSD);
  return 0;
}

/**
 * Total funding to show: recorded contributions plus the government's share,
 * never more than the budget (unless contributions alone already exceed it).
 */
export function fundedUSD(p: { govFunding?: unknown }, raisedUSD: number, budgetUSD: number): number {
  const covered = govCoveredUSD(p, budgetUSD);
  if (covered <= 0) return raisedUSD;
  return Math.max(raisedUSD, Math.min(budgetUSD, raisedUSD + covered));
}

/**
 * The project with raisedUSD replaced by its total funding, for display only.
 * Safe to apply more than once (a page and the cards it renders both call it).
 */
export function withGovFunding<T extends { govFunding?: unknown; raisedUSD: number; budgetUSD: number }>(p: T): T {
  if ((p as { govApplied?: boolean }).govApplied) return p;
  const funded = fundedUSD(p, p.raisedUSD, p.budgetUSD);
  return funded === p.raisedUSD ? p : { ...p, raisedUSD: funded, govApplied: true };
}

/** What contributions can still add before the project reaches its budget. */
export function contributionRoomUSD(p: { govFunding?: unknown }, raisedUSD: number, budgetUSD: number): number {
  return Math.max(0, budgetUSD - govCoveredUSD(p, budgetUSD) - raisedUSD);
}
