import { ok, route, ApiError } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import { prisma } from "@/lib/prisma";
import {
  deactivateUser,
  revokeUserSessions,
  updateUser,
} from "@/server/services/user.service";
import { userUpdateSchema } from "@/server/validation/schemas";

async function findUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
  });
  if (!user) throw ApiError.notFound("That staff account no longer exists.");
  return user;
}

/**
 * PATCH /api/admin/users/:id
 *
 * The service refuses to demote or deactivate the last active owner, and
 * refuses to let anyone deactivate themselves — both would lock the kitchen
 * out of its own dashboard.
 */
export const PATCH = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    await assertCsrf(request);
    const session = await requireAdmin("users.manage");
    const { id } = await params;

    const before = await findUser(id);
    const input = userUpdateSchema.parse(await request.json());

    const user = await updateUser(id, input, session.userId);

    // A new password, a demotion or a deactivation all mean the old sessions
    // should stop working now rather than when the access token expires.
    if (input.password || (input.role && input.role !== before.role) || input.isActive === false) {
      await revokeUserSessions(id);
    }

    await auditLog({
      session,
      action: "UPDATE",
      entity: "user",
      entityId: id,
      before: { name: before.name, email: before.email, role: before.role, isActive: before.isActive },
      after: {
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        // Recorded as a fact, never as a value.
        ...(input.password ? { passwordChanged: true } : {}),
      },
    });

    return ok(user);
  },
);

/**
 * DELETE /api/admin/users/:id — deactivate, not delete.
 *
 * Orders and audit rows point at the actor who made them; removing the row
 * would leave a year of history attributed to nobody.
 */
export const DELETE = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    await assertCsrf(request);
    const session = await requireAdmin("users.manage");
    const { id } = await params;

    const before = await findUser(id);
    const user = await deactivateUser(id, session.userId);
    await revokeUserSessions(id);

    await auditLog({
      session,
      action: "DEACTIVATE",
      entity: "user",
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive: user.isActive },
    });

    return ok(user);
  },
);
