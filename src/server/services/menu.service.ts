import type { Menu, MenuItem, MenuSlot, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { DAILY_SLOTS, SPECIAL_SLOTS } from "@/lib/constants";
import { ApiError } from "@/server/api/response";
import type { MenuInput } from "@/server/validation/schemas";

/**
 * Menu resolution.
 *
 * A slot's menu for a given day is chosen by specificity: a menu pinned to
 * that exact date beats one pinned to that weekday, which beats a general
 * recurring menu. This is what lets the owner schedule "Sunday Special" once
 * and still override a particular Sunday for a festival.
 */

export type MenuWithEntries = Menu & {
  entries: Array<{
    id: string;
    menuItemId: string;
    priceOverride: Prisma.Decimal | null;
    isAvailable: boolean;
    sortOrder: number;
    menuItem: MenuItem & { category: { id: string; name: string; slug: string } | null };
  }>;
};

const entryInclude = {
  entries: {
    where: { menuItem: { isAvailable: true } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      menuItem: {
        include: { category: { select: { id: true, name: true, slug: true } } },
      },
    },
  },
} satisfies Prisma.MenuInclude;

/** Midnight of the given day, so date-only comparisons are exact. */
export function startOfDay(date: Date = new Date()): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * The live menu for one slot on one day, or null when nothing is published.
 *
 * `publishAt` in the future hides a menu until its moment arrives, which is
 * how "tomorrow's breakfast" goes live automatically at midnight without a
 * background job.
 */
export async function getMenuForSlot(
  slot: MenuSlot,
  date: Date = new Date(),
): Promise<MenuWithEntries | null> {
  const day = startOfDay(date);
  const dayOfWeek = day.getDay();

  const candidates = await prisma.menu.findMany({
    where: {
      slot,
      isActive: true,
      OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }],
      AND: [
        {
          OR: [
            { date: day },
            { date: null, dayOfWeek },
            { date: null, dayOfWeek: null },
          ],
        },
      ],
    },
    include: entryInclude,
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
  });

  if (candidates.length === 0) return null;

  // Specificity: exact date > weekday > general recurring.
  const score = (menu: Menu) => (menu.date ? 3 : menu.dayOfWeek !== null ? 2 : 1);
  return candidates.reduce((best, current) => (score(current) > score(best) ? current : best));
}

/** All three time-of-day menus for a day, in order, skipping empty slots. */
export async function getDailyMenus(date: Date = new Date()) {
  const menus = await Promise.all(DAILY_SLOTS.map((slot) => getMenuForSlot(slot, date)));
  return DAILY_SLOTS.map((slot, index) => ({ slot, menu: menus[index] ?? null })).filter(
    (entry) => entry.menu !== null && entry.menu.entries.length > 0,
  ) as Array<{ slot: MenuSlot; menu: MenuWithEntries }>;
}

/**
 * Specials live for a day. SUNDAY_SPECIAL is only surfaced on a Sunday unless
 * the owner pinned it to a specific date.
 */
export async function getSpecialMenus(date: Date = new Date()) {
  const day = startOfDay(date);
  const isSunday = day.getDay() === 0;

  const results = await Promise.all(
    SPECIAL_SLOTS.map(async (slot) => {
      if (slot === "SUNDAY_SPECIAL" && !isSunday) {
        const pinned = await prisma.menu.findFirst({
          where: { slot, isActive: true, date: day },
          include: entryInclude,
        });
        return { slot, menu: pinned };
      }
      return { slot, menu: await getMenuForSlot(slot, date) };
    }),
  );

  return results.filter((r) => r.menu && r.menu.entries.length > 0) as Array<{
    slot: MenuSlot;
    menu: MenuWithEntries;
  }>;
}

/**
 * Has the cut-off for this menu passed today? `orderCutoffTime` is "HH:mm" in
 * the shop's local timezone; a menu for a future date is never cut off.
 */
