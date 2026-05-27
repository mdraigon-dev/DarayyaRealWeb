/**
 * Demo donation persistence (localStorage only).
 *
 * Real donations require a payment processor and backend. For v1 we
 * simulate the experience locally so stakeholders can see the donation
 * flow working end-to-end. Changes are only visible on the donor's own
 * browser; nothing crosses the network.
 *
 * Every UI surface that uses this data shows a "Demo Mode" indicator
 * so no one mistakes simulated state for real funds.
 */

const STORAGE_KEY = 'darayya-demo-donations-v1';

export type DemoDonation = {
  projectId: string;
  subId?: string;          // optional — donor picked a specific sub-item
  amountUSD: number;
  name?: string;           // optional donor name; falls back to "Anonymous"
  timestamp: number;       // Date.now()
};

export type DemoDonationsState = {
  donations: DemoDonation[];
};

export function loadDonations(): DemoDonationsState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { donations: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { donations: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.donations)) return { donations: [] };
    return parsed;
  } catch {
    return { donations: [] };
  }
}

export function saveDonation(d: DemoDonation): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const state = loadDonations();
  state.donations.push(d);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or disabled — silently fail rather than crashing
  }
}

export function clearAllDonations(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Sum the demo donations for a given project (optionally a specific sub).
 */
export function sumForProject(projectId: string, subId?: string): { amount: number; count: number } {
  const { donations } = loadDonations();
  let amount = 0;
  let count = 0;
  for (const d of donations) {
    if (d.projectId !== projectId) continue;
    if (subId && d.subId !== subId) continue;
    amount += d.amountUSD;
    count++;
  }
  return { amount, count };
}

