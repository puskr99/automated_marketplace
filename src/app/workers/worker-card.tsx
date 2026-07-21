import Link from "next/link";
import { UserRound, Gift, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatSc } from "@/lib/currency";
import { coverStyle } from "./cover";
import type { WorkerCardData } from "@/lib/worker-listing-types";

// Plain presentational component — no "use client" directive, since it's
// rendered both from the server (page.tsx's initial page) and from the
// client (load-more.tsx's appended pages), from the same JSON-shaped data
// either way.
export function WorkerCard({ worker }: { worker: WorkerCardData }) {
  const { gradient, Icon } = coverStyle(worker.category);

  return (
    <Link href={`/workers/${worker.slug}`} className="group">
      <Card className="h-full overflow-hidden pt-0 ring-foreground/10 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl hover:shadow-foreground/10 hover:ring-foreground/25">
        <div
          className={`relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br ${gradient}`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.25)_1px,transparent_0)] bg-size-[18px_18px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
          <Icon
            className="absolute -bottom-6 -right-6 size-32 text-white/25 transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-6"
            strokeWidth={1.25}
          />
          <Badge
            variant="secondary"
            className="absolute left-3 top-3 bg-white/90 text-foreground backdrop-blur-sm dark:bg-black/60"
          >
            {worker.category}
          </Badge>
        </div>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle>{worker.name}</CardTitle>
            {worker.trust !== undefined && (
              <Badge variant="secondary" className="shrink-0">
                Trust {worker.trust}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <UserRound className="size-3.5" />
              {worker.creatorName}
            </span>
            {worker.avgRating !== undefined && (
              <span className="flex items-center gap-1">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                {worker.avgRating.toFixed(1)}
                <span>({worker.reviewCount})</span>
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {worker.manifest ? (
            <>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {worker.manifest.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {formatSc(worker.manifest.pricing.amount_cents)}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    / {worker.manifest.pricing.model.replace("_", " ")}
                  </span>
                </span>
                {worker.manifest.trial.free_runs > 0 && (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                  >
                    <Gift className="size-3" />
                    {worker.manifest.trial.free_runs} free
                  </Badge>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Awaiting verification</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
