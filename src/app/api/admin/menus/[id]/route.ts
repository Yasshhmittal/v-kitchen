import { ok, noContent, route, ApiError } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import { getMenuById, updateMenu, deleteMenu } from "@/server/services/menu.service";
import { menuUpdateSchema } from "@/server/validation/schemas";

/** GET /api/admin/menus/:id — the menu plus its full composition. */
export const GET = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin("menu.view");
  const { id } = await params;

  const menu = await getMenuById(id);
  if (!menu) throw ApiError.notFound("That menu doesn't exist.");

  return ok(menu);
});

/**
 * PATCH /api/admin/menus/:id
 *
 * Publishing state and the dish list are both recorded: "who put this on the
 * site and when" is the question an audit log has to answer for a menu.
 */
export const PATCH = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await assertCsrf(request);
  const session = await requireAdmin("menu.manage");
  const { id } = await params;

  const before = await getMenuById(id);
  if (!before) throw ApiError.notFound("That menu doesn't exist.");

  const input = menuUpdateSchema.parse(await request.json());
  await updateMenu(id, input);

  const after = await getMenuById(id);

  await auditLog({
    session,
    action: "UPDATE",
    entity: "menu",
    entityId: id,
    before: {
      title: before.title,
      slot: before.slot,
      date: before.date?.toISOString() ?? null,
      isActive: before.isActive,
      itemCount: before.entries.length,
    },
    after: {
      title: after?.title,
      slot: after?.slot,
      date: after?.date?.toISOString() ?? null,
      isActive: after?.isActive,
      itemCount: after?.entries.length,
    },
  });

  return ok(after);
});

/**
 * DELETE /api/admin/menus/:id
 *
 * Entries cascade, so only this composition goes away — the dishes stay in the
 * catalogue and past orders keep their own snapshots.
 */
export const DELETE = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await assertCsrf(request);
  const session = await requireAdmin("menu.manage");
  const { id } = await params;

  const before = await getMenuById(id);
  if (!before) throw ApiError.notFound("That menu doesn't exist.");

  await deleteMenu(id);

  await auditLog({
    session,
    action: "DELETE",
    entity: "menu",
    entityId: id,
    before: {
      title: before.title,
      slot: before.slot,
      date: before.date?.toISOString() ?? null,
      itemCount: before.entries.length,
    },
  });

  return noContent();
});
