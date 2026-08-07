import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/response";
import { fakeVerify, hashPassword, verifyPassword } from "@/server/auth/password";
import type { AdminLoginInput, UserCreateInput } from "@/server/validation/schemas";

/**
 * Staff accounts — the people who can sign in to /admin.
 *
 * Distinct from `Customer`, which is a person who orders food. A customer
 * account can never become staff by accident: they are separate tables with
 * separate session cookies.
 */

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * Verify staff credentials.
 *
 * The failure message is deliberately the same for "no such email" and "wrong
 * password", and an unknown email still pays the cost of a bcrypt comparison —
 * otherwise response timing would reveal which addresses have accounts.
 */
export async function authenticateAdmin(input: AdminLoginInput): Promise<AuthenticatedUser> {
  const email = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      passwordHash: true,
      isActive: true,
    },
  });

  if (!user) {
    await fakeVerify();
    throw ApiError.unauthenticated("That email or password isn't right.");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthenticated("That email or password isn't right.");
  }

  // Checked after the password so a disabled account cannot be probed without
  // knowing its password in the first place.
  if (!user.isActive) {
    throw ApiError.forbidden("This account has been deactivated. Ask the owner to re-enable it.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
}

export async function createUser(input: UserCreateInput) {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw ApiError.validation({ email: "An account with that email already exists." });
  }

  return prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      phone: input.phone?.trim() || null,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      isActive: input.isActive,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
}

/**
 * Update a staff account.
 *
 * Two safeguards the owner cannot bypass by mistake: the last active OWNER
 * cannot be demoted or deactivated, which would lock everyone out of settings
 * and user management permanently.
 */
export async function updateUser(
  id: string,
  input: Partial<UserCreateInput>,
  actorId: string,
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw ApiError.notFound("That staff account no longer exists.");

  const losingOwner =
    user.role === "OWNER" &&
    ((input.role !== undefined && input.role !== "OWNER") || input.isActive === false);

  if (losingOwner) {
    const otherOwners = await prisma.user.count({
      where: { role: "OWNER", isActive: true, id: { not: id } },
    });
    if (otherOwners === 0) {
      throw ApiError.conflict(
        "This is the only active owner account. Promote someone else to owner first.",
      );
    }
  }

  if (input.isActive === false && id === actorId) {
    throw ApiError.conflict("You can't deactivate your own account.");
  }

  const email = input.email?.trim().toLowerCase();
  if (email && email !== user.email) {
    const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (clash) throw ApiError.validation({ email: "An account with that email already exists." });
  }

  return prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(email ? { email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
}

/**
 * Deactivate rather than delete: order history and audit rows reference the
 * actor, and those must stay attributable after someone leaves.
 */
export async function deactivateUser(id: string, actorId: string) {
  if (id === actorId) throw ApiError.conflict("You can't deactivate your own account.");
  return updateUser(id, { isActive: false }, actorId);
}

/** Revoke every refresh token for a user — used on password change and lockout. */
export async function revokeUserSessions(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
