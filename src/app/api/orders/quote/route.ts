import { z } from "zod";

import { ok, route } from "@/server/api/response";
import { assertSameOrigin } from "@/server/api/csrf";
import { priceOrderLines } from "@/server/services/order.service";
import { orderLineSchema } from "@/server/validation/schemas";
import { getSettings, settingNumber } from "@/server/services/settings.service";

/**
 * POST /api/orders/quote — re-price a cart without placing an order.
 *
 * Checkout calls this on load so the customer sees the same figures the server
 * will charge, including any price the owner changed while the cart sat open.
 * Sold-out items surface here as an error rather than as a surprise on submit.
 */

const bodySchema = z.object({
  items: z.array(orderLineSchema).min(1, "Add at least one item to your order"),
});

export const POST = route(async (request: Request) => {
  await assertSameOrigin(request);

  const { items } = bodySchema.parse(await request.json());
  const [{ lines, subtotal }, settings] = await Promise.all([
    priceOrderLines(items),
    getSettings(),
  ]);

  const minOrderValue = settingNumber(settings, "ordering.minOrderValue", 0);

  return ok({
    lines: lines.map((line) => ({
      kind: line.menuItemId ? "MENU_ITEM" : "PRODUCT",
      itemId: line.menuItemId ?? line.productId,
      variantId: line.productVariantId,
      name: line.nameSnapshot,
      variantLabel: line.variantSnapshot,
      image: line.imageSnapshot,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
    })),
    subtotal,
    minOrderValue,
    belowMinimum: minOrderValue > 0 && subtotal < minOrderValue,
  });
});
