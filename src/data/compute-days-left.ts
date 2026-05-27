/**
 * Build-time helper: compute daysLeft from fundingDeadline.
 *
 * When a project has a fundingDeadline (YYYY-MM-DD), we calculate how
 * many calendar days remain from TODAY at build time and override the
 * static daysLeft field. This means the site always shows accurate
 * countdowns without manual editing — just push and Netlify rebuilds.
 *
 * When fundingDeadline is absent we fall back to the static daysLeft
 * stored in the markdown (backwards-compatible with all existing files).
 *
 * Usage (in any .astro page that passes project data to a component):
 *
 *   import { withComputedDaysLeft } from '../../data/compute-days-left';
 *   const projectData = projects.map(p => withComputedDaysLeft(p.data));
 */

export function computeDaysLeft(fundingDeadline: string | undefined, staticDaysLeft: number): number {
  if (!fundingDeadline) return staticDaysLeft;
  const deadline = Date.parse(fundingDeadline + 'T00:00:00Z');
  if (isNaN(deadline)) return staticDaysLeft;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const diff = Math.ceil((deadline - today.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

/** Narrow type that describes what we need from a project record */
type ProjectLike = {
  daysLeft: number;
  fundingDeadline?: string;
  [key: string]: unknown;
};

/** Return the project with daysLeft replaced by the computed value. */
export function withComputedDaysLeft<T extends ProjectLike>(project: T): T {
  return {
    ...project,
    daysLeft: computeDaysLeft(project.fundingDeadline, project.daysLeft),
  };
}
