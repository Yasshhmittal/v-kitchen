import { z } from "zod";

import { ok, route, ApiError } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import { getOrderById } from "@/server/services/order.service";
import { prisma } from "@/lib/prisma";

/** GET /api/admin/orders/:id — the full order with its snapshot lines. */
export const GET = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin("orders.view");
  const { id } = await params;

  const order = await getOrderById(id);
  if (!order) throw ApiError.notFound("That order no longer exists.");

  return ok(order);
});

/**
 * PATCH /api/admin/orders/:id — kitchen notes only.
 *
 * Status lives on its own endpoint because it has transition rules and stock
 * side effects; letting it through here would bypass both.
 */
const patchSchema = z.object({
  adminNotes: z.string().max(2000).optional(),
});

export const PATCH = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await assertCsrf(request);
  const session = await requireAdmin("orders.update");
  const { id } = await params;

  const before = await prisma.order.findUnique({ where: { id } });
  if (!before) throw ApiError.notFound("That order no longer exists.");

  const input = patchSchema.parse(await request.json());

  const updated = await prisma.order.update({
    where: { id },
    data: {
      ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes || null } : {}),
    },
  });

  await auditLog({
    session,
    action: "UPDATE",
    entity: "order",
    entityId: id,
    before: { adminNotes: before.adminNotes },
    after: { adminNotes: updated.adminNotes },
  });

  return ok(updated);
});
