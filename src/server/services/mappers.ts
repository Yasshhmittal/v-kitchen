import type {
  Category,
  MenuItem,
  Order,
  OrderItem,
  PickupSlot,
  Prisma,
  Product,
  ProductVariant,
  Review,
} from "@prisma/client";

import { entryPrice, isPastCutoff, type MenuWithEntries } from "@/server/services/menu.service";
import { effectivePrice, formatTime24to12, toNumber } from "@/lib/format";
import type {
  CategoryView,
  MenuItemView,
  MenuView,
  OrderView,
  ProductVariantView,
  ProductView,
  ReviewView,
} from "@/types/view";

/**
 * Prisma row -> plain view model.
 *
 * These are the only place that unwraps `Decimal` and resolves which price a
 * customer actually pays, so no component ever has to decide between `price`
 * and `discountPrice`.
 */

export function toCategoryView(
  category: Category & { _count?: { menuItems?: number; products?: number } },
): CategoryView {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: category.image,
    icon: category.icon,
    tintColor: category.tintColor,
    itemCount: (category._count?.menuItems ?? 0) + (category._count?.products ?? 0),
  };
}

export function toMenuItemView(
  item: MenuItem & { category?: { name: string } | null },
  overrides?: { price?: number; compareAtPrice?: number | null; isAvailable?: boolean },
): MenuItemView {
  const base = toNumber(item.price);
  const paid = overrides?.price ?? effectivePrice(item.price, item.discountPrice);

  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description,
    image: item.image,
    price: paid,
    compareAtPrice:
      overrides?.compareAtPrice !== undefined ? overrides.compareAtPrice : paid < base ? base : null,
    unitLabel: item.unitLabel,
    isVeg: item.isVeg,
    isSpecial: item.isSpecial,
    isAvailable: overrides?.isAvailable ?? item.isAvailable,
    prepTimeMins: item.prepTimeMins,
    tags: item.tags,
    categoryName: item.category?.name ?? null,
  };
}

/** A composed menu, with each entry's per-menu price override applied. */
export function toMenuView(menu: MenuWithEntries, forDate: Date = new Date()): MenuView {
  return {
    id: menu.id,
    title: menu.title,
    subtitle: menu.subtitle,
    slot: menu.slot,
    bannerImage: menu.bannerImage,
    orderCutoffTime: menu.orderCutoffTime,
    isPastCutoff: isPastCutoff(menu, forDate),
    items: menu.entries
      .filter((entry) => entry.isAvailable)
      .map((entry) => {
        const { price, compareAt } = entryPrice(entry);
        return toMenuItemView(entry.menuItem, {
          price,
          compareAtPrice: compareAt,
          isAvailable: entry.isAvailable && entry.menuItem.isAvailable,
        });
      }),
  };
}

export function toProductVariantView(variant: ProductVariant): ProductVariantView {
  const base = toNumber(variant.price);
  const paid = effectivePrice(variant.price, variant.discountPrice);
  return {
    id: variant.id,
    label: variant.label,
    price: paid,
    compareAtPrice: paid < base ? base : null,
    weightGrams: variant.weightGrams,
    inStock: variant.stockQty > 0,
    stockQty: variant.stockQty,
  };
}

export function toProductView(
  product: Product & {
    category?: { name: string } | null;
    variants?: ProductVariant[];
  },
  options: { includeLongDescription?: boolean } = {},
): ProductView {
  const base = toNumber(product.price);
  const paid = effectivePrice(product.price, product.discountPrice);
  const variants = (product.variants ?? [])
    .filter((variant) => variant.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toProductVariantView);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    ...(options.includeLongDescription ? { longDescription: product.longDescription } : {}),
    images: product.images,
    // With variants, the card advertises the cheapest one ("from ₹120").
    price: variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : paid,
    compareAtPrice: variants.length > 0 ? null : paid < base ? base : null,
    weightLabel: product.weightLabel,
    isVeg: product.isVeg,
    // Untracked stock is always orderable — that is what trackStock: false means.
    inStock: product.trackStock ? product.stockQty > 0 : true,
    stockQty: product.trackStock ? product.stockQty : null,
    tags: product.tags,
    categoryName: product.category?.name ?? null,
    variants,
  };
}

export function toReviewView(review: Review): ReviewView {
  return {
    id: review.id,
    authorName: review.authorName,
    rating: review.rating,
    comment: review.comment,
    image: review.image,
    createdAt: review.createdAt.toISOString(),
  };
}

/**
 * An order as the customer sees it — on the confirmation page, the track page
 * and in their account history.
 *
 * Every line reads from its snapshot columns, never from the linked menu item
 * or product, so an order slip printed today still matches what was agreed.
 */
export function toOrderView(
  order: Order & { items: OrderItem[]; pickupSlot?: PickupSlot | null },
): OrderView {
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    pickupDate: order.pickupDate.toISOString(),
    pickupWindow: order.pickupSlot
      ? `${formatTime24to12(order.pickupSlot.startTime)} – ${formatTime24to12(order.pickupSlot.endTime)}`
      : order.pickupTime
        ? formatTime24to12(order.pickupTime)
        : null,
    subtotal: toNumber(order.subtotal),
    discount: toNumber(order.discount),
    total: toNumber(order.total),
    couponCode: order.couponCode,
    notes: order.notes,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    contactEmail: order.contactEmail,
    cancelReason: order.cancelReason,
    placedAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      name: item.nameSnapshot,
      variantLabel: item.variantSnapshot,
      image: item.imageSnapshot,
      unitPrice: toNumber(item.unitPrice),
      quantity: item.quantity,
      lineTotal: toNumber(item.lineTotal),
    })),
  };
}

/** Serialize a Decimal for JSON responses without losing precision to floats. */
export function decimalToString(value: Prisma.Decimal | null): string | null {
  return value ? value.toFixed(2) : null;
}
