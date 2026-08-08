import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/response";
import type { CustomerProfileInput } from "@/server/validation/schemas";

/**
 * Customer accounts.
 *
 * There is no password anywhere here: customers sign in with a one-time code
 * sent to their phone (see `otp.service.ts`), and the `Customer` row is created
 * or claimed at that moment. A guest who has ordered before already has a row
 * keyed by the same number, so signing in inherits their order history rather
 * than starting a second identity.
 *
 * Name and email are not asked for at sign-in. `createOrder` writes them back
 * from the checkout form, so the second order already knows who you are.
 */

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

/**
 * Just the ids, for filling in the hearts on a listing page.
 *
 * The full favourites payload is a menu's worth of rows; the cards only need to
 * know which of them are already saved.
 */
export async function getFavouriteIds(
  customerId: string,
): Promise<{ menuItemIds: string[]; productIds: string[] }> {
  const rows = await prisma.favourite.findMany({
    where: { customerId },
    select: { menuItemId: true, productId: true },
  });

  return {
    menuItemIds: rows.map((row) => row.menuItemId).filter((id): id is string => id !== null),
    productIds: rows.map((row) => row.productId).filter((id): id is string => id !== null),
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

export type CustomerProfile = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  addressNote: string | null;
};

const profileSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  addressNote: true,
} as const;

export async function getCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
  return prisma.customer.findUnique({ where: { id: customerId }, select: profileSelect });
}

/**
 * The customer editing their own details.
 *
 * `phone` is not a parameter and never will be: it is the login identity and
 * the key past orders are filed under, so letting it be typed over would hand
 * one person's history to another. Changing it is a phone call to the kitchen.
 */
export async function updateCustomerProfile(
  customerId: string,
  input: CustomerProfileInput,
): Promise<CustomerProfile> {
  return prisma.customer.update({
    where: { id: customerId },
    data: {
      name: input.name,
      email: input.email ?? null,
      addressNote: input.addressNote ?? null,
    },
    select: profileSelect,
  });
}

/* -------------------------------------------------------------------------- */
/* admin views                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The customer list is a *derived* view: what the kitchen wants to know is how
 * much someone has actually spent and when they last collected, neither of
 * which is a column on `Customer`. Both are aggregated from completed orders
 * only — a cancelled order is not revenue, and counting it would overstate
 * every regular.
 */
export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isBlocked: boolean;
  /** True once they've signed in with a code — pure guests never have. */
  hasAccount: boolean;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
  createdAt: Date;
};

export async function listCustomers(params: {
  search?: string;
  hasAccount?: boolean;
  isBlocked?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: CustomerRow[]; total: number }> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  const where: Prisma.CustomerWhereInput = {
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" as const } },
            { phone: { contains: params.search } },
            { email: { contains: params.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(params.hasAccount === undefined
      ? {}
      : params.hasAccount
        ? { phoneVerifiedAt: { not: null } }
        : { phoneVerifiedAt: null }),
    ...(params.isBlocked === undefined ? {} : { isBlocked: params.isBlocked }),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        orders: {
          where: { status: "COMPLETED" },
          select: { total: true, createdAt: true },
        },
        _count: { select: { orders: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    total,
    rows: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      isBlocked: customer.isBlocked,
      hasAccount: Boolean(customer.phoneVerifiedAt),
      orderCount: customer._count.orders,
      totalSpent: customer.orders.reduce((sum, order) => sum + Number(order.total), 0),
      lastOrderAt:
        customer.orders.reduce<Date | null>(
          (latest, order) =>
            latest === null || order.createdAt > latest ? order.createdAt : latest,
          null,
        ) ?? null,
      createdAt: customer.createdAt,
    })),
  };
}

export type CustomerDetail = Prisma.CustomerGetPayload<{
  include: {
    orders: {
      include: { items: true; pickupSlot: true };
    };
    _count: { select: { favourites: true; reviews: true } };
  };
}>;

export async function getCustomerById(id: string): Promise<CustomerDetail | null> {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { items: true, pickupSlot: true },
      },
      _count: { select: { favourites: true, reviews: true } },
    },
  });
}

/**
 * Blocking is the only lever the admin has over a customer, and it is
 * deliberately reversible: no delete. Their past orders are business records,
 * and a phone number that has been blocked once may need unblocking after a
 * misunderstanding.
 */
export async function setCustomerBlocked(id: string, isBlocked: boolean) {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("That customer no longer exists.");

  return prisma.customer.update({
    where: { id },
    data: { isBlocked },
  });
}

/** Kitchen-facing notes on a customer — allergies, "always calls first", etc. */
export async function updateCustomerNote(id: string, addressNote: string | null) {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("That customer no longer exists.");

  return prisma.customer.update({
    where: { id },
    data: { addressNote },
  });
}
