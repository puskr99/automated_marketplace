import { Queue } from "bullmq";

const connection = {
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
  lazyConnect: true,
};

// Serverless Postgres (Neon) drops idle connections; the first query after
// a quiet period can fail while it reconnects. Retrying with backoff
// absorbs that transparently instead of permanently failing a user's job
// over a transient DB hiccup.
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
};

export const QUEUE_NAMES = {
  workerExecute: "worker.execute",
  verifyDocumentation: "verify.documentation",
  verifySecurity: "verify.security",
  verifyBenchmark: "verify.benchmark",
  verifyJudge: "verify.judge",
} as const;

export type JobExecuteData = {
  jobId: string;
};

export type VerifyManifestData = {
  manifestId: string;
};

export const workerExecuteQueue = new Queue<JobExecuteData>(
  QUEUE_NAMES.workerExecute,
  { connection, defaultJobOptions },
);

export const verifyDocumentationQueue = new Queue<VerifyManifestData>(
  QUEUE_NAMES.verifyDocumentation,
  { connection, defaultJobOptions },
);

export const verifySecurityQueue = new Queue<VerifyManifestData>(
  QUEUE_NAMES.verifySecurity,
  { connection, defaultJobOptions },
);

export const verifyBenchmarkQueue = new Queue<VerifyManifestData>(
  QUEUE_NAMES.verifyBenchmark,
  { connection, defaultJobOptions },
);

export const verifyJudgeQueue = new Queue<VerifyManifestData>(
  QUEUE_NAMES.verifyJudge,
  { connection, defaultJobOptions },
);
