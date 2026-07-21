import { randomUUID } from "crypto";
import { isAddress, type Address } from "viem";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, findOrCreate } from "@/lib/db";
import {
  withdrawCredits,
  reverseWithdrawal,
  InsufficientCreditsError,
} from "@/lib/credits";
import { centsToUsdcBaseUnits, sendUsdc } from "@/lib/crypto/server";
import { REAL_MONEY_PAYMENTS_ENABLED } from "@/lib/feature-flags";

const MIN_WITHDRAWAL_CENTS = 100; // $1

export async function POST(request: Request) {
  if (!REAL_MONEY_PAYMENTS_ENABLED) {
    return NextResponse.json(
      { error: "withdrawals are coming soon" },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const { amountCents, payoutAddress } = (await request.json()) as {
    amountCents?: number;
    payoutAddress?: string;
  };

  if (!amountCents || !Number.isInteger(amountCents) || amountCents < MIN_WITHDRAWAL_CENTS) {
    return NextResponse.json(
      { error: `amountCents must be an integer of at least ${MIN_WITHDRAWAL_CENTS}` },
      { status: 400 },
    );
  }
  if (!payoutAddress || !isAddress(payoutAddress)) {
    return NextResponse.json({ error: "a valid payoutAddress is required" }, { status: 400 });
  }

  const user = await findOrCreate(
    () => db.user.findUnique({ where: { email: session.user!.email! } }),
    () => db.user.create({ data: { email: session.user!.email! } }),
  );

  // Debit first (single guarded statement, prevents double-spend), then
  // attempt the actual send. No transaction ties these two together (see
  // lib/credits.ts) — if the send fails, credit the amount straight back.
  const reference = `withdraw:${randomUUID()}`;
  try {
    await withdrawCredits({
      userId: user.id,
      amountCents,
      reference,
      metadata: { payoutAddress, status: "pending" },
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "insufficient withdrawable balance" }, { status: 402 });
    }
    throw err;
  }

  try {
    const txHash = await sendUsdc(payoutAddress as Address, centsToUsdcBaseUnits(amountCents));
    await db.creditTransaction.updateMany({
      where: { reference },
      data: { metadata: { payoutAddress, status: "sent", payoutTxHash: txHash } },
    });
    return NextResponse.json({ payoutTxHash: txHash }, { status: 201 });
  } catch (err) {
    await reverseWithdrawal({
      userId: user.id,
      amountCents,
      reference: `${reference}:reversed`,
      metadata: { reversalOf: reference, payoutAddress },
    });
    const message = err instanceof Error ? err.message : "payout failed";
    return NextResponse.json(
      { error: `withdrawal could not be sent, your balance was not charged: ${message}` },
      { status: 502 },
    );
  }
}
