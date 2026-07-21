import "server-only";
import { db } from "@/lib/db";
import { searchWorkerIds } from "@/lib/search";
import type { WorkerManifest } from "@/lib/manifest";
import type { Prisma } from "@/generated/prisma/client";
import {
  WORKERS_PAGE_SIZE,
  SORT_OPTIONS,
  type SortValue,
  type WorkerCardData,
} from "@/lib/worker-listing-types";

// Re-exported so server files (page.tsx, api/workers/feed/route.ts) can
// import everything from one place — but client components must import
// these from worker-listing-types directly, never from this file: it pulls
// in the Prisma client via lib/db, which breaks the client bundle (Prisma's
// generated client isn't browser-safe).
export { WORKERS_PAGE_SIZE, SORT_OPTIONS };
export type { SortValue, WorkerCardData };

function average(nums: number[]): number | undefined {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined;
}

// Computes the full, correctly-ordered list of worker IDs matching a
// category/search filter and sort — using only lightweight, targeted
// queries (ids, latest trust score, rating average, latest manifest's
// price) rather than the full card data (manifest JSON, developer/user
// join, review list). That heavy data is only ever fetched for the one
// page of IDs actually being rendered (see getWorkerCards) — so this stays
// cheap as the catalog grows, instead of re-fetching everything on every
// "Load more" click just to throw most of it away.
export async function getSortedWorkerIds(params: {
  category?: string;
  q?: string;
  sort: SortValue;
}): Promise<{ ids: string[]; categories: string[] }> {
  const { category, q, sort } = params;

  const [rankedIds, categoryRows] = await Promise.all([
    q ? searchWorkerIds(q) : Promise.resolve(null),
    db.worker.findMany({ select: { category: true }, distinct: ["category"] }),
  ]);
  const categories = categoryRows.map((c) => c.category).sort();

  const where: Prisma.WorkerWhereInput = {
    ...(category ? { category } : {}),
    ...(rankedIds ? { id: { in: rankedIds } } : {}),
  };

  const workers = await db.worker.findMany({
    where,
    select: { id: true, createdAt: true },
  });
  const ids = workers.map((w) => w.id);
  if (ids.length === 0) return { ids: [], categories };

  const [trustRows, ratingRows, manifestRows] = await Promise.all([
    db.trustScoreSnapshot.findMany({
      where: { workerId: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: { workerId: true, score: true },
    }),
    db.review.groupBy({
      by: ["workerId"],
      where: { workerId: { in: ids } },
      _avg: { rating: true },
    }),
    db.workerManifest.findMany({
      where: { workerId: { in: ids }, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      select: { workerId: true, manifest: true },
    }),
  ]);

  // trustRows/manifestRows are ordered newest-first per worker but not
  // deduped — first occurrence per workerId (via a Map) is the latest one.
  const latestTrust = new Map<string, number>();
  for (const row of trustRows) {
    if (!latestTrust.has(row.workerId)) latestTrust.set(row.workerId, row.score);
  }
  const avgRatingByWorker = new Map(
    ratingRows.map((r) => [r.workerId, r._avg.rating ?? undefined]),
  );
  const priceByWorker = new Map<string, number>();
  for (const row of manifestRows) {
    if (priceByWorker.has(row.workerId)) continue;
    const manifest = row.manifest as unknown as WorkerManifest;
    priceByWorker.set(row.workerId, manifest.pricing.amount_cents);
  }

  const rankOrder = rankedIds ? new Map(rankedIds.map((id, i) => [id, i])) : null;
  const createdAtByWorker = new Map(workers.map((w) => [w.id, w.createdAt.getTime()]));

  const sorted = [...ids].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return (createdAtByWorker.get(a) ?? 0) - (createdAtByWorker.get(b) ?? 0);
      case "trust":
        return (latestTrust.get(b) ?? -1) - (latestTrust.get(a) ?? -1);
      case "rating":
        return (avgRatingByWorker.get(b) ?? -1) - (avgRatingByWorker.get(a) ?? -1);
      case "price_asc":
        return (priceByWorker.get(a) ?? Infinity) - (priceByWorker.get(b) ?? Infinity);
      case "price_desc":
        return (priceByWorker.get(b) ?? -1) - (priceByWorker.get(a) ?? -1);
      case "newest":
      default:
        if (rankOrder) return (rankOrder.get(a) ?? 0) - (rankOrder.get(b) ?? 0);
        return (createdAtByWorker.get(b) ?? 0) - (createdAtByWorker.get(a) ?? 0);
    }
  });

  return { ids: sorted, categories };
}

// The expensive fetch (full manifest, developer+user join, review ratings)
// — call only with the slice of IDs actually being rendered.
export async function getWorkerCards(ids: string[]): Promise<WorkerCardData[]> {
  if (ids.length === 0) return [];

  const workers = await db.worker.findMany({
    where: { id: { in: ids } },
    include: {
      manifests: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      reviews: { select: { rating: true } },
      developer: { include: { user: true } },
    },
  });
  const byId = new Map(workers.map((w) => [w.id, w]));
  const trustRows = await db.trustScoreSnapshot.findMany({
    where: { workerId: { in: ids } },
    orderBy: { createdAt: "desc" },
    select: { workerId: true, score: true },
  });
  const latestTrust = new Map<string, number>();
  for (const row of trustRows) {
    if (!latestTrust.has(row.workerId)) latestTrust.set(row.workerId, row.score);
  }

  // Re-attach in the caller's order — findMany's `id: { in }` doesn't
  // preserve the order the IDs were passed in.
  return ids.flatMap((id) => {
    const worker = byId.get(id);
    if (!worker) return [];
    const manifest = worker.manifests[0]?.manifest as unknown as WorkerManifest | undefined;
    return [
      {
        slug: worker.slug,
        name: worker.name,
        category: worker.category,
        createdAt: worker.createdAt.toISOString(),
        creatorName: worker.developer.user.name ?? worker.developer.user.email,
        trust: latestTrust.get(id),
        avgRating: average(worker.reviews.map((r) => r.rating)),
        reviewCount: worker.reviews.length,
        manifest: manifest
          ? {
              description: manifest.description,
              pricing: manifest.pricing,
              trial: manifest.trial,
            }
          : undefined,
      },
    ];
  });
}
