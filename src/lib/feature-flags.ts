// Real-money rails (Stripe card deposits, USDC crypto deposits, USDC
// withdrawals) are off while the marketplace runs on free/showcase workers
// and ad-earned bonus credits only — flip this once Stripe Connect payouts
// and crypto withdrawal are actually ready to handle real developer earnings.
export const REAL_MONEY_PAYMENTS_ENABLED = false;
