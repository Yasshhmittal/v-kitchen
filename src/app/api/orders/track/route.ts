import { ok, route } from "@/server/api/response";
import { assertSameOrigin } from "@/server/api/csrf";
import { rateLimit, requestIp } from "@/server/api/guards";
import { findOrderForTracking } from "@/server/services/order.service";
import { toOrderView } from "@/server/services/mappers";
import { orderLookupSchema } from "@/server/validation/schemas";

/**
 * POST /api/orders/track — look an order up by number *and* phone.
 *
 * Both are required and the rate limit is deliberately tight: with the order
 * number alone, sequential numbering would let anyone walk the whole order
 * book. POST rather than GET so the phone number stays out of server logs and
 * browser history.
 */
export const POST = route(async (request: Request) => {
  await assertSameOrigin(request);

  const ip = await requestIp();
  rateLimit(`track:${ip}`, { limit: 12, windowMs: 5 * 60 * 1000 });

  const { orderNo, phone } = orderLookupSchema.parse(await request.json());
  const order = await findOrderForTracking(orderNo, phone);

  return ok(toOrderView(order));
});
