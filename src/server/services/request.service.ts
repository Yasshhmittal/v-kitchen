import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { BulkOrderInput, CustomOrderInput } from "@/server/validation/schemas";

/**
 * Bulk and custom order enquiries.
 *
 * These are conversations, not transactions: nothing is priced or charged here.
 * The owner reads them in the admin inbox, quotes a figure, and takes it from
 * there — so the job of this service is to capture the request reliably and
 * make sure it is noticed.
 */

/** Human-quotable reference, e.g. BLK-260806-0003. */
async function nextRequestNo(
  prefix: "BLK" | "CUS",
  countToday: () => Promise<number>,
): Promise<string> {
  const today = new Date();
  const stamp = [
    String(today.getFullYear()).slice(2),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("");
  return `${prefix}-${stamp}-${String((await countToday()) + 1).padStart(4, "0")}`;
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

export async function createBulkOrderRequest(input: BulkOrderInput) {
  const requestNo = await nextRequestNo("BLK", () =>
    prisma.bulkOrderRequest.count({ where: { createdAt: todayRange() } }),
  );

  const data: Prisma.BulkOrderRequestCreateInput = {
    requestNo,
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    occasion: input.occasion,
    occasionOther: input.occasionOther ?? null,
    peopleCount: input.peopleCount ?? null,
    requirements: input.requirements,
    preferredDate: input.preferredDate ?? null,
    budget: input.budget ?? null,
    instructions: input.instructions ?? null,
  };

  const request = await prisma.bulkOrderRequest.create({ data });

  await notifyAdmin({
    type: "BULK_REQUEST",
    title: `Bulk enquiry ${request.requestNo}`,
    body: `${input.name}${input.peopleCount ? ` · ${input.peopleCount} people` : ""}`,
    link: `/admin/bulk-orders/${request.id}`,
    meta: { requestId: request.id, requestNo: request.requestNo },
  });

  return request;
}

export async function createCustomOrderRequest(input: CustomOrderInput) {
  const requestNo = await nextRequestNo("CUS", () =>
    prisma.customOrderRequest.count({ where: { createdAt: todayRange() } }),
  );

  const request = await prisma.customOrderRequest.create({
    data: {
      requestNo,
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      itemName: input.itemName,
      description: input.description,
      ingredients: input.ingredients ?? null,
      quantity: input.quantity ?? null,
      preferredDate: input.preferredDate ?? null,
      preferredTime: input.preferredTime ?? null,
      budget: input.budget ?? null,
      referenceImage: input.referenceImage ?? null,
    },
  });

  await notifyAdmin({
    type: "CUSTOM_REQUEST",
    title: `Custom order ${request.requestNo}`,
    body: `${input.name} · ${input.itemName}`,
    link: `/admin/custom-orders/${request.id}`,
    meta: { requestId: request.id, requestNo: request.requestNo },
  });

  return request;
}

/**
 * Notifications are best-effort. Losing the bell badge is a nuisance; losing
 * the enquiry because the badge failed to write is not acceptable.
 */
async function notifyAdmin(data: {
  type: string;
  title: string;
  body: string;
  link: string;
  meta: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.notification.create({ data });
  } catch (error) {
    console.error("[notify] could not create notification:", error);
  }
}
