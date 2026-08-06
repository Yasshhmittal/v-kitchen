import { headers } from "next/headers";

import { ApiError } from "./response";
import { getAdminSession, getCustomerSession, type AdminSession } from "@/server/auth/session";
import { can, type Permission } from "@/server/auth/rbac";
import { prisma } from "@/lib/prisma";

/**
 * Guards used at the top of route handlers.
 *
 * `middleware.ts` already turned away requests with no token, but that check
 * runs on the Edge and cannot see the database. These functions are the real
 * boundary: they confirm the account still exists, is active, and holds the
 * permission being exercised.
 */

export async function requireAdmin(permission?: Permission): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw ApiError.unauthenticated();
  if (permission && !can(session.role, permission)) {
    throw ApiError.forbidden(
      `Your role (${session.role.toLowerCase()}) can't perform this action.`,
    );
  }
  return session;
}

export async function requireCustomer() {
  const session = await getCustomerSession();
  if (!session) throw ApiError.unauthenticated("Sign in to view this.");
  return session;
}

/**
 * Write an audit row. Called after every admin mutation so a price change can
 * always be traced to a person, with the before/after values.
 */
export async function auditLog(params: {
  session: AdminSession;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  const hdrs = await headers();
  try {
    await prisma.adminLog.create({
      data: {
        userId: params.session.userId,
        actorName: params.session.name,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: params.before === undefined ? undefined : JSON.parse(JSON.stringify(params.before)),
        after: params.after === undefined ? undefined : JSON.parse(JSON.stringify(params.after)),
        ipAddress:
          hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || undefined,
        userAgent: hdrs.get("user-agent")?.slice(0, 255),
      },
    });
  } catch (error) {
    // Auditing must never break the operation it is recording.
    console.error("[audit] failed to write log:", error);
  }
}

/**
 * In-memory fixed-window rate limiter.
 *
 * Deliberately simple: it protects a single instance against brute-force and
 * form spam. Multi-instance deployments should point this at Redis
 * (REDIS_URL is already wired in the compose file).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistic sweep so the map cannot grow without bound.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const seconds = Math.ceil((bucket.resetAt - now) / 1000);
    throw new ApiError(
      "RATE_LIMITED",
      `Too many attempts. Please try again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
    );
  }
}

export async function requestIp(): Promise<string> {
  const hdrs = await headers();
  return (
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || "unknown"
  );
}