export function isPastCutoff(menu: Pick<Menu, "orderCutoffTime" | "date">, forDate: Date): boolean {
  if (!menu.orderCutoffTime) return false;

  const target = startOfDay(forDate);
  const today = startOfDay();
  if (target.getTime() > today.getTime()) return false;
  if (target.getTime() < today.getTime()) return true;

  const [hoursRaw, minutesRaw] = menu.orderCutoffTime.split(":");
  const cutoff = new Date();
  cutoff.setHours(Number.parseInt(hoursRaw ?? "23", 10), Number.parseInt(minutesRaw ?? "59", 10), 0, 0);
  return new Date() > cutoff;
}

/** The price a customer pays for an item within a menu. */
export function entryPrice(entry: {
  priceOverride: Prisma.Decimal | null;
  menuItem: Pick<MenuItem, "price" | "discountPrice">;
}): { price: number; compareAt: number | null } {
  if (entry.priceOverride) {
    return { price: entry.priceOverride.toNumber(), compareAt: entry.menuItem.price.toNumber() };
  }
  const base = entry.menuItem.price.toNumber();
  const discounted = entry.menuItem.discountPrice?.toNumber() ?? 0;
  return discounted > 0 && discounted < base
    ? { price: discounted, compareAt: base }
    : { price: base, compareAt: null };
}

// ---------------------------------------------------------------------------
// Admin operations
// ---------------------------------------------------------------------------

/**
 * Replace a menu's composition atomically. Entries are deleted and recreated
 * inside a transaction so a failure part-way cannot leave a half-built menu
 * live on the site.
 */
export async function replaceMenuEntries(
  menuId: string,
  entries: Array<{
    menuItemId: string;
    priceOverride?: number;
    isAvailable?: boolean;
    sortOrder?: number;
  }>,
): Promise<void> {
  // Deduplicate — the join has a unique constraint and the UI can double-add.
  const seen = new Set<string>();
  const unique = entries.filter((e) => {
    if (seen.has(e.menuItemId)) return false;
    seen.add(e.menuItemId);
    return true;
  });

  if (unique.length > 0) {
    const found = await prisma.menuItem.count({
      where: { id: { in: unique.map((e) => e.menuItemId) } },
    });
    if (found !== unique.length) {
      throw ApiError.badRequest("One or more of those dishes no longer exists.");
    }
  }

  await prisma.$transaction([
    prisma.menuEntry.deleteMany({ where: { menuId } }),
    ...(unique.length > 0
      ? [
          prisma.menuEntry.createMany({
            data: unique.map((entry, index) => ({
              menuId,
              menuItemId: entry.menuItemId,
              priceOverride: entry.priceOverride ?? null,
              isAvailable: entry.isAvailable ?? true,
              sortOrder: entry.sortOrder ?? index,
            })),
          }),
        ]
      : []),
  ]);
}

export type MenuWithCounts = Menu & { _count: { entries: number } };

/** The admin list: every menu regardless of publish state, newest day first. */
export async function listMenus(filters: {
  search?: string;
  slot?: MenuSlot;
  isActive?: boolean;
  page: number;
  pageSize: number;
  sort?: string;
  order?: "asc" | "desc";
}): Promise<{ items: MenuWithCounts[]; total: number }> {
  const where: Prisma.MenuWhereInput = {
    ...(filters.slot ? { slot: filters.slot } : {}),
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: "insensitive" } },
            { subtitle: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.menu.findMany({
      where,
      include: { _count: { select: { entries: true } } },
      orderBy: buildMenuOrderBy(filters.sort, filters.order),
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.menu.count({ where }),
  ]);

  return { items, total };
}

function buildMenuOrderBy(
  sort: string | undefined,
  order: "asc" | "desc" = "desc",
): Prisma.MenuOrderByWithRelationInput[] {
  switch (sort) {
    case "title":
      return [{ title: order }];
    case "slot":
      return [{ slot: order }, { title: "asc" }];
    case "date":
      return [{ date: order }, { sortOrder: "asc" }];
    case "createdAt":
      return [{ createdAt: order }];
    default:
      // Undated recurring menus sort last, so today's pinned menus lead.
      return [{ date: "desc" }, { sortOrder: "asc" }, { title: "asc" }];
  }
}

