import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, findOrCreate } from "@/lib/db";
import { validateManifest } from "@/lib/manifest";
import { verifyDocumentationQueue } from "@/lib/queue";
import type { Prisma } from "@/generated/prisma/client";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const developerEmail = session.user.email;

  const body = await request.json();
  const { slug, readme, manifest: rawManifest } = body as {
    slug?: string;
    readme?: string;
    manifest?: unknown;
  };

  if (!slug || !readme) {
    return NextResponse.json(
      { error: "slug and readme are required" },
      { status: 400 },
    );
  }

  const parsed = validateManifest(rawManifest);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid manifest", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const user = await findOrCreate(
    () => db.user.findUnique({ where: { email: developerEmail } }),
    () => db.user.create({ data: { email: developerEmail } }),
  );

  const developer = await findOrCreate(
    () => db.developerProfile.findUnique({ where: { userId: user.id } }),
    () => db.developerProfile.create({ data: { userId: user.id } }),
  );

  const worker = await findOrCreate(
    () => db.worker.findUnique({ where: { slug } }),
    () =>
      db.worker.create({
        data: {
          slug,
          name: parsed.data.name,
          category: parsed.data.category,
          developerId: developer.id,
        },
      }),
  );

  const manifestRow = await db.workerManifest.create({
    data: {
      workerId: worker.id,
      version: parsed.data.version,
      manifest: parsed.data as unknown as Prisma.InputJsonValue,
      readme,
      status: "PENDING_REVIEW",
    },
  });

  await verifyDocumentationQueue.add("verify", {
    manifestId: manifestRow.id,
  });

  return NextResponse.json(
    { workerId: worker.id, manifestId: manifestRow.id },
    { status: 201 },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? undefined;

  const workers = await db.worker.findMany({
    where: category ? { category } : undefined,
    include: {
      manifests: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      trustScores: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ workers });
}
