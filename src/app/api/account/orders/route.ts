import { ok, route } from "@/server/api/response";
import { requireCustomer } from "@/server/api/guards";
import { getCustomerOrders } from "@/server/services/customer.service";

/**
 * GET /api/account/orders — the signed-in customer's own orders.
 *
 * Scoped by the session, never by a query parameter: an id in the URL would let
 * anyone read anyone's order history by guessing.
 */
export const GET = route(async () => {
  const session = await requireCustomer();
  return ok(await getCustomerOrders(session.customerId));
});
