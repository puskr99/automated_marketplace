import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, findOrCreate } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { REAL_MONEY_PAYMENTS_ENABLED } from "@/lib/feature-flags";

const MIN_DEPOSIT_CENTS = 100; // $1
const MAX_DEPOSIT_CENTS = 100_000; // $1,000

// Stripe Checkout (hosted, redirect-based) rather than Elements — no card
// form to build client-side. The webhook (checkout.session.completed)
// credits the account once Stripe confirms payment.
export async function POST(request: Request) {
  if (!REAL_MONEY_PAYMENTS_ENABLED) {
    return NextResponse.json(
      { error: "card deposits are coming soon — earn credits by watching ads for now" },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const { amountCents } = (await request.json()) as { amountCents?: number };
  if (
    !amountCents ||
    !Number.isInteger(amountCents) ||
    amountCents < MIN_DEPOSIT_CENTS ||
    amountCents > MAX_DEPOSIT_CENTS
  ) {
    return NextResponse.json(
      { error: `amountCents must be an integer between ${MIN_DEPOSIT_CENTS} and ${MAX_DEPOSIT_CENTS}` },
      { status: 400 },
    );
  }

  const user = await findOrCreate(
    () => db.user.findUnique({ where: { email: session.user!.email! } }),
    () => db.user.create({ data: { email: session.user!.email! } }),
  );

  const origin = new URL(request.url).origin;
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Market credits top-up" },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: { userId: user.id, purpose: "credit_deposit" },
    success_url: `${origin}/credits?deposit=success`,
    cancel_url: `${origin}/credits?deposit=cancelled`,
  });

  return NextResponse.json({ url: checkoutSession.url }, { status: 201 });
}
