import { z } from "zod";
import { OrderStatus } from "@prisma/client";

import { ok, route, buildPageMeta } from "@/server/api/response";
import { requireAdmin } from "@/server/api/guards";
import { listOrders, countOrdersByStatus } from "@/server/services/order.service";
import { PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/admin/orders?search=...&status=PENDING&pickupDate=2026-08-07&page=1
 *
 * The orders board. `counts` rides along in the meta so the status chips stay
 * accurate without a second request per filter change.
 */

const querySchema = z.object({
  search: z.string().max(120).optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  pickupDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE),
  sort: z.string().max(20).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const GET = route(async (request: Request) => {
  // STAFF can work the board — that's the whole point of the role.
  await requireAdmin("orders.view");

  const url = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams));

  const [{ items, total }, counts] = await Promise.all([
    listOrders({
      search: query.search,
      status: query.status,
      pickupDate: query.pickupDate,
      page: query.page,
      pageSize: query.pageSize,
      sort: query.sort,
      order: query.order,
    }),
    countOrdersByStatus(),
  ]);

  return ok(items, { ...buildPageMeta(total, query.page, query.pageSize), counts });
});
