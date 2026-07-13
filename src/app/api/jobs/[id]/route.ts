import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/jobs/[id]">,
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const job = await db.job.findUnique({
    where: { id },
    include: {
      escrowTransaction: true,
      buyer: { select: { email: true } },
      worker: { include: { developer: { include: { user: { select: { email: true } } } } } },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  const isBuyer = job.buyer.email === session.user.email;
  const isDeveloper = job.worker.developer.user.email === session.user.email;
  if (!isBuyer && !isDeveloper) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}
