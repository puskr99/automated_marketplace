# Market

A trusted marketplace for programmable workers (AI agents, APIs, scrapers,
automation tools) — see `skill.md` for the full product spec. Developers
publish workers via a JSON manifest, users pay through escrow, and every
worker is scored by an automated verification pipeline (documentation,
security, benchmark, judge agents).

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui
- PostgreSQL via Prisma 7 (driver adapters — see `prisma.config.ts`)
- BullMQ (Redis) for async worker execution and the verification pipeline
- Stripe (manual capture) for escrow
- Claude (`@anthropic-ai/sdk`) for the Documentation/Security/Judge agents

## Local setup

1. `cp .env.example .env` and fill in `DATABASE_URL`, `REDIS_URL`,
   `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`.
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
- `src/worker.ts` — standalone process consuming those queues: executes
  worker HTTP calls, settles escrow, and runs the four verification agents.
- `src/app/workers` — public marketplace (listing, detail, run-a-worker).
- `src/app/developer` — publish-a-worker form and developer dashboard.
- `src/app/api` — `workers` (publish), `jobs` (run + status), Stripe
  webhook.

## Known gaps (by design, for a first scaffold)

- No auth yet — API routes take a plain email and upsert a `User`. Wire up
  Auth.js or Clerk before this is real.
- Benchmark Agent has no fixtures — those are category-specific (e.g.
  known-vulnerable contracts for a Solidity Auditor) and need to be curated
  per category.
- Manifest-driven input forms are a raw JSON textarea for now; swap in a
  JSON-Schema-to-form renderer once the schema shape stabilizes.
- Crypto/USDC payments are deferred; Stripe manual-capture covers escrow for
  the MVP.
