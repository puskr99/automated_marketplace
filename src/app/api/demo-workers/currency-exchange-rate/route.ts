import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Wraps Frankfurter (https://frankfurter.dev) — free, keyless, ECB rate data.

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const from = body?.from;
  const to = body?.to;
  const amount = typeof body?.amount === "number" && body.amount > 0 ? body.amount : 1;

  if (!from || typeof from !== "string" || !to || typeof to !== "string") {
    return NextResponse.json(
      { error: "from and to (ISO currency codes) are required" },
      { status: 400 },
    );
  }

  const res = await fetch(
    `https://api.frankfurter.app/latest?amount=${amount}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  if (!res.ok) {
    return NextResponse.json({ error: "exchange rate service unavailable" }, { status: 502 });
  }
  const data = await res.json();
  const convertedAmount = data.rates?.[to.toUpperCase()];
  if (convertedAmount === undefined) {
    return NextResponse.json({ error: `no rate found for "${to}"` }, { status: 404 });
  }

  return NextResponse.json({
    from: data.base,
    to: to.toUpperCase(),
    amount,
    converted_amount: convertedAmount,
    rate: convertedAmount / amount,
    date: data.date,
  });
}
