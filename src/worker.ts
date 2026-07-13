import "dotenv/config";
import { Worker, type Job as BullJob } from "bullmq";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { anthropic, VERIFICATION_MODEL } from "@/lib/anthropic";
import {
  QUEUE_NAMES,
  verifySecurityQueue,
  verifyBenchmarkQueue,
  verifyJudgeQueue,
  type JobExecuteData,
  type VerifyManifestData,
} from "@/lib/queue";
import type { WorkerManifest } from "@/lib/manifest";
import type { Prisma } from "@/generated/prisma/client";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

// ---------- Worker execution ----------
// Calls the developer's endpoint, records the result, and settles escrow.
// Automatic refund cases per skill.md: API unavailable, timeout, invalid
// response, server failure. Anything beyond that follows the worker's
// declared outcome_policy (not yet implemented — flagged below).

async function processWorkerExecute(bullJob: BullJob<JobExecuteData>) {
  const job = await db.job.findUniqueOrThrow({
    where: { id: bullJob.data.jobId },
    include: { manifest: true, escrowTransaction: true },
  });

  const manifest = job.manifest.manifest as unknown as WorkerManifest;
  const startedAt = Date.now();

  await db.job.update({ where: { id: job.id }, data: { status: "RUNNING" } });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      manifest.endpoint.timeout_seconds * 1000,
    );

    const res = await fetch(manifest.endpoint.url, {
      method: manifest.endpoint.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job.input),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`worker responded with status ${res.status}`);
    }

    const output = await res.json();
    const latencyMs = Date.now() - startedAt;

    await db.job.update({
      where: { id: job.id },
      data: { status: "SUCCEEDED", output, latencyMs, completedAt: new Date() },
    });

    if (job.escrowTransaction?.stripePaymentIntentId) {
      await stripe.paymentIntents.capture(
        job.escrowTransaction.stripePaymentIntentId,
      );
      await db.escrowTransaction.update({
        where: { jobId: job.id },
        data: { status: "CAPTURED" },
      });
    }
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : "unknown error";

    await db.job.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        latencyMs,
        errorMessage: message,
        completedAt: new Date(),
      },
    });

    // Automatic refund: unavailable / timeout / invalid response / server failure.
    if (job.escrowTransaction?.stripePaymentIntentId) {
      await stripe.paymentIntents.cancel(
        job.escrowTransaction.stripePaymentIntentId,
      );
      await db.escrowTransaction.update({
        where: { jobId: job.id },
        data: { status: "VOIDED" },
      });
    }
  }
}

// ---------- Verification: Documentation Agent ----------

