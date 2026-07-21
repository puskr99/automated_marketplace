import Link from "next/link";
import { Suspense } from "react";
import { MarginAds } from "@/components/margin-ads";
import { SearchBar } from "./search-bar";
import { FiltersBar, type SortValue } from "./filters-bar";
import { WorkerCard } from "./worker-card";
import { LoadMore } from "./load-more";
import { getSortedWorkerIds, getWorkerCards, WORKERS_PAGE_SIZE } from "@/lib/worker-listing";

export const dynamic = "force-dynamic";

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string }>;
}) {
  const { category, q, sort } = await searchParams;
  const sortBy = (sort ?? "newest") as SortValue;

  const { ids, categories } = await getSortedWorkerIds({ category, q, sort: sortBy });
  const pageIds = ids.slice(0, WORKERS_PAGE_SIZE);
  const cards = await getWorkerCards(pageIds);
  const hasMore = ids.length > WORKERS_PAGE_SIZE;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <MarginAds contentWidthPx={768} />
      <h1 className="text-2xl font-semibold tracking-tight">Workers</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {category ? `Category: ${category}` : "All categories"}
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md flex-1">
          <Suspense fallback={<div className="h-9 rounded-lg border bg-muted/30" />}>
            <SearchBar />
          </Suspense>
        </div>
        <Suspense fallback={<div className="h-9 w-96 rounded-lg border bg-muted/30" />}>
          <FiltersBar categories={categories} />
        </Suspense>
      </div>

      {cards.length === 0 && (
        <p className="mt-10 text-sm text-muted-foreground">
          {q ? (
            `No workers match "${q}".`
          ) : (
            <>
              No workers published yet.{" "}
              <Link href="/developer/workers/new" className="underline">
                Publish the first one
              </Link>
              .
            </>
          )}
        </p>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {cards.map((worker) => (
          <WorkerCard key={worker.slug} worker={worker} />
        ))}
      </div>

      <LoadMore
        category={category}
        q={q}
        sort={sortBy}
        initialCount={pageIds.length}
        initialHasMore={hasMore}
      />
    </div>
  );
}
