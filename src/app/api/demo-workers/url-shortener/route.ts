import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Wraps is.gd — free, keyless.

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const url = body?.url;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url (string) is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "url must be a valid, absolute URL" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "url must use http or https" }, { status: 400 });
  }

  const res = await fetch(
    `https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`,
  );
  if (!res.ok) {
    return NextResponse.json({ error: "URL shortener service unavailable" }, { status: 502 });
  }
  const data = await res.json();
  if (data.errorcode) {
    return NextResponse.json({ error: data.errormessage ?? "could not shorten this URL" }, { status: 400 });
  }

  return NextResponse.json({ original_url: url, short_url: data.shorturl });
}
