import { z } from "zod";

import { ok, route, buildPageMeta } from "@/server/api/response";
import { requireAdmin } from "@/server/api/guards";
import { listCustomers } from "@/server/services/customer.service";
import { PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/admin/customers?search=...&hasAccount=true&page=1
 *
 * The kitchen's customer roll: who they are, how much they've actually spent
 * (completed orders only), and when they last collected. The figures are
 * aggregated rather than columnar, so the query runs on every page load.
 */

const querySchema = z.object({
  search: z.string().max(120).optional(),
  hasAccount: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  isBlocked: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE),
});

export const GET = route(async (request: Request) => {
  await requireAdmin("customers.view");

  const url = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams));

  const { rows, total } = await listCustomers(query);

  return ok(rows, buildPageMeta(total, query.page, query.pageSize));
});
