import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { created, ok, route } from "@/server/api/response";
import { assertSameOrigin } from "@/server/api/csrf";
import { rateLimit, requestIp } from "@/server/api/guards";
import { getCustomerSession } from "@/server/auth/session";
import { toReviewView } from "@/server/services/mappers";
import { reviewSchema } from "@/server/validation/schemas";

/**
 * GET  /api/reviews  — approved reviews only.
 * POST /api/reviews  — submit one; it lands as PENDING for moderation.
 *
 * New reviews are never published automatically. The owner approves them in
 * the admin, which is the only thing standing between the home page and spam.
 */

const querySchema = z.object({
  featured: z.enum(["true", "false"]).default("false"),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams));

  const reviews = await prisma.review.findMany({
    where: {
      status: "APPROVED",
      ...(query.featured === "true" ? { isFeatured: true } : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take: query.limit,
  });

  return ok(reviews.map(toReviewView));
});

export const POST = route(async (request: Request) => {
  await assertSameOrigin(request);

  const ip = await requestIp();
  rateLimit(`review:${ip}`, { limit: 3, windowMs: 60 * 60 * 1000 });

  const input = reviewSchema.parse(await request.json());
  const session = await getCustomerSession();

  const review = await prisma.review.create({
    data: {
      customerId: session?.customerId ?? null,
      authorName: input.authorName,
      rating: input.rating,
      comment: input.comment,
      image: input.image ?? null,
      // status defaults to PENDING — moderation is not optional.
    },
  });

  return created({
    id: review.id,
    status: review.status,
    message: "Thank you! Your review will appear once we've had a look at it.",
  });
});
