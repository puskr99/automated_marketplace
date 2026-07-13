import Stripe from "stripe";

// Falls back to a placeholder so module init doesn't crash when unconfigured
// (e.g. during build, or before STRIPE_SECRET_KEY is set locally). Calls
// will fail with a real Stripe auth error at runtime until it's set.
export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
);
