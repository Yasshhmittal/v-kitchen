import bcrypt from "bcryptjs";

/**
 * Cost 12 is the current sensible balance: ~250ms per hash on typical
 * hardware, which is slow enough to make offline cracking expensive and fast
 * enough not to be a DoS vector on login.
 */
const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Compare against a dummy hash when no user was found, so the response time of
 * "unknown email" matches "wrong password". Without this, timing alone reveals
 * which email addresses have accounts.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.wjcSAiNTOtcvOxYqLBB4A1eV6cRxJ0O";

export async function fakeVerify(): Promise<void> {
  await bcrypt.compare("timing-equalizer", DUMMY_HASH);
}
