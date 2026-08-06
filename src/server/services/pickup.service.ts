import { prisma } from "@/lib/prisma";
import { formatTime24to12 } from "@/lib/format";
import type { PickupSlotView } from "@/types/view";
import { startOfDay } from "./menu.service";
import { getSettings, settingNumber } from "./settings.service";

/**
 * Pickup windows for a given date.
 *
 * A slot can be unavailable for two reasons: it is already full, or it closes
 * too soon to cook the order. Both are decided here so checkout, the API and
 * the admin all agree — and the same rules are re-checked when the order is
 * actually created, since a slot can fill up while someone fills in the form.
 */

export async function getPickupSlotsForDate(date: Date): Promise<PickupSlotView[]> {
  const day = startOfDay(date);
  const today = startOfDay();
  const isToday = day.getTime() === today.getTime();

  const [slots, settings] = await Promise.all([
    prisma.pickupSlot.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }],
    }),
    getSettings(),
  ]);

  if (slots.length === 0) return [];

  const minLead = settingNumber(settings, "ordering.minLeadMinutes", 45);

  const counts = await prisma.order.groupBy({
    by: ["pickupSlotId"],
    where: {
      pickupDate: day,
      status: { notIn: ["CANCELLED"] },
      pickupSlotId: { in: slots.map((slot) => slot.id) },
    },
    _count: { _all: true },
  });

  const takenBySlot = new Map(
    counts.map((row) => [row.pickupSlotId, row._count._all] as const),
  );

  return slots.map((slot) => {
    const taken = takenBySlot.get(slot.id) ?? 0;
    // maxOrders 0 means the owner has not capped this window.
    const remaining = slot.maxOrders > 0 ? Math.max(0, slot.maxOrders - taken) : null;

    let available = remaining === null || remaining > 0;
    if (available && isToday) available = closesLateEnough(slot.endTime, minLead);

    return {
      id: slot.id,
      label: slot.label,
      startTime: slot.startTime,
      endTime: slot.endTime,
      available,
      remaining,
    };
  });
}

/** A window that ends inside the notice period is no use to anyone. */
function closesLateEnough(endTime: string, minLeadMinutes: number): boolean {
  const [hours, minutes] = endTime.split(":");
  const end = new Date();
  end.setHours(
    Number.parseInt(hours ?? "23", 10),
    Number.parseInt(minutes ?? "59", 10),
    0,
    0,
  );
  return end.getTime() - Date.now() >= minLeadMinutes * 60 * 1000;
}

/** "10:00 AM – 12:30 PM", for order slips and confirmations. */
export function formatSlotRange(slot: { startTime: string; endTime: string }): string {
  return `${formatTime24to12(slot.startTime)} – ${formatTime24to12(slot.endTime)}`;
}

/**
 * The dates a customer may choose from, respecting the owner's advance-booking
 * limit. Returned as `yyyy-MM-dd` strings so the value can go straight into a
 * date input without timezone drift.
 */
export async function getOrderableDates(): Promise<{ min: string; max: string }> {
  const settings = await getSettings();
  const maxAdvanceDays = settingNumber(settings, "ordering.maxAdvanceDays", 14);

  const today = startOfDay();
  const latest = new Date(today);
  latest.setDate(latest.getDate() + maxAdvanceDays);

  return { min: toDateInput(today), max: toDateInput(latest) };
}

/** Local-date ISO string. `toISOString()` would shift the day in +0530. */
export function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
