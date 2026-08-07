import { z } from "zod";

import { ok, route, ApiError } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import {
  getCustomerById,
  setCustomerBlocked,
  updateCustomerNote,
} from "@/server/services/customer.service";

/** GET /api/admin/customers/:id — profile, recent orders, and their totals. */
export const GET = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin("customers.view");
  const { id } = await params;

  const customer = await getCustomerById(id);
  if (!customer) throw ApiError.notFound("That customer no longer exists.");

  // The password hash is never part of a response, even to an owner.
  const { passwordHash: _passwordHash, ...safe } = customer;
  return ok(safe);
});

/**
 * PATCH /api/admin/customers/:id
 *
 * Blocking and kitchen notes only. Name, phone and email belong to the
 * customer — an admin editing their phone number would silently reassign their
 * order history to a number they don't own.
 */
const patchSchema = z.object({
  isBlocked: z.boolean().optional(),
  addressNote: z.string().max(1000).optional(),
});

export const PATCH = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await assertCsrf(request);
  const session = await requireAdmin("customers.manage");
  const { id } = await params;

  const before = await getCustomerById(id);
  if (!before) throw ApiError.notFound("That customer no longer exists.");

  const input = patchSchema.parse(await request.json());

  if (input.addressNote !== undefined) {
    await updateCustomerNote(id, input.addressNote || null);
  }
  const updated =
    input.isBlocked === undefined
      ? await getCustomerById(id)
      : await setCustomerBlocked(id, input.isBlocked);

  await auditLog({
    session,
    action: "UPDATE",
    entity: "customer",
    entityId: id,
    before: { isBlocked: before.isBlocked, addressNote: before.addressNote },
    after: { isBlocked: updated?.isBlocked, addressNote: updated?.addressNote },
  });

  return ok({ id, isBlocked: updated?.isBlocked, addressNote: updated?.addressNote });
});
