import { ok, route } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import { createUser, listUsers } from "@/server/services/user.service";
import { userCreateSchema } from "@/server/validation/schemas";

/**
 * GET /api/admin/users — staff accounts.
 *
 * The service selects explicit columns, so `passwordHash` never leaves the
 * database. There is no pagination: a home kitchen has a handful of staff, and
 * a list you can see all of at once is the point.
 */
export const GET = route(async () => {
  await requireAdmin("users.manage");
  return ok(await listUsers());
});

/** POST /api/admin/users — add a staff account. */
export const POST = route(async (request: Request) => {
  await assertCsrf(request);
  const session = await requireAdmin("users.manage");

  const input = userCreateSchema.parse(await request.json());
  const user = await createUser(input);

  // The password is deliberately absent from the audit row — a log that
  // records credentials is a second copy of them.
  await auditLog({
    session,
    action: "CREATE",
    entity: "user",
    entityId: user.id,
    after: { name: user.name, email: user.email, role: user.role, isActive: user.isActive },
  });

  return ok(user);
});
