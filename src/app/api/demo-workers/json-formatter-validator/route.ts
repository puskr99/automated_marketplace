import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Purely local logic, no upstream API. Invalid JSON is a normal, successful
// answer (valid: false) — not a service failure.

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jsonString = body?.json_string;
  const indent = Number.isInteger(body?.indent) ? body.indent : 2;

  if (!jsonString || typeof jsonString !== "string") {
    return NextResponse.json({ error: "json_string (string) is required" }, { status: 400 });
  }

  try {
    const parsed = JSON.parse(jsonString);
    return NextResponse.json({
      valid: true,
      formatted: JSON.stringify(parsed, null, indent),
    });
  } catch (err) {
    return NextResponse.json({
      valid: false,
      error: err instanceof Error ? err.message : "invalid JSON",
    });
  }
}
