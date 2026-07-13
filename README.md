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
- Claude (`@anthropic-ai/sdk`) for the Documentation/Security/Judge agents

## Local setup

1. `cp .env.example .env` and fill in `DATABASE_URL` (Neon), `REDIS_URL`
   (Upstash), `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`,
   `PLATFORM_WALLET_PRIVATE_KEY` (see Crypto payments below).
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

## Known gaps (by design, for a first scaffold)

- No auth yet — API routes take a plain email and upsert a `User`. Wire up
  Auth.js or Clerk before this is real.
- Benchmark Agent has no fixtures — those are category-specific (e.g.
  known-vulnerable contracts for a Solidity Auditor) and need to be curated
  per category.
- Manifest-driven input forms are a raw JSON textarea for now; swap in a
  JSON-Schema-to-form renderer once the schema shape stabilizes.
- Stripe card checkout isn't wired to a client-side confirmation UI (Stripe
  Elements) yet — the API creates the PaymentIntent, but there's no way to
  actually pay by card in the current UI. USDC payment is fully wired.
