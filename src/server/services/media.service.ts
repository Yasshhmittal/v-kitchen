import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/response";
import { getStorage } from "@/server/storage";
import { PAGE_SIZE } from "@/lib/constants";

/**
 * The media library.
 *
 * Every image the owner uploads is recorded here as well as being written to
 * storage, which is what makes a photo reusable: upload the laddu picture once,
 * then pick it from the library for the product, the menu item and the hero
 * banner. The DB row is the index; the provider owns the bytes.
 */

export interface MediaListOptions {
  folder?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function uploadMedia(file: File, folder: string, alt?: string) {
  const storage = getStorage();
  const stored = await storage.upload(file, folder);

  try {
    return await prisma.mediaAsset.create({
      data: {
        url: stored.url,
        publicId: stored.publicId,
        provider: stored.provider,
        alt: alt?.trim() || null,
        folder: folder.toLowerCase().replace(/[^a-z0-9-]/g, "") || "general",
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        width: stored.width ?? null,
        height: stored.height ?? null,
      },
    });
  } catch (error) {
    // The bytes landed but the row didn't — remove the orphan rather than
    // leaving a file nothing references.
    await storage.delete(stored.publicId).catch(() => undefined);
    throw error;
  }
}

export async function listMedia({ folder, search, page = 1, pageSize = PAGE_SIZE }: MediaListOptions) {
  const where = {
    ...(folder ? { folder } : {}),
    ...(search ? { alt: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  return { items, total };
}

/** Folders that actually contain something, for the library's filter chips. */
export async function listMediaFolders(): Promise<Array<{ folder: string; count: number }>> {
  const groups = await prisma.mediaAsset.groupBy({
    by: ["folder"],
    _count: { _all: true },
    orderBy: { folder: "asc" },
  });
  return groups.map((group) => ({ folder: group.folder, count: group._count._all }));
}

export async function updateMediaAlt(id: string, alt: string) {
  return prisma.mediaAsset.update({
    where: { id },
    data: { alt: alt.trim() || null },
  });
}

/**
 * Delete an asset, refusing while anything still points at its URL. Removing a
 * photo that a live product uses would leave a broken card on the public site,
 * so the owner is told what is using it instead.
 */
export async function deleteMedia(id: string) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) throw ApiError.notFound("That image no longer exists.");

  const [menuItems, products, categories] = await Promise.all([
    prisma.menuItem.count({ where: { image: asset.url } }),
    prisma.product.count({ where: { images: { has: asset.url } } }),
    prisma.category.count({ where: { image: asset.url } }),
  ]);

  const inUse = menuItems + products + categories;
  if (inUse > 0) {
    throw ApiError.conflict(
      `This image is still used by ${inUse} item${inUse === 1 ? "" : "s"}. Replace it there first.`,
    );
  }

  if (asset.publicId) {
    await getStorage().delete(asset.publicId);
  }
  await prisma.mediaAsset.delete({ where: { id } });

  return asset;
}
