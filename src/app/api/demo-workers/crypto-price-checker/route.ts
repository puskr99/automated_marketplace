import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Wraps CoinGecko's public price endpoint — free, keyless, rate-limited.

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const coinId = body?.coin_id;
  const vsCurrency = typeof body?.vs_currency === "string" ? body.vs_currency : "usd";

  if (!coinId || typeof coinId !== "string") {
    return NextResponse.json(
      { error: 'coin_id (string, e.g. "bitcoin") is required' },
      { status: 400 },
    );
  }

  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=${encodeURIComponent(vsCurrency)}`,
  );
  if (!res.ok) {
    return NextResponse.json({ error: "price service unavailable" }, { status: 502 });
  }
  const data = await res.json();
  const price = data[coinId]?.[vsCurrency];
  if (price === undefined) {
    return NextResponse.json(
      { error: `no price found for "${coinId}" in "${vsCurrency}"` },
      { status: 404 },
    );
  }

  return NextResponse.json({ coin_id: coinId, currency: vsCurrency, price });
}
