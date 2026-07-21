import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Purely local logic, no upstream API to depend on.

const MAX_LENGTH = 500;

// Combining diacritical marks (U+0300-U+036F) left behind after NFKD
// normalization splits an accented character into base + mark (e.g.
// "e" + combining-acute from "é") — stripping them is what makes
// "café" become "cafe" instead of dropping the whole character.
const COMBINING_MARKS = /[̀-ͯ]/g;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = body?.text;

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text (string) is required" }, { status: 400 });
  }
  if (text.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `text must be ${MAX_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  const slug = text
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return NextResponse.json({ original: text, slug });
}
