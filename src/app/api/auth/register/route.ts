import { created, route } from "@/server/api/response";
import { assertSameOrigin } from "@/server/api/csrf";
import { rateLimit, requestIp } from "@/server/api/guards";
import { createCustomerSession } from "@/server/auth/session";
import { registerCustomer } from "@/server/services/customer.service";
import { customerRegisterSchema } from "@/server/validation/schemas";

/** POST /api/auth/register — create a customer account and sign them in. */
export const POST = route(async (request: Request) => {
  await assertSameOrigin(request);

  const ip = await requestIp();
  rateLimit(`register:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });

  const input = customerRegisterSchema.parse(await request.json());
  const customer = await registerCustomer(input);

  await createCustomerSession(customer);

  return created({
    name: customer.name,
    phone: customer.phone,
    // True when we found existing guest orders under this number.
    claimedGuestHistory: customer.claimed,
  });
});
