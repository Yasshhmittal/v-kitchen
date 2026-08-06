import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { ok, route } from "@/server/api/response";
import { toMenuItemView, toProductView } from "@/server/services/mappers";

/**
 * GET /api/search?q=
 *
 * Searches dishes and products in one call and returns them grouped, so the
 * navbar's search box can show both without two round trips.
 */

const querySchema = z.object({
  q: z.string().trim().min(2, "Type at least two characters").max(80),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const { q, limit } = querySchema.parse(Object.fromEntries(url.searchParams));

  const contains = { contains: q, mode: "insensitive" } as const;

  const [menuItems, products] = await Promise.all([
    prisma.menuItem.findMany({
      where: {
        isAvailable: true,
        OR: [{ name: contains }, { description: contains }, { tags: { has: q.toLowerCase() } }],
      },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
      take: limit,
      include: { category: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        OR: [{ name: contains }, { description: contains }, { tags: { has: q.toLowerCase() } }],
      },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
      take: limit,
      include: { category: { select: { name: true } }, variants: true },
    }),
  ]);

  return ok({
    query: q,
    menuItems: menuItems.map((item) => toMenuItemView(item)),
    products: products.map((product) => toProductView(product)),
    total: menuItems.length + products.length,
  });
});
