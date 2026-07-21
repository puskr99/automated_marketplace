import { NextResponse } from "next/server";
import {
  getSortedWorkerIds,
  getWorkerCards,
  WORKERS_PAGE_SIZE,
  SORT_OPTIONS,
  type SortValue,
} from "@/lib/worker-listing";

const VALID_SORTS = new Set(SORT_OPTIONS.map((o) => o.value));

function isSortValue(value: string): value is SortValue {
  return VALID_SORTS.has(value as SortValue);
}

// Backs the "Load more" button on /workers specifically — distinct from
// the public GET /api/workers listing endpoint (../route.ts), which has a
// different, simpler response shape and no search/sort/pagination. Not
// meant to be a stable external API.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const sortParam = searchParams.get("sort") ?? "newest";
  const sort = isSortValue(sortParam) ? sortParam : "newest";
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const { ids } = await getSortedWorkerIds({ category, q, sort });
  const pageIds = ids.slice(offset, offset + WORKERS_PAGE_SIZE);
  const cards = await getWorkerCards(pageIds);

  return NextResponse.json({
    cards,
    hasMore: offset + WORKERS_PAGE_SIZE < ids.length,
  });
}
