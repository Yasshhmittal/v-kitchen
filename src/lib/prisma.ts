import { PrismaClient } from "@prisma/client";

/**
 * A single PrismaClient across hot reloads. Next.js re-evaluates modules on
 * every edit in dev; without caching on globalThis we would exhaust the
 * database connection pool within a few saves.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
