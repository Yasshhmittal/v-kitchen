import { z } from "zod";
import { CategoryType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ok, route } from "@/server/api/response";
import { toCategoryView } from "@/server/services/mappers";

/**
 * GET /api/categories?type=MENU|PRODUCT&nonEmpty=true
 *
 * `nonEmpty` skips categories with nothing published in them, which is what the
 * public filter chips want — an empty chip is a dead end.
 */

const querySchema = z.object({
  type: z.nativeEnum(CategoryType).optional(),
  nonEmpty: z.enum(["true", "false"]).default("false"),
});

export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams));

  const nonEmpty = query.nonEmpty === "true";

  const categories = await prisma.category.findMany({
    where: {
      isActive: true,
      ...(query.type ? { type: query.type } : {}),
      ...(nonEmpty && query.type === CategoryType.PRODUCT
        ? { products: { some: { isActive: true } } }
        : {}),
      ...(nonEmpty && query.type === CategoryType.MENU
        ? { menuItems: { some: { isAvailable: true } } }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { menuItems: true, products: true } } },
  });

  return ok(categories.map(toCategoryView));
});
