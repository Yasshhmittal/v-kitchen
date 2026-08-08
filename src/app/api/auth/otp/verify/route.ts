import { ok, route } from "@/server/api/response";
import { assertSameOrigin } from "@/server/api/csrf";
import { rateLimit, requestIp } from "@/server/api/guards";
import { createCustomerSession } from "@/server/auth/session";
import { verifyOtp } from "@/server/services/otp.service";
import { otpVerifySchema } from "@/server/validation/schemas";

/**
 * POST /api/auth/otp/verify — exchange a valid code for a session.
 *
 * The per-challenge attempt counter in `verifyOtp` is the real brute-force
 * defence; this rate limit is the coarser one that stops a client hammering the
 * endpoint across many freshly requested codes.
 */
export const POST = route(async (request: Request) => {
  await assertSameOrigin(request);

  const ip = await requestIp();
  rateLimit(`otp-verify:ip:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });

  const input = otpVerifySchema.parse(await request.json());
  const customer = await verifyOtp(input.phone, input.code);

  await createCustomerSession(customer);

  // `profileComplete` tells the client whether checkout still needs to ask for
  // a name and email, or whether we already have them on file.
  return ok({
    name: customer.name,
    phone: customer.phone,
    profileComplete: customer.profileComplete,
  });
});
