import { randomInt } from "crypto";
import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Purely local logic, no upstream API. Uses crypto.randomInt (rejection
// sampling under the hood) rather than Math.random, so character choice
// isn't modulo-biased.

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const length = Number.isInteger(body?.length) ? body.length : 16;
  const includeSymbols = body?.include_symbols !== false;

  if (length < MIN_LENGTH || length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `length must be between ${MIN_LENGTH} and ${MAX_LENGTH}` },
      { status: 400 },
    );
  }

  const charset = LETTERS + DIGITS + (includeSymbols ? SYMBOLS : "");
  const password = Array.from({ length }, () => charset[randomInt(charset.length)]).join("");

  return NextResponse.json({ password, length });
}
