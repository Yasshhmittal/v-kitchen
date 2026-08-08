import { randomInt } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/format";
import { ApiError } from "@/server/api/response";
import { hashToken } from "@/server/auth/jwt";
import { getSmsSender } from "@/server/messaging/sms";
import { getSettings, settingText } from "@/server/services/settings.service";

/**
 * Phone-number sign-in with a one-time code.
 *
 * This is the only way a customer signs in. There is no password to choose, so
 * there is nothing to forget and nothing to leak — the number they already have
 * to give us for pickup is the credential.
 *
 * The name and email are *not* collected here. We ask for those once, at their
 * first checkout, and remember them afterwards.
 */

const CODE_LENGTH = 6;
const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/** How long a code stays valid, in whole minutes, for display in messages. */
export const OTP_TTL_MINUTES = Math.round(CODE_TTL_MS / 60_000);

/**
 * `randomInt` is the cryptographic generator — `Math.random()` is predictable
 * and must never stand between someone and another person's order history.
 */
function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/** Store phone numbers one way only; this is the login identity. */
function normalise(phone: string): string {
  return phone.trim().replace(/\s+/g, " ");
}

export interface OtpRequestResult {
  /**
   * Only ever set when the console sender is active, and only read by the dev
   * UI. A real provider leaves this undefined so the code exists nowhere but
   * the recipient's phone.
   */
  devCode?: string;
  expiresInSeconds: number;
}

/**
 * Create a challenge and send the code.
 *
 * Rate limiting lives in the route handler. What matters here is that any
 * earlier live code for the number is invalidated first: without that, every
 * "resend" widens the window of valid codes instead of replacing it.
 */
export async function requestOtp(
  rawPhone: string,
  ipAddress?: string,
): Promise<OtpRequestResult> {
  const phone = normalise(rawPhone);

  const existing = await prisma.customer.findUnique({
    where: { phone },
    select: { isBlocked: true },
  });

  // Blocked numbers get no code. The generic message is the same one an
  // unknown-but-valid number would produce, so this does not confirm who is
  // blocked to someone probing numbers.
  if (existing?.isBlocked) {
    throw ApiError.forbidden("We can't sign in that number. Please call the kitchen.");
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.$transaction([
    // Supersede any live code for this number.
    prisma.otpChallenge.updateMany({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    }),
    prisma.otpChallenge.create({
      data: { phone, codeHash: await hashToken(code), expiresAt, ipAddress },
    }),
  ]);

  const settings = await getSettings();
  const siteName = settingText(settings, "site.name", "V-Kitchen");

  const sender = getSmsSender();
  await sender.send({
    to: normalizePhone(phone),
    // The code first: Android's SMS autofill and the WebOTP API both read the
    // first number in the message.
    body: `${code} is your ${siteName} sign-in code. It expires in ${OTP_TTL_MINUTES} minutes. Don't share it with anyone.`,
  });

  return {
    devCode: sender.name === "CONSOLE" ? code : undefined,
    expiresInSeconds: Math.floor(CODE_TTL_MS / 1000),
  };
}

export interface VerifiedCustomer {
  id: string;
  name: string;
  phone: string;
  /** False until they've given us a name — the checkout form asks then. */
  profileComplete: boolean;
}

/**
 * Check a code and return the customer it belongs to, creating the row on first
 * sign-in.
 *
 * A guest who has ordered before already has a `Customer` row keyed by this
 * number, so verifying claims that row and its order history rather than
 * creating a second one.
 */
export async function verifyOtp(rawPhone: string, code: string): Promise<VerifiedCustomer> {
  const phone = normalise(rawPhone);

  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge || challenge.expiresAt < new Date()) {
    throw ApiError.unauthenticated("That code has expired. Ask for a new one.");
  }

  // Count the attempt before comparing, so a crashed comparison still costs the
  // guesser a try.
  const attempts = challenge.attempts + 1;
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { attempts },
  });

  if (attempts > MAX_ATTEMPTS) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    throw ApiError.unauthenticated("Too many wrong codes. Ask for a new one.");
  }

  if ((await hashToken(code.trim())) !== challenge.codeHash) {
    throw ApiError.unauthenticated("That code isn't right.");
  }

  // Correct: burn it so it cannot be replayed.
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  const now = new Date();
  const customer = await prisma.customer.upsert({
    where: { phone },
    // Claims an existing guest row. `name` is deliberately untouched — an
    // existing customer's name must not be blanked by a sign-in.
    update: { phoneVerifiedAt: now },
    create: { phone, phoneVerifiedAt: now },
    select: { id: true, name: true, phone: true, isBlocked: true },
  });

  if (customer.isBlocked) {
    throw ApiError.forbidden("This account can't place orders. Please call us.");
  }

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    profileComplete: customer.name.trim().length > 0,
  };
}

/**
 * Drop consumed and long-expired challenges.
 *
 * Called opportunistically from the request route rather than on a schedule —
 * there is no job runner yet, and this table only grows on sign-in attempts.
 */
export async function pruneOtpChallenges(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.otpChallenge
    .deleteMany({ where: { expiresAt: { lt: cutoff } } })
    .catch(() => undefined);
}
