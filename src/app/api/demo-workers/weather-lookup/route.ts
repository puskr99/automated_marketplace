import { NextResponse } from "next/server";

// This route simulates a THIRD-PARTY DEVELOPER'S hosted service, not a
// platform endpoint — it exists so the marketplace's job-execution flow has
// something real to call over HTTP for local testing. A production worker
// would live on the developer's own infrastructure; the platform only ever
// talks to it via the manifest's `endpoint.url`, exactly as it does here.
//
// Wraps Open-Meteo (https://open-meteo.com) — free, keyless, no auth.

const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const city = body?.city;

  if (!city || typeof city !== "string") {
    return NextResponse.json({ error: "city (string) is required" }, { status: 400 });
  }

  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
  );
  if (!geoRes.ok) {
    return NextResponse.json({ error: "geocoding service unavailable" }, { status: 502 });
  }
  const geo = await geoRes.json();
  const place = geo.results?.[0];
  if (!place) {
    return NextResponse.json({ error: `no location found for "${city}"` }, { status: 404 });
  }

  const forecastRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`,
  );
  if (!forecastRes.ok) {
    return NextResponse.json({ error: "forecast service unavailable" }, { status: 502 });
  }
  const forecast = await forecastRes.json();
  const current = forecast.current;

  return NextResponse.json({
    city: place.name,
    country: place.country,
    temperature_c: current.temperature_2m,
    condition: WEATHER_CODES[current.weather_code] ?? "Unknown",
    humidity_percent: current.relative_humidity_2m,
    wind_kph: current.wind_speed_10m,
    observed_at: current.time,
  });
}
