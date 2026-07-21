"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkerCard } from "./worker-card";
import { WORKERS_PAGE_SIZE, type WorkerCardData } from "@/lib/worker-listing-types";

type Props = {
  category?: string;
  q?: string;
  sort: string;
  initialCount: number;
  initialHasMore: boolean;
};

export function LoadMore({ category, q, sort, initialCount, initialHasMore }: Props) {
  const [cards, setCards] = useState<WorkerCardData[]>([]);
  const [offset, setOffset] = useState(initialCount);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sort, offset: String(offset) });
      if (category) params.set("category", category);
      if (q) params.set("q", q);

      const res = await fetch(`/api/workers/feed?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "couldn't load more workers");

      setCards((prev) => [...prev, ...data.cards]);
      setOffset((prev) => prev + WORKERS_PAGE_SIZE);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {cards.length > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {cards.map((worker) => (
            <WorkerCard key={worker.slug} worker={worker} />
          ))}
        </div>
      )}
      {hasMore && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Load more
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </>
  );
}
