import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Wraps api.qrserver.com — free, keyless. Returns a PNG, so it's base64
// encoded into the JSON response the same way docx-to-pdf returns its file.

const MIN_SIZE = 50;
const MAX_SIZE = 1000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const data = body?.data;
  const size = Number.isInteger(body?.size) ? body.size : 200;

  if (!data || typeof data !== "string") {
    return NextResponse.json({ error: "data (string) is required" }, { status: 400 });
  }
  if (size < MIN_SIZE || size > MAX_SIZE) {
    return NextResponse.json(
      { error: `size must be between ${MIN_SIZE} and ${MAX_SIZE}` },
      { status: 400 },
    );
  }

  const res = await fetch(
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`,
  );
  if (!res.ok) {
    return NextResponse.json({ error: "QR code service unavailable" }, { status: 502 });
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  return NextResponse.json({
    data,
    size,
    content_type: "image/png",
    image_base64: buffer.toString("base64"),
  });
}
