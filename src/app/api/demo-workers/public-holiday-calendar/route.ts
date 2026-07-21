import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Wraps Nager.Date (https://date.nager.at) — free, keyless.

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const year = body?.year;
  const countryCode = body?.country_code;

  if (!Number.isInteger(year) || !countryCode || typeof countryCode !== "string") {
    return NextResponse.json(
      { error: "year (integer) and country_code (ISO 2-letter) are required" },
      { status: 400 },
    );
  }

  const res = await fetch(
    `https://date.nager.at/api/v3/publicholidays/${year}/${encodeURIComponent(countryCode.toUpperCase())}`,
  );
  if (res.status === 404) {
    return NextResponse.json(
      { error: `no holiday data for "${countryCode}" in ${year}` },
      { status: 404 },
    );
  }
  if (!res.ok) {
    return NextResponse.json({ error: "holiday calendar service unavailable" }, { status: 502 });
  }
  const data = await res.json();

  return NextResponse.json({
    country_code: countryCode.toUpperCase(),
    year,
    holidays: data.map((h: { date: string; name: string; localName: string }) => ({
      date: h.date,
      name: h.name,
      local_name: h.localName,
    })),
  });
}
