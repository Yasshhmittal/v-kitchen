import type { MenuItem, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/response";
import { uniqueSlug } from "./slug.service";
import type { MenuItemInput } from "@/server/validation/schemas";

/**
 * Menu-item CRUD — the dishes themselves, independent of any menu.
 *
 * Items are reusable: the same dish can appear in Monday breakfast and next
 * Sunday's special, at a different price each time. That is why editing a dish
 * here never touches a menu, and why deleting one is refused while any menu
 * still lists it.
 */

export type MenuItemWithCategory = MenuItem & {
  category: { id: string; name: string; slug: string } | null;
  _count: { entries: number };
};

const listInclude = {
  category: { select: { id: true, name: true, slug: true } },
  _count: { select: { entries: true } },
} satisfies Prisma.MenuItemInclude;

export async function listMenuItems(filters: {
  search?: string;
  categoryId?: string;
  isAvailable?: boolean;
  page: number;
  pageSize: number;
  sort?: string;
  order?: "asc" | "desc";
}): Promise<{ items: MenuItemWithCategory[]; total: number }> {
  const where: Prisma.MenuItemWhereInput = {
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.isAvailable !== undefined ? { isAvailable: filters.isAvailable } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy = buildOrderBy(filters.sort, filters.order);

  const [items, total] = await Promise.all([
    prisma.menuItem.findMany({
      where,
      include: listInclude,
      orderBy,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.menuItem.count({ where }),
  ]);

  return { items, total };
}

function buildOrderBy(
  sort: string | undefined,
  order: "asc" | "desc" = "desc",
): Prisma.MenuItemOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ name: order }];
    case "price":
      return [{ price: order }];
    case "createdAt":
      return [{ createdAt: order }];
    case "category":
      return [{ category: { name: order } }, { name: "asc" }];
    default:
      return [{ sortOrder: "asc" }, { name: "asc" }];
  }
}

export async function getMenuItemById(id: string): Promise<MenuItemWithCategory | null> {
  return prisma.menuItem.findUnique({ where: { id }, include: listInclude });
}

export async function createMenuItem(input: MenuItemInput): Promise<MenuItem> {
  const slug = await uniqueSlug("menuItem", input.slug, input.name);

  return prisma.menuItem.create({
    data: {
      name: input.name,
      slug,
      description: input.description || null,
      image: input.image || null,
      categoryId: input.categoryId || null,
      price: input.price,
      discountPrice: input.discountPrice ?? null,
      unitLabel: input.unitLabel || null,
      isAvailable: input.isAvailable,
      prepTimeMins: input.prepTimeMins,
      isVeg: input.isVeg,
      isSpecial: input.isSpecial,
      isFeatured: input.isFeatured,
      tags: input.tags,
      sortOrder: input.sortOrder,
    },
  });
}

export async function updateMenuItem(
  id: string,
  input: Partial<MenuItemInput>,
): Promise<MenuItem> {
  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("That dish doesn't exist.");

  // A partial update can set discountPrice without price (or vice versa), so the
  // rule is re-checked against the merged values — the schema only sees the patch.
  const price = input.price ?? Number(existing.price);
  const discount =
    input.discountPrice !== undefined
      ? input.discountPrice
      : existing.discountPrice === null
        ? undefined
        : Number(existing.discountPrice);

  if (discount !== undefined && discount >= price) {
    throw ApiError.validation({
      discountPrice: "Offer price must be lower than the regular price",
    });
  }

  const slug =
    input.slug !== undefined
      ? await uniqueSlug("menuItem", input.slug, input.name ?? existing.name, id)
      : undefined;

  return prisma.menuItem.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.image !== undefined ? { image: input.image || null } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId || null } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.discountPrice !== undefined
        ? { discountPrice: input.discountPrice ?? null }
        : {}),
      ...(input.unitLabel !== undefined ? { unitLabel: input.unitLabel || null } : {}),
      ...(input.isAvailable !== undefined ? { isAvailable: input.isAvailable } : {}),
      ...(input.prepTimeMins !== undefined ? { prepTimeMins: input.prepTimeMins } : {}),
      ...(input.isVeg !== undefined ? { isVeg: input.isVeg } : {}),
      ...(input.isSpecial !== undefined ? { isSpecial: input.isSpecial } : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

/**
 * Delete a dish.
 *
 * Refused while any menu still lists it — removing it silently would change
 * what those menus show. Past orders are safe either way: order lines store
 * their own name and price snapshot rather than pointing at this row.
 */
export async function deleteMenuItem(id: string): Promise<void> {
  const existing = await prisma.menuItem.findUnique({
    where: { id },
    include: { _count: { select: { entries: true } } },
  });

  if (!existing) throw ApiError.notFound("That dish doesn't exist.");

  if (existing._count.entries > 0) {
    throw ApiError.conflict(
      `This dish is on ${existing._count.entries} menu${existing._count.entries === 1 ? "" : "s"}. Remove it from those menus first, or just mark it unavailable.`,
    );
  }

  await prisma.menuItem.delete({ where: { id } });
}

/** Toggle availability — the one-click action on the list row. */
export async function setMenuItemAvailability(
  id: string,
  isAvailable: boolean,
): Promise<MenuItem> {
  return prisma.menuItem.update({ where: { id }, data: { isAvailable } });
}
