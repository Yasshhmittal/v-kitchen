import { ok, route } from "@/server/api/response";
import { assertSameOrigin } from "@/server/api/csrf";
import { rateLimit, requestIp } from "@/server/api/guards";
import { pruneOtpChallenges, requestOtp } from "@/server/services/otp.service";
import { otpRequestSchema } from "@/server/validation/schemas";

/**
 * POST /api/auth/otp/request — send a sign-in code to a phone number.
 *
 * Two rate limits, because they stop different things: the per-number one stops
 * someone being spammed with codes they didn't ask for, and the per-IP one
 * stops one machine walking through many numbers. Each SMS costs real money,
 * which makes this endpoint worth guarding more tightly than a login form.
 */
export const POST = route(async (request: Request) => {
  await assertSameOrigin(request);

  const ip = await requestIp();
  rateLimit(`otp:ip:${ip}`, { limit: 12, windowMs: 15 * 60 * 1000 });

  const input = otpRequestSchema.parse(await request.json());
  rateLimit(`otp:phone:${input.phone.replace(/\D/g, "")}`, {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  const result = await requestOtp(input.phone, ip);

  // Housekeeping on a low-traffic endpoint, since there is no job runner.
  void pruneOtpChallenges();

  // The response never says whether the number is already known — that would
  // turn this into a way to test which phone numbers have ordered here.
  return ok({
    sent: true,
    expiresInSeconds: result.expiresInSeconds,
    ...(result.devCode ? { devCode: result.devCode } : {}),
  });
});
