import { z } from "zod";

import { ok, created, route, buildPageMeta } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import { listMenuItems, createMenuItem } from "@/server/services/menu-item.service";
import { menuItemSchema } from "@/server/validation/schemas";
import { PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/admin/menu-items?search=...&categoryId=...&page=1&pageSize=20&sort=name&order=asc
 *
 * List menu items with pagination, search, and filters. The admin table needs
 * this for the main grid; creating a new menu pulls from the same endpoint.
 */

const querySchema = z.object({
  search: z.string().max(120).optional(),
  categoryId: z.string().optional(),
  isAvailable: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE),
  sort: z.string().max(20).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const GET = route(async (request: Request) => {
  await requireAdmin("menu.view");

  const url = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams));

  const { items, total } = await listMenuItems({
    search: query.search,
    categoryId: query.categoryId,
    isAvailable:
      query.isAvailable === "true" ? true : query.isAvailable === "false" ? false : undefined,
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
    order: query.order,
  });

  return ok(items, buildPageMeta(total, query.page, query.pageSize));
});

/** POST /api/admin/menu-items — add a dish to the catalogue. */
export const POST = route(async (request: Request) => {
  await assertCsrf(request);
  const session = await requireAdmin("menu.manage");

  const input = menuItemSchema.parse(await request.json());
  const item = await createMenuItem(input);

  await auditLog({
    session,
    action: "CREATE",
    entity: "menuItem",
    entityId: item.id,
    after: { name: item.name, price: String(item.price), slug: item.slug },
  });

  return created(item);
});
