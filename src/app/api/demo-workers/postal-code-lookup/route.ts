import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Wraps Zippopotam.us (https://zippopotam.us) — free, keyless.

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const countryCode = body?.country_code;
  const postalCode = body?.postal_code;

  if (
    !countryCode ||
    typeof countryCode !== "string" ||
    !postalCode ||
    typeof postalCode !== "string"
  ) {
    return NextResponse.json(
      { error: "country_code (ISO 2-letter) and postal_code are required" },
      { status: 400 },
    );
  }

  const res = await fetch(
    `https://api.zippopotam.us/${encodeURIComponent(countryCode.toLowerCase())}/${encodeURIComponent(postalCode)}`,
  );
  if (res.status === 404) {
    return NextResponse.json(
      { error: `no location found for "${postalCode}" in "${countryCode}"` },
      { status: 404 },
    );
  }
  if (!res.ok) {
    return NextResponse.json({ error: "postal code service unavailable" }, { status: 502 });
  }
  const data = await res.json();

  return NextResponse.json({
    country: data.country,
    country_code: data["country abbreviation"],
    postal_code: data["post code"],
    places: (data.places as Array<Record<string, string>>).map((p) => ({
      place_name: p["place name"],
      state: p.state,
      latitude: p.latitude,
      longitude: p.longitude,
    })),
  });
}
