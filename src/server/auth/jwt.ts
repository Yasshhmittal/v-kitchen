import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * JWT signing/verification using `jose`, which runs in both the Node and Edge
 * runtimes — important because `middleware.ts` (Edge) must verify the access
 * token without touching Prisma or bcrypt.
 */

export type Audience = "admin" | "customer";

export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  aud: Audience;
  role?: string;
  name?: string;
  email?: string;
}

function secret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"): Uint8Array {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(
      `${name} is missing or too short. Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
    );
  }
  return new TextEncoder().encode(value);
}

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "15m";

export async function signAccessToken(
  claims: Omit<AccessTokenClaims, "iat" | "exp">,
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("v-kitchen")
    .setExpirationTime(ACCESS_TTL)
    .sign(secret("JWT_ACCESS_SECRET"));
}

/** Returns null on any failure — expired, tampered, or wrong audience. */
export async function verifyAccessToken(
  token: string,
  audience: Audience,
): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret("JWT_ACCESS_SECRET"), {
      issuer: "v-kitchen",
    });
    if (payload.aud !== audience) return null;
    return payload as AccessTokenClaims;
  } catch {
    return null;
  }
}

/**
 * Refresh tokens are opaque random strings, not JWTs — they must be revocable,
 * which a self-contained token cannot be. We store only a SHA-256 hash, so a
 * leaked database dump cannot be replayed as a session.
 */
export function generateRefreshToken(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function refreshTokenExpiry(): Date {
  const days = Number.parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "7", 10);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Customer sessions last far longer than staff ones.
 *
 * The trade-offs are not the same. A staff token grants access to every order,
 * price and setting in the business, so it expires quickly. A customer token
 * grants access to one person's own order history — and the alternative to a
 * long session is asking someone to wait for an SMS every time they want to
 * reorder lunch, which is the friction this whole flow exists to remove.
 *
 * The token is still revocable (it is a hashed row, rotated on every use), so a
 * blocked customer stops working immediately regardless of expiry.
 */
export function customerRefreshTokenExpiry(): Date {
  const days = Number.parseInt(process.env.CUSTOMER_REFRESH_TOKEN_TTL_DAYS || "180", 10);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
