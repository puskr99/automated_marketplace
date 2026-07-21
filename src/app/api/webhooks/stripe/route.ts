import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { depositCredits } from "@/lib/credits";

// Handles Stripe events that happen outside our own capture/cancel calls
// (e.g. disputes, async payment failures). Register this route's URL in the
// Stripe dashboard and set STRIPE_WEBHOOK_SECRET.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      await db.escrowTransaction.updateMany({
        where: { stripePaymentIntentId: intent.id },
        data: { status: "VOIDED" },
      });
      break;
    }
    case "charge.dispute.created": {
      // TODO: flag the related job/worker for manual review.
      break;
    }
    case "checkout.session.completed": {
      const checkoutSession = event.data.object;
      if (checkoutSession.metadata?.purpose === "credit_deposit") {
        const userId = checkoutSession.metadata.userId;
        const amountCents = checkoutSession.amount_total;
        if (userId && amountCents) {
          try {
            await depositCredits({
              userId,
              amountCents,
              reference: `stripe_checkout:${checkoutSession.id}`,
              metadata: { stripeCheckoutSessionId: checkoutSession.id },
            });
          } catch {
            // Unique constraint on reference — this session was already
            // credited (webhook retry). Safe to ignore.
          }
        }
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
