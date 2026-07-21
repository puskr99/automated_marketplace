import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Wraps randomuser.me — free, keyless. Useful for generating fake test
// fixtures (QA, demos, seed data) — not real people.

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const nationality = typeof body?.nationality === "string" ? body.nationality : undefined;

  const url = nationality
    ? `https://randomuser.me/api/?nat=${encodeURIComponent(nationality)}`
    : "https://randomuser.me/api/";

  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json({ error: "random user service unavailable" }, { status: 502 });
  }
  const data = await res.json();
  const person = data.results?.[0];
  if (!person) {
    return NextResponse.json({ error: "random user service returned nothing" }, { status: 502 });
  }

  return NextResponse.json({
    full_name: `${person.name.first} ${person.name.last}`,
    email: person.email,
    phone: person.phone,
    username: person.login.username,
    picture_url: person.picture.large,
    location: `${person.location.city}, ${person.location.country}`,
  });
}
