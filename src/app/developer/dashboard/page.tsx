import Link from "next/link";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

// TODO: scope this list to the authenticated developer once auth is wired up.
export default async function DeveloperDashboardPage() {
  const workers = await db.worker.findMany({
    include: {
      manifests: { orderBy: { createdAt: "desc" }, take: 1 },
      trustScores: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Developer dashboard
        </h1>
        <Link href="/developer/workers/new" className="text-sm underline">
          Publish a worker
        </Link>
      </div>

      <Table className="mt-8">
        <TableHeader>
          <TableRow>
            <TableHead>Worker</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Latest version status</TableHead>
            <TableHead>Trust score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workers.map((worker) => (
            <TableRow key={worker.id}>
              <TableCell>
                <Link href={`/workers/${worker.slug}`} className="underline">
                  {worker.name}
                </Link>
              </TableCell>
              <TableCell>{worker.category}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {worker.manifests[0]?.status ?? "—"}
                </Badge>
              </TableCell>
              <TableCell>{worker.trustScores[0]?.score ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
