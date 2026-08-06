import { created, route } from "@/server/api/response";
import { assertSameOrigin } from "@/server/api/csrf";
import { rateLimit, requestIp } from "@/server/api/guards";
import { createBulkOrderRequest } from "@/server/services/request.service";
import { bulkOrderSchema } from "@/server/validation/schemas";

/** POST /api/bulk-orders — catering / party enquiry from the public form. */
export const POST = route(async (request: Request) => {
  await assertSameOrigin(request);

  const ip = await requestIp();
  rateLimit(`bulk:${ip}`, { limit: 5, windowMs: 30 * 60 * 1000 });

  const input = bulkOrderSchema.parse(await request.json());
  const saved = await createBulkOrderRequest(input);

  return created({ requestNo: saved.requestNo, status: saved.status });
});
