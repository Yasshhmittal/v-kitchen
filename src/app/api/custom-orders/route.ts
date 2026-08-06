import { created, route } from "@/server/api/response";
import { assertSameOrigin } from "@/server/api/csrf";
import { rateLimit, requestIp } from "@/server/api/guards";
import { createCustomOrderRequest } from "@/server/services/request.service";
import { customOrderSchema } from "@/server/validation/schemas";

/** POST /api/custom-orders — "make me this" enquiry from the public form. */
export const POST = route(async (request: Request) => {
  await assertSameOrigin(request);

  const ip = await requestIp();
  rateLimit(`custom:${ip}`, { limit: 5, windowMs: 30 * 60 * 1000 });

  const input = customOrderSchema.parse(await request.json());
  const saved = await createCustomOrderRequest(input);

  return created({ requestNo: saved.requestNo, status: saved.status });
});
