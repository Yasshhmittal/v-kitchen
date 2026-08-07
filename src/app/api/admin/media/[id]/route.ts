import { ok, noContent, route } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { updateMediaAlt, deleteMedia } from "@/server/services/media.service";
import { mediaUpdateSchema } from "@/server/validation/schemas";

/**
 * PATCH /api/admin/media/:id — update alt text or folder.
 *
 * Editing the URL itself is forbidden — the owner replaces a photo by deleting
 * the old one and uploading a new one, which keeps the media table clean.
 */
export const PATCH = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireAdmin("media.manage");
  const { id } = await params;

  const input = mediaUpdateSchema.parse(await request.json());

  const updated = await updateMediaAlt(id, input.alt || "");

  await auditLog({
    session,
    action: "UPDATE",
    entity: "media",
    entityId: id,
    after: { alt: updated.alt },
  });

  return ok(updated);
});

/**
 * DELETE /api/admin/media/:id — remove the asset and the bytes.
 *
 * The service checks whether any menu items, products or categories still
 * reference this URL. If they do, the delete is blocked and the owner is told
 * what needs updating first.
 */
export const DELETE = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireAdmin("media.manage");
  const { id } = await params;

  const deleted = await deleteMedia(id);

  await auditLog({
    session,
    action: "DELETE",
    entity: "media",
    entityId: id,
    before: { url: deleted.url, folder: deleted.folder },
  });

  return noContent();
});
