import "dotenv/config";
import { db } from "@/lib/db";

// One-off seed: registers the free-API demo workers (src/app/api/demo-workers/*)
// as real, APPROVED Worker/WorkerManifest rows under the existing
// demo-developer@example.com profile — the same one city-weather-lookup and
// docx-to-pdf-converter already use. Idempotent on slug: safe to re-run.
//
// Skips the real verification pipeline (Documentation/Security/Benchmark/Judge
// agents in src/worker.ts) — these are inserted directly as APPROVED with a
// hand-picked trust score, matching how the two pre-existing demo workers
// were seeded. `benchmark` is always 0 across the board: there are no
// benchmark fixtures for any of these categories yet (same reason the two
// existing demo workers show benchmark: 0), not a real measured value.
const APP_URL = "http://localhost:3000";

type Seed = {
  slug: string;
  name: string;
  category: string;
  description: string;
  path: string;
  input: object;
  output: object;
  priceCents: number;
  freeRuns: number;
  thirdPartySharing: boolean;
  capabilities: string[];
  readme: string;
  documentationScore: number;
  securityScore: number;
};

const seeds: Seed[] = [
  {
    slug: "currency-exchange-rate",
    name: "Currency Exchange Rate",
    category: "apis",
    description: "Converts an amount between two currencies using live ECB reference rates.",
    path: "currency-exchange-rate",
    input: {
      type: "object",
      required: ["from", "to"],
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        amount: { type: "number" },
      },
    },
    output: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        amount: { type: "number" },
        converted_amount: { type: "number" },
        rate: { type: "number" },
        date: { type: "string" },
      },
    },
    priceCents: 5,
    freeRuns: 5,
    thirdPartySharing: true,
    capabilities: ["currency-conversion"],
    readme:
      '# Currency Exchange Rate\n\nConverts an amount between two ISO currency codes using live ECB reference rates (via Frankfurter).\n\n## Example\n\nInput: `{"from": "USD", "to": "EUR", "amount": 100}`\n\nOutput: `{"from": "USD", "to": "EUR", "amount": 100, "converted_amount": 92.14, "rate": 0.9214, "date": "2026-07-14"}`\n\n## Notes\n\nNo API key required upstream. Rates update once per business day.',
    documentationScore: 90,
    securityScore: 85,
  },
  {
    slug: "ip-geolocation-lookup",
    name: "IP Geolocation Lookup",
    category: "apis",
    description: "Looks up approximate city, region, and ISP for a given IP address.",
    path: "ip-geolocation-lookup",
    input: {
      type: "object",
      required: ["ip"],
      properties: { ip: { type: "string" } },
    },
    output: {
      type: "object",
      properties: {
        ip: { type: "string" },
        city: { type: "string" },
        region: { type: "string" },
        country: { type: "string" },
        latitude: { type: "number" },
        longitude: { type: "number" },
        timezone: { type: "string" },
        isp: { type: "string" },
      },
    },
    priceCents: 5,
    freeRuns: 5,
    thirdPartySharing: true,
    capabilities: ["ip-geolocation"],
    readme:
      '# IP Geolocation Lookup\n\nReturns approximate city, region, country, timezone, and ISP for a given IPv4/IPv6 address.\n\n## Example\n\nInput: `{"ip": "8.8.8.8"}`\n\nOutput: `{"ip": "8.8.8.8", "city": "Mountain View", "region": "California", "country": "United States", "latitude": 37.4, "longitude": -122.1, "timezone": "America/Los_Angeles", "isp": "Google LLC"}`\n\n## Notes\n\nAccuracy is approximate (city-level at best) and varies by IP block. Rate-limited upstream.',
    documentationScore: 85,
    securityScore: 80,
  },
  {
    slug: "postal-code-lookup",
    name: "Postal Code Lookup",
    category: "apis",
    description: "Returns place names, state, and coordinates for a country + postal code.",
    path: "postal-code-lookup",
    input: {
      type: "object",
      required: ["country_code", "postal_code"],
      properties: {
        country_code: { type: "string" },
        postal_code: { type: "string" },
      },
    },
    output: {
      type: "object",
      properties: {
        country: { type: "string" },
        country_code: { type: "string" },
        postal_code: { type: "string" },
        places: { type: "array" },
      },
    },
    priceCents: 5,
    freeRuns: 5,
    thirdPartySharing: true,
    capabilities: ["postal-lookup"],
    readme:
      '# Postal Code Lookup\n\nReturns place name(s), state, and coordinates for a country (ISO 3166-1 alpha-2 code) + postal/zip code.\n\n## Example\n\nInput: `{"country_code": "US", "postal_code": "90210"}`\n\nOutput: `{"country": "United States", "country_code": "US", "postal_code": "90210", "places": [{"place_name": "Beverly Hills", "state": "California", "latitude": "34.0901", "longitude": "-118.4065"}]}`\n\n## Notes\n\nCovers dozens of countries\' postal systems, not just the US. Returns 404 for an unrecognized code.',
    documentationScore: 88,
    securityScore: 88,
  },
  {
    slug: "public-holiday-calendar",
    name: "Public Holiday Calendar",
    category: "apis",
    description: "Lists official public holidays for a country in a given year.",
    path: "public-holiday-calendar",
    input: {
      type: "object",
      required: ["year", "country_code"],
      properties: {
        year: { type: "number" },
        country_code: { type: "string" },
      },
    },
    output: {
      type: "object",
      properties: {
        country_code: { type: "string" },
        year: { type: "number" },
        holidays: { type: "array" },
      },
    },
    priceCents: 5,
    freeRuns: 5,
    thirdPartySharing: true,
    capabilities: ["holiday-calendar"],
    readme:
      '# Public Holiday Calendar\n\nLists official public holidays for a country (ISO 3166-1 alpha-2 code) in a given year.\n\n## Example\n\nInput: `{"year": 2026, "country_code": "US"}`\n\nOutput: `{"country_code": "US", "year": 2026, "holidays": [{"date": "2026-01-01", "name": "New Year\'s Day", "local_name": "New Year\'s Day"}, ...]}`\n\n## Notes\n\nCovers ~100 countries. Returns 404 if the country isn\'t covered.',
    documentationScore: 88,
    securityScore: 85,
  },
  {
    slug: "crypto-price-checker",
    name: "Crypto Price Checker",
    category: "blockchain",
    description: "Looks up the current market price of a cryptocurrency in a given fiat currency.",
    path: "crypto-price-checker",
    input: {
      type: "object",
      required: ["coin_id"],
      properties: {
        coin_id: { type: "string" },
        vs_currency: { type: "string" },
      },
    },
    output: {
      type: "object",
      properties: {
        coin_id: { type: "string" },
        currency: { type: "string" },
        price: { type: "number" },
      },
    },
    priceCents: 5,
    freeRuns: 5,
    thirdPartySharing: true,
    capabilities: ["crypto-price"],
    readme:
      '# Crypto Price Checker\n\nReturns the current market price of a cryptocurrency (by CoinGecko coin ID, e.g. "bitcoin", "ethereum") in a given fiat currency.\n\n## Example\n\nInput: `{"coin_id": "bitcoin", "vs_currency": "usd"}`\n\nOutput: `{"coin_id": "bitcoin", "currency": "usd", "price": 71234.5}`\n\n## Notes\n\ncoin_id must be a CoinGecko slug, not a ticker symbol. Rate-limited upstream.',
    documentationScore: 85,
    securityScore: 82,
  },
  {
    slug: "ethereum-address-validator",
    name: "Ethereum Address Validator",
    category: "blockchain",
    description: "Validates an Ethereum address and returns its EIP-55 checksummed form.",
    path: "ethereum-address-validator",
    input: {
      type: "object",
      required: ["address"],
      properties: { address: { type: "string" } },
    },
    output: {
      type: "object",
      properties: {
        address: { type: "string" },
        is_valid: { type: "boolean" },
        checksummed_address: { type: "string" },
      },
    },
    priceCents: 2,
    freeRuns: 10,
    thirdPartySharing: false,
    capabilities: ["address-validation"],
    readme:
      '# Ethereum Address Validator\n\nValidates an Ethereum address\'s format and returns its EIP-55 checksummed form. Runs entirely locally — no on-chain lookup, no upstream service.\n\n## Example\n\nInput: `{"address": "0x742d35cc6634c0532925a3b844bc9e7595f0beb0"}`\n\nOutput: `{"address": "0x742d35cc6634c0532925a3b844bc9e7595f0beb0", "is_valid": true, "checksummed_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"}`\n\n## Notes\n\nFormat/checksum validation only — does not check whether the address holds funds or has ever transacted.',
    documentationScore: 90,
    securityScore: 95,
  },
  {
    slug: "github-user-lookup",
    name: "GitHub User Lookup",
    category: "dev-utilities",
    description: "Returns public profile info for a GitHub username.",
    path: "github-user-lookup",
    input: {
      type: "object",
      required: ["username"],
      properties: { username: { type: "string" } },
    },
    output: {
      type: "object",
      properties: {
        username: { type: "string" },
        name: { type: "string" },
        bio: { type: "string" },
        public_repos: { type: "number" },
        followers: { type: "number" },
        following: { type: "number" },
        avatar_url: { type: "string" },
        profile_url: { type: "string" },
      },
    },
    priceCents: 5,
    freeRuns: 5,
    thirdPartySharing: true,
    capabilities: ["github-lookup"],
    readme:
      '# GitHub User Lookup\n\nReturns public profile info (name, bio, repo/follower counts, avatar) for a GitHub username.\n\n## Example\n\nInput: `{"username": "torvalds"}`\n\nOutput: `{"username": "torvalds", "name": "Linus Torvalds", "public_repos": 8, "followers": 250000, ...}`\n\n## Notes\n\nUses the unauthenticated GitHub API — subject to GitHub\'s public rate limit.',
    documentationScore: 87,
    securityScore: 83,
  },
  {
    slug: "random-test-user-generator",
    name: "Random Test User Generator",
    category: "dev-utilities",
    description: "Generates a fake person's profile (name, email, phone, avatar) for test fixtures.",
    path: "random-test-user-generator",
    input: {
      type: "object",
      properties: { nationality: { type: "string" } },
    },
    output: {
      type: "object",
      properties: {
        full_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        username: { type: "string" },
        picture_url: { type: "string" },
        location: { type: "string" },
      },
    },
    priceCents: 3,
    freeRuns: 5,
    thirdPartySharing: true,
    capabilities: ["test-fixtures"],
    readme:
      '# Random Test User Generator\n\nGenerates a single fake person\'s profile — name, email, phone, username, avatar, location — for seeding test data or demos. Not a real person.\n\n## Example\n\nInput: `{}`\n\nOutput: `{"full_name": "Jane Doe", "email": "jane.doe@example.com", ...}`\n\n## Notes\n\nOptional `nationality` (2-letter code, e.g. "us", "gb") biases the generated name/locale.',
    documentationScore: 82,
    securityScore: 80,
  },
  {
    slug: "trivia-question-generator",
    name: "Trivia Question Generator",
    category: "apis",
    description: "Generates a random multiple-choice trivia question, with the correct answer.",
    path: "trivia-question-generator",
    input: {
      type: "object",
      properties: { difficulty: { type: "string" } },
    },
    output: {
      type: "object",
      properties: {
        category: { type: "string" },
        difficulty: { type: "string" },
        question: { type: "string" },
        correct_answer: { type: "string" },
        incorrect_answers: { type: "array" },
      },
    },
    priceCents: 2,
    freeRuns: 10,
    thirdPartySharing: true,
    capabilities: ["trivia"],
    readme:
      '# Trivia Question Generator\n\nGenerates a random multiple-choice trivia question spanning general knowledge, entertainment, science, and more, with the correct answer and distractors.\n\n## Example\n\nInput: `{"difficulty": "medium"}`\n\nOutput: `{"category": "Science: Computers", "difficulty": "medium", "question": "What does CPU stand for?", "correct_answer": "Central Processing Unit", "incorrect_answers": ["Central Process Unit", "Computer Personal Unit", "Central Processor Unit"]}`\n\n## Notes\n\n`difficulty` is optional: one of "easy", "medium", "hard". Omit for a random difficulty.',
    documentationScore: 80,
    securityScore: 85,
  },
  {
    slug: "university-search",
    name: "University Search",
    category: "apis",
    description: "Searches a global directory of universities by name and country.",
    path: "university-search",
    input: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        country: { type: "string" },
      },
    },
    output: {
      type: "object",
      properties: {
        query: { type: "string" },
        count: { type: "number" },
        universities: { type: "array" },
      },
    },
    priceCents: 5,
    freeRuns: 5,
    thirdPartySharing: true,
    capabilities: ["university-directory"],
    readme:
      '# University Search\n\nSearches a global directory of universities by (partial) name, optionally filtered by country. Returns up to 10 matches.\n\n## Example\n\nInput: `{"name": "Oxford"}`\n\nOutput: `{"query": "Oxford", "count": 1, "universities": [{"name": "University of Oxford", "country": "United Kingdom", "domains": ["ox.ac.uk"], "web_pages": ["https://www.ox.ac.uk/"]}]}`',
    documentationScore: 85,
    securityScore: 85,
  },
  {
    slug: "dictionary-lookup",
    name: "Dictionary Lookup",
    category: "dev-utilities",
    description: "Returns definitions and phonetic spelling for an English word.",
    path: "dictionary-lookup",
    input: {
      type: "object",
      required: ["word"],
      properties: { word: { type: "string" } },
    },
    output: {
      type: "object",
      properties: {
        word: { type: "string" },
        phonetic: { type: "string" },
        meanings: { type: "array" },
      },
    },
    priceCents: 3,
    freeRuns: 5,
    thirdPartySharing: true,
    capabilities: ["dictionary"],
    readme:
      '# Dictionary Lookup\n\nReturns phonetic spelling and up to 3 definitions per part of speech for an English word.\n\n## Example\n\nInput: `{"word": "serendipity"}`\n\nOutput: `{"word": "serendipity", "phonetic": "/ˌsɛr.ənˈdɪp.ɪ.ti/", "meanings": [{"part_of_speech": "noun", "definitions": ["..."]}]}`\n\n## Notes\n\nEnglish only. Returns 404 for words not in the dictionary.',
    documentationScore: 90,
    securityScore: 88,
  },
  {
    slug: "qr-code-generator",
    name: "QR Code Generator",
    category: "automation",
    description: "Generates a QR code image (PNG, base64) encoding the given text or URL.",
    path: "qr-code-generator",
    input: {
      type: "object",
      required: ["data"],
      properties: {
        data: { type: "string" },
        size: { type: "number" },
      },
    },
    output: {
      type: "object",
      properties: {
        data: { type: "string" },
        size: { type: "number" },
        content_type: { type: "string" },
        image_base64: { type: "string" },
      },
    },
    priceCents: 8,
    freeRuns: 5,
    thirdPartySharing: true,
    capabilities: ["qr-code"],
    readme:
      '# QR Code Generator\n\nGenerates a square QR code PNG (returned as base64) encoding any text or URL.\n\n## Example\n\nInput: `{"data": "https://example.com", "size": 200}`\n\nOutput: `{"data": "https://example.com", "size": 200, "content_type": "image/png", "image_base64": "..."}`\n\n## Notes\n\n`size` is the pixel width/height, between 50 and 1000 (default 200).',
    documentationScore: 85,
    securityScore: 82,
  },
  {
    slug: "url-shortener",
    name: "URL Shortener",
    category: "automation",
    description: "Shortens a long URL into a compact redirect link.",
    path: "url-shortener",
    input: {
      type: "object",
      required: ["url"],
      properties: { url: { type: "string" } },
    },
    output: {
      type: "object",
      properties: {
        original_url: { type: "string" },
        short_url: { type: "string" },
      },
    },
    priceCents: 5,
    freeRuns: 5,
    thirdPartySharing: true,
    capabilities: ["url-shortening"],
    readme:
      '# URL Shortener\n\nShortens a long URL into a compact is.gd redirect link.\n\n## Example\n\nInput: `{"url": "https://example.com/a/very/long/path?with=query&params=here"}`\n\nOutput: `{"original_url": "https://example.com/a/very/long/path?with=query&params=here", "short_url": "https://is.gd/aBc123"}`\n\n## Notes\n\nurl must be a valid, absolute http(s) URL.',
    documentationScore: 82,
    securityScore: 78,
  },
  {
    slug: "uuid-generator",
    name: "UUID Generator",
    category: "dev-utilities",
    description: "Generates one or more random UUIDs (v4).",
    path: "uuid-generator",
    input: {
      type: "object",
      properties: { count: { type: "number" } },
    },
    output: {
      type: "object",
      properties: { uuids: { type: "array" } },
    },
    priceCents: 1,
    freeRuns: 10,
    thirdPartySharing: false,
    capabilities: ["uuid"],
    readme:
      '# UUID Generator\n\nGenerates one or more cryptographically random v4 UUIDs. Runs entirely locally.\n\n## Example\n\nInput: `{"count": 3}`\n\nOutput: `{"uuids": ["a1b2c3d4-...", "...", "..."]}`\n\n## Notes\n\n`count` defaults to 1, max 100.',
    documentationScore: 90,
    securityScore: 95,
  },
  {
    slug: "password-generator",
    name: "Password Generator",
    category: "dev-utilities",
    description: "Generates a cryptographically random password of a given length.",
    path: "password-generator",
    input: {
      type: "object",
      properties: {
        length: { type: "number" },
        include_symbols: { type: "boolean" },
      },
    },
    output: {
      type: "object",
      properties: {
        password: { type: "string" },
        length: { type: "number" },
      },
    },
    priceCents: 1,
    freeRuns: 10,
    thirdPartySharing: false,
    capabilities: ["password-generation"],
    readme:
      '# Password Generator\n\nGenerates a cryptographically random password (letters, digits, optionally symbols). Runs entirely locally — the generated password is never logged or retained.\n\n## Example\n\nInput: `{"length": 20, "include_symbols": true}`\n\nOutput: `{"password": "aB3!kL9#mQ2$xZ7&pW1@", "length": 20}`\n\n## Notes\n\n`length` between 8 and 128, default 16.',
    documentationScore: 88,
    securityScore: 90,
  },
  {
    slug: "slug-generator",
    name: "Slug Generator",
    category: "dev-utilities",
    description: "Converts free text into a URL-safe slug.",
    path: "slug-generator",
    input: {
      type: "object",
      required: ["text"],
      properties: { text: { type: "string" } },
    },
    output: {
      type: "object",
      properties: {
        original: { type: "string" },
        slug: { type: "string" },
      },
    },
    priceCents: 1,
    freeRuns: 10,
    thirdPartySharing: false,
    capabilities: ["slug-generation"],
    readme:
      '# Slug Generator\n\nConverts free text into a lowercase, hyphenated, URL-safe slug (accented characters are transliterated). Runs entirely locally.\n\n## Example\n\nInput: `{"text": "Café du Monde: 20% Off!"}`\n\nOutput: `{"original": "Café du Monde: 20% Off!", "slug": "cafe-du-monde-20-off"}`',
    documentationScore: 90,
    securityScore: 95,
  },
  {
    slug: "json-formatter-validator",
    name: "JSON Formatter & Validator",
    category: "dev-utilities",
    description: "Validates a JSON string and returns a pretty-printed version if valid.",
    path: "json-formatter-validator",
    input: {
      type: "object",
      required: ["json_string"],
      properties: {
        json_string: { type: "string" },
        indent: { type: "number" },
      },
    },
    output: {
      type: "object",
      properties: {
        valid: { type: "boolean" },
        formatted: { type: "string" },
        error: { type: "string" },
      },
    },
    priceCents: 2,
    freeRuns: 10,
    thirdPartySharing: false,
    capabilities: ["json-validation"],
    readme:
      '# JSON Formatter & Validator\n\nValidates a JSON string and returns a pretty-printed version. Runs entirely locally.\n\n## Example\n\nInput: `{"json_string": "{\\"a\\":1}"}`\n\nOutput: `{"valid": true, "formatted": "{\\n  \\"a\\": 1\\n}"}`\n\nInvalid input returns `{"valid": false, "error": "..."}` — this is a normal result, not a failed run.',
    documentationScore: 88,
    securityScore: 92,
  },
  {
    slug: "website-metadata-scraper",
    name: "Website Metadata Scraper",
    category: "scrapers",
    description: "Fetches a public URL and extracts its title, meta description, and OG image.",
    path: "website-metadata-scraper",
    input: {
      type: "object",
      required: ["url"],
      properties: { url: { type: "string" } },
    },
    output: {
      type: "object",
      properties: {
        url: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        og_image_url: { type: "string" },
      },
    },
    priceCents: 12,
    freeRuns: 3,
    thirdPartySharing: true,
    capabilities: ["web-scraping", "metadata-extraction"],
    readme:
      '# Website Metadata Scraper\n\nFetches a public webpage and extracts its `<title>`, meta description, and Open Graph image URL.\n\n## Example\n\nInput: `{"url": "https://example.com"}`\n\nOutput: `{"url": "https://example.com", "title": "Example Domain", "description": null, "og_image_url": null}`\n\n## Notes\n\nRefuses to fetch localhost/private-network addresses. Does not follow redirects — pass the destination URL directly if the source redirects.',
    documentationScore: 85,
    securityScore: 65,
  },
  {
    slug: "random-joke-generator",
    name: "Random Joke Generator",
    category: "apis",
    description: "Returns a random setup-and-punchline joke.",
    path: "random-joke-generator",
    input: { type: "object", properties: {} },
    output: {
      type: "object",
      properties: {
        setup: { type: "string" },
        punchline: { type: "string" },
        category: { type: "string" },
      },
    },
    priceCents: 1,
    freeRuns: 10,
    thirdPartySharing: true,
    capabilities: ["jokes"],
    readme:
      '# Random Joke Generator\n\nReturns a random two-part joke (setup + punchline).\n\n## Example\n\nInput: `{}`\n\nOutput: `{"setup": "Why don\'t eggs tell jokes?", "punchline": "Because they would crack each other up.", "category": "dad"}`',
    documentationScore: 85,
    securityScore: 85,
  },
];

