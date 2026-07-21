import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — see weather-lookup
// for the full rationale on this file's role.
//
// Unlike the other demo workers, this one fetches a URL the *caller*
// supplies — a classic SSRF vector (hitting internal services or cloud
// metadata endpoints like 169.254.169.254 through the platform's own
// server). Mitigations below: block literal loopback/private/link-local
// hosts up front, and don't auto-follow redirects (redirect: "manual") so a
// public URL can't bounce the request to a blocked host after the check has
// already passed. This is deliberately not exhaustive (it doesn't resolve
// DNS to catch a public hostname that resolves to a private IP) — adequate
// for a demo scraper, not a hardened SSRF gate.

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);
const MAX_BYTES = 500_000;

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost")) return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = ipv4.slice(1).map(Number);
  if (a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const url = body?.url;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url (string) is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "url must be a valid, absolute URL" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "url must use http or https" }, { status: 400 });
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return NextResponse.json({ error: "this host cannot be scraped" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(parsed.toString(), { redirect: "manual" });
  } catch {
    return NextResponse.json({ error: "could not reach this URL" }, { status: 502 });
  }
  if (res.status >= 300 && res.status < 400) {
    return NextResponse.json(
      { error: "this URL redirects — pass the destination URL directly" },
      { status: 400 },
    );
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `page responded with status ${res.status}` },
      { status: 502 },
    );
  }

  const reader = res.body?.getReader();
  let html = "";
  if (reader) {
    const decoder = new TextDecoder();
    let bytesRead = 0;
    while (bytesRead < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});
  } else {
    html = await res.text();
  }

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ??
    null;
  const ogImage =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i)?.[1] ??
    null;

  return NextResponse.json({
    url: parsed.toString(),
    title,
    description,
    og_image_url: ogImage,
  });
}
