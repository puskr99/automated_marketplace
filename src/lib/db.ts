import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";
import ws from "ws";

// Neon's driver uses WebSockets for pooled connections. Plain Node.js (this
// dev server, and the worker process on Railway) has no native WebSocket
// global, so it needs the `ws` polyfill. Skip it where one already exists
// (e.g. Cloudflare Workers), since `ws` itself needs Node's `net`/`tls`.
if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
