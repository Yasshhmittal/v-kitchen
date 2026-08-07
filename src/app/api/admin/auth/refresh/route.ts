import { ok, route, ApiError } from "@/server/api/response";
import { assertSameOrigin } from "@/server/api/csrf";
import { refreshAdminSession } from "@/server/auth/session";
import { ROLE_PERMISSIONS } from "@/server/auth/rbac";

/**
 * POST /api/admin/auth/refresh — exchange the refresh token for a new pair.
 *
 * Rotation is single-use: `refreshAdminSession` revokes the presented token
 * before issuing its replacement, so a stolen token stops working as soon as
 * the real client next refreshes.
 */
export const POST = route(async (request: Request) => {
  await assertSameOrigin(request);

  const session = await refreshAdminSession();
  if (!session) {
    throw ApiError.unauthenticated("Your session has expired. Please sign in again.");
  }

  return ok({
    name: session.name,
    email: session.email,
    role: session.role,
    permissions: ROLE_PERMISSIONS[session.role],
  });
});
