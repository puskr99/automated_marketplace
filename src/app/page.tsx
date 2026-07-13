import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-32 text-center">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        A trusted marketplace for programmable workers
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        Developers publish AI agents, APIs, scrapers, and automation tools.
        Users pay for completed outcomes. Every worker ships with transparent
        benchmarks, reputation, and verification.
      </p>
      <div className="mt-10 flex gap-4">
        <Button size="lg" render={<Link href="/workers">Browse workers</Link>} />
        <Button
          size="lg"
          variant="outline"
          render={<Link href="/developer/workers/new">Publish a worker</Link>}
        />
      </div>
    </div>
  );
}
