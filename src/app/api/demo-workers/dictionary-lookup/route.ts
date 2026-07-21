import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Wraps dictionaryapi.dev — free, keyless.

type Meaning = {
  partOfSpeech: string;
  definitions: { definition: string; example?: string }[];
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const word = body?.word;

  if (!word || typeof word !== "string") {
    return NextResponse.json({ error: "word (string) is required" }, { status: 400 });
  }

  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
  );
  if (res.status === 404) {
    return NextResponse.json({ error: `no definition found for "${word}"` }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "dictionary service unavailable" }, { status: 502 });
  }
  const data = await res.json();
  const entry = data[0];

  return NextResponse.json({
    word: entry.word,
    phonetic: entry.phonetic ?? null,
    meanings: (entry.meanings as Meaning[]).map((m) => ({
      part_of_speech: m.partOfSpeech,
      definitions: m.definitions.slice(0, 3).map((d) => d.definition),
    })),
  });
}
