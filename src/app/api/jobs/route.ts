import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { workerExecuteQueue } from "@/lib/queue";
import type { WorkerManifest } from "@/lib/manifest";

// TODO: replace with real auth (session -> buyer user). For now the caller
// supplies buyerEmail and we upsert a User.
export async function POST(request: Request) {
  const body = await request.json();
  const { buyerEmail, workerSlug, input } = body as {
    buyerEmail?: string;
    workerSlug?: string;
    input?: unknown;
  };

  if (!buyerEmail || !workerSlug || input === undefined) {
    return NextResponse.json(
      { error: "buyerEmail, workerSlug, and input are required" },
      { status: 400 },
    );
  }

  const worker = await db.worker.findUnique({
    where: { slug: workerSlug },
    include: {
      manifests: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const manifestRow = worker?.manifests[0];
  if (!worker || !manifestRow) {
    return NextResponse.json(
      { error: "worker not found or has no approved manifest" },
      { status: 404 },
    );
  }

  const manifest = manifestRow.manifest as unknown as WorkerManifest;
  const buyer = await db.user.upsert({
    where: { email: buyerEmail },
    update: {},
    create: { email: buyerEmail },
  });

  const job = await db.job.create({
    data: {
      workerId: worker.id,
      manifestId: manifestRow.id,
      buyerId: buyer.id,
      input: input as object,
      costCents: manifest.pricing.amount_cents,
      outcomePolicy: manifest.outcome_policy,
    },
  });

  // Escrow: authorize now, capture on success, void/refund on failure.
  const paymentIntent = await stripe.paymentIntents.create({
    amount: manifest.pricing.amount_cents,
    currency: manifest.pricing.currency,
    capture_method: "manual",
    metadata: { jobId: job.id },
  });

  await db.escrowTransaction.create({
    data: {
      jobId: job.id,
      stripePaymentIntentId: paymentIntent.id,
      amountCents: manifest.pricing.amount_cents,
      currency: manifest.pricing.currency,
      status: "AUTHORIZED",
    },
  });

  await workerExecuteQueue.add("execute", { jobId: job.id });

  return NextResponse.json(
    { jobId: job.id, clientSecret: paymentIntent.client_secret },
    { status: 201 },
  );
}
