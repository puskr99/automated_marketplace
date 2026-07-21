import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Wraps the unauthenticated GitHub REST API — free, keyless, rate-limited
// to 60 req/hr per IP. GitHub requires a User-Agent on every request.

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = body?.username;

  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "username (string) is required" }, { status: 400 });
  }

  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
    headers: { "User-Agent": "market-marketplace-demo-worker" },
  });
  if (res.status === 404) {
    return NextResponse.json({ error: `no GitHub user "${username}"` }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "GitHub API unavailable" }, { status: 502 });
  }
  const data = await res.json();

  return NextResponse.json({
    username: data.login,
    name: data.name,
    bio: data.bio,
    public_repos: data.public_repos,
    followers: data.followers,
    following: data.following,
    avatar_url: data.avatar_url,
    profile_url: data.html_url,
  });
}
