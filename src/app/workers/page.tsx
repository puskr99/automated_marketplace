import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
          const manifest = worker.manifests[0];
          return (
            <Link key={worker.id} href={`/workers/${worker.slug}`}>
              <Card className="h-full transition-colors hover:border-foreground/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{worker.name}</CardTitle>
                    {trust !== undefined && (
                      <Badge variant="secondary">Trust {trust}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">{worker.category}</Badge>
                  {!manifest && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Awaiting verification
                    </p>
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
