import { Prisma } from "@prisma/client";

/**
 * Formatting helpers. Currency and locale come from site settings where
 * available; these are the pure functions the UI calls.
 */

/** Prisma Decimal, number and numeric string all arrive here from the DB. */
export type Money = Prisma.Decimal | number | string | null | undefined;

export function toNumber(value: Money): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value) || 0;
  return value.toNumber();
}

export function formatCurrency(
  value: Money,
  { currency = "INR", locale = "en-IN", showDecimals = false } = {},
): string {
  const amount = toNumber(value);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: showDecimals || amount % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** The price a customer actually pays: discount when set and lower. */
export function effectivePrice(price: Money, discountPrice: Money): number {
  const base = toNumber(price);
  const discounted = toNumber(discountPrice);
  return discounted > 0 && discounted < base ? discounted : base;
}

export function discountPercent(price: Money, discountPrice: Money): number | null {
  const base = toNumber(price);
  const discounted = toNumber(discountPrice);
  if (!(discounted > 0 && discounted < base) || base === 0) return null;
  return Math.round(((base - discounted) / base) * 100);
}

export function formatDate(value: Date | string, locale = "en-IN"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: Date | string, locale = "en-IN"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** "10:30" -> "10:30 AM". Times are stored as HH:mm strings. */
export function formatTime24to12(time: string): string {
  const [hourPart, minutePart] = time.split(":");
  const hour = Number.parseInt(hourPart ?? "0", 10);
  if (Number.isNaN(hour)) return time;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minutePart ?? "00"} ${suffix}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function truncate(text: string, max = 120): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Digits-only phone, for WhatsApp deep links and tel: hrefs. */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
