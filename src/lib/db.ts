import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

// HTTP-based Neon adapter (not the WebSocket Pool one): the platform's
// query pattern is independent single queries, sometimes with long gaps
// between them within one request (e.g. a worker execution call that waits
// 15-20s on a third-party API before writing the result) — exactly the
// case Neon recommends HTTP mode for, since a pooled WebSocket connection
// can go stale/drop across that gap and fail the next query.
//
// Tradeoff: HTTP mode does not support transactions — and that includes
// Prisma's `upsert()`, which uses one internally even though we never call
// `$transaction` ourselves. Use `findOrCreate` below instead of `upsert`
// anywhere in this app.
const adapter = new PrismaNeonHttp(process.env.DATABASE_URL ?? "", {});

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// Transaction-free substitute for `db.<model>.upsert()` (unsupported in
// Neon's HTTP mode). Every call site in this app only needs get-or-create
// semantics (no "update on match" behavior), so this is a straight swap.
// Falls back to a re-fetch on a unique-constraint race instead of retrying
// the insert, since the losing writer's create attempt is not the row we
// want to return anyway.
export async function findOrCreate<T>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
): Promise<T> {
  const existing = await find();
  if (existing) return existing;
  try {
    return await create();
  } catch (err) {
    const isUniqueConstraintError =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002";
    if (!isUniqueConstraintError) throw err;
    const raceWinner = await find();
    if (!raceWinner) throw err;
    return raceWinner;
  }
}
