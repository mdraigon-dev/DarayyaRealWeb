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
 * Take an array of projects and an array of demo donations, and return
 * the projects with `raisedUSD` and `donors` adjusted to reflect demo
 * donations applied to each.
 *
 * Used by Home / Projects-list / Dashboard / PDF report so every tile
 * shows the user's demo contributions.
 *
 * IMPORTANT: only call this on the client. Demo donations live in
 * localStorage which doesn't exist during SSR.
 */


/**
 * Display-time status: a project that's classified as 'funding' but
 * has hit or exceeded its budget should be displayed as 'active'. The
 * underlying frontmatter doesn't change — staff still need to mark the
 * project completed manually when construction is actually done — but
 * once it's fully funded, telling visitors it's still "open for
 * funding" is misleading.
 *
 * Note: only promotes funding → active. Does NOT promote active → completed
 * (that's a different lifecycle event: money raised vs work done).
 */
export function displayStatus<P extends {
  status: string;
  raisedUSD: number;
  budgetUSD: number;
}>(project: P): string {
  if (project.status === 'funding' && project.raisedUSD >= project.budgetUSD && project.budgetUSD > 0) {
    return 'active';
  }
  return project.status;
}
