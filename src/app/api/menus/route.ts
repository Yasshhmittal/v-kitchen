import { z } from "zod";
import { MenuSlot } from "@prisma/client";

import { ok, route } from "@/server/api/response";
import { getDailyMenus, getSpecialMenus, getMenuForSlot } from "@/server/services/menu.service";
import { toMenuView } from "@/server/services/mappers";

/**
 * GET /api/menus?date=&slot=
 *
 * Without a slot: every menu live on that date, daily slots first. With one:
 * just that slot. The date defaults to today, which is what the site asks for
 * 99% of the time.
 */

const querySchema = z.object({
  date: z.coerce.date().optional(),
  slot: z.nativeEnum(MenuSlot).optional(),
});

export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const { date, slot } = querySchema.parse({
    date: url.searchParams.get("date") ?? undefined,
    slot: url.searchParams.get("slot") ?? undefined,
  });

  const forDate = date ?? new Date();

  if (slot) {
    const menu = await getMenuForSlot(slot, forDate);
    return ok(menu ? [toMenuView(menu, forDate)] : []);
  }

  const [daily, specials] = await Promise.all([
    getDailyMenus(forDate),
    getSpecialMenus(forDate),
  ]);

  return ok([...daily, ...specials].map((entry) => toMenuView(entry.menu, forDate)));
});
