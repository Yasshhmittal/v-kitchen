import type { Prisma, Product } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/response";
import { uniqueSlug } from "./slug.service";
import type { ProductInput } from "@/server/validation/schemas";

/**
 * Packaged-product CRUD — laddus, namkeens, festival boxes.
 *
 * Unlike menu items these are stock-tracked and sold in weights, so a product
 * carries an image gallery and optional variants. `trackStock` decides whether
 * running out hides it: a made-to-order box is always available, a batch of
 * laddus is not.
 */

export type ProductWithCategory = Product & {
  category: { id: string; name: string; slug: string } | null;
  _count: { orderItems: number };
};

const listInclude = {
  category: { select: { id: true, name: true, slug: true } },
  _count: { select: { orderItems: true } },
} satisfies Prisma.ProductInclude;

export async function listProducts(filters: {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
  sort?: string;
  order?: "asc" | "desc";
}): Promise<{ items: ProductWithCategory[]; total: number }> {
  const where: Prisma.ProductWhereInput = {
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: listInclude,
      orderBy: buildOrderBy(filters.sort, filters.order),
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total };
}

function buildOrderBy(
  sort: string | undefined,
  order: "asc" | "desc" = "desc",
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ name: order }];
    case "price":
      return [{ price: order }];
    case "stockQty":
      return [{ stockQty: order }];
    case "createdAt":
      return [{ createdAt: order }];
    case "category":
      return [{ category: { name: order } }, { name: "asc" }];
    default:
      return [{ sortOrder: "asc" }, { name: "asc" }];
  }
}

export async function getProductById(id: string): Promise<ProductWithCategory | null> {
  return prisma.product.findUnique({ where: { id }, include: listInclude });
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const slug = await uniqueSlug("product", input.slug, input.name);

  return prisma.product.create({
    data: {
      name: input.name,
      slug,
      description: input.description || null,
      longDescription: input.longDescription || null,
      images: input.images,
      categoryId: input.categoryId || null,
      price: input.price,
      discountPrice: input.discountPrice ?? null,
      weightLabel: input.weightLabel || null,
      weightGrams: input.weightGrams ?? null,
      trackStock: input.trackStock,
      stockQty: input.stockQty,
      isVeg: input.isVeg,
      isActive: input.isActive,
      isFeatured: input.isFeatured,
      tags: input.tags,
      sortOrder: input.sortOrder,
    },
  });
}

export async function updateProduct(
  id: string,
  input: Partial<ProductInput>,
): Promise<Product> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("That product doesn't exist.");

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
      ? await uniqueSlug("product", input.slug, input.name ?? existing.name, id)
      : undefined;

  return prisma.product.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.longDescription !== undefined
        ? { longDescription: input.longDescription || null }
        : {}),
      ...(input.images !== undefined ? { images: input.images } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId || null } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.discountPrice !== undefined
        ? { discountPrice: input.discountPrice ?? null }
        : {}),
      ...(input.weightLabel !== undefined ? { weightLabel: input.weightLabel || null } : {}),
      ...(input.weightGrams !== undefined ? { weightGrams: input.weightGrams ?? null } : {}),
      ...(input.trackStock !== undefined ? { trackStock: input.trackStock } : {}),
      ...(input.stockQty !== undefined ? { stockQty: input.stockQty } : {}),
      ...(input.isVeg !== undefined ? { isVeg: input.isVeg } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

/**
 * Delete a product.
 * Refused once it has been ordered: the order lines keep their own name and
 * price snapshot, but the reporting FK would be lost. Deactivating instead
 * keeps history intact and takes it off the site just the same.
 */
export async function deleteProduct(id: string): Promise<void> {
  const existing = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { orderItems: true } } },
  });

  if (!existing) throw ApiError.notFound("That product doesn't exist.");

  if (existing._count.orderItems > 0) {
    throw ApiError.conflict(
      `This product is on ${existing._count.orderItems} order${existing._count.orderItems === 1 ? "" : "s"}. Turn it off instead of deleting so those orders keep their history.`,
    );
  }

  await prisma.product.delete({ where: { id } });
}

/** Toggle listing — the one-click action on the list row. */
export async function setProductActive(id: string, isActive: boolean): Promise<Product> {
  return prisma.product.update({ where: { id }, data: { isActive } });
}
