import { NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Purely local logic, no upstream API — an invalid address is a normal,
// successful answer, not a service failure.

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const address = body?.address;

  if (!address || typeof address !== "string") {
    return NextResponse.json({ error: "address (string) is required" }, { status: 400 });
  }

  const valid = isAddress(address);

  return NextResponse.json({
    address,
    is_valid: valid,
    checksummed_address: valid ? getAddress(address) : null,
  });
}
