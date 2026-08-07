import {
  type BulkOrderRequest,
  type CustomOrderRequest,
  type Occasion,
  type Prisma,
  RequestStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/response";
import type {
  BulkOrderInput,
  CustomOrderInput,
  RequestStatusUpdateInput,
} from "@/server/validation/schemas";

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
    link: `/admin/enquiries?kind=BULK&id=${request.id}`,
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
    link: `/admin/enquiries?kind=CUSTOM&id=${request.id}`,
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

/* -------------------------------------------------------------------------- */
/* Admin inbox                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Both kinds of enquiry share a shape in the inbox. They live in separate
 * tables because their questions differ, but the owner works one list — so the
 * list layer normalises them into a single row and remembers which table each
 * came from.
 */
export type RequestKind = "BULK" | "CUSTOM";

export type RequestRow = {
  id: string;
  kind: RequestKind;
  requestNo: string;
  name: string;
  phone: string;
  email: string | null;
  /**
   * The gist of the enquiry, kept as raw fields rather than a formatted string:
   * occasion labels belong with the other display copy, not in two places.
   */
  occasion: Occasion | null;
  occasionOther: string | null;
  itemName: string | null;
  peopleCount: number | null;
  preferredDate: Date | null;
  budget: Prisma.Decimal | null;
  quotedAmount: Prisma.Decimal | null;
  status: RequestStatus;
  createdAt: Date;
};

export type BulkRequestDetail = BulkOrderRequest & { kind: "BULK" };
export type CustomRequestDetail = CustomOrderRequest & { kind: "CUSTOM" };
export type RequestDetail = BulkRequestDetail | CustomRequestDetail;

export type ListRequestsParams = {
  kind?: RequestKind;
  status?: RequestStatus;
  search?: string;
  page?: number;
  pageSize?: number;
};

function bulkWhere(params: ListRequestsParams): Prisma.BulkOrderRequestWhereInput {
  const where: Prisma.BulkOrderRequestWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.search) {
    where.OR = [
      { requestNo: { contains: params.search, mode: "insensitive" } },
      { name: { contains: params.search, mode: "insensitive" } },
      { phone: { contains: params.search } },
      { email: { contains: params.search, mode: "insensitive" } },
    ];
  }
  return where;
}

function customWhere(params: ListRequestsParams): Prisma.CustomOrderRequestWhereInput {
  const where: Prisma.CustomOrderRequestWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.search) {
    where.OR = [
      { requestNo: { contains: params.search, mode: "insensitive" } },
      { name: { contains: params.search, mode: "insensitive" } },
      { phone: { contains: params.search } },
      { email: { contains: params.search, mode: "insensitive" } },
      { itemName: { contains: params.search, mode: "insensitive" } },
    ];
  }
  return where;
}

/**
 * Two tables cannot be paginated by the database as one list, so when no kind
 * filter is set we over-fetch `page * pageSize` from each side, merge, sort by
 * date and slice. Enquiry volume for a home kitchen makes that comfortably
 * cheaper than the alternatives, and the ordering stays exact.
 */
export async function listRequests(params: ListRequestsParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const reach = page * pageSize;

  const wantBulk = params.kind !== "CUSTOM";
  const wantCustom = params.kind !== "BULK";

  const [bulk, bulkTotal, custom, customTotal] = await Promise.all([
    wantBulk
      ? prisma.bulkOrderRequest.findMany({
          where: bulkWhere(params),
          orderBy: { createdAt: "desc" },
          take: reach,
        })
      : Promise.resolve([]),
    wantBulk ? prisma.bulkOrderRequest.count({ where: bulkWhere(params) }) : Promise.resolve(0),
    wantCustom
      ? prisma.customOrderRequest.findMany({
          where: customWhere(params),
          orderBy: { createdAt: "desc" },
          take: reach,
        })
      : Promise.resolve([]),
    wantCustom
      ? prisma.customOrderRequest.count({ where: customWhere(params) })
      : Promise.resolve(0),
  ]);

  const rows: RequestRow[] = [
    ...bulk.map((r) => ({
      id: r.id,
      kind: "BULK" as const,
      requestNo: r.requestNo,
      name: r.name,
      phone: r.phone,
      email: r.email,
      occasion: r.occasion,
      occasionOther: r.occasionOther,
      itemName: null,
      peopleCount: r.peopleCount,
      preferredDate: r.preferredDate,
      budget: r.budget,
      quotedAmount: r.quotedAmount,
      status: r.status,
      createdAt: r.createdAt,
    })),
    ...custom.map((r) => ({
      id: r.id,
      kind: "CUSTOM" as const,
      requestNo: r.requestNo,
      name: r.name,
      phone: r.phone,
      email: r.email,
      occasion: null,
      occasionOther: null,
      itemName: r.itemName,
      peopleCount: null,
      preferredDate: r.preferredDate,
      budget: r.budget,
      quotedAmount: r.quotedAmount,
      status: r.status,
      createdAt: r.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = bulkTotal + customTotal;

  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Unanswered enquiries, for the inbox badge and the dashboard. */
export async function countNewRequests(): Promise<number> {
  const [bulk, custom] = await Promise.all([
    prisma.bulkOrderRequest.count({ where: { status: "NEW" } }),
    prisma.customOrderRequest.count({ where: { status: "NEW" } }),
  ]);
  return bulk + custom;
}

export async function countRequestsByStatus(
  kind?: RequestKind,
): Promise<Record<RequestStatus, number>> {
  const counts = Object.fromEntries(
    Object.values(RequestStatus).map((s) => [s, 0]),
  ) as Record<RequestStatus, number>;

  const [bulk, custom] = await Promise.all([
    kind === "CUSTOM"
      ? Promise.resolve([])
      : prisma.bulkOrderRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    kind === "BULK"
      ? Promise.resolve([])
      : prisma.customOrderRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  for (const group of [...bulk, ...custom]) {
    counts[group.status] += group._count._all;
  }
  return counts;
}

export async function getRequestById(
  kind: RequestKind,
  id: string,
): Promise<RequestDetail | null> {
  if (kind === "BULK") {
    const found = await prisma.bulkOrderRequest.findUnique({ where: { id } });
    return found ? { ...found, kind: "BULK" } : null;
  }
  const found = await prisma.customOrderRequest.findUnique({ where: { id } });
  return found ? { ...found, kind: "CUSTOM" } : null;
}

/**
 * Quoting and answering an enquiry. Unlike an order there are no stock or
 * pricing side effects — the amount recorded here is what the owner told the
 * customer, kept so the conversation has a written record.
 */
export async function updateRequest(
  kind: RequestKind,
  id: string,
  input: RequestStatusUpdateInput,
): Promise<RequestDetail> {
  const existing = await getRequestById(kind, id);
  if (!existing) throw ApiError.notFound("That enquiry no longer exists.");

  const data = {
    status: input.status,
    quotedAmount: input.quotedAmount ?? null,
    adminNotes: input.adminNotes ?? null,
  };

  if (kind === "BULK") {
    const updated = await prisma.bulkOrderRequest.update({ where: { id }, data });
    return { ...updated, kind: "BULK" };
  }
  const updated = await prisma.customOrderRequest.update({ where: { id }, data });
  return { ...updated, kind: "CUSTOM" };
}
