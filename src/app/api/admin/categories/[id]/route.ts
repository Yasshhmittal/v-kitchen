import { ok, noContent, route, ApiError } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import {
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "@/server/services/category.service";
import { categoryUpdateSchema } from "@/server/validation/schemas";

/** GET /api/admin/categories/:id — one category, for populating the edit form. */
export const GET = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin("menu.view");
  const { id } = await params;

  const category = await getCategoryById(id);
  if (!category) throw ApiError.notFound("That category doesn't exist.");

  return ok(category);
});

/** PATCH /api/admin/categories/:id — partial update; only sent fields change. */
export const PATCH = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await assertCsrf(request);
  const session = await requireAdmin("categories.manage");
  const { id } = await params;

  const before = await getCategoryById(id);
  if (!before) throw ApiError.notFound("That category doesn't exist.");

  const input = categoryUpdateSchema.parse(await request.json());
  const updated = await updateCategory(id, input);

  await auditLog({
    session,
    action: "UPDATE",
    entity: "category",
    entityId: id,
    before: { name: before.name, type: before.type, isActive: before.isActive },
    after: { name: updated.name, type: updated.type, isActive: updated.isActive },
  });

  return ok(updated);
});

/**
 * DELETE /api/admin/categories/:id
 *
 * Refused while menu items or products still point here — the service reports
 * how many, so the owner knows what to move before trying again.
 */
export const DELETE = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await assertCsrf(request);
  const session = await requireAdmin("categories.manage");
  const { id } = await params;

  const before = await getCategoryById(id);
  if (!before) throw ApiError.notFound("That category doesn't exist.");

  await deleteCategory(id);

  await auditLog({
    session,
    action: "DELETE",
    entity: "category",
    entityId: id,
    before: { name: before.name, type: before.type, slug: before.slug },
  });

  return noContent();
});
