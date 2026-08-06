import { ok, route } from "@/server/api/response";
import { assertSameOrigin } from "@/server/api/csrf";
import { destroyCustomerSession } from "@/server/auth/session";

/**
 * POST /api/auth/logout
 *
 * Revokes the stored refresh token as well as clearing the cookies, so a
 * copied token cannot be replayed after signing out.
 */
export const POST = route(async (request: Request) => {
  await assertSameOrigin(request);
  await destroyCustomerSession();
  return ok({ signedOut: true });
});
