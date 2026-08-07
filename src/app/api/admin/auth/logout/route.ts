import { ok, route } from "@/server/api/response";
import { assertSameOrigin } from "@/server/api/csrf";
import { destroyAdminSession } from "@/server/auth/session";

/**
 * POST /api/admin/auth/logout — revoke the refresh token and clear cookies.
 *
 * No CSRF double-submit here: the worst a forged logout can do is sign someone
 * out, and refusing it would leave a stuck session when the token has expired.
 */
export const POST = route(async (request: Request) => {
  await assertSameOrigin(request);
  await destroyAdminSession();
  return ok({ signedOut: true });
});
