-- CreateEnum
CREATE TYPE "EscrowProvider" AS ENUM ('STRIPE', 'CRYPTO_USDC');

-- AlterTable
ALTER TABLE "developer_profiles" ADD COLUMN "payoutWalletAddress" TEXT;

-- AlterTable
ALTER TABLE "escrow_transactions"
  ADD COLUMN "provider" "EscrowProvider" NOT NULL DEFAULT 'STRIPE',
  ADD COLUMN "payerAddress" TEXT,
  ADD COLUMN "depositTxHash" TEXT,
  ADD COLUMN "payoutTxHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "escrow_transactions_depositTxHash_key" ON "escrow_transactions"("depositTxHash");
