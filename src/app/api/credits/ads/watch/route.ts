import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, findOrCreate } from "@/lib/db";
import { creditBonus, getBalances } from "@/lib/credits";
import {
  MAX_AD_REWARDS_PER_DAY,
  adRewardCentsForWatch,
  verifyAdRewardToken,
} from "@/lib/ad-reward";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const token = body?.token;
  if (typeof token !== "string") {
    return NextResponse.json({ error: "missing ad session token" }, { status: 400 });
  }

  const user = await findOrCreate(
    () => db.user.findUnique({ where: { email: session.user!.email! } }),
    () => db.user.create({ data: { email: session.user!.email! } }),
  );

  const verified = verifyAdRewardToken(token, user.id);
  if (!verified) {
    return NextResponse.json(
      { error: "ad session expired or invalid — try watching another ad" },
      { status: 400 },
    );
  }

  const rewardsToday = await db.creditTransaction.count({
    where: {
      type: "AD_REWARD",
      createdAt: { gte: startOfToday() },
      account: { userId: user.id },
    },
  });

  if (rewardsToday >= MAX_AD_REWARDS_PER_DAY) {
    return NextResponse.json(
      { error: "daily ad-reward limit reached — come back tomorrow" },
      { status: 429 },
    );
  }

  // The token's jti is the idempotency key: a replayed token (same jti)
  // hits the unique constraint on `reference` and creditBonus throws before
  // touching the balance, so this can't be double-spent by retrying.
  const rewardCents = adRewardCentsForWatch(rewardsToday);
  await creditBonus({
    userId: user.id,
    amountCents: rewardCents,
    reference: `ad:${verified.jti}`,
  });

  const balances = await getBalances(user.id);
  return NextResponse.json(
    {
      ...balances,
      rewardedCents: rewardCents,
      rewardsRemainingToday: MAX_AD_REWARDS_PER_DAY - rewardsToday - 1,
    },
    { status: 201 },
  );
}
