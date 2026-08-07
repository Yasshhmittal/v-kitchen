import { z } from "zod";

import { ok, created, route, buildPageMeta } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import { listProducts, createProduct } from "@/server/services/product.service";
import { productSchema } from "@/server/validation/schemas";
import { PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/admin/products?search=...&categoryId=...&page=1&pageSize=20&sort=name&order=asc
 *
 * Admin product list with search, filters, pagination and sort. Products are
 * the packaged goods — laddus, namkeens, festival boxes — separate from the
 * daily menu dishes.
 */

const querySchema = z.object({
  search: z.string().max(120).optional(),
  categoryId: z.string().optional(),
  isActive: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE),
  sort: z.string().max(20).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const GET = route(async (request: Request) => {
  await requireAdmin("menu.view");

  const url = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams));

  const { items, total } = await listProducts({
    search: query.search,
    categoryId: query.categoryId,
    isActive:
      query.isActive === "true" ? true : query.isActive === "false" ? false : undefined,
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
    order: query.order,
  });

  return ok(items, buildPageMeta(total, query.page, query.pageSize));
});

/** POST /api/admin/products — add a packaged product. */
export const POST = route(async (request: Request) => {
  await assertCsrf(request);
  const session = await requireAdmin("menu.manage");

  const input = productSchema.parse(await request.json());
  const product = await createProduct(input);

  await auditLog({
    session,
    action: "CREATE",
    entity: "product",
    entityId: product.id,
    after: { name: product.name, price: String(product.price), slug: product.slug },
  });

  return created(product);
});
