import { created, route } from "@/server/api/response";
import { assertSameOrigin } from "@/server/api/csrf";
import { rateLimit, requestIp } from "@/server/api/guards";
import { getCustomerSession } from "@/server/auth/session";
import { createOrder } from "@/server/services/order.service";
import { sendOrderPlacedNotifications } from "@/server/services/notify.service";
import { orderCreateSchema } from "@/server/validation/schemas";

/**
 * POST /api/orders — place an order.
 *
 * Works for guests and signed-in customers alike. The body carries item IDs and
 * quantities only; every price and the total are computed server-side, so a
 * tampered cart in localStorage changes nothing about what is charged.
 */
export const POST = route(async (request: Request) => {
  await assertSameOrigin(request);

  const ip = await requestIp();
  // Generous enough for a real person retrying a failed submit, tight enough
  // that a script cannot flood the kitchen with orders.
  rateLimit(`order:${ip}`, { limit: 8, windowMs: 10 * 60 * 1000 });

  const input = orderCreateSchema.parse(await request.json());
  const session = await getCustomerSession();

  const order = await createOrder(input, session?.customerId);

  // The order is committed; the confirmation is a courtesy on top of it. Awaited
  // so the send actually starts before this serverless invocation can be frozen,
  // but it resolves even when a provider is down — a failed receipt must never
  // report a placed order as failed, because the customer would order again.
  await sendOrderPlacedNotifications(order.id);

  return created({
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    total: order.total.toFixed(2),
    pickupDate: order.pickupDate.toISOString(),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
  });
});
