# Market

A trusted marketplace for programmable workers (AI agents, APIs, scrapers,
automation tools) — see `skill.md` for the full product spec. Developers
publish workers via a JSON manifest, users pay through escrow, and every
worker is scored by an automated verification pipeline (documentation,
security, benchmark, judge agents).

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui
- PostgreSQL via Prisma 7 (driver adapters, Neon serverless driver — see
  `prisma.config.ts` and `src/lib/db.ts`)
- BullMQ (Redis) for async worker execution and the verification pipeline
- Stripe (manual capture) and USDC-on-Base (`viem`) for escrow
- Groq (Llama 3.3 70B, OpenAI-compatible, free tier) for the
  Documentation/Security/Judge agents — swap the `baseURL`/model in
  `src/lib/llm.ts` for Anthropic/OpenAI/etc. later
- Auth.js v5 (`next-auth@beta`) with Google sign-in, JWT sessions

## Local setup

1. `cp .env.example .env` and fill in `DATABASE_URL` (Neon), `REDIS_URL`
   (Upstash), `STRIPE_SECRET_KEY`, `GROQ_API_KEY` (free, no card —
   console.groq.com),
   `PLATFORM_WALLET_PRIVATE_KEY` (see Crypto payments below),
   `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (see Auth below).
2. `npm install`
3. `npm run db:migrate` — creates the Postgres schema.
4. `npm run dev` — starts the web app.
5. `npm run worker` — starts the BullMQ worker process (job execution +
   verification pipeline). Run this alongside `dev` in a second terminal.

## Structure

- `prisma/schema.prisma` — data model (User, DeveloperProfile, Worker,
  WorkerManifest, VerificationRun, TrustScoreSnapshot, Job,
  EscrowTransaction, Review).
- `src/lib/manifest.ts` — zod schema validating the worker manifest JSON.
- `src/lib/queue.ts` — BullMQ queue definitions.
- `src/lib/crypto/` — `constants.ts` (chain/USDC address, shared, no
  secrets), `server.ts` (deposit verification + payout signing, `server-only`,
  never bundled to the client), `client.ts` (browser wallet connect + send).
- `src/worker.ts` — standalone process consuming those queues: executes
  worker HTTP calls, settles escrow (Stripe capture/void or USDC
  payout/refund), and runs the four verification agents.
- `src/app/workers` — public marketplace (listing, detail, run-a-worker).
- `src/app/developer` — publish-a-worker form and developer dashboard.
- `src/app/api` — `workers` (publish), `jobs` (run + status), `crypto/config`
  (deposit address for the client), Stripe webhook.

## Crypto payments (USDC on Base)

Defaults to **Base Sepolia (testnet)** — set `CRYPTO_NETWORK=mainnet` to go
live. Flow: buyer connects an injected wallet (MetaMask, Coinbase Wallet)
and sends USDC directly to the platform's deposit address; the backend
verifies the transfer on-chain (amount, recipient, tx success) before
queuing the job — it never trusts client-reported amounts. On job success,
the platform wallet sends USDC to the developer's `payoutWalletAddress`; on
failure, it refunds the buyer's wallet automatically.

**Custody caveat**: `PLATFORM_WALLET_PRIVATE_KEY` is a hot wallet that both
receives deposits and signs payouts/refunds — whoever holds that key
controls all escrowed funds. Fine for testnet and low-volume MVP use; before
real volume, move to a managed custody service (Fireblocks, Coinbase Prime,
Turnkey) so no raw private key lives in the app's environment.

## Auth (Google sign-in)

Google is the only provider for now. API routes derive the buyer/developer
identity from the verified session (`auth()`), then upsert a `User` row by
that email — no database adapter, JWT sessions only.

To set up Google OAuth: create a project at console.cloud.google.com, add an
OAuth consent screen (External, add yourself as a test user), then create an
OAuth client ID (Web application) with authorized redirect URI
`http://localhost:3000/api/auth/callback/google` (swap the host for your
deployed domain in production). Put the client ID/secret in
`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`.

## Known gaps (by design, for a first scaffold)

- Benchmark Agent has no fixtures — those are category-specific (e.g.
  known-vulnerable contracts for a Solidity Auditor) and need to be curated
  per category.
- Manifest-driven input forms are a raw JSON textarea for now; swap in a
  JSON-Schema-to-form renderer once the schema shape stabilizes.
- Stripe card checkout isn't wired to a client-side confirmation UI (Stripe
  Elements) yet — the API creates the PaymentIntent, but there's no way to
  actually pay by card in the current UI. USDC payment is fully wired.
