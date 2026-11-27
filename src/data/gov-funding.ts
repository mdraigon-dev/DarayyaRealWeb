/**
 * gov-funding.ts — projects funded by the government, fully or partly.
 *
 * Stored on a project as
 *   govFunding: { type: 'partial' | 'full', note: { ar, en } }
 * (absent = not government-funded). This is a label with an explanation;
 * it doesn't change the budget or amount raised. A fully government-funded
 * project doesn't ask the public for contributions.
 */
export type GovFundingType = 'none' | 'partial' | 'full';
export type GovFunding = { type: GovFundingType; note: { ar: string; en: string } };

export function govFundingOf(p: { govFunding?: unknown } | null | undefined): GovFunding {
  const g = (p?.govFunding && typeof p.govFunding === 'object' ? p.govFunding : {}) as Record<string, any>;
  const type: GovFundingType = g.type === 'full' || g.type === 'partial' ? g.type : 'none';
  const note = g.note && typeof g.note === 'object' ? g.note : {};
  return { type, note: { ar: String(note.ar ?? ''), en: String(note.en ?? '') } };
}

export const isFullyGovFunded = (p: { govFunding?: unknown }) => govFundingOf(p).type === 'full';
