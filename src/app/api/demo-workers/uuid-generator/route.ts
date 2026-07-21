import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Purely local logic, no upstream API to depend on.

const MAX_COUNT = 100;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const count = Number.isInteger(body?.count) ? body.count : 1;

  if (count < 1 || count > MAX_COUNT) {
    return NextResponse.json(
      { error: `count must be between 1 and ${MAX_COUNT}` },
      { status: 400 },
    );
  }

  return NextResponse.json({
    uuids: Array.from({ length: count }, () => randomUUID()),
  });
}
