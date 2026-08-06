import type { MenuSlot, OrderStatus } from "@prisma/client";

/**
 * Plain shapes handed to client components.
 *
 * Prisma models carry `Decimal` and `Date` instances, which cannot cross the
 * server/client boundary — so every server component maps its rows into these
 * before rendering. Prices here are already resolved (discount and per-menu
 * override applied), which keeps pricing logic out of the UI.
 */

export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  icon: string | null;
  tintColor: string | null;
  itemCount: number;
}

export interface MenuItemView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  /** What the customer pays. */
  price: number;
  /** Struck-through original, when discounted. */
  compareAtPrice: number | null;
  unitLabel: string | null;
  isVeg: boolean;
  isSpecial: boolean;
  isAvailable: boolean;
  prepTimeMins: number;
  tags: string[];
  categoryName: string | null;
}

export interface ProductVariantView {
  id: string;
  label: string;
  price: number;
  compareAtPrice: number | null;
  weightGrams: number | null;
  inStock: boolean;
  stockQty: number | null;
}

export interface ProductView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  longDescription?: string | null;
  images: string[];
  price: number;
  compareAtPrice: number | null;
  weightLabel: string | null;
  isVeg: boolean;
  inStock: boolean;
  /** null when the owner does not track stock for this product. */
  stockQty: number | null;
  tags: string[];
  categoryName: string | null;
  variants: ProductVariantView[];
}

export interface MenuView {
  id: string;
  title: string;
  subtitle: string | null;
  slot: MenuSlot;
  bannerImage: string | null;
  orderCutoffTime: string | null;
  isPastCutoff: boolean;
  items: MenuItemView[];
}

export interface ReviewView {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  image: string | null;
  createdAt: string;
}

export interface PickupSlotView {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  /** false when the slot is full for the chosen date. */
  available: boolean;
  remaining: number | null;
}

export interface OrderItemView {
  id: string;
  /** Copied at order time — never re-read from the live item. */
  name: string;
  variantLabel: string | null;
  image: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderView {
  id: string;
  orderNo: string;
  status: OrderStatus;
  pickupDate: string;
  /** Resolved slot window, or the free-text time when no slots are configured. */
  pickupWindow: string | null;
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
  notes: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  cancelReason: string | null;
  placedAt: string;
  items: OrderItemView[];
}
