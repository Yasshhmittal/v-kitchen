import { ok, route } from "@/server/api/response";
import { getDailyMenus, getSpecialMenus } from "@/server/services/menu.service";
import { toMenuView } from "@/server/services/mappers";
import { DAILY_SLOTS } from "@/lib/constants";

/**
 * GET /api/menus/today
 *
 * What's cooking right now, plus the rest of today and any live specials. The
 * "current" slot is derived from the clock so a widget can highlight it without
 * duplicating that rule.
 */
export const GET = route(async () => {
  const now = new Date();
  const hour = now.getHours();
  const currentSlot = hour < 11 ? "MORNING" : hour < 16 ? "AFTERNOON" : "EVENING";

  const [daily, specials] = await Promise.all([getDailyMenus(now), getSpecialMenus(now)]);

  return ok({
    date: now.toISOString(),
    currentSlot,
    slots: DAILY_SLOTS,
    daily: daily.map((entry) => toMenuView(entry.menu, now)),
    specials: specials.map((entry) => toMenuView(entry.menu, now)),
  });
});
