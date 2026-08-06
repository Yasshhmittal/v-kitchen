import { ok, route } from "@/server/api/response";
import { assertSameOrigin } from "@/server/api/csrf";
import { rateLimit, requestIp } from "@/server/api/guards";
import { createCustomerSession } from "@/server/auth/session";
import { authenticateCustomer } from "@/server/services/customer.service";
import { customerLoginSchema } from "@/server/validation/schemas";

/** POST /api/auth/login — customer sign-in (staff use /api/admin/auth/login). */
export const POST = route(async (request: Request) => {
  await assertSameOrigin(request);

  const ip = await requestIp();
  // Per-IP and per-account, so one attacker cannot spray a single account and
  // one account's failures cannot lock out a shared network.
  rateLimit(`login:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });

  const input = customerLoginSchema.parse(await request.json());
  rateLimit(`login:phone:${input.phone.replace(/\D/g, "")}`, {
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });

  const customer = await authenticateCustomer(input);
  await createCustomerSession(customer);

  return ok({ name: customer.name, phone: customer.phone });
});
