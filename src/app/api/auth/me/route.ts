import { prisma } from "@/lib/prisma";
import { ok, route } from "@/server/api/response";
import { getCustomerSession } from "@/server/auth/session";

/**
 * GET /api/auth/me — who is signed in, if anyone.
 *
 * Answers 200 with `null` rather than 401 when signed out: "not logged in" is
 * a normal state for this endpoint, not an error the client should surface.
 */
export const GET = route(async () => {
  const session = await getCustomerSession();
  if (!session) return ok(null);

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      addressNote: true,
      _count: { select: { orders: true, favourites: true } },
    },
  });

  if (!customer) return ok(null);

  return ok({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    addressNote: customer.addressNote,
    orderCount: customer._count.orders,
    favouriteCount: customer._count.favourites,
  });
});
