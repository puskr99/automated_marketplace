import Link from "next/link";
import { auth, signIn } from "@/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function DeveloperDashboardPage() {
  const session = await auth();

  if (!session?.user?.email) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">
          Developer dashboard
        </h1>
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
          className="mt-6"
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Sign in to see the workers you&apos;ve published.
          </p>
          <Button type="submit">Sign in with Google</Button>
        </form>
      </div>
    );
  }

  const workers = await db.worker.findMany({
    where: { developer: { user: { email: session.user.email } } },
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

      {workers.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          You haven&apos;t published any workers yet.
        </p>
      ) : (
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
      )}
    </div>
  );
}
