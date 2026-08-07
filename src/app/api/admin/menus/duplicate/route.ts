import { created, route } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import { duplicateMenu } from "@/server/services/menu.service";
import { menuDuplicateSchema } from "@/server/validation/schemas";

/**
 * POST /api/admin/menus/duplicate
 *
 * "Same as yesterday" is the most common menu action, so it gets its own
 * endpoint rather than making the client re-post a whole composition. The copy
 * is created inactive — the owner reviews it, then publishes.
 */
export const POST = route(async (request: Request) => {
  await assertCsrf(request);
  const session = await requireAdmin("menu.manage");

  const input = menuDuplicateSchema.parse(await request.json());
  const menu = await duplicateMenu(input);

  await auditLog({
    session,
    action: "CREATE",
    entity: "menu",
    entityId: menu.id,
    after: {
      title: menu.title,
      slot: menu.slot,
      date: menu.date?.toISOString() ?? null,
      duplicatedFrom: input.sourceMenuId,
    },
  });

  return created(menu);
});
