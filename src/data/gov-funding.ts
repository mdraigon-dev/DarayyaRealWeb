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
 *
 * Line items: on a project with line items (subs), the government's share is
 * held per item in subs[].govUSD, and amountUSD is their total, the same way
 * the project's budget and amount raised are the sums of its items. An older
 * project that has only a project-level amountUSD has it spread over its
 * items in proportion to what each still needs (govBySub), until the share
 * is saved per item.
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

export type GovSub = { id: string; budgetUSD?: number; raisedUSD?: number; govUSD?: number };
type GovProject = { govFunding?: unknown; subs?: unknown };

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const subsOf = (p: GovProject): GovSub[] =>
  (Array.isArray(p.subs) ? p.subs : []).filter((s): s is GovSub => !!s && typeof s === 'object' && 'id' in (s as object));

/** True when the government's share has been saved per line item. */
export function hasItemShares(p: GovProject): boolean {
  return subsOf(p).some((s) => n(s.govUSD) > 0);
}

/**
 * Split `amount` over items in proportion to what each still needs
 * (budget − raised), in whole dollars, never more than an item needs.
 */
export function splitByNeed(subs: GovSub[], amount: number): Record<string, number> {
  const out: Record<string, number> = {};
  const need = subs.map((s) => Math.max(0, n(s.budgetUSD) - n(s.raisedUSD)));
  const totalNeed = need.reduce((a, b) => a + b, 0);
  const total = Math.min(Math.round(n(amount)), Math.round(totalNeed));
  if (total <= 0 || totalNeed <= 0) { subs.forEach((s) => { out[s.id] = 0; }); return out; }
  const exact = need.map((x) => (total * x) / totalNeed);
  const floor = exact.map(Math.floor);
  let left = total - floor.reduce((a, b) => a + b, 0);
  // Hand out the leftover dollars to the largest remainders.
  exact.map((x, i) => [x - floor[i], i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => {
    if (left > 0 && floor[i] < need[i]) { floor[i]++; left--; }
  });
  subs.forEach((s, i) => { out[s.id] = floor[i]; });
  return out;
}

/**
 * The government's share of each line item. Full: whatever each item still
 * needs. Partial: the per-item shares, or the project amount spread by need.
 */
export function govBySub(p: GovProject): Record<string, number> {
  const subs = subsOf(p);
  const g = govFundingOf(p);
  const out: Record<string, number> = {};
  if (g.type === 'full') {
    subs.forEach((s) => { out[s.id] = Math.max(0, n(s.budgetUSD) - n(s.raisedUSD)); });
  } else if (g.type === 'partial') {
    if (hasItemShares(p)) subs.forEach((s) => { out[s.id] = Math.min(n(s.govUSD), n(s.budgetUSD)); });
    else return splitByNeed(subs, g.amountUSD);
  } else {
    subs.forEach((s) => { out[s.id] = 0; });
  }
  return out;
}

/** How much of `budgetUSD` the government covers. */
export function govCoveredUSD(p: GovProject, budgetUSD: number): number {
  const g = govFundingOf(p);
  if (g.type === 'full') return Math.max(0, budgetUSD);
  if (g.type === 'partial') {
    const amount = subsOf(p).length
      ? Object.values(govBySub(p)).reduce((a, b) => a + b, 0)
      : g.amountUSD;
    return Math.min(Math.max(0, budgetUSD), amount);
  }
  return 0;
}

/**
 * Total funding to show: recorded contributions plus the government's share,
 * never more than the budget (unless contributions alone already exceed it).
 */
export function fundedUSD(p: GovProject, raisedUSD: number, budgetUSD: number): number {
  const covered = govCoveredUSD(p, budgetUSD);
  if (covered <= 0) return raisedUSD;
  return Math.max(raisedUSD, Math.min(budgetUSD, raisedUSD + covered));
}

/**
 * The project with raisedUSD replaced by its total funding, for display only.
 * Safe to apply more than once (a page and the cards it renders both call it).
 */
export function withGovFunding<T extends GovProject & { raisedUSD: number; budgetUSD: number }>(p: T): T {
  if ((p as { govApplied?: boolean }).govApplied) return p;
  const funded = fundedUSD(p, p.raisedUSD, p.budgetUSD);
  return funded === p.raisedUSD ? p : { ...p, raisedUSD: funded, govApplied: true };
}

/** What contributions can still add before the project reaches its budget. */
export function contributionRoomUSD(p: GovProject, raisedUSD: number, budgetUSD: number): number {
  return Math.max(0, budgetUSD - govCoveredUSD(p, budgetUSD) - raisedUSD);
}
