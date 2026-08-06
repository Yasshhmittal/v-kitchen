import { Prisma, type Order, type OrderStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_TRANSITIONS, ORDER_STATUS_META } from "@/lib/constants";
import { ApiError } from "@/server/api/response";
import { getSettings, settingBool, settingNumber, settingText } from "./settings.service";
import { startOfDay } from "./menu.service";
import type { OrderCreateInput } from "@/server/validation/schemas";

/**
 * Order creation and lifecycle.
 *
 * The cardinal rule here: the browser sends identifiers and quantities, never
 * prices. Every amount is recomputed from the database, and the resulting line
 * items store a *snapshot* of the name and price — so when the owner edits a
 * price tomorrow, yesterday's orders and receipts do not silently change.
 */

export interface PricedLine {
  menuItemId: string | null;
  productId: string | null;
  productVariantId: string | null;
  nameSnapshot: string;
  imageSnapshot: string | null;
  variantSnapshot: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

/** Sequential per-day order number, e.g. VK-260806-0007. */
async function nextOrderNo(tx: Prisma.TransactionClient): Promise<string> {
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const countToday = await tx.order.count({
    where: { createdAt: { gte: today, lt: tomorrow } },
  });

  const stamp = today.toISOString().slice(2, 10).replace(/-/g, "");
  return `VK-${stamp}-${String(countToday + 1).padStart(4, "0")}`;
}

/**
 * Look every line up in the database and price it. Throws with a specific,
 * customer-readable message for anything unavailable, so the checkout page can
 * tell them exactly which item to remove.
 */
export async function priceOrderLines(
  lines: OrderCreateInput["items"],
): Promise<{ lines: PricedLine[]; subtotal: number }> {
  const menuItemIds = lines.filter((l) => l.kind === "MENU_ITEM").map((l) => l.itemId);
  const productIds = lines.filter((l) => l.kind === "PRODUCT").map((l) => l.itemId);

  const [menuItems, products] = await Promise.all([
    menuItemIds.length
      ? prisma.menuItem.findMany({ where: { id: { in: menuItemIds } } })
      : Promise.resolve([]),
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          include: { variants: true },
        })
      : Promise.resolve([]),
  ]);

  const menuItemById = new Map(menuItems.map((i) => [i.id, i]));
  const productById = new Map(products.map((p) => [p.id, p]));

  const priced: PricedLine[] = [];

  for (const line of lines) {
    if (line.kind === "MENU_ITEM") {
      const item = menuItemById.get(line.itemId);
      if (!item) throw ApiError.badRequest("One of the dishes in your order is no longer on the menu.");
      if (!item.isAvailable) throw ApiError.conflict(`"${item.name}" has just sold out. Please remove it to continue.`);

      const base = item.price.toNumber();
      const discounted = item.discountPrice?.toNumber() ?? 0;
      const unitPrice = discounted > 0 && discounted < base ? discounted : base;

      priced.push({
        menuItemId: item.id,
        productId: null,
        productVariantId: null,
        nameSnapshot: item.name,
        imageSnapshot: item.image,
        variantSnapshot: null,
        unitPrice,
        quantity: line.quantity,
        lineTotal: round2(unitPrice * line.quantity),
      });
      continue;
    }

    const product = productById.get(line.itemId);
    if (!product) throw ApiError.badRequest("One of the products in your order is no longer available.");
    if (!product.isActive) throw ApiError.conflict(`"${product.name}" is no longer available. Please remove it to continue.`);

    if (line.variantId) {
      const variant = product.variants.find((v) => v.id === line.variantId);
      if (!variant || !variant.isActive) {
        throw ApiError.conflict(`That size of "${product.name}" is no longer available.`);
      }
      if (variant.stockQty > 0 && line.quantity > variant.stockQty) {
        throw ApiError.conflict(
          `Only ${variant.stockQty} of "${product.name} — ${variant.label}" left. Please reduce the quantity.`,
        );
      }

      const base = variant.price.toNumber();
      const discounted = variant.discountPrice?.toNumber() ?? 0;
      const unitPrice = discounted > 0 && discounted < base ? discounted : base;

      priced.push({
        menuItemId: null,
        productId: product.id,
        productVariantId: variant.id,
        nameSnapshot: product.name,
        imageSnapshot: product.images[0] ?? null,
        variantSnapshot: variant.label,
        unitPrice,
        quantity: line.quantity,
        lineTotal: round2(unitPrice * line.quantity),
      });
      continue;
    }

    if (product.trackStock && line.quantity > product.stockQty) {
      throw ApiError.conflict(
        product.stockQty === 0
          ? `"${product.name}" is out of stock. Please remove it to continue.`
          : `Only ${product.stockQty} of "${product.name}" left. Please reduce the quantity.`,
      );
    }

    const base = product.price.toNumber();
    const discounted = product.discountPrice?.toNumber() ?? 0;
    const unitPrice = discounted > 0 && discounted < base ? discounted : base;

    priced.push({
      menuItemId: null,
      productId: product.id,
      productVariantId: null,
      nameSnapshot: product.name,
      imageSnapshot: product.images[0] ?? null,
      variantSnapshot: product.weightLabel,
      unitPrice,
      quantity: line.quantity,
      lineTotal: round2(unitPrice * line.quantity),
    });
  }

  return { lines: priced, subtotal: round2(priced.reduce((sum, l) => sum + l.lineTotal, 0)) };
}

