import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  customerRefreshTokenExpiry,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
  verifyAccessToken,
} from "./jwt";

/**
 * Session management for both audiences.
 *
 * Tokens live in HttpOnly cookies — never localStorage, which is readable by
 * any injected script. The admin and customer sessions use separate cookie
 * names so being logged in as a customer can never be mistaken for staff
 * access.
 */

export const ADMIN_ACCESS_COOKIE = "vk_admin_at";
export const ADMIN_REFRESH_COOKIE = "vk_admin_rt";
export const CUSTOMER_ACCESS_COOKIE = "vk_cust_at";
export const CUSTOMER_REFRESH_COOKIE = "vk_cust_rt";
export const CSRF_COOKIE = "vk_csrf";

const isProd = process.env.NODE_ENV === "production";

function baseCookie(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export interface AdminSession {
  userId: string;
  name: string;
  email: string;
  role: Role;
}

export interface CustomerSession {
  customerId: string;
  name: string;
  phone: string;
}

// ---------------------------------------------------------------------------
// Admin session
// ---------------------------------------------------------------------------

export async function createAdminSession(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
}): Promise<void> {
  const jar = await cookies();
  const hdrs = await headers();

  const accessToken = await signAccessToken({
    sub: user.id,
    aud: "admin",
    role: user.role,
    name: user.name,
    email: user.email,
  });

  const refreshToken = generateRefreshToken();
  const expiresAt = refreshTokenExpiry();

  await prisma.refreshToken.create({
    data: {
      tokenHash: await hashToken(refreshToken),
      userId: user.id,
      expiresAt,
      userAgent: hdrs.get("user-agent")?.slice(0, 255),
      ipAddress: clientIp(hdrs),
    },
  });

  jar.set(ADMIN_ACCESS_COOKIE, accessToken, baseCookie(15 * 60));
  jar.set(
    ADMIN_REFRESH_COOKIE,
    refreshToken,
    baseCookie(Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  );
  jar.set(CSRF_COOKIE, generateRefreshToken().slice(0, 32), {
    ...baseCookie(Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    httpOnly: false, // the client must read this to echo it back in a header
  });
}

/**
 * Resolve the current admin from the access cookie, then confirm against the
 * database that the account still exists and is active — a token issued before
 * an account was disabled must stop working immediately.
 *
 * `cache` dedupes this across a single render pass.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const jar = await cookies();
  const token = jar.get(ADMIN_ACCESS_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifyAccessToken(token, "admin");
  if (!claims?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;

  return { userId: user.id, name: user.name, email: user.email, role: user.role };
});

/** Rotate: consume the refresh token, issue a new pair. */
export async function refreshAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const refreshToken = jar.get(ADMIN_REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const tokenHash = await hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
    },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.user.isActive) {
    return null;
  }

  // Single-use: revoke before issuing the replacement.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  await createAdminSession(stored.user);
  return {
    userId: stored.user.id,
    name: stored.user.name,
    email: stored.user.email,
    role: stored.user.role,
  };
}

export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies();
  const refreshToken = jar.get(ADMIN_REFRESH_COOKIE)?.value;

  if (refreshToken) {
    await prisma.refreshToken
      .updateMany({
        where: { tokenHash: await hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }

  jar.delete(ADMIN_ACCESS_COOKIE);
  jar.delete(ADMIN_REFRESH_COOKIE);
  jar.delete(CSRF_COOKIE);
}

// ---------------------------------------------------------------------------
// Customer session
// ---------------------------------------------------------------------------

export async function createCustomerSession(customer: {
  id: string;
  name: string;
  phone: string;
}): Promise<void> {
  const jar = await cookies();
  const hdrs = await headers();

  const accessToken = await signAccessToken({
    sub: customer.id,
    aud: "customer",
    name: customer.name,
  });

  const refreshToken = generateRefreshToken();
  const expiresAt = customerRefreshTokenExpiry();

  await prisma.customerToken.create({
    data: {
      tokenHash: await hashToken(refreshToken),
      customerId: customer.id,
      expiresAt,
      userAgent: hdrs.get("user-agent")?.slice(0, 255),
    },
  });

  const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

  jar.set(CUSTOMER_ACCESS_COOKIE, accessToken, baseCookie(15 * 60));
  jar.set(CUSTOMER_REFRESH_COOKIE, refreshToken, baseCookie(maxAge));

  // Customers get the same double-submit token as admins. Without it
  // `assertCsrf` finds no cookie to compare against and falls through to the
  // origin check alone, which is one layer short of what the account mutations
  // are supposed to have.
  jar.set(CSRF_COOKIE, generateRefreshToken().slice(0, 32), {
    ...baseCookie(maxAge),
    httpOnly: false, // the client must read this to echo it back in a header
  });
}

export const getCustomerSession = cache(async (): Promise<CustomerSession | null> => {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_ACCESS_COOKIE)?.value;

  // Try the access token first; fall back to a silent refresh so a customer
  // browsing after 15 minutes is not logged out mid-session.
  if (token) {
    const claims = await verifyAccessToken(token, "customer");
    if (claims?.sub) {
      const customer = await prisma.customer.findUnique({
        where: { id: claims.sub },
        select: { id: true, name: true, phone: true, isBlocked: true },
      });
      if (customer && !customer.isBlocked) {
        return { customerId: customer.id, name: customer.name, phone: customer.phone };
      }
      return null;
    }
  }

  return refreshCustomerSession();
});

export async function refreshCustomerSession(): Promise<CustomerSession | null> {
  const jar = await cookies();
  const refreshToken = jar.get(CUSTOMER_REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const stored = await prisma.customerToken.findUnique({
    where: { tokenHash: await hashToken(refreshToken) },
    include: {
      customer: { select: { id: true, name: true, phone: true, isBlocked: true } },
    },
  });

  if (
    !stored ||
    stored.revokedAt ||
    stored.expiresAt < new Date() ||
    stored.customer.isBlocked
  ) {
    return null;
  }

  await prisma.customerToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  await createCustomerSession(stored.customer);
  return {
    customerId: stored.customer.id,
    name: stored.customer.name,
    phone: stored.customer.phone,
  };
}

export async function destroyCustomerSession(): Promise<void> {
  const jar = await cookies();
  const refreshToken = jar.get(CUSTOMER_REFRESH_COOKIE)?.value;

  if (refreshToken) {
    await prisma.customerToken
      .updateMany({
        where: { tokenHash: await hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }

  jar.delete(CUSTOMER_ACCESS_COOKIE);
  jar.delete(CUSTOMER_REFRESH_COOKIE);
  jar.delete(CSRF_COOKIE);
}

// ---------------------------------------------------------------------------

export function clientIp(hdrs: Headers): string | undefined {
  return (
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    undefined
  );
}
