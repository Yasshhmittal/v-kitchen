import { z } from "zod";

import { ok, route } from "@/server/api/response";
import { getOrderableDates, getPickupSlotsForDate } from "@/server/services/pickup.service";

/**
 * GET /api/pickup-slots?date=yyyy-MM-dd
 *
 * Checkout calls this whenever the customer changes the date, because capacity
 * and the notice cut-off are both date-dependent. Also returns the bookable
 * date range so the form's min/max come from the owner's settings.
 */

const querySchema = z.object({
  date: z.coerce.date().optional(),
});

export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const { date } = querySchema.parse({ date: url.searchParams.get("date") ?? undefined });

  const [slots, range] = await Promise.all([
    getPickupSlotsForDate(date ?? new Date()),
    getOrderableDates(),
  ]);

  return ok({ slots, ...range });
});