async function processVerifyDocumentation(bullJob: BullJob<VerifyManifestData>) {
  const manifest = await db.workerManifest.findUniqueOrThrow({
    where: { id: bullJob.data.manifestId },
  });

  const message = await anthropic.messages.create({
    model: VERIFICATION_MODEL,
    max_tokens: 1024,
    system:
      "You are the Documentation Agent for a developer marketplace. Score submitted worker documentation for quality, completeness, and honesty. Respond with ONLY JSON: {\"score\": 0-100, \"issues\": [{\"severity\": \"low\"|\"medium\"|\"high\", \"message\": string}]}.",
    messages: [
      {
        role: "user",
        content: `Manifest:\n${JSON.stringify(manifest.manifest, null, 2)}\n\nREADME:\n${manifest.readme}`,
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
  const { score, issues } = JSON.parse(text) as {
    score: number;
    issues: Prisma.InputJsonValue;
  };

  await db.verificationRun.create({
    data: {
      manifestId: manifest.id,
      agentType: "DOCUMENTATION",
      score,
      issues,
    },
  });

  await verifySecurityQueue.add("verify", { manifestId: manifest.id });
}

// ---------- Verification: Security Agent ----------
// Per skill.md: never automatically ban, only flag.

async function processVerifySecurity(bullJob: BullJob<VerifyManifestData>) {
  const manifest = await db.workerManifest.findUniqueOrThrow({
    where: { id: bullJob.data.manifestId },
  });

  const message = await anthropic.messages.create({
    model: VERIFICATION_MODEL,
    max_tokens: 1024,
    system:
      "You are the Security Agent for a developer marketplace. Review the manifest for suspicious behavior, endpoint safety, prompt-injection resistance, data-leakage risk, and credential exposure. You only flag concerns for human review — never decide bans. Respond with ONLY JSON: {\"score\": 0-100, \"issues\": [{\"severity\": \"low\"|\"medium\"|\"high\", \"message\": string}]}.",
    messages: [
      {
        role: "user",
        content: JSON.stringify(manifest.manifest, null, 2),
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
  const { score, issues } = JSON.parse(text) as {
    score: number;
    issues: Prisma.InputJsonValue;
  };

  await db.verificationRun.create({
    data: {
      manifestId: manifest.id,
      agentType: "SECURITY",
      score,
      issues,
    },
  });

  await verifyBenchmarkQueue.add("verify", { manifestId: manifest.id });
}

// ---------- Verification: Benchmark Agent ----------
// Benchmark fixtures are category-specific (e.g. known-vulnerable contracts
// for a Solidity Auditor) and must be curated per category — there is no
// generic fixture set. This scaffold records a run so the pipeline and
// Judge Agent are wired end-to-end; plug in real fixtures per category
// before relying on this score.

async function processVerifyBenchmark(bullJob: BullJob<VerifyManifestData>) {
  const manifest = await db.workerManifest.findUniqueOrThrow({
    where: { id: bullJob.data.manifestId },
  });

  await db.verificationRun.create({
    data: {
      manifestId: manifest.id,
      agentType: "BENCHMARK",
      score: 0,
      issues: [
        {
          severity: "medium",
          message: `No benchmark fixtures configured for category "${
            (manifest.manifest as { category?: string }).category ?? "unknown"
          }" yet.`,
        },
      ],
    },
  });

  await verifyJudgeQueue.add("verify", { manifestId: manifest.id });
}

// ---------- Verification: Judge Agent ----------
// Combines documentation, security, and benchmark scores into a trust score.
// Auto-approves confidently high scores; everything else goes to manual
// review rather than being auto-rejected (skill.md: never rely only on AI
// judgement).

const APPROVAL_THRESHOLD = 70;

async function processVerifyJudge(bullJob: BullJob<VerifyManifestData>) {
  const manifest = await db.workerManifest.findUniqueOrThrow({
    where: { id: bullJob.data.manifestId },
    include: { verificationRuns: true },
  });

  const scoreFor = (type: string) =>
    manifest.verificationRuns.find((r) => r.agentType === type)?.score ?? 0;

  const documentation = scoreFor("DOCUMENTATION");
  const security = scoreFor("SECURITY");
  const benchmark = scoreFor("BENCHMARK");

  const judgeScore = Math.round(
    documentation * 0.25 + security * 0.35 + benchmark * 0.4,
  );

  await db.verificationRun.create({
    data: {
      manifestId: manifest.id,
      agentType: "JUDGE",
      score: judgeScore,
      issues: [],
    },
  });

  await db.workerManifest.update({
    where: { id: manifest.id },
    data: {
      status: judgeScore >= APPROVAL_THRESHOLD ? "APPROVED" : "PENDING_REVIEW",
    },
  });

  await db.trustScoreSnapshot.create({
    data: {
      workerId: manifest.workerId,
      score: judgeScore,
      breakdown: { documentation, security, benchmark },
    },
  });
}

new Worker<JobExecuteData>(QUEUE_NAMES.workerExecute, processWorkerExecute, {
  connection,
});
new Worker<VerifyManifestData>(
  QUEUE_NAMES.verifyDocumentation,
  processVerifyDocumentation,
  { connection },
);
new Worker<VerifyManifestData>(
  QUEUE_NAMES.verifySecurity,
  processVerifySecurity,
  { connection },
);
new Worker<VerifyManifestData>(
  QUEUE_NAMES.verifyBenchmark,
  processVerifyBenchmark,
  { connection },
);
new Worker<VerifyManifestData>(QUEUE_NAMES.verifyJudge, processVerifyJudge, {
  connection,
});

console.log("worker process started, listening on all queues");
