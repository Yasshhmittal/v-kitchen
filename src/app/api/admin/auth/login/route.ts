import { ok, route } from "@/server/api/response";
import { assertSameOrigin } from "@/server/api/csrf";
import { rateLimit, requestIp } from "@/server/api/guards";
import { createAdminSession } from "@/server/auth/session";
import { authenticateAdmin } from "@/server/services/user.service";
import { adminLoginSchema } from "@/server/validation/schemas";
import { ROLE_PERMISSIONS } from "@/server/auth/rbac";

/**
 * POST /api/admin/auth/login — staff sign-in.
 *
 * Reached before the middleware guard (it allowlists /api/admin/auth/*), since
 * you cannot be authenticated while logging in.
 */
export const POST = route(async (request: Request) => {
  await assertSameOrigin(request);

  const ip = await requestIp();
  rateLimit(`admin-login:${ip}`, { limit: 8, windowMs: 15 * 60 * 1000 });

  const input = adminLoginSchema.parse(await request.json());
  // Also per-account, so one attacker on a rotating IP cannot grind a single
  // known email address.
  rateLimit(`admin-login:email:${input.email.trim().toLowerCase()}`, {
    limit: 6,
    windowMs: 15 * 60 * 1000,
  });

  const user = await authenticateAdmin(input);
  await createAdminSession(user);

  return ok({
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: ROLE_PERMISSIONS[user.role],
  });
});
