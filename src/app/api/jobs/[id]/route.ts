import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/jobs/[id]">,
) {
  const { id } = await ctx.params;

  const job = await db.job.findUnique({
    where: { id },
    include: { escrowTransaction: true },
  });

  if (!job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}
