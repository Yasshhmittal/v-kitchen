import { ok, noContent, route, ApiError } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import {
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem,
} from "@/server/services/menu-item.service";
import { menuItemUpdateSchema } from "@/server/validation/schemas";

/** GET /api/admin/menu-items/:id */
export const GET = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin("menu.view");
  const { id } = await params;

  const item = await getMenuItemById(id);
  if (!item) throw ApiError.notFound("That dish doesn't exist.");

  return ok(item);
});

/**
 * PATCH /api/admin/menu-items/:id
 *
 * The before/after price is recorded deliberately: "why did this cost more last
 * week" is the question an audit log has to be able to answer.
 */
export const PATCH = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await assertCsrf(request);
  const session = await requireAdmin("menu.manage");
  const { id } = await params;

  const before = await getMenuItemById(id);
  if (!before) throw ApiError.notFound("That dish doesn't exist.");

  const input = menuItemUpdateSchema.parse(await request.json());
  const updated = await updateMenuItem(id, input);

  await auditLog({
    session,
    action: "UPDATE",
    entity: "menuItem",
    entityId: id,
    before: {
      name: before.name,
      price: String(before.price),
      discountPrice: before.discountPrice === null ? null : String(before.discountPrice),
      isAvailable: before.isAvailable,
    },
    after: {
      name: updated.name,
      price: String(updated.price),
      discountPrice: updated.discountPrice === null ? null : String(updated.discountPrice),
      isAvailable: updated.isAvailable,
    },
  });

  return ok(updated);
});

/** DELETE /api/admin/menu-items/:id — refused while any menu still lists it. */
export const DELETE = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await assertCsrf(request);
  const session = await requireAdmin("menu.manage");
  const { id } = await params;

  const before = await getMenuItemById(id);
  if (!before) throw ApiError.notFound("That dish doesn't exist.");

  await deleteMenuItem(id);

  await auditLog({
    session,
    action: "DELETE",
    entity: "menuItem",
    entityId: id,
    before: { name: before.name, slug: before.slug, price: String(before.price) },
  });

  return noContent();
});
