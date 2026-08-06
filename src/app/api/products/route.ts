import { z } from "zod";
import { CategoryType, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildPageMeta, ok, route } from "@/server/api/response";
import { toProductView } from "@/server/services/mappers";

/**
 * GET /api/products?category=&search=&sort=&page=&pageSize=
 *
 * Only active products are ever returned — the `isActive` flag is the owner's
 * hide switch, so it is applied here rather than being an optional filter.
 */

const querySchema = z.object({
  category: z.string().max(80).optional(),
  search: z.string().max(120).optional(),
  featured: z.enum(["true", "false"]).optional(),
  sort: z.enum(["default", "price-asc", "price-desc", "newest"]).default("default"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});

export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams));

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(query.category ? { category: { slug: query.category, type: CategoryType.PRODUCT } } : {}),
    ...(query.featured === "true" ? { isFeatured: true } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
            { tags: { has: query.search.toLowerCase() } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    query.sort === "price-asc"
      ? [{ price: "asc" }]
      : query.sort === "price-desc"
        ? [{ price: "desc" }]
        : query.sort === "newest"
          ? [{ createdAt: "desc" }]
          : [{ sortOrder: "asc" }, { createdAt: "desc" }];

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { category: { select: { name: true } }, variants: true },
    }),
  ]);

  return ok(
    products.map((product) => toProductView(product)),
    buildPageMeta(total, query.page, query.pageSize),
  );
});
