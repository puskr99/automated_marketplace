// Platform-internal credits ledger. Two balances per user:
//   - withdrawableCents: backed 1:1 by real deposits or job earnings.
//     Redeemable back to real money.
//   - bonusCents: earned by watching ads (see /credits/earn). Spendable on
//     worker runs only — never withdrawable. Keeping this separate from
//     withdrawableCents is deliberate: a shared balance would let ad-watching
//     be laundered into a cash payout.
//
// No `db.$transaction` here: the Neon HTTP adapter this app uses doesn't
// support multi-statement transactions (see lib/db.ts). Each balance
// mutation is instead a single guarded UPDATE (`WHERE ... + delta >= 0`),
// which Postgres already makes atomic on its own — no explicit transaction
// needed for that part.
//
// Statement ordering matters without a transaction: functions keyed by an
// externally-suppliable `reference` (depositCredits, creditBonus,
// reverseWithdrawal) insert the audit row *first*, so the unique constraint
// on `reference` is the idempotency gate — a retry with the same reference
// fails before the balance is ever touched. Debit-side functions (spendForJob,
// withdrawCredits) apply the balance delta first and log after, since there's
// no replay concern there and the guarded UPDATE is what needs to run before
// anything else can observe the new balance.
import { db, findOrCreate } from "@/lib/db";
import type { CreditBalance } from "@/generated/prisma/client";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("insufficient credit balance");
  }
}

async function getOrCreateAccount(userId: string) {
  return findOrCreate(
    () => db.creditAccount.findUnique({ where: { userId } }),
    () => db.creditAccount.create({ data: { userId } }),
  );
}

async function applyDelta(
  accountId: string,
  balance: CreditBalance,
  amountCents: number,
) {
  const rows =
    balance === "WITHDRAWABLE"
      ? await db.$queryRaw<{ id: string }[]>`
          UPDATE credit_accounts
          SET "withdrawableCents" = "withdrawableCents" + ${amountCents}, "updatedAt" = now()
          WHERE id = ${accountId} AND "withdrawableCents" + ${amountCents} >= 0
          RETURNING id`
      : await db.$queryRaw<{ id: string }[]>`
          UPDATE credit_accounts
          SET "bonusCents" = "bonusCents" + ${amountCents}, "updatedAt" = now()
          WHERE id = ${accountId} AND "bonusCents" + ${amountCents} >= 0
          RETURNING id`;

  if (rows.length === 0) {
    throw new InsufficientCreditsError();
  }
}

export async function getBalances(userId: string) {
  const account = await getOrCreateAccount(userId);
  return {
    withdrawableCents: account.withdrawableCents,
    bonusCents: account.bonusCents,
  };
}

// Inserts the audit row *before* touching the balance: the unique
// `reference` constraint is the idempotency gate for external retries
// (Stripe webhook redelivery, a client resubmitting the same deposit tx). If
// this reference was already used, the insert throws and the balance is
// never touched — the reverse order would let a retry double-credit even
// though the duplicate row correctly gets rejected.
export async function depositCredits(params: {
  userId: string;
  amountCents: number;
  reference: string;
  metadata?: object;
}) {
  const account = await getOrCreateAccount(params.userId);
  await db.creditTransaction.create({
    data: {
      accountId: account.id,
      type: "DEPOSIT",
      balance: "WITHDRAWABLE",
      amountCents: params.amountCents,
      reference: params.reference,
      metadata: params.metadata,
    },
  });
  await applyDelta(account.id, "WITHDRAWABLE", params.amountCents);
}

// Debits withdrawableCents immediately. Callers are responsible for crediting
// it back (see api/credits/withdraw) if the actual payout send fails
// afterward — there's no transaction wrapping the two.
export async function withdrawCredits(params: {
  userId: string;
  amountCents: number;
  reference: string;
  metadata?: object;
}) {
  const account = await getOrCreateAccount(params.userId);
  await applyDelta(account.id, "WITHDRAWABLE", -params.amountCents);
  await db.creditTransaction.create({
    data: {
      accountId: account.id,
      type: "WITHDRAWAL",
      balance: "WITHDRAWABLE",
      amountCents: -params.amountCents,
      reference: params.reference,
      metadata: params.metadata,
    },
  });
}

// Compensates a withdrawal whose debit succeeded but whose actual payout
// send failed afterward (no transaction ties the two together — see the
// module comment). Tagged as a WITHDRAWAL-type credit so it reads in history
// as "this withdrawal didn't go through", not as a fresh deposit.
export async function reverseWithdrawal(params: {
  userId: string;
  amountCents: number;
  reference: string;
  metadata?: object;
}) {
  const account = await getOrCreateAccount(params.userId);
  await db.creditTransaction.create({
    data: {
      accountId: account.id,
      type: "WITHDRAWAL",
      balance: "WITHDRAWABLE",
      amountCents: params.amountCents,
      reference: params.reference,
      metadata: params.metadata,
    },
  });
  await applyDelta(account.id, "WITHDRAWABLE", params.amountCents);
}

