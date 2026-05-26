/**
 * Pure helpers for computing how demo donations affect displayed totals
 * on a project. Used by both the donation modal (to enforce caps) and
 * the project detail page (to render progress bars).
 *
 * The "waterfall" rule: when a donor gives money to "the whole project"
 * (no subId), the money is virtually allocated to sub-projects in their
 * listed order. Fill sub[0] until full, spill into sub[1], and so on.
 *
 * Targeted donations (subId === sub.id) always count against that
 * specific sub first. Only the leftover undirected pool waterfalls.
 */

export type SubBudget = {
  id: string;
  budgetUSD: number;
  raisedUSD: number;
};

export type DemoBreakdown = {
  /** Sum of TARGETED demo donations to each sub, keyed by sub id */
  targetedBySub: Record<string, number>;
  /** Sum of donations NOT tied to a specific sub */
  undirectedTotal: number;
};

/**
 * Given a project's sub-budgets and a demo breakdown, return the displayed
 * raised amount per sub after waterfall fill of undirected donations.
 */
export function computeSubRaised(
  subs: SubBudget[],
  breakdown: DemoBreakdown
): Record<string, number> {
  const result: Record<string, number> = {};
  let spillover = breakdown.undirectedTotal;

  for (const sub of subs) {
    const targeted = breakdown.targetedBySub[sub.id] || 0;
    const beforeWaterfall = sub.raisedUSD + targeted;
    const room = Math.max(0, sub.budgetUSD - beforeWaterfall);
    const fromSpillover = Math.min(spillover, room);
    result[sub.id] = beforeWaterfall + fromSpillover;
    spillover -= fromSpillover;
  }
  return result;
}

/**
 * Total raised across the whole project including all demo donations
 * (targeted + undirected). When the project has subs, this is the sum
 * of the per-sub waterfall totals. When it doesn't, fall back to
 * raisedUSD + total demo amount.
 */
export function computeProjectRaised(
  projectRaisedUSD: number,
  subs: SubBudget[],
  breakdown: DemoBreakdown
): number {
  if (subs.length === 0) {
    return (
      projectRaisedUSD +
      breakdown.undirectedTotal +
      Object.values(breakdown.targetedBySub).reduce((a, b) => a + b, 0)
    );
  }
  const subRaised = computeSubRaised(subs, breakdown);
  return Object.values(subRaised).reduce((a, b) => a + b, 0);
}

/**
 * How much room is left on a project (or a specific sub) for new demo
 * donations. The donation modal uses this to cap inputs.
 *
 * When `subId` is provided: returns sub.budgetUSD - displayedRaisedForSub.
 *   Note: a directed donation can fill its sub up to its own cap; if the
 *   user picks a sub that's already full, they get 0.
 * When `subId` is undefined: returns total project budget - total raised.
 *   This is the room available for undirected donations.
 */
export function remainingRoom(
  projectBudgetUSD: number,
  projectRaisedUSD: number,
  subs: SubBudget[],
  breakdown: DemoBreakdown,
  subId?: string,
): number {
  if (subId) {
    const sub = subs.find((s) => s.id === subId);
    if (!sub) return 0;
    const subRaised = computeSubRaised(subs, breakdown);
    return Math.max(0, sub.budgetUSD - (subRaised[subId] || sub.raisedUSD));
  }
  // Project-level remaining.
  const totalBudget = subs.length > 0
    ? subs.reduce((sum, s) => sum + s.budgetUSD, 0)
    : projectBudgetUSD;
  const totalRaised = computeProjectRaised(projectRaisedUSD, subs, breakdown);
  return Math.max(0, totalBudget - totalRaised);
}
