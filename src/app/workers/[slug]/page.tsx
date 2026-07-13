import { notFound } from "next/navigation";
import { auth, signIn } from "@/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatRunner } from "./chat-runner";
import { classifyInput, classifyOutput } from "@/lib/manifest-ui";
import { PLATFORM_MAX_FREE_RUNS } from "@/lib/manifest";
import type { WorkerManifest } from "@/lib/manifest";

export const dynamic = "force-dynamic";

export default async function WorkerDetailPage(
  props: PageProps<"/workers/[slug]">,
) {
  const { slug } = await props.params;
  const session = await auth();

  const worker = await db.worker.findUnique({
    where: { slug },
    include: {
      manifests: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      trustScores: { orderBy: { createdAt: "desc" }, take: 1 },
      reviews: { orderBy: { createdAt: "desc" }, take: 10 },
      developer: { include: { user: true } },
    },
  });

  if (!worker) notFound();

  const manifestRow = worker.manifests[0];
  const manifest = manifestRow?.manifest as unknown as WorkerManifest | undefined;
  const trust = worker.trustScores[0];
  const creatorName = worker.developer.user.name ?? worker.developer.user.email;

  let initialJobs: Awaited<ReturnType<typeof db.job.findMany>> = [];
  let freeRunsUsed = 0;
  if (session?.user?.email) {
    const buyer = await db.user.findUnique({ where: { email: session.user.email } });
    if (buyer) {
      [initialJobs, freeRunsUsed] = await Promise.all([
        db.job.findMany({
          where: { buyerId: buyer.id, workerId: worker.id },
          include: { escrowTransaction: { select: { id: true } } },
          orderBy: { createdAt: "asc" },
          take: 50,
        }),
        db.job.count({
          where: { buyerId: buyer.id, workerId: worker.id, escrowTransaction: null },
        }),
      ]);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {worker.name}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline">{worker.category}</Badge>
            <span className="text-sm text-muted-foreground">
              by {creatorName}
            </span>
          </div>
        </div>
        {trust && <Badge variant="secondary">Trust score {trust.score}</Badge>}
      </div>

      {!manifest ? (
        <p className="mt-8 text-sm text-muted-foreground">
          This worker has no approved version yet — it&apos;s still in
          verification.
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm leading-relaxed">
            {manifest.description}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-muted-foreground">Price</div>
              <div className="font-medium">
                ${(manifest.pricing.amount_cents / 100).toFixed(2)}{" "}
                {manifest.pricing.currency.toUpperCase()} /{" "}
                {manifest.pricing.model.replace("_", " ")}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Free trial</div>
              <div className="font-medium">
                {Math.min(manifest.trial.free_runs, PLATFORM_MAX_FREE_RUNS)} runs
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Version</div>
              <div className="font-medium">{manifestRow.version}</div>
            </div>
          </div>

          {trust && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="text-base">Trust breakdown</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4 text-sm">
                {Object.entries(
                  trust.breakdown as Record<string, number>,
                ).map(([key, value]) => (
                  <div key={key}>
                    <div className="text-muted-foreground capitalize">
                      {key}
                    </div>
                    <div className="font-medium">{value}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-base">Run this worker</CardTitle>
            </CardHeader>
            <CardContent>
              {session?.user ? (
                <ChatRunner
                  workerSlug={worker.slug}
                  amountCents={manifest.pricing.amount_cents}
                  freeRunsAllowed={Math.min(
                    manifest.trial.free_runs,
                    PLATFORM_MAX_FREE_RUNS,
                  )}
                  inputShape={classifyInput(manifest.input)}
                  outputShape={classifyOutput(manifest.output)}
                  initialJobs={JSON.parse(JSON.stringify(initialJobs))}
                  initialFreeRunsUsed={freeRunsUsed}
                />
              ) : (
                <form
                  action={async () => {
                    "use server";
                    await signIn("google");
                  }}
                >
                  <p className="mb-3 text-sm text-muted-foreground">
                    Sign in to run this worker.
                  </p>
                  <Button type="submit">Sign in with Google</Button>
                </form>
              )}
            </CardContent>
          </Card>

          <div className="mt-8">
            <h2 className="text-base font-medium">Reviews</h2>
            {worker.reviews.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No reviews yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {worker.reviews.map((review) => (
                  <li key={review.id} className="rounded-md border p-3 text-sm">
                    <div className="font-medium">{review.rating} / 5</div>
                    {review.comment && (
                      <p className="mt-1 text-muted-foreground">
                        {review.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
