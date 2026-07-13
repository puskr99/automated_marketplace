import Link from "next/link";
import {
  Bot,
  Globe,
  Database,
  Workflow,
  Blocks,
  Wrench,
  FileSearch,
  ShieldCheck,
  Gauge,
  Scale,
  Lock,
  Wallet,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";

const CATEGORIES = [
  { icon: Bot, label: "AI agents" },
  { icon: Globe, label: "APIs" },
  { icon: Database, label: "Data services" },
  { icon: FileSearch, label: "Scrapers" },
  { icon: Workflow, label: "Automation tools" },
  { icon: Blocks, label: "Blockchain tools" },
  { icon: Wrench, label: "Developer utilities" },
];

const VERIFICATION_AGENTS = [
  {
    icon: FileSearch,
    title: "Documentation Agent",
    description:
      "Checks README quality, missing information, and unrealistic claims before a worker is listed.",
  },
  {
    icon: ShieldCheck,
    title: "Security Agent",
    description:
      "Flags suspicious behavior, endpoint safety, and data-leakage risk. Never auto-bans — only flags for review.",
  },
  {
    icon: Gauge,
    title: "Benchmark Agent",
    description:
      "Runs standardized tests per category and measures accuracy, latency, and cost.",
  },
  {
    icon: Scale,
    title: "Judge Agent",
    description:
      "Combines documentation, security, and benchmark scores into one transparent trust score.",
  },
];

export default async function Home() {
  const [workerCount, categoryRows] = await Promise.all([
    db.worker.count(),
    db.worker.findMany({ select: { category: true }, distinct: ["category"] }),
  ]);
  const categoryCount = categoryRows.length;

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-24 text-center sm:py-32">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            Escrowed payments · automated verification · public trust scores
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            A trusted marketplace for programmable workers
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Developers publish AI agents, APIs, scrapers, and automation
            tools. Buyers pay for completed outcomes, held in escrow until
            delivery. Every worker ships with a public benchmark, reputation,
            and verification history.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href="/workers">Browse workers</Link>}
            />
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/developer/workers/new">Publish a worker</Link>}
            />
          </div>

          {workerCount > 0 && (
            <div className="mt-16 flex flex-wrap justify-center gap-x-10 gap-y-4 text-sm text-muted-foreground">
              <div>
                <span className="text-2xl font-semibold text-foreground">
                  {workerCount}
                </span>{" "}
                worker{workerCount === 1 ? "" : "s"} published
              </div>
              <div>
                <span className="text-2xl font-semibold text-foreground">
                  {categoryCount}
                </span>{" "}
                categor{categoryCount === 1 ? "y" : "ies"} covered
              </div>
              <div>
                <span className="text-2xl font-semibold text-foreground">4</span>{" "}
                verification agents per submission
              </div>
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            How it works
          </h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            <div>
              <div className="text-3xl font-semibold text-muted-foreground/40">
                01
              </div>
              <h3 className="mt-2 font-medium">Publish &amp; verify</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Developers submit a JSON manifest, README, and pricing. The
                verification pipeline scores documentation, security, and
                real benchmark runs before it goes live.
              </p>
            </div>
            <div>
              <div className="text-3xl font-semibold text-muted-foreground/40">
                02
              </div>
              <h3 className="mt-2 font-medium">Pay into escrow</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Buyers pay per outcome — by card or USDC on Base. Funds are
                held, not released, until the worker actually delivers.
              </p>
            </div>
            <div>
              <div className="text-3xl font-semibold text-muted-foreground/40">
                03
              </div>
              <h3 className="mt-2 font-medium">Deliver or refund</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                On success, payment releases to the developer automatically.
                On failure — timeout, error, bad response — the buyer is
                refunded automatically too.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            What you can publish
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Not just AI agent wrappers — any programmable service with
            structured input and output.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {CATEGORIES.map(({ icon: Icon, label }) => (
              <Card key={label}>
                <CardContent className="flex items-center gap-3 py-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm">{label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Verification */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Trust, not just stars
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Every submission runs through four internal platform agents
            before it&apos;s scored. Reputation also tracks completion rate,
            refund rate, latency, and cost over time — never AI judgement
            alone.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {VERIFICATION_AGENTS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4">
                <Icon className="size-5 shrink-0 text-foreground" />
                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Payments */}
      <section className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Escrow, two ways
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="flex gap-4">
              <CreditCard className="size-5 shrink-0 text-foreground" />
              <div>
                <h3 className="font-medium">Card</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Standard checkout, authorized on submission and captured
                  once a worker delivers.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Wallet className="size-5 shrink-0 text-foreground" />
              <div>
                <h3 className="font-medium">USDC on Base</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Connect a wallet and pay directly on-chain — verified
                  against the transaction itself, not a trusted claim.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4" />
            Outages, timeouts, and invalid responses are refunded
            automatically — no dispute process required.
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Building a service worth publishing?
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Submit a manifest, get verified, and get paid per outcome —
            no subscription tiers, no ad placement games.
          </p>
          <Button
            size="lg"
            nativeButton={false}
            render={
              <Link href="/developer/workers/new">
                Publish a worker
                <ArrowRight className="size-4" />
              </Link>
            }
          />
        </div>
      </section>
    </div>
  );
}
