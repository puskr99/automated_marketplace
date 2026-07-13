import Link from "next/link";
import { UserRound, Gift } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WorkerManifest } from "@/lib/manifest";

export const dynamic = "force-dynamic";

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const workers = await db.worker.findMany({
    where: category ? { category } : undefined,
    include: {
      manifests: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      trustScores: { orderBy: { createdAt: "desc" }, take: 1 },
      developer: { include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Workers</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {category ? `Category: ${category}` : "All categories"}
      </p>

      {workers.length === 0 && (
        <p className="mt-10 text-sm text-muted-foreground">
          No workers published yet.{" "}
          <Link href="/developer/workers/new" className="underline">
            Publish the first one
          </Link>
          .
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {workers.map((worker) => {
          const trust = worker.trustScores[0]?.score;
          const manifestRow = worker.manifests[0];
          const manifest = manifestRow?.manifest as unknown as
            | WorkerManifest
            | undefined;
          const creatorName =
            worker.developer.user.name ?? worker.developer.user.email;

          return (
            <Link key={worker.id} href={`/workers/${worker.slug}`}>
              <Card className="h-full transition-colors hover:border-foreground/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{worker.name}</CardTitle>
                    {trust !== undefined && (
                      <Badge variant="secondary" className="shrink-0">
                        Trust {trust}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserRound className="size-3.5" />
                    {creatorName}
                  </div>
                </CardHeader>
                <CardContent>
                  {manifest ? (
                    <>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {manifest.description}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{worker.category}</Badge>
                        <span className="text-sm font-medium">
                          ${(manifest.pricing.amount_cents / 100).toFixed(2)}
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            / {manifest.pricing.model.replace("_", " ")}
                          </span>
                        </span>
                        {manifest.trial.free_runs > 0 && (
                          <Badge
                            variant="secondary"
                            className="gap-1 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          >
                            <Gift className="size-3" />
                            {manifest.trial.free_runs} free
                          </Badge>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline">{worker.category}</Badge>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Awaiting verification
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
