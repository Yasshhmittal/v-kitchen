import type { MenuSlot, OrderStatus, RequestStatus, Role } from "@prisma/client";

/**
 * Presentation metadata for enum values.
 *
 * These are labels and colours for values that are part of the *code* (Prisma
 * enums), not business content — a new menu slot needs a migration anyway. All
 * actual business content (items, prices, categories, copy) lives in the
 * database and is never listed here.
 */

export const ADMIN_BASE_PATH = "/admin";

export const MENU_SLOT_META: Record<
  MenuSlot,
  { label: string; short: string; description: string; icon: string }
> = {
  MORNING: {
    label: "Morning",
    short: "Morning",
    description: "Fresh breakfast, ready early",
    icon: "sunrise",
  },
  AFTERNOON: {
    label: "Afternoon",
    short: "Afternoon",
    description: "Hearty lunch thalis and mains",
    icon: "sun",
  },
  EVENING: {
    label: "Evening",
    short: "Evening",
    description: "Evening snacks and dinner",
    icon: "sunset",
  },
  SPECIAL: {
    label: "Today's Special",
    short: "Special",
    description: "Chef's pick for today",
    icon: "sparkles",
  },
  SUNDAY_SPECIAL: {
    label: "Sunday Special",
    short: "Sunday",
    description: "Our weekend feast",
    icon: "party-popper",
  },
  FESTIVAL: {
    label: "Festival Special",
    short: "Festival",
    description: "Made for the occasion",
    icon: "gift",
  },
  LIMITED_TIME: {
    label: "Limited Time",
    short: "Limited",
    description: "Here for a short while only",
    icon: "timer",
  },
  SEASONAL: {
    label: "Seasonal",
    short: "Seasonal",
    description: "What the season brings",
    icon: "leaf",
  },
};

/** Slots shown as the primary tabs on the menu page, in order. */
export const DAILY_SLOTS: MenuSlot[] = ["MORNING", "AFTERNOON", "EVENING"];

/** Slots treated as "specials" and surfaced on the specials page. */
export const SPECIAL_SLOTS: MenuSlot[] = [
  "SPECIAL",
  "SUNDAY_SPECIAL",
  "FESTIVAL",
  "LIMITED_TIME",
  "SEASONAL",
];

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }
> = {
  PENDING: { label: "Pending", tone: "warning" },
  ACCEPTED: { label: "Accepted", tone: "info" },
  PREPARING: { label: "Preparing", tone: "info" },
  READY_FOR_PICKUP: { label: "Ready for pickup", tone: "success" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

/**
 * Legal status transitions. Enforced server-side in the order service so a
 * crafted request cannot move a cancelled order back into preparation.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const REQUEST_STATUS_META: Record<RequestStatus, { label: string }> = {
  NEW: { label: "New" },
  REVIEWING: { label: "Reviewing" },
  QUOTED: { label: "Quoted" },
  ACCEPTED: { label: "Accepted" },
  REJECTED: { label: "Rejected" },
  COMPLETED: { label: "Completed" },
};

export const ROLE_META: Record<Role, { label: string; description: string }> = {
  OWNER: {
    label: "Owner",
    description: "Full access, including staff accounts and site settings",
  },
  MANAGER: {
    label: "Manager",
    description: "Manage menus, products, orders and enquiries",
  },
  STAFF: {
    label: "Staff",
    description: "View and progress orders only",
  },
};

/** Pale tints available for category cards, cycled when none is set. */
export const CARD_TINTS = [
  "var(--tint-green)",
  "var(--tint-cream)",
  "var(--tint-peach)",
  "var(--tint-sage)",
] as const;

export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
