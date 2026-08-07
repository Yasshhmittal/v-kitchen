import { z } from "zod";
import { MenuSlot } from "@prisma/client";

import { ok, created, route, buildPageMeta } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import { listMenus, createMenu } from "@/server/services/menu.service";
import { menuSchema } from "@/server/validation/schemas";
import { PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/admin/menus?search=...&slot=MORNING&page=1&pageSize=20&sort=date&order=desc
 *
 * Admin menu list with search, filters, pagination and sort. Every menu is
 * included regardless of publish state — the table shows drafts and recurring
 * menus alongside today's pinned ones.
 */

const querySchema = z.object({
  search: z.string().max(120).optional(),
  slot: z.nativeEnum(MenuSlot).optional(),
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

  const { items, total } = await listMenus({
    search: query.search,
    slot: query.slot,
    isActive:
      query.isActive === "true" ? true : query.isActive === "false" ? false : undefined,
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
    order: query.order,
  });

  return ok(items, buildPageMeta(total, query.page, query.pageSize));
});

/** POST /api/admin/menus — compose a new menu. */
export const POST = route(async (request: Request) => {
  await assertCsrf(request);
  const session = await requireAdmin("menu.manage");

  const input = menuSchema.parse(await request.json());
  const menu = await createMenu(input);

  await auditLog({
    session,
    action: "CREATE",
    entity: "menu",
    entityId: menu.id,
    after: { title: menu.title, slot: menu.slot, date: menu.date?.toISOString() ?? null },
  });

  return created(menu);
});
