import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, findOrCreate } from "@/lib/db";
import {
  MAX_AD_REWARDS_PER_DAY,
  cooldownMsRemaining,
  mintAdRewardToken,
} from "@/lib/ad-reward";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Mints the session token that POST /api/credits/ads/watch requires to
// credit a reward. Called once the client actually requests the rewarded ad
// slot from Google — see lib/ad-reward.ts for why this exists instead of a
// real server-side verification callback (GAM doesn't offer one for web).
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const user = await findOrCreate(
    () => db.user.findUnique({ where: { email: session.user!.email! } }),
    () => db.user.create({ data: { email: session.user!.email! } }),
  );

  const [rewardsToday, lastReward] = await Promise.all([
    db.creditTransaction.count({
      where: {
        type: "AD_REWARD",
        createdAt: { gte: startOfToday() },
        account: { userId: user.id },
      },
    }),
    db.creditTransaction.findFirst({
      where: {
        type: "AD_REWARD",
        createdAt: { gte: startOfToday() },
        account: { userId: user.id },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (rewardsToday >= MAX_AD_REWARDS_PER_DAY) {
    return NextResponse.json(
      { error: "daily ad-reward limit reached — come back tomorrow" },
      { status: 429 },
    );
  }

  const waitMs = cooldownMsRemaining(rewardsToday, lastReward?.createdAt ?? null);
  if (waitMs > 0) {
    const waitMinutes = Math.ceil(waitMs / 60_000);
    return NextResponse.json(
      {
        error: `come back in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"} for your next ad`,
      },
      { status: 429 },
    );
  }

  return NextResponse.json({ token: mintAdRewardToken(user.id) }, { status: 201 });
}
