import { Queue } from "bullmq";

const connection = {
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
  lazyConnect: true,
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
  { connection },
);

export const verifyDocumentationQueue = new Queue<VerifyManifestData>(
  QUEUE_NAMES.verifyDocumentation,
  { connection },
);

export const verifySecurityQueue = new Queue<VerifyManifestData>(
  QUEUE_NAMES.verifySecurity,
  { connection },
);

export const verifyBenchmarkQueue = new Queue<VerifyManifestData>(
  QUEUE_NAMES.verifyBenchmark,
  { connection },
);

export const verifyJudgeQueue = new Queue<VerifyManifestData>(
  QUEUE_NAMES.verifyJudge,
  { connection },
);