function judgeScore(documentation: number, security: number, benchmark: number) {
  return Math.round(documentation * 0.25 + security * 0.35 + benchmark * 0.4);
}

async function main() {
  const developer = await db.developerProfile.findFirst({
    where: { user: { email: "demo-developer@example.com" } },
  });
  if (!developer) {
    throw new Error(
      "demo-developer@example.com DeveloperProfile not found — expected the existing " +
        "city-weather-lookup/docx-to-pdf-converter demo workers to already be seeded under it.",
    );
  }

  for (const seed of seeds) {
    const existing = await db.worker.findUnique({ where: { slug: seed.slug } });
    if (existing) {
      console.log(`skip (already exists): ${seed.slug}`);
      continue;
    }

    const benchmark = 0; // no benchmark fixtures for these categories yet
    const score = judgeScore(seed.documentationScore, seed.securityScore, benchmark);

    const manifest = {
      name: seed.name,
      version: "1.0.0",
      category: seed.category,
      description: seed.description,
      endpoint: {
        url: `${APP_URL}/api/demo-workers/${seed.path}`,
        method: "POST",
        timeout_seconds: 30,
      },
      input: seed.input,
      output: seed.output,
      pricing: { model: "per_call", amount_cents: seed.priceCents, currency: "usd" },
      trial: { free_runs: seed.freeRuns },
      privacy: {
        logs_input: false,
        logs_output: false,
        retains_data: false,
        third_party_sharing: seed.thirdPartySharing,
      },
      capabilities: seed.capabilities,
      outcome_policy: "STANDARD",
    };

    // Two separate creates, not a nested write — nested writes use an
    // implicit transaction, which the Neon HTTP adapter doesn't support
    // (see lib/db.ts).
    const worker = await db.worker.create({
      data: {
        slug: seed.slug,
        name: seed.name,
        category: seed.category,
        developerId: developer.id,
      },
    });

    await db.workerManifest.create({
      data: {
        workerId: worker.id,
        version: "1.0.0",
        manifest,
        readme: seed.readme,
        status: "APPROVED",
      },
    });

    await db.trustScoreSnapshot.create({
      data: {
        workerId: worker.id,
        score,
        breakdown: {
          documentation: seed.documentationScore,
          security: seed.securityScore,
          benchmark,
        },
      },
    });

    console.log(`created: ${seed.slug} (trust score ${score})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
