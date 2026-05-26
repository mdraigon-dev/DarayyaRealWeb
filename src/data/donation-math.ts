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
 * Take an array of projects and an array of demo donations, and return
 * the projects with `raisedUSD`, `donors`, and `budgetUSD` adjusted to
 * reflect a consistent view:
 *
 *   - When a project has sub-projects:
 *       budgetUSD = sum(sub.budgetUSD)        — single source of truth
 *       raisedUSD = waterfall-applied sub sums + targeted demo + spillover
 *   - When a project has no sub-projects:
 *       budgetUSD = project.budgetUSD          — unchanged
 *       raisedUSD = project.raisedUSD + all demos for this project
 *
 * This normalization runs unconditionally even when there are zero
 * demo donations, so the homepage, list, detail, dashboard, and PDF
 * all read identical totals. (Before this fix, projects with subs
 * whose top-level budget/raised didn't match the sub sum produced
 * different totals on different pages.)
 *
 * Used by Home / Projects-list / Dashboard / Transparency / PDF.
 *
 * IMPORTANT: only call this on the client. Demo donations live in
 * localStorage which doesn't exist during SSR.
 */
export function applyDemoToProjects<P extends {
  id: string;
  raisedUSD: number;
  donors: number;
  budgetUSD: number;
  subs?: { id: string; budgetUSD: number; raisedUSD: number }[];
}>(
  projects: P[],
  donations: { projectId: string; subId?: string; amountUSD: number }[]
): P[] {
  // Group donations by projectId
  const byProject = new Map<string, typeof donations>();
  for (const d of donations) {
    const arr = byProject.get(d.projectId) || [];
    arr.push(d);
    byProject.set(d.projectId, arr);
  }

  return projects.map(p => {
    const projectDonations = byProject.get(p.id) || [];
    const subs: SubBudget[] = p.subs || [];

    // Build the demo breakdown (empty when no donations for this project)
    const targetedBySub: Record<string, number> = {};
    let undirectedTotal = 0;
    for (const d of projectDonations) {
      if (d.subId) {
        targetedBySub[d.subId] = (targetedBySub[d.subId] || 0) + d.amountUSD;
      } else {
        undirectedTotal += d.amountUSD;
      }
    }
    const breakdown: DemoBreakdown = { targetedBySub, undirectedTotal };

    // Normalize budget: when subs exist, budget IS sum(subs.budgetUSD).
    // The top-level frontmatter field is treated as a fallback only.
    const newBudget = subs.length > 0
      ? subs.reduce((s, x) => s + x.budgetUSD, 0)
      : p.budgetUSD;

    const newRaised = computeProjectRaised(p.raisedUSD, subs, breakdown);
    const newDonors = p.donors + projectDonations.length;

    // Only allocate a new object when something actually changed, so
    // referential equality holds for projects untouched by demos.
    if (newBudget === p.budgetUSD && newRaised === p.raisedUSD && newDonors === p.donors) {
      return p;
    }
    return { ...p, budgetUSD: newBudget, raisedUSD: newRaised, donors: newDonors };
  });
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
