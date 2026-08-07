import { z } from "zod";
import { OrderStatus } from "@prisma/client";

import { ok, route, ApiError } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import { updateOrderStatus } from "@/server/services/order.service";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/admin/orders/:id/status
 *
 * Separate from the order PATCH because a status change is not a field edit: it
 * runs transition rules and returns stock on cancellation. The service refuses
 * illegal jumps, so a crafted request can't resurrect a cancelled order.
 */

const bodySchema = z.object({
  status: z.nativeEnum(OrderStatus),
  cancelReason: z.string().max(500).optional(),
});

export const PATCH = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await assertCsrf(request);
  const session = await requireAdmin("orders.update");
  const { id } = await params;

  const before = await prisma.order.findUnique({
    where: { id },
    select: { status: true, orderNo: true },
  });
  if (!before) throw ApiError.notFound("That order no longer exists.");

  const input = bodySchema.parse(await request.json());
  const updated = await updateOrderStatus(id, input.status, {
    cancelReason: input.cancelReason,
  });

  await auditLog({
    session,
    action: "STATUS_CHANGE",
    entity: "order",
    entityId: id,
    before: { status: before.status },
    after: { status: updated.status, cancelReason: updated.cancelReason },
  });

  return ok(updated);
});