/** Validate and apply a coupon. Returns 0 when no code was supplied. */
async function resolveCoupon(
  code: string | undefined,
  subtotal: number,
): Promise<{ couponId: string | null; couponCode: string | null; discount: number }> {
  if (!code) return { couponId: null, couponCode: null, discount: 0 };

  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase().trim() } });
  const now = new Date();

  if (
    !coupon ||
    !coupon.isActive ||
    (coupon.startsAt && coupon.startsAt > now) ||
    (coupon.expiresAt && coupon.expiresAt < now)
  ) {
    throw ApiError.badRequest("That coupon code isn't valid.");
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw ApiError.badRequest("That coupon has already been fully used.");
  }
  if (coupon.minOrder && subtotal < coupon.minOrder.toNumber()) {
    throw ApiError.badRequest(
      `That coupon needs a minimum order of ${coupon.minOrder.toNumber()}.`,
    );
  }

  let discount =
    coupon.discountType === "PERCENT"
      ? (subtotal * coupon.value.toNumber()) / 100
      : coupon.value.toNumber();

  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount.toNumber());
  discount = round2(Math.min(discount, subtotal));

  return { couponId: coupon.id, couponCode: coupon.code, discount };
}

/** Check the pickup date/slot against the owner's ordering rules. */
async function validatePickup(input: OrderCreateInput, subtotal: number): Promise<void> {
  const settings = await getSettings();

  if (!settingBool(settings, "ordering.enabled", true)) {
    throw ApiError.conflict(
      settingText(settings, "ordering.pausedMessage", "We're not taking online orders right now."),
    );
  }

  const minOrderValue = settingNumber(settings, "ordering.minOrderValue", 0);
  if (minOrderValue > 0 && subtotal < minOrderValue) {
    throw ApiError.badRequest(`Minimum order value is ${minOrderValue}.`);
  }

  const pickupDay = startOfDay(input.pickupDate);
  const today = startOfDay();

  if (pickupDay < today) {
    throw ApiError.badRequest("Choose a pickup date that hasn't already passed.");
  }

  const maxAdvanceDays = settingNumber(settings, "ordering.maxAdvanceDays", 14);
  const latest = new Date(today);
  latest.setDate(latest.getDate() + maxAdvanceDays);
  if (pickupDay > latest) {
    throw ApiError.badRequest(`Orders can be placed up to ${maxAdvanceDays} days ahead.`);
  }

  if (input.pickupSlotId) {
    const slot = await prisma.pickupSlot.findUnique({ where: { id: input.pickupSlotId } });
    if (!slot || !slot.isActive) throw ApiError.badRequest("That pickup slot is no longer available.");

    // Capacity: 0 means unlimited.
    if (slot.maxOrders > 0) {
      const taken = await prisma.order.count({
        where: {
          pickupSlotId: slot.id,
          pickupDate: pickupDay,
          status: { notIn: ["CANCELLED"] },
        },
      });
      if (taken >= slot.maxOrders) {
        throw ApiError.conflict("That pickup slot is fully booked. Please choose another time.");
      }
    }

    // Enforce minimum notice against the slot's end time — there is no point
    // booking a window that is already closing.
    if (pickupDay.getTime() === today.getTime()) {
      const minLead = settingNumber(settings, "ordering.minLeadMinutes", 45);
      const [h, m] = slot.endTime.split(":");
      const slotEnd = new Date();
      slotEnd.setHours(Number.parseInt(h ?? "23", 10), Number.parseInt(m ?? "59", 10), 0, 0);
      if (slotEnd.getTime() - Date.now() < minLead * 60 * 1000) {
        throw ApiError.conflict(
          `We need at least ${minLead} minutes' notice. Please choose a later slot.`,
        );
      }
    }
  }
}

/**
 * Create an order. Everything happens in one transaction: the customer upsert,
 * the order, its snapshot lines, stock decrements and the admin notification.
 */
