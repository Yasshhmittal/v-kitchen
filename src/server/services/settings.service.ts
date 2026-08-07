import { cache } from "react";

import { prisma } from "@/lib/prisma";
import {
  SETTING_DEFINITIONS,
  SETTING_MAP,
  defaultSettings,
  type SettingGroup,
} from "@/server/settings/definitions";

/**
 * Reads and writes the site-wide settings the owner controls.
 *
 * Every consumer goes through `getSettings()`, which merges stored rows over
 * the factory defaults. A missing row therefore degrades to the default rather
 * than rendering an empty page — which matters on a fresh install and after a
 * new setting is added to the registry.
 */

export type SettingsMap = Record<string, unknown>;

export const getSettings = cache(async (): Promise<SettingsMap> => {
  const defaults = defaultSettings();

  try {
    const rows = await prisma.siteSetting.findMany();
    for (const row of rows) {
      // Ignore rows for settings that no longer exist in the registry.
      if (SETTING_MAP.has(row.key)) defaults[row.key] = row.value;
    }
  } catch (error) {
    // A settings read must never take the whole site down — fall back to
    // defaults and let the page render.
    console.error("[settings] falling back to defaults:", error);
  }

  return defaults;
});

/**
 * Typed accessor with a fallback. Values come from a JSON column, so the type
 * parameter is a convenience for callers, not a runtime guarantee — hence the
 * shape check before returning.
 */
export function setting<T>(settings: SettingsMap, key: string, fallback: T): T {
  const value = settings[key];
  if (value === undefined || value === null || value === "") return fallback;
  return value as T;
}

export function settingText(settings: SettingsMap, key: string, fallback = ""): string {
  const value = settings[key];
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

export function settingBool(settings: SettingsMap, key: string, fallback = false): boolean {
  const value = settings[key];
  return typeof value === "boolean" ? value : fallback;
}

export function settingNumber(settings: SettingsMap, key: string, fallback = 0): number {
  const value = settings[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function settingList<T>(settings: SettingsMap, key: string, fallback: T[] = []): T[] {
  const value = settings[key];
  return Array.isArray(value) ? (value as T[]) : fallback;
}

/**
 * Whether the owner requires an account to place an order.
 *
 * Guest checkout is on by default and this setting flips it off. Read by the
 * checkout page and enforced again in the order service, so hiding the form is
 * never the only thing standing between a guest and an order.
 */
export async function isLoginRequired(): Promise<boolean> {
  return settingBool(await getSettings(), "ordering.requireLogin", false);
}

/** Settings for one tab of the admin settings screen. */
export async function getSettingsByGroup(group: SettingGroup) {
  const settings = await getSettings();
  return SETTING_DEFINITIONS.filter((d) => d.group === group).map((d) => ({
    ...d,
    value: settings[d.key] ?? d.defaultValue,
  }));
}

/**
 * Persist a batch of settings. Unknown keys are dropped rather than stored, so
 * a crafted request cannot pollute the table with arbitrary data.
 */
export async function updateSettings(values: Record<string, unknown>): Promise<string[]> {
  const applied: string[] = [];

  await prisma.$transaction(
    Object.entries(values)
      .filter(([key]) => SETTING_MAP.has(key))
      .map(([key, value]) => {
        const definition = SETTING_MAP.get(key)!;
        applied.push(key);
        return prisma.siteSetting.upsert({
          where: { key },
          create: {
            key,
            value: value as never,
            group: definition.group,
            label: definition.label,
          },
          update: { value: value as never },
        });
      }),
  );

  return applied;
}

/** Convenience bundle used by the public layout (navbar + footer + SEO). */
export const getPublicSettings = cache(async () => {
  const settings = await getSettings();
  return {
    siteName: settingText(settings, "site.name", "V-Kitchen"),
    tagline: settingText(settings, "site.tagline"),
    logo: settingText(settings, "site.logo"),
    currency: settingText(settings, "site.currency", "INR"),
    locale: settingText(settings, "site.locale", "en-IN"),
    phone: settingText(settings, "contact.phone"),
    whatsapp: settingText(settings, "contact.whatsapp"),
    email: settingText(settings, "contact.email"),
    address: settingText(settings, "contact.address"),
    orderingEnabled: settingBool(settings, "ordering.enabled", true),
    raw: settings,
  };
});
