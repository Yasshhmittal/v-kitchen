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

    // Switched rather than cast: the three delegates have incompatible
    // argument types, so a union cast doesn't typecheck.
    const existing = await findBySlug(model, candidate);

    if (!existing || existing.id === excludeId) return candidate;
  }

  throw ApiError.conflict("Couldn't generate a unique web address for that name.");
}

function findBySlug(model: SluggedModel, slug: string): Promise<{ id: string } | null> {
  const where = { slug };
  const select = { id: true } as const;

  switch (model) {
    case "menuItem":
      return prisma.menuItem.findUnique({ where, select });
    case "product":
      return prisma.product.findUnique({ where, select });
    case "category":
      return prisma.category.findUnique({ where, select });
  }
}
