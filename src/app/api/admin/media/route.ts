import { z } from "zod";

import { ok, created, route, buildPageMeta, ApiError } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import { listMedia, uploadMedia } from "@/server/services/media.service";
import { PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/admin/media?folder=...&search=...&page=1&pageSize=20
 *
 * List media assets with optional folder and search filters. The library UI uses
 * this for the main grid; folder counts come from the sibling /folders route.
 */

const querySchema = z.object({
  folder: z.string().max(60).optional(),
  search: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE),
});

export const GET = route(async (request: Request) => {
  await requireAdmin("media.manage");

  const url = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams));

  const { items, total } = await listMedia(query);

  return ok(items, buildPageMeta(total, query.page, query.pageSize));
});

/**
 * POST /api/admin/media — upload one image.
 *
 * Expects `multipart/form-data` with a `file` field plus optional `folder` and
 * `alt`. The storage provider sniffs the bytes and caps the size; the service
 * writes the row and cleans up the file if that write fails.
 */
export const POST = route(async (request: Request) => {
  await assertCsrf(request);
  const session = await requireAdmin("media.manage");

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = (formData.get("folder") as string | null) || "general";
  const alt = (formData.get("alt") as string | null) || undefined;

  if (!(file instanceof File)) {
    throw ApiError.badRequest("Choose an image to upload.");
  }

  const asset = await uploadMedia(file, folder, alt);

  await auditLog({
    session,
    action: "CREATE",
    entity: "media",
    entityId: asset.id,
    after: { url: asset.url, folder: asset.folder },
  });

  return created(asset);
});
