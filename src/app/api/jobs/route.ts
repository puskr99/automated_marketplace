import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, findOrCreate } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { workerExecuteQueue } from "@/lib/queue";
import { centsToUsdcBaseUnits, verifyUsdcDeposit } from "@/lib/crypto/server";
import { PLATFORM_MAX_FREE_RUNS } from "@/lib/manifest";
import type { WorkerManifest } from "@/lib/manifest";
import type { Hash } from "viem";

// A job with no escrow row is how a free-trial run is represented — see
// the free-trial branch below. Counting those per (buyer, worker) is how
// remaining trial runs are computed, both here and on GET.
async function countFreeRunsUsed(buyerId: string, workerId: string) {
  return db.job.count({
    where: { buyerId, workerId, escrowTransaction: null },
  });
}

// If enqueueing fails after the job row exists (e.g. a Redis blip), a
// free-trial job would otherwise sit orphaned in PENDING forever and
// silently burn one of the buyer's limited free runs for nothing. Delete
// it instead so the run isn't wasted and the caller gets a clean error to
// retry. (Paid jobs don't get this cleanup — same failure there would mean
// money already collected with no job to run; rare enough, and out of
// scope here, to just surface the error rather than attempt an inline
// refund outside the normal settlement path in worker.ts.)
async function enqueueOrDelete(jobId: string) {
  try {
    await workerExecuteQueue.add("execute", { jobId });
  } catch (err) {
    await db.job.delete({ where: { id: jobId } });
    throw err;
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workerSlug = searchParams.get("workerSlug");
  if (!workerSlug) {
    return NextResponse.json({ error: "workerSlug is required" }, { status: 400 });
  }

  const buyer = await db.user.findUnique({ where: { email: session.user.email } });
  const worker = await db.worker.findUnique({ where: { slug: workerSlug } });
  if (!buyer || !worker) {
    return NextResponse.json({ jobs: [], freeRunsUsed: 0 });
  }

  const [jobs, freeRunsUsed] = await Promise.all([
    db.job.findMany({
      where: { buyerId: buyer.id, workerId: worker.id },
      include: { escrowTransaction: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    countFreeRunsUsed(buyer.id, worker.id),
  ]);

  return NextResponse.json({ jobs, freeRunsUsed });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const buyerEmail = session.user.email;

  const body = await request.json();
  const { workerSlug, input, paymentMethod, depositTxHash } = body as {
    workerSlug?: string;
    input?: unknown;
    paymentMethod?: "stripe" | "crypto_usdc";
    depositTxHash?: string;
  };

  if (!workerSlug || input === undefined) {
    return NextResponse.json(
      { error: "workerSlug and input are required" },
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

  const buyer = await findOrCreate(
    () => db.user.findUnique({ where: { email: buyerEmail } }),
    () => db.user.create({ data: { email: buyerEmail } }),
  );

  // Free trial: platform-wide cap always wins over whatever the manifest
  // requests, in case an older manifest predates the cap being enforced at
  // submission time.
  const freeRunsAllowed = Math.min(manifest.trial.free_runs, PLATFORM_MAX_FREE_RUNS);
  const freeRunsUsed = await countFreeRunsUsed(buyer.id, worker.id);
  const isFreeTrial = freeRunsUsed < freeRunsAllowed;

  if (isFreeTrial) {
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
    try {
      await enqueueOrDelete(job.id);
    } catch {
      return NextResponse.json(
        { error: "failed to queue job — please try again" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        jobId: job.id,
        freeTrial: true,
        freeRunsRemaining: freeRunsAllowed - freeRunsUsed - 1,
      },
      { status: 201 },
    );
  }

  // Trial exhausted (or none offered) — payment is required from here on.
  if (paymentMethod === "crypto_usdc" && !depositTxHash) {
    return NextResponse.json(
      { error: "depositTxHash is required for crypto_usdc payments" },
      { status: 400 },
    );
  }
  if (!paymentMethod) {
    return NextResponse.json(
      { error: "free trial exhausted — paymentMethod is required", freeTrialExhausted: true },
      { status: 402 },
    );
  }

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
