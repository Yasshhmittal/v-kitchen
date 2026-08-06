import { prisma } from "@/lib/prisma";
import { ApiError, ok, route } from "@/server/api/response";
import { toProductView } from "@/server/services/mappers";

/** GET /api/products/[slug] — one product with its variants and long copy. */
export const GET = route(
  async (_request: Request, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;

    const product = await prisma.product.findFirst({
      where: { slug, isActive: true },
      include: { category: { select: { name: true } }, variants: true },
    });

    if (!product) throw ApiError.notFound("We couldn't find that product.");

    return ok(toProductView(product, { includeLongDescription: true }));
  },
);
