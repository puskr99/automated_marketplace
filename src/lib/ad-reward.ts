// Rewarded-ad session tokens for /credits/earn.
//
// Google Ad Manager's server-side verification (SSV) for rewarded ads is an
// app-only feature (Android/iOS/Unity) — Google's own docs say it's
// "unavailable for web use". So there's no signed reward callback Google
// will send us for a web (GPT) integration; the reward is fundamentally a
// client-reported event (window.googletag firing "rewardedSlotGranted").
//
// This is the practical substitute: a short-lived, single-use token signed
// with AUTH_SECRET, minted by POST /api/credits/ads/watch/start when the
// rewarded ad slot is actually requested, and required (with a minimum
// elapsed time) by POST /api/credits/ads/watch when the reward is claimed.
// It stops a signed-in user from just looping the reward endpoint without
// ever loading an ad — they now need a fresh token tied to a real ad
// session. It can't stop someone from spoofing the rewardedSlotGranted
// event in devtools once they hold a valid token; the daily cap is the
// backstop for that, same as before this existed.
import { createHmac, randomUUID, timingSafeEqual } from "crypto";

export const MAX_AD_REWARDS_PER_DAY = 10;

// Progressively longer required gaps between claims, indexed by how many
// the account has already watched today (index 0 applies before the 2nd ad,
// index 1 before the 3rd, etc; the last entry repeats for every ad after).
// With no real GAM SSV callback for web (see verifyAdRewardToken above),
// the daily cap alone left a script free to loop /watch/start -> /watch
// and drain a full day's cap in well under a minute — a real rewarded
// video ad takes 15-30s+ to load and play, so these cooldowns mainly cost
// an automated loop real wall-clock time without changing what a genuine
// viewer experiences.
const COOLDOWN_MINUTES_BY_WATCH_COUNT = [5, 15, 60];

export function cooldownMsRemaining(
  rewardsToday: number,
  lastRewardAt: Date | null,
): number {
  if (rewardsToday <= 0 || !lastRewardAt) return 0;
  const idx = Math.min(rewardsToday - 1, COOLDOWN_MINUTES_BY_WATCH_COUNT.length - 1);
  const requiredMs = COOLDOWN_MINUTES_BY_WATCH_COUNT[idx] * 60_000;
  return Math.max(0, requiredMs - (Date.now() - lastRewardAt.getTime()));
}

// Real per-view rewarded-ad revenue floor is $0.01–$0.015 (GAM's minimum),
// so the payout needs to sit under that with margin. $0.005/watch is the
// target — but amountCents is a whole-cent integer end to end (see
// CreditTransaction in prisma/schema.prisma), and changing that to sub-cent
// precision would mean migrating every dollar-handling path in lib/credits.ts,
// not just this one. Instead: credit 1 cent on every *other* watch, 0 on the
// rest — deterministic and schema-free, and it converges to exactly
// $0.005/watch on average. `rewardsToday` (already fetched by both routes for
// the daily-cap check) doubles as the parity counter, so this needs no new
// state: index 0, 2, 4… credits 1¢; index 1, 3, 5… credits 0¢.
export function adRewardCentsForWatch(rewardsToday: number): number {
  return rewardsToday % 2 === 0 ? 1 : 0;
}

const MIN_AD_SECONDS = 4;
const MAX_TOKEN_AGE_MS = 10 * 60 * 1000;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET must be set to sign ad-reward tokens");
  return value;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", secret()).update(encodedPayload).digest("base64url");
}

export function mintAdRewardToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, iat: Date.now(), jti: randomUUID() }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

// Returns the token's jti (for use as the idempotency reference on the
// credited transaction) if the token is validly signed, belongs to this
// user, and its age falls within [MIN_AD_SECONDS, MAX_TOKEN_AGE_MS] —
// otherwise null.
export function verifyAdRewardToken(
  token: string,
  userId: string,
): { jti: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  let decoded: { uid: string; iat: number; jti: string };
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }

  if (decoded.uid !== userId) return null;

  const age = Date.now() - decoded.iat;
  if (age < MIN_AD_SECONDS * 1000 || age > MAX_TOKEN_AGE_MS) return null;

  return { jti: decoded.jti };
}
