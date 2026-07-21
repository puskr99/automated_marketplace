import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, findOrCreate } from "@/lib/db";
import { depositCredits } from "@/lib/credits";
import { verifyUsdcDeposit, usdcBaseUnitsToCents } from "@/lib/crypto/server";
import { REAL_MONEY_PAYMENTS_ENABLED } from "@/lib/feature-flags";
import type { Hash } from "viem";

// Buyer already sent USDC to the platform address from their own wallet
// (client-side, before calling this) — verify the transfer on-chain and
// credit exactly what arrived, never what the client claims.
export async function POST(request: Request) {
  if (!REAL_MONEY_PAYMENTS_ENABLED) {
    return NextResponse.json(
      { error: "USDC deposits are coming soon — earn credits by watching ads for now" },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const { depositTxHash } = (await request.json()) as { depositTxHash?: string };
  if (!depositTxHash) {
    return NextResponse.json({ error: "depositTxHash is required" }, { status: 400 });
  }

  let amountBaseUnits: bigint;
  try {
    const deposit = await verifyUsdcDeposit(depositTxHash as Hash, BigInt(1));
    amountBaseUnits = deposit.amountBaseUnits;
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid deposit";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const amountCents = usdcBaseUnitsToCents(amountBaseUnits);
  if (amountCents <= 0) {
    return NextResponse.json({ error: "deposit amount too small" }, { status: 400 });
  }

  const user = await findOrCreate(
    () => db.user.findUnique({ where: { email: session.user!.email! } }),
    () => db.user.create({ data: { email: session.user!.email! } }),
  );

  try {
    await depositCredits({
      userId: user.id,
      amountCents,
      reference: `deposit:${depositTxHash}`,
      metadata: { depositTxHash },
    });
  } catch {
    // Unique constraint on reference — this tx was already credited.
    return NextResponse.json(
      { error: "this deposit transaction has already been credited" },
      { status: 409 },
    );
  }

  return NextResponse.json({ creditedCents: amountCents }, { status: 201 });
}
