import { z } from "zod";

import { ok, route } from "@/server/api/response";
import { requireCustomer } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import {
  getCustomerFavourites,
  getFavouriteIds,
  toggleFavourite,
} from "@/server/services/customer.service";

/**
 * GET /api/account/favourites — saved dishes and products.
 *
 * `?view=ids` answers with just the ids, which is all the heart buttons on a
 * listing page need; the default returns the full rows for the favourites page.
 */
export const GET = route(async (request: Request) => {
  const session = await requireCustomer();

  const view = new URL(request.url).searchParams.get("view");
  if (view === "ids") return ok(await getFavouriteIds(session.customerId));

  return ok(await getCustomerFavourites(session.customerId));
});

/**
 * POST /api/account/favourites — toggle one.
 *
 * One endpoint for both directions: the heart button doesn't track state, it
 * just says what was tapped and is told what the state became.
 */
const toggleSchema = z
  .object({
    menuItemId: z.string().cuid().optional(),
    productId: z.string().cuid().optional(),
  })
  .refine((value) => Boolean(value.menuItemId) !== Boolean(value.productId), {
    message: "Send exactly one of menuItemId or productId.",
  });

export const POST = route(async (request: Request) => {
  await assertCsrf(request);
  const session = await requireCustomer();

  const input = toggleSchema.parse(await request.json());
  return ok(await toggleFavourite(session.customerId, input));
});
