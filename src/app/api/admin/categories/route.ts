import { ok, created, route } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import { listCategories, createCategory } from "@/server/services/category.service";
import { categorySchema } from "@/server/validation/schemas";

/**
 * GET /api/admin/categories?type=MENU|PRODUCT&isActive=true
 *
 * List all categories, optionally filtered by type or active state. Unlike the
 * public route, this shows inactive categories too — they're hidden from the
 * site but stay in the admin so re-enabling one doesn't lose its history.
 */
export const GET = route(async (request: Request) => {
  await requireAdmin("menu.view");

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const isActiveParam = url.searchParams.get("isActive");

  const categories = await listCategories({
    type: type === "MENU" || type === "PRODUCT" ? type : undefined,
    isActive: isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined,
  });

  return ok(categories);
});

/** POST /api/admin/categories — create a new category. */
export const POST = route(async (request: Request) => {
  await assertCsrf(request);
  const session = await requireAdmin("categories.manage");

  const input = categorySchema.parse(await request.json());
  const category = await createCategory(input);

  await auditLog({
    session,
    action: "CREATE",
    entity: "category",
    entityId: category.id,
    after: { name: category.name, type: category.type, slug: category.slug },
  });

  return created(category);
});