/** One menu with its full composition — what the editor loads. */
export async function getMenuById(id: string): Promise<MenuWithEntries | null> {
  return prisma.menu.findUnique({
    where: { id },
    include: {
      entries: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: {
          menuItem: {
            include: { category: { select: { id: true, name: true, slug: true } } },
          },
        },
      },
    },
  });
}

export async function createMenu(input: MenuInput): Promise<Menu> {
  const menu = await prisma.menu.create({
    data: {
      title: input.title,
      subtitle: input.subtitle || null,
      slot: input.slot,
      date: input.date ? startOfDay(input.date) : null,
      // A date pins the menu to one day, which makes a weekday rule meaningless.
      dayOfWeek: input.date ? null : (input.dayOfWeek ?? null),
      bannerImage: input.bannerImage || null,
      orderCutoffTime: input.orderCutoffTime || null,
      publishAt: input.publishAt ?? null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });

  if (input.entries.length > 0) {
    await replaceMenuEntries(menu.id, input.entries);
  }

  return menu;
}

export async function updateMenu(id: string, input: Partial<MenuInput>): Promise<Menu> {
  const existing = await prisma.menu.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("That menu doesn't exist.");

  const date = input.date !== undefined ? (input.date ? startOfDay(input.date) : null) : undefined;

  const menu = await prisma.menu.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.subtitle !== undefined ? { subtitle: input.subtitle || null } : {}),
      ...(input.slot !== undefined ? { slot: input.slot } : {}),
      ...(date !== undefined ? { date } : {}),
      ...(input.dayOfWeek !== undefined || date
        ? { dayOfWeek: date ? null : (input.dayOfWeek ?? null) }
        : {}),
      ...(input.bannerImage !== undefined ? { bannerImage: input.bannerImage || null } : {}),
      ...(input.orderCutoffTime !== undefined
        ? { orderCutoffTime: input.orderCutoffTime || null }
        : {}),
      ...(input.publishAt !== undefined ? { publishAt: input.publishAt ?? null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });

  // Absent entries means "composition untouched"; an empty array means "empty it".
  if (input.entries !== undefined) {
    await replaceMenuEntries(id, input.entries);
  }

  return menu;
}

/**
 * Delete a menu. Entries cascade, so the dishes themselves are untouched — only
 * this composition of them goes away.
 */
export async function deleteMenu(id: string): Promise<void> {
  const existing = await prisma.menu.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("That menu doesn't exist.");
  await prisma.menu.delete({ where: { id } });
}

/** Publish/unpublish — the one-click action on the list row. */
export async function setMenuActive(id: string, isActive: boolean): Promise<Menu> {
  return prisma.menu.update({ where: { id }, data: { isActive } });
}

/** Copy a menu — the "duplicate yesterday" button. */
export async function duplicateMenu(params: {
  sourceMenuId: string;
  title?: string;
  date?: Date;
  slot?: MenuSlot;
}): Promise<Menu> {
  const source = await prisma.menu.findUnique({
    where: { id: params.sourceMenuId },
    include: { entries: true },
  });
  if (!source) throw ApiError.notFound("That menu no longer exists.");

  return prisma.menu.create({
    data: {
      title: params.title ?? `${source.title} (copy)`,
      subtitle: source.subtitle,
      slot: params.slot ?? source.slot,
      date: params.date ?? null,
      dayOfWeek: params.date ? null : source.dayOfWeek,
      bannerImage: source.bannerImage,
      orderCutoffTime: source.orderCutoffTime,
      isActive: false, // copies start hidden so a half-edited menu never goes live
      sortOrder: source.sortOrder,
      entries: {
        create: source.entries.map((entry) => ({
          menuItemId: entry.menuItemId,
          priceOverride: entry.priceOverride,
          isAvailable: entry.isAvailable,
          sortOrder: entry.sortOrder,
        })),
      },
    },
  });
}
