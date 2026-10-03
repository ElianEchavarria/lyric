import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Next.js re-runs this module on every hot reload in dev. A plain
// `new PrismaClient()` would open a fresh connection pool on each reload until
// the database runs out of connections — so in dev the client is cached on
// globalThis, which survives reloads. Production loads modules once, so it
// doesn't need the cache.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
