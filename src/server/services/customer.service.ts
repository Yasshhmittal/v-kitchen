import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/response";
import { fakeVerify, hashPassword, verifyPassword } from "@/server/auth/password";
import type { CustomerLoginInput, CustomerRegisterInput } from "@/server/validation/schemas";

/**
 * Customer accounts.
 *
 * A `Customer` row already exists for anyone who has checked out as a guest,
 * keyed by phone number. Registering therefore *claims* that row rather than
 * creating a second one — which is what preserves a guest's order history when
 * they later decide to sign up.
 */

export async function registerCustomer(input: CustomerRegisterInput) {
  const phone = normalise(input.phone);
  const existing = await prisma.customer.findUnique({ where: { phone } });

  if (existing?.passwordHash) {
    throw ApiError.conflict("An account already exists for that number. Try signing in instead.");
  }
  if (existing?.isBlocked) {
    throw ApiError.forbidden("We can't create an account for that number. Please call us.");
  }

  const passwordHash = await hashPassword(input.password);

  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          email: input.email ?? existing.email,
          passwordHash,
        },
      })
    : await prisma.customer.create({
        data: {
          name: input.name,
          phone,
          email: input.email ?? null,
          passwordHash,
        },
      });

  return { id: customer.id, name: customer.name, phone: customer.phone, claimed: Boolean(existing) };
}

export async function authenticateCustomer(input: CustomerLoginInput) {
  const customer = await prisma.customer.findUnique({
    where: { phone: normalise(input.phone) },
  });

  // Same generic message and comparable timing whether the number is unknown
  // or the password is wrong — otherwise this endpoint confirms who has an
  // account here.
  if (!customer?.passwordHash) {
    await fakeVerify();
    throw ApiError.unauthenticated("That phone number or password isn't right.");
  }

  const valid = await verifyPassword(input.password, customer.passwordHash);
  if (!valid) throw ApiError.unauthenticated("That phone number or password isn't right.");
  if (customer.isBlocked) throw ApiError.forbidden("This account can't place orders. Please call us.");

  return { id: customer.id, name: customer.name, phone: customer.phone };
}

/** Orders for the account screen, newest first. */
export async function getCustomerOrders(customerId: string, limit = 30) {
  return prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { items: true, pickupSlot: true },
  });
}

export async function getCustomerFavourites(customerId: string) {
  const favourites = await prisma.favourite.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      menuItem: { include: { category: { select: { name: true } } } },
      product: { include: { category: { select: { name: true } }, variants: true } },
    },
  });

  return {
    // A favourite whose item was deleted is dropped rather than rendered blank.
    menuItems: favourites.map((f) => f.menuItem).filter((item) => item !== null),
    products: favourites.map((f) => f.product).filter((product) => product !== null),
  };
}

/** Add or remove in one call — the heart button has no idea which it is. */
export async function toggleFavourite(
  customerId: string,
  target: { menuItemId?: string; productId?: string },
): Promise<{ favourited: boolean }> {
  if (!target.menuItemId && !target.productId) {
    throw ApiError.badRequest("Nothing to favourite.");
  }

  const where = target.menuItemId
    ? { customerId_menuItemId: { customerId, menuItemId: target.menuItemId } }
    : { customerId_productId: { customerId, productId: target.productId! } };

  const existing = await prisma.favourite.findUnique({ where });

  if (existing) {
    await prisma.favourite.delete({ where: { id: existing.id } });
    return { favourited: false };
  }

  await prisma.favourite.create({
    data: {
      customerId,
      menuItemId: target.menuItemId ?? null,
      productId: target.productId ?? null,
    },
  });
  return { favourited: true };
}

/** Phone numbers are the login identity, so store them one way only. */
function normalise(phone: string): string {
  return phone.trim().replace(/\s+/g, " ");
}
