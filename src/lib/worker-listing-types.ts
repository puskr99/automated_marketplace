// Pure types/constants shared between server code (worker-listing.ts,
// page.tsx, api/workers/feed/route.ts) and client components (filters-bar,
// worker-card, load-more). Deliberately has zero imports of its own —
// worker-listing.ts pulls in the Prisma client (via lib/db), which breaks
// the client bundle if a "use client" component imports from it directly.
import type { WorkerManifest } from "@/lib/manifest";

export const WORKERS_PAGE_SIZE = 12;

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "trust", label: "Trust score: high to low" },
  { value: "rating", label: "Rating: high to low" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export type WorkerCardData = {
  slug: string;
  name: string;
  category: string;
  createdAt: string;
  creatorName: string;
  trust?: number;
  avgRating?: number;
  reviewCount: number;
  manifest?: {
    description: string;
    pricing: WorkerManifest["pricing"];
    trial: WorkerManifest["trial"];
  };
};
