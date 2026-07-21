import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Wraps ipwho.is — free, keyless, no strict per-minute rate limit (unlike
// ipapi.co, the original choice here, whose free tier 429'd after light
// testing traffic).

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ip = body?.ip;

  if (!ip || typeof ip !== "string") {
    return NextResponse.json({ error: "ip (string) is required" }, { status: 400 });
  }

  const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
  if (!res.ok) {
    return NextResponse.json({ error: "geolocation service unavailable" }, { status: 502 });
  }
  const data = await res.json();
  if (!data.success) {
    return NextResponse.json(
      { error: data.message ?? "could not locate this IP" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ip: data.ip,
    city: data.city,
    region: data.region,
    country: data.country,
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone?.id,
    isp: data.connection?.isp ?? data.connection?.org,
  });
}
