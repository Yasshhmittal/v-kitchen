import { NextResponse, type NextRequest } from "next/server";

import { verifyAccessToken } from "@/server/auth/jwt";

/**
 * Edge middleware guarding the admin surface.
 *
 * This runs before rendering and blocks obviously-unauthenticated traffic
 * cheaply. It is NOT the authorization boundary: it only checks that a valid
 * admin-audience token is present, because the Edge runtime cannot reach
 * Prisma to confirm the account is still active or has the required role.
 * Every admin route handler re-checks with `requireAdmin(...)` server-side.
 */

const ADMIN_ACCESS_COOKIE = "vk_admin_at";

/** Paths under /admin that must stay reachable without a session. */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/forgot-password"];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (!isAdminPage && !isAdminApi) return NextResponse.next();

  if (PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  // The auth endpoints themselves must be reachable to log in / refresh.
  if (pathname.startsWith("/api/admin/auth/")) return NextResponse.next();

  const token = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  const claims = token ? await verifyAccessToken(token, "admin") : null;

  if (claims) return NextResponse.next();

  // An expired access token is normal — the client refreshes and retries.
  // APIs get a machine-readable 401; pages get bounced to login with a
  // `next` param so the user lands back where they were headed.
  if (isAdminApi) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/admin/login", request.url);
  if (pathname !== "/admin") loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
