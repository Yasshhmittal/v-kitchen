import { ok, route } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import { getSettings, updateSettings } from "@/server/services/settings.service";
import { settingsUpdateSchema } from "@/server/validation/schemas";
import { SETTING_DEFINITIONS, SETTING_GROUPS } from "@/server/settings/definitions";

/**
 * GET /api/admin/settings — the full registry with current values.
 *
 * The screen renders itself from this: definitions carry the editor type and
 * help text, so adding a setting to the registry adds a field to the form with
 * no change here or in the page.
 */
export const GET = route(async () => {
  await requireAdmin("settings.manage");

  const settings = await getSettings();

  return ok({
    groups: SETTING_GROUPS,
    definitions: SETTING_DEFINITIONS.map((definition) => ({
      ...definition,
      value: settings[definition.key] ?? definition.defaultValue,
    })),
  });
});

/**
 * PATCH /api/admin/settings — save a batch of values.
 *
 * The service drops keys that aren't in the registry, so a crafted request
 * can't write arbitrary rows. Only the keys actually applied are logged.
 */
export const PATCH = route(async (request: Request) => {
  await assertCsrf(request);
  const session = await requireAdmin("settings.manage");

  const { values } = settingsUpdateSchema.parse(await request.json());

  const before = await getSettings();
  const applied = await updateSettings(values);

  await auditLog({
    session,
    action: "UPDATE",
    entity: "siteSetting",
    entityId: applied.join(","),
    before: Object.fromEntries(applied.map((key) => [key, before[key]])),
    after: Object.fromEntries(applied.map((key) => [key, values[key]])),
  });

  return ok({ applied });
});
