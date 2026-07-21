"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SORT_OPTIONS, type SortValue } from "@/lib/worker-listing-types";

export type { SortValue };

const SORT_LABELS = Object.fromEntries(
  SORT_OPTIONS.map((opt) => [opt.value, opt.label]),
);

function categoryLabel(value: string) {
  if (value === "all") return "All categories";
  return value.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function FiltersBar({ categories }: { categories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const category = searchParams.get("category") ?? "all";
  const sort = searchParams.get("sort") ?? "newest";

  function setParam(key: string, value: string | null) {
    if (value === null) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "newest") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Select value={category} onValueChange={(v) => setParam("category", v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Category">
            {(value: string | null) => categoryLabel(value ?? "all")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {categoryLabel(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Sort by">
            {(value: string | null) => SORT_LABELS[value ?? "newest"]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
