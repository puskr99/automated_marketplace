import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateManifest } from "@/lib/manifest";
import { verifyDocumentationQueue } from "@/lib/queue";
import type { Prisma } from "@/generated/prisma/client";

// TODO: replace with real auth (session -> developer profile). For now the
// caller supplies developerEmail and we upsert a User + DeveloperProfile.
export async function POST(request: Request) {
  const body = await request.json();
  const { developerEmail, slug, readme, manifest: rawManifest } = body as {
    developerEmail?: string;
    slug?: string;
    readme?: string;
    manifest?: unknown;
  };

  if (!developerEmail || !slug || !readme) {
    return NextResponse.json(
      { error: "developerEmail, slug, and readme are required" },
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

  const user = await db.user.upsert({
    where: { email: developerEmail },
    update: {},
    create: { email: developerEmail },
  });

  const developer = await db.developerProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  const worker = await db.worker.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name: parsed.data.name,
      category: parsed.data.category,
      developerId: developer.id,
    },
  });

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
