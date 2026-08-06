import { ok, route } from "@/server/api/response";
import { getSettings } from "@/server/services/settings.service";
import { SETTING_MAP } from "@/server/settings/definitions";

/**
 * GET /api/settings — the public subset of site settings.
 *
 * Only the keys listed here leave the server. The settings table is a generic
 * key/value store, so returning it wholesale would expose anything the owner
 * later adds, including keys that are not meant to be public.
 */

const PUBLIC_KEYS = [
  "site.name",
  "site.tagline",
  "site.logo",
  "site.currency",
  "site.locale",
  "contact.phone",
  "contact.whatsapp",
  "contact.email",
  "contact.address",
  "contact.mapsEmbedUrl",
  "contact.mapsLink",
  "contact.pickupNote",
  "hours.weekly",
  "hours.note",
  "nav.links",
  "ordering.enabled",
  "ordering.pausedMessage",
  "ordering.minLeadMinutes",
  "ordering.maxAdvanceDays",
  "ordering.minOrderValue",
  "ordering.requireLogin",
  "social.links",
  "footer.about",
  "footer.quickLinks",
  "footer.supportLinks",
] as const;

export const GET = route(async () => {
  const settings = await getSettings();

  const payload: Record<string, unknown> = {};
  for (const key of PUBLIC_KEYS) {
    if (SETTING_MAP.has(key)) payload[key] = settings[key];
  }

  return ok(payload);
});
