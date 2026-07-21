import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Wraps the Open Trivia Database (https://opentdb.com) — free, keyless.
// Requests URL-encoded output (encode=url3986) rather than the API's
// default HTML-entity encoding, so field values don't need a second
// decoding pass for things like apostrophes/quotes.

const VALID_DIFFICULTIES = ["easy", "medium", "hard"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const difficulty =
    typeof body?.difficulty === "string" && VALID_DIFFICULTIES.includes(body.difficulty)
      ? body.difficulty
      : undefined;

  const params = new URLSearchParams({ amount: "1", encode: "url3986" });
  if (difficulty) params.set("difficulty", difficulty);

  const res = await fetch(`https://opentdb.com/api.php?${params.toString()}`);
  if (!res.ok) {
    return NextResponse.json({ error: "trivia service unavailable" }, { status: 502 });
  }
  const data = await res.json();
  const question = data.results?.[0];
  if (data.response_code !== 0 || !question) {
    return NextResponse.json({ error: "no trivia question available" }, { status: 502 });
  }

  return NextResponse.json({
    category: decodeURIComponent(question.category),
    difficulty: decodeURIComponent(question.difficulty),
    question: decodeURIComponent(question.question),
    correct_answer: decodeURIComponent(question.correct_answer),
    incorrect_answers: (question.incorrect_answers as string[]).map((a) => decodeURIComponent(a)),
  });
}
