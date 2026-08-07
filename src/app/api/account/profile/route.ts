import { ok, route } from "@/server/api/response";
import { requireCustomer } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import { updateCustomerProfile } from "@/server/services/customer.service";
import { customerProfileSchema } from "@/server/validation/schemas";

/**
 * PATCH /api/account/profile — name, email and a pickup note.
 *
 * The phone number is deliberately not editable here: it is the login identity
 * and the key every past order is filed under, so changing it would hand
 * someone else's history to whoever typed the number.
 */
export const PATCH = route(async (request: Request) => {
  await assertCsrf(request);
  const session = await requireCustomer();

  const input = customerProfileSchema.parse(await request.json());

  return ok(await updateCustomerProfile(session.customerId, input));
});
