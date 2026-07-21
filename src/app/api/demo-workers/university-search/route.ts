import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Wraps Hipolabs' universities API (http://universities.hipolabs.com) —
// free, keyless. HTTP only — the host doesn't serve HTTPS (connection
// refused on 443), so don't "fix" this to https:// without re-checking.

type University = { name: string; country: string; domains: string[]; web_pages: string[] };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = body?.name;
  const country = typeof body?.country === "string" ? body.country : undefined;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name (string) is required" }, { status: 400 });
  }

  const params = new URLSearchParams({ name });
  if (country) params.set("country", country);

  const res = await fetch(`http://universities.hipolabs.com/search?${params.toString()}`);
  if (!res.ok) {
    return NextResponse.json({ error: "university search service unavailable" }, { status: 502 });
  }
  const data: University[] = await res.json();

  return NextResponse.json({
    query: name,
    count: data.length,
    universities: data.slice(0, 10).map((u) => ({
      name: u.name,
      country: u.country,
      domains: u.domains,
      web_pages: u.web_pages,
    })),
  });
}
