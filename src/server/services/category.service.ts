import type { Category, CategoryType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/response";
import { uniqueSlug } from "./slug.service";
import type { CategoryInput } from "@/server/validation/schemas";

/**
 * Category CRUD.
 *
 * Categories organize menu items and products — the user sees them as filters
 * above the grid. A category with nothing in it is hidden from the public site
 * but stays in the admin, so making a new one and populating it later is fine.
 */

/** A category plus the counts the admin list column shows. */
export type CategoryWithCounts = Category & {
  _count: { menuItems: number; products: number };
};

export async function listCategories(filters?: {
  type?: CategoryType;
  isActive?: boolean;
}): Promise<CategoryWithCounts[]> {
  return prisma.category.findMany({
    where: {
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { menuItems: true, products: true } } },
  });
}

export async function getCategoryById(id: string): Promise<Category | null> {
  return prisma.category.findUnique({ where: { id } });
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const slug = await uniqueSlug("category", input.slug, input.name);

  return prisma.category.create({
    data: {
      name: input.name,
      slug,
      description: input.description || null,
      image: input.image || null,
      tintColor: input.tintColor || null,
      icon: input.icon || null,
      type: input.type,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
      isFeatured: input.isFeatured,
    },
  });
}

export async function updateCategory(id: string, input: Partial<CategoryInput>): Promise<Category> {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("That category doesn't exist.");

  // Slug only changes when explicitly set, and must stay unique.
  const slug =
    input.slug !== undefined
      ? await uniqueSlug("category", input.slug, input.name ?? existing.name, id)
      : undefined;

  return prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.image !== undefined ? { image: input.image || null } : {}),
      ...(input.tintColor !== undefined ? { tintColor: input.tintColor || null } : {}),
      ...(input.icon !== undefined ? { icon: input.icon || null } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
    },
  });
}

/**
 * Soft-delete: flip `isActive` to false so menu items and products stay linked.
 * An orphaned menu item is confusing; an inactive category is just hidden.
 */
export async function deleteCategory(id: string): Promise<void> {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { menuItems: true, products: true } } },
  });

  if (!existing) throw ApiError.notFound("That category doesn't exist.");

  if (existing._count.menuItems > 0 || existing._count.products > 0) {
    throw ApiError.conflict(
      `This category has ${existing._count.menuItems} menu items and ${existing._count.products} products. Move them first, then delete.`,
    );
  }

  await prisma.category.delete({ where: { id } });
}

export async function reorderCategories(ids: string[]): Promise<void> {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.category.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
}
