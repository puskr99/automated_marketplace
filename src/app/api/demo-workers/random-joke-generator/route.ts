import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Wraps official-joke-api.appspot.com — free, keyless.

export async function POST() {
  const res = await fetch("https://official-joke-api.appspot.com/random_joke");
  if (!res.ok) {
    return NextResponse.json({ error: "joke service unavailable" }, { status: 502 });
  }
  const data = await res.json();

  return NextResponse.json({
    setup: data.setup,
    punchline: data.punchline,
    category: data.type,
  });
}
