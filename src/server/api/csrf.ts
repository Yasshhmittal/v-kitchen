import { cookies, headers } from "next/headers";

import { ApiError } from "./response";
import { CSRF_COOKIE } from "@/server/auth/session";

/**
 * CSRF protection for cookie-authenticated mutations.
 *
 * Because sessions ride in cookies, a form on another origin could otherwise
 * make the browser send an authenticated request. Two independent checks:
 *
 *  1. Origin/Referer must match the host — blocks the classic cross-site POST.
 *  2. Double submit — the client echoes the non-HttpOnly `vk_csrf` cookie in
 *     an `x-csrf-token` header. An attacker's page can cause the cookie to be
 *     sent but cannot read it to set the header.
 *
 * Guest checkout is deliberately exempt: it carries no session, so there is no
 * authority for a forged request to borrow.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function assertSameOrigin(request: Request): Promise<void> {
  if (SAFE_METHODS.has(request.method)) return;

  const hdrs = await headers();
  const host = hdrs.get("host");
  const source = hdrs.get("origin") ?? hdrs.get("referer");

  // No Origin and no Referer means a non-browser client (curl, a mobile app).
  // Those carry no ambient cookies, so there is nothing to forge.
  if (!source || !host) return;

  let sourceHost: string;
  try {
    sourceHost = new URL(source).host;
  } catch {
    throw ApiError.forbidden("That request came from an unexpected origin.");
  }

  if (sourceHost !== host) {
    throw ApiError.forbidden("That request came from an unexpected origin.");
  }
}

/** Full check for endpoints that act on behalf of a logged-in session. */
export async function assertCsrf(request: Request): Promise<void> {
  await assertSameOrigin(request);
  if (SAFE_METHODS.has(request.method)) return;

  const jar = await cookies();
  const cookieToken = jar.get(CSRF_COOKIE)?.value;
  if (!cookieToken) return; // no session cookie set yet — nothing to protect

  const headerToken = request.headers.get("x-csrf-token");
  if (headerToken !== cookieToken) {
    throw ApiError.forbidden("Your session token didn't match. Please refresh and try again.");
  }
}
