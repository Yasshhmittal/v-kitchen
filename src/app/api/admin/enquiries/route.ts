import { z } from "zod";
import { RequestStatus } from "@prisma/client";

import { ok, route, buildPageMeta } from "@/server/api/response";
import { requireAdmin } from "@/server/api/guards";
import { listRequests, countRequestsByStatus } from "@/server/services/request.service";
import { PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/admin/enquiries?kind=BULK&status=NEW&search=...&page=1
 *
 * Bulk and custom enquiries as one inbox. `kind` narrows to a single table;
 * without it both are merged. Counts ride along in the meta so the status chips
 * stay accurate without a second request per filter change.
 */

const querySchema = z.object({
  kind: z.enum(["BULK", "CUSTOM"]).optional(),
  status: z.nativeEnum(RequestStatus).optional(),
  search: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE),
});

export const GET = route(async (request: Request) => {
  // STAFF may read enquiries but not answer them — quoting is the owner's call.
  await requireAdmin("requests.view");

  const url = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams));

  const [{ rows, total }, counts] = await Promise.all([
    listRequests(query),
    countRequestsByStatus(query.kind),
  ]);

  return ok(rows, { ...buildPageMeta(total, query.page, query.pageSize), counts });
});
