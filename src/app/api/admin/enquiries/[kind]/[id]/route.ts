import { z } from "zod";

import { ok, route, ApiError } from "@/server/api/response";
import { requireAdmin, auditLog } from "@/server/api/guards";
import { assertCsrf } from "@/server/api/csrf";
import { getRequestById, updateRequest } from "@/server/services/request.service";
import { requestStatusUpdateSchema } from "@/server/validation/schemas";

/**
 * One enquiry, addressed by kind + id.
 *
 * The kind is in the path because the two live in separate tables — an id alone
 * would not say which one to look in, and guessing by trying both would let a
 * caller probe for ids across tables.
 */

const kindSchema = z.enum(["BULK", "CUSTOM"]);

type Ctx = { params: Promise<{ kind: string; id: string }> };

export const GET = route(async (_request: Request, { params }: Ctx) => {
  await requireAdmin("requests.view");
  const { kind, id } = await params;

  const enquiry = await getRequestById(kindSchema.parse(kind), id);
  if (!enquiry) throw ApiError.notFound("That enquiry no longer exists.");

  return ok(enquiry);
});

/** PATCH — status, the quoted figure, and the owner's private notes. */
export const PATCH = route(async (request: Request, { params }: Ctx) => {
  await assertCsrf(request);
  const session = await requireAdmin("requests.manage");
  const { kind: rawKind, id } = await params;
  const kind = kindSchema.parse(rawKind);

  const before = await getRequestById(kind, id);
  if (!before) throw ApiError.notFound("That enquiry no longer exists.");

  const input = requestStatusUpdateSchema.parse(await request.json());

  // A quote with no figure is not a quote — the customer has to be told a price.
  if (input.status === "QUOTED" && input.quotedAmount === undefined) {
    throw ApiError.validation({
      quotedAmount: "Enter the amount you quoted before marking this as quoted.",
    });
  }

  const updated = await updateRequest(kind, id, input);

  await auditLog({
    session,
    action: "STATUS_CHANGE",
    entity: kind === "BULK" ? "bulkOrderRequest" : "customOrderRequest",
    entityId: id,
    before: {
      status: before.status,
      quotedAmount: before.quotedAmount === null ? null : String(before.quotedAmount),
    },
    after: {
      status: updated.status,
      quotedAmount: updated.quotedAmount === null ? null : String(updated.quotedAmount),
    },
  });

  return ok(updated);
});
