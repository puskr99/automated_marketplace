import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, findOrCreate } from "@/lib/db";
import { workerExecuteQueue } from "@/lib/queue";
import { spendForJob, refundJob, InsufficientCreditsError } from "@/lib/credits";
import { PLATFORM_MAX_FREE_RUNS } from "@/lib/manifest";
import type { WorkerManifest } from "@/lib/manifest";

async function countFreeRunsUsed(buyerId: string, workerId: string) {
  return db.job.count({
    where: { buyerId, workerId, isFreeTrial: true },
  });
}

// If enqueueing fails after the job row exists (e.g. a Redis blip), it would
// otherwise sit orphaned in PENDING forever. For a free-trial job that just
// wastes one of the buyer's limited free runs for nothing, so delete it. For
// a credit-funded job, credits were already spent — refund them first so the
// buyer isn't out money for a run that never happened, then delete.
async function enqueueOrRefundAndDelete(job: {
  id: string;
  buyerId: string;
  costCents: number;
  bonusCentsSpent: number;
  isFreeTrial: boolean;
}) {
  try {
    await workerExecuteQueue.add("execute", { jobId: job.id });
  } catch (err) {
    if (!job.isFreeTrial) {
      await refundJob(job);
    }
    await db.job.delete({ where: { id: job.id } });
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
  const { workerSlug, input } = body as {
    workerSlug?: string;
    input?: unknown;
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
        isFreeTrial: true,
      },
    });
    try {
      await enqueueOrRefundAndDelete(job);
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

  // Trial exhausted (or none offered) — spend from the buyer's credit
  // balance (bonus first, then withdrawable). No per-job Stripe/crypto call:
  // that already happened, once, when the buyer deposited into their credit
  // balance (see /api/credits/deposit/*).
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

  let spend: { bonusCentsSpent: number; withdrawableCentsSpent: number };
  try {
    spend = await spendForJob(buyer.id, job.id, manifest.pricing.amount_cents);
  } catch (err) {
    await db.job.delete({ where: { id: job.id } });
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "insufficient credits — top up in Credits", insufficientCredits: true },
        { status: 402 },
      );
    }
    throw err;
  }

  await db.job.update({
    where: { id: job.id },
    data: { bonusCentsSpent: spend.bonusCentsSpent },
  });

  try {
    await enqueueOrRefundAndDelete({ ...job, bonusCentsSpent: spend.bonusCentsSpent });
  } catch {
    return NextResponse.json(
      { error: "failed to queue job — please try again" },
      { status: 503 },
    );
  }

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
