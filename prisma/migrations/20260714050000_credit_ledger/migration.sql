-- Two-balance credits ledger: withdrawableCents (deposit/earning-backed,
-- redeemable to cash) and bonusCents (ad-earned, spend-only). See
-- src/lib/credits.ts for the mutation logic and prisma/schema.prisma for
-- the rationale on keeping the two balances separate.

CREATE TYPE "CreditBalance" AS ENUM ('WITHDRAWABLE', 'BONUS');
CREATE TYPE "CreditTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'AD_REWARD', 'JOB_SPEND', 'JOB_EARNING', 'JOB_REFUND');

CREATE TABLE "credit_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "withdrawableCents" INTEGER NOT NULL DEFAULT 0,
    "bonusCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credit_accounts_userId_key" ON "credit_accounts"("userId");

ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "balance" "CreditBalance" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "jobId" TEXT,
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credit_transactions_reference_key" ON "credit_transactions"("reference");
CREATE INDEX "credit_transactions_accountId_idx" ON "credit_transactions"("accountId");

ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "credit_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "jobs" ADD COLUMN "isFreeTrial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "jobs" ADD COLUMN "bonusCentsSpent" INTEGER NOT NULL DEFAULT 0;

-- Backfill: historical jobs with no escrow row were free trials under the
-- old inference rule (`escrowTransaction == null`).
UPDATE "jobs" SET "isFreeTrial" = true
WHERE "id" NOT IN (SELECT "jobId" FROM "escrow_transactions");
