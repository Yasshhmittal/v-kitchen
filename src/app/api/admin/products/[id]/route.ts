import { ok, noContent, route, ApiError } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import {
  getProductById,
  updateProduct,
  deleteProduct,
} from "@/server/services/product.service";
import { productUpdateSchema } from "@/server/validation/schemas";

/** GET /api/admin/products/:id */
export const GET = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin("products.view");
  const { id } = await params;

  const product = await getProductById(id);
  if (!product) throw ApiError.notFound("That product doesn't exist.");

  return ok(product);
});

/**
 * PATCH /api/admin/products/:id
 *
 * Price and stock are recorded before/after: "why did this cost more last week"
 * and "when did we mark this out of stock" are both questions an audit log has
 * to be able to answer.
 */
export const PATCH = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await assertCsrf(request);
  const session = await requireAdmin("products.manage");
  const { id } = await params;

  const before = await getProductById(id);
  if (!before) throw ApiError.notFound("That product doesn't exist.");

  const input = productUpdateSchema.parse(await request.json());
  const updated = await updateProduct(id, input);

  await auditLog({
    session,
    action: "UPDATE",
    entity: "product",
    entityId: id,
    before: {
      name: before.name,
      price: String(before.price),
      discountPrice: before.discountPrice === null ? null : String(before.discountPrice),
      stockQty: before.stockQty,
      isActive: before.isActive,
    },
    after: {
      name: updated.name,
      price: String(updated.price),
      discountPrice: updated.discountPrice === null ? null : String(updated.discountPrice),
      stockQty: updated.stockQty,
      isActive: updated.isActive,
    },
  });

  return ok(updated);
});

/** DELETE /api/admin/products/:id — refused once it appears on any order. */
export const DELETE = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await assertCsrf(request);
  const session = await requireAdmin("products.manage");
  const { id } = await params;

  const before = await getProductById(id);
  if (!before) throw ApiError.notFound("That product doesn't exist.");

  await deleteProduct(id);

  await auditLog({
    session,
    action: "DELETE",
    entity: "product",
    entityId: id,
    before: { name: before.name, slug: before.slug, price: String(before.price) },
  });

  return noContent();
});
