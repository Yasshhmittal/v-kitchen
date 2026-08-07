import { ok, route } from "@/server/api/response";
import { requireAdmin } from "@/server/api/guards";
import { listMediaFolders } from "@/server/services/media.service";

/**
 * GET /api/admin/media/folders — folder counts for the library filter chips.
 *
 * Returns `[{ folder: "products", count: 42 }, ...]` sorted by folder name.
 */
export const GET = route(async () => {
  await requireAdmin("media.manage");
  const folders = await listMediaFolders();
  return ok(folders);
});
