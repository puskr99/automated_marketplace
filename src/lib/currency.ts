// Display-only currency conversion. The ledger (lib/credits.ts, Job.costCents,
// manifest pricing, etc.) stays denominated in USD cents everywhere internally
// — nothing about storage or arithmetic changes here. This just renders those
// cents as "SC" (Spending Credits), the platform's only user-facing unit, at
// a fixed rate: 1 USD = 200 SC (1 SC = $0.005).
export const USD_TO_SC_RATE = 200;

export function centsToSc(cents: number): number {
  return Math.round((cents * USD_TO_SC_RATE) / 100);
}

export function formatSc(cents: number): string {
  return `${centsToSc(cents).toLocaleString()} SC`;
}
