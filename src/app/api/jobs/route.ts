import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { workerExecuteQueue } from "@/lib/queue";
import { centsToUsdcBaseUnits, verifyUsdcDeposit } from "@/lib/crypto/server";
import type { WorkerManifest } from "@/lib/manifest";
import type { Hash } from "viem";

// TODO: replace with real auth (session -> buyer user). For now the caller
// supplies buyerEmail and we upsert a User.
export async function POST(request: Request) {
  const body = await request.json();
  const {
    buyerEmail,
    workerSlug,
    input,
    paymentMethod = "stripe",
    depositTxHash,
  } = body as {
    buyerEmail?: string;
    workerSlug?: string;
    input?: unknown;
    paymentMethod?: "stripe" | "crypto_usdc";
    depositTxHash?: string;
  };

  if (!buyerEmail || !workerSlug || input === undefined) {
    return NextResponse.json(
      { error: "buyerEmail, workerSlug, and input are required" },
      { status: 400 },
    );
  }

  if (paymentMethod === "crypto_usdc" && !depositTxHash) {
    return NextResponse.json(
      { error: "depositTxHash is required for crypto_usdc payments" },
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

  // Crypto payment already happened client-side (buyer sent USDC from their
  // wallet before calling this endpoint) — verify it on-chain before we
  // trust anything the client reported.
  let verifiedPayerAddress: string | undefined;
  if (paymentMethod === "crypto_usdc") {
    try {
      const deposit = await verifyUsdcDeposit(
        depositTxHash as Hash,
        centsToUsdcBaseUnits(manifest.pricing.amount_cents),
      );
      verifiedPayerAddress = deposit.fromAddress;
    } catch (err) {
      const message = err instanceof Error ? err.message : "invalid deposit";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

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

  if (paymentMethod === "crypto_usdc") {
    try {
      await db.escrowTransaction.create({
        data: {
          jobId: job.id,
          provider: "CRYPTO_USDC",
          payerAddress: verifiedPayerAddress,
          depositTxHash: depositTxHash,
          amountCents: manifest.pricing.amount_cents,
          currency: "usdc",
          status: "AUTHORIZED",
        },
      });
    } catch {
      // Unique constraint on depositTxHash — this tx was already used to
      // fund a different job (replay attempt).
      await db.job.delete({ where: { id: job.id } });
      return NextResponse.json(
        { error: "this deposit transaction has already been used" },
        { status: 409 },
      );
    }

    await workerExecuteQueue.add("execute", { jobId: job.id });
    return NextResponse.json({ jobId: job.id }, { status: 201 });
  }

  // Stripe: authorize now, capture on success, void/refund on failure.
  const paymentIntent = await stripe.paymentIntents.create({
    amount: manifest.pricing.amount_cents,
    currency: manifest.pricing.currency,
    capture_method: "manual",
    metadata: { jobId: job.id },
  });

  await db.escrowTransaction.create({
    data: {
      jobId: job.id,
      provider: "STRIPE",
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