export async function createOrder(
  input: OrderCreateInput,
  customerId?: string,
): Promise<Order & { items: Array<{ nameSnapshot: string; quantity: number }> }> {
  const { lines, subtotal } = await priceOrderLines(input.items);
  await validatePickup(input, subtotal);

  const { couponId, couponCode, discount } = await resolveCoupon(input.couponCode, subtotal);
  const total = round2(subtotal - discount);

  return prisma.$transaction(async (tx) => {
    // Guest checkout still creates a customer record, keyed by phone, so the
    // owner sees repeat customers and the person can claim the history later.
    const customer = customerId
      ? await tx.customer.update({
          where: { id: customerId },
          data: { name: input.contactName, email: input.contactEmail ?? undefined },
        })
      : await tx.customer.upsert({
          where: { phone: input.contactPhone },
          create: {
            name: input.contactName,
            phone: input.contactPhone,
            email: input.contactEmail,
          },
          update: { name: input.contactName, email: input.contactEmail ?? undefined },
        });

    if (customer.isBlocked) {
      throw ApiError.forbidden("We can't accept orders from this account. Please call us.");
    }

    const order = await tx.order.create({
      data: {
        orderNo: await nextOrderNo(tx),
        customerId: customer.id,
        pickupDate: startOfDay(input.pickupDate),
        pickupSlotId: input.pickupSlotId ?? null,
        pickupTime: input.pickupTime ?? null,
        subtotal: new Prisma.Decimal(subtotal),
        discount: new Prisma.Decimal(discount),
        total: new Prisma.Decimal(total),
        couponId,
        couponCode,
        notes: input.notes ?? null,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail ?? null,
        items: {
          create: lines.map((line) => ({
            menuItemId: line.menuItemId,
            productId: line.productId,
            productVariantId: line.productVariantId,
            nameSnapshot: line.nameSnapshot,
            imageSnapshot: line.imageSnapshot,
            variantSnapshot: line.variantSnapshot,
            unitPrice: new Prisma.Decimal(line.unitPrice),
            quantity: line.quantity,
            lineTotal: new Prisma.Decimal(line.lineTotal),
          })),
        },
      },
      include: { items: { select: { nameSnapshot: true, quantity: true } } },
    });

    // Decrement stock for tracked products only.
    for (const line of lines) {
      if (line.productVariantId) {
        await tx.productVariant.updateMany({
          where: { id: line.productVariantId, stockQty: { gt: 0 } },
          data: { stockQty: { decrement: line.quantity } },
        });
      } else if (line.productId) {
        await tx.product.updateMany({
          where: { id: line.productId, trackStock: true },
          data: { stockQty: { decrement: line.quantity } },
        });
      }
    }

    if (couponId) {
      await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
    }

    await tx.notification.create({
      data: {
        type: "ORDER_PLACED",
        title: `New order ${order.orderNo}`,
        body: `${input.contactName} · ${lines.length} item${lines.length === 1 ? "" : "s"} · ${total}`,
        link: `/admin/orders/${order.id}`,
        meta: { orderId: order.id, orderNo: order.orderNo },
      },
    });

    return order;
  });
}

/**
 * Move an order to a new status, refusing illegal jumps. Without this a
 * crafted request could resurrect a cancelled order.
 */
export async function updateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
  extra?: { cancelReason?: string; adminNotes?: string },
): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw ApiError.notFound("That order no longer exists.");

  if (order.status === nextStatus) return order;

  const allowed = ORDER_STATUS_TRANSITIONS[order.status];
  if (!allowed.includes(nextStatus)) {
    throw ApiError.conflict(
      `An order that is ${ORDER_STATUS_META[order.status].label.toLowerCase()} can't be moved to ${ORDER_STATUS_META[nextStatus].label.toLowerCase()}.`,
    );
  }

  const now = new Date();
  const timestamps: Partial<Record<string, Date>> = {};
  if (nextStatus === "ACCEPTED") timestamps.acceptedAt = now;
  if (nextStatus === "READY_FOR_PICKUP") timestamps.readyAt = now;
  if (nextStatus === "COMPLETED") timestamps.completedAt = now;
  if (nextStatus === "CANCELLED") timestamps.cancelledAt = now;

  return prisma.$transaction(async (tx) => {
    // Cancelling returns stock so the shop's counts stay honest.
    if (nextStatus === "CANCELLED") {
      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const item of items) {
        if (item.productVariantId) {
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stockQty: { increment: item.quantity } },
          });
        } else if (item.productId) {
          await tx.product.updateMany({
            where: { id: item.productId, trackStock: true },
            data: { stockQty: { increment: item.quantity } },
          });
        }
      }
    }

    return tx.order.update({
      where: { id: orderId },
      data: {
        status: nextStatus,
        cancelReason: nextStatus === "CANCELLED" ? extra?.cancelReason ?? null : undefined,
        adminNotes: extra?.adminNotes ?? undefined,
        ...timestamps,
      },
    });
  });
}

/**
 * Public order lookup. Requires both the order number and the phone it was
 * placed with, so order numbers alone cannot be enumerated.
 */
export async function findOrderForTracking(orderNo: string, phone: string) {
  const order = await prisma.order.findUnique({
    where: { orderNo: orderNo.trim().toUpperCase() },
    include: { items: true, pickupSlot: true },
  });

  const digits = (value: string) => value.replace(/\D/g, "");
  if (!order || digits(order.contactPhone) !== digits(phone)) {
    throw ApiError.notFound("We couldn't find an order with those details.");
  }

  return order;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
