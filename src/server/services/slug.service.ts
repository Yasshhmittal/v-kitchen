import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/format";
import { ApiError } from "@/server/api/response";

/**
 * Slugs are user-visible URLs, so they must be unique and stable. The owner
 * can supply one; when they don't we derive it from the name and append a
 * counter until it is free.
 */

type SluggedModel = "menuItem" | "product" | "category";

export async function uniqueSlug(
  model: SluggedModel,
  desired: string | undefined,
  fallbackSource: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(desired || fallbackSource) || "item";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;

    const existing = await (
      prisma[model] as {
        findUnique(args: { where: { slug: string }; select: { id: true } }): Promise<{ id: string } | null>;
      }
    ).findUnique({ where: { slug: candidate }, select: { id: true } });

    if (!existing || existing.id === excludeId) return candidate;
  }

  throw ApiError.conflict("Couldn't generate a unique web address for that name.");
}