export async function creditBonus(params: {
  userId: string;
  amountCents: number;
  reference: string;
  metadata?: object;
}) {
  const account = await getOrCreateAccount(params.userId);
  await db.creditTransaction.create({
    data: {
      accountId: account.id,
      type: "AD_REWARD",
      balance: "BONUS",
      amountCents: params.amountCents,
      reference: params.reference,
      metadata: params.metadata,
    },
  });
  await applyDelta(account.id, "BONUS", params.amountCents);
}

// Spends bonus credits first, then withdrawable, for the remainder. Returns
// the split so the job can be refunded proportionally on failure. Throws
// InsufficientCreditsError (and leaves both balances untouched) if the
// combined balance can't cover the cost.
export async function spendForJob(
  userId: string,
  jobId: string,
  costCents: number,
): Promise<{ bonusCentsSpent: number; withdrawableCentsSpent: number }> {
  const account = await getOrCreateAccount(userId);
  const bonusCentsSpent = Math.min(account.bonusCents, costCents);
  const withdrawableCentsSpent = costCents - bonusCentsSpent;

  if (bonusCentsSpent > 0) {
    await applyDelta(account.id, "BONUS", -bonusCentsSpent);
  }

  if (withdrawableCentsSpent > 0) {
    try {
      await applyDelta(account.id, "WITHDRAWABLE", -withdrawableCentsSpent);
    } catch (err) {
      // Combined balance wasn't enough — undo the bonus debit already applied
      // so the failed spend has no side effect.
      if (bonusCentsSpent > 0) {
        await applyDelta(account.id, "BONUS", bonusCentsSpent);
      }
      throw err;
    }
  }

  if (bonusCentsSpent > 0) {
    await db.creditTransaction.create({
      data: {
        accountId: account.id,
        jobId,
        type: "JOB_SPEND",
        balance: "BONUS",
        amountCents: -bonusCentsSpent,
      },
    });
  }
  if (withdrawableCentsSpent > 0) {
    await db.creditTransaction.create({
      data: {
        accountId: account.id,
        jobId,
        type: "JOB_SPEND",
        balance: "WITHDRAWABLE",
        amountCents: -withdrawableCentsSpent,
      },
    });
  }

  return { bonusCentsSpent, withdrawableCentsSpent };
}

// Refunds a failed job back to the buyer, split across the same buckets it
// was originally spent from. No-ops if this job was already refunded (guards
// the BullMQ retry path in worker.ts re-running settlement after a crash).
export async function refundJob(job: {
  id: string;
  buyerId: string;
  costCents: number;
  bonusCentsSpent: number;
}) {
  const alreadyRefunded = await db.creditTransaction.findFirst({
    where: { jobId: job.id, type: "JOB_REFUND" },
  });
  if (alreadyRefunded) return;

  const account = await getOrCreateAccount(job.buyerId);
  const withdrawableCentsSpent = job.costCents - job.bonusCentsSpent;

  if (job.bonusCentsSpent > 0) {
    await applyDelta(account.id, "BONUS", job.bonusCentsSpent);
    await db.creditTransaction.create({
      data: {
        accountId: account.id,
        jobId: job.id,
        type: "JOB_REFUND",
        balance: "BONUS",
        amountCents: job.bonusCentsSpent,
      },
    });
  }
  if (withdrawableCentsSpent > 0) {
    await applyDelta(account.id, "WITHDRAWABLE", withdrawableCentsSpent);
    await db.creditTransaction.create({
      data: {
        accountId: account.id,
        jobId: job.id,
        type: "JOB_REFUND",
        balance: "WITHDRAWABLE",
        amountCents: withdrawableCentsSpent,
      },
    });
  }
}

// Credits a developer for a completed job. Always withdrawable, regardless
// of whether the buyer funded the run from bonus or withdrawable credits —
// bonus-funded runs are a platform marketing cost, not something the
// developer should ever see or bear. No-ops if already paid out (retry guard,
// same as refundJob).
export async function earnForJob(params: {
  developerUserId: string;
  jobId: string;
  amountCents: number;
}) {
  const alreadyPaid = await db.creditTransaction.findFirst({
    where: { jobId: params.jobId, type: "JOB_EARNING" },
  });
  if (alreadyPaid) return;

  const account = await getOrCreateAccount(params.developerUserId);
  await applyDelta(account.id, "WITHDRAWABLE", params.amountCents);
  await db.creditTransaction.create({
    data: {
      accountId: account.id,
      jobId: params.jobId,
      type: "JOB_EARNING",
      balance: "WITHDRAWABLE",
      amountCents: params.amountCents,
    },
  });
}
