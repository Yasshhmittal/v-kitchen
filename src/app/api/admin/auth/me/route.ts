import { ok, route } from "@/server/api/response";
import { requireAdmin } from "@/server/api/guards";
import { ROLE_PERMISSIONS } from "@/server/auth/rbac";

/** GET /api/admin/auth/me — the signed-in staff member and what they can do. */
export const GET = route(async () => {
  const session = await requireAdmin();

  return ok({
    name: session.name,
    email: session.email,
    role: session.role,
    permissions: ROLE_PERMISSIONS[session.role],
  });
});
