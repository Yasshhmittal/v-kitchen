import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

/**
 * A single response shape for every endpoint:
 *   success -> { data, meta? }
 *   failure -> { error: { code, message, fields? } }
 *
 * The client only ever has to look in two places, and error messages are
 * written for a shop owner, not a developer.
 */

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/** Throw this anywhere inside a service; `handleApiError` maps it to HTTP. */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message = "That request wasn't valid.") {
    return new ApiError("BAD_REQUEST", message);
  }
  static unauthenticated(message = "Sign in to continue.") {
    return new ApiError("UNAUTHENTICATED", message);
  }
  static forbidden(message = "You don't have permission to do that.") {
    return new ApiError("FORBIDDEN", message);
  }
  static notFound(message = "We couldn't find that.") {
    return new ApiError("NOT_FOUND", message);
  }
  static conflict(message: string) {
    return new ApiError("CONFLICT", message);
  }
  static validation(fields: Record<string, string>, message = "Please check the highlighted fields.") {
    return new ApiError("VALIDATION_ERROR", message, fields);
  }
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function ok<T>(data: T, meta?: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(meta ? { data, meta } : { data }, init);
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function fail(code: ApiErrorCode, message: string, fields?: Record<string, string>) {
  return NextResponse.json(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status: STATUS_BY_CODE[code] },
  );
}

/**
 * Convert anything thrown inside a route handler into a safe response.
 * Unexpected errors are logged in full but reported generically — internal
 * messages and stack traces must never reach the browser.
 */
export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.code, error.message, error.fields);
  }

  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.errors) {
      const path = issue.path.join(".") || "_";
      if (!fields[path]) fields[path] = issue.message;
    }
    return fail("VALIDATION_ERROR", "Please check the highlighted fields.", fields);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const target = (error.meta?.target as string[] | undefined)?.join(", ") ?? "value";
        return fail("CONFLICT", `That ${target} is already in use.`);
      }
      case "P2025":
        return fail("NOT_FOUND", "We couldn't find that.");
      case "P2003":
        return fail(
          "CONFLICT",
          "This is still linked to other records, so it can't be removed.",
        );
    }
  }

  console.error("[api] unhandled error:", error);
  return fail("INTERNAL_ERROR", "Something went wrong on our side. Please try again.");
}

/** Wrap a route handler so every throw becomes a well-formed response. */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

export function buildPageMeta(total: number, page: number, pageSize: number): PageMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
