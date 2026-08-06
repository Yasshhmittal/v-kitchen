/**
 * Typed fetch wrapper for the API.
 *
 * Every endpoint answers with `{ data }` or `{ error: { code, message } }`, so
 * this unwraps the success case and throws a typed error otherwise — callers
 * get either the payload or a message they can show the user directly.
 */

export interface ApiErrorShape {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Set to false for FormData uploads, which set their own boundary. */
  json?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, json = true, headers, ...rest } = options;

  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(json && body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : json ? JSON.stringify(body) : (body as BodyInit),
    credentials: "same-origin",
  });

  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError(
      "INTERNAL_ERROR",
      "The server sent back something unexpected. Please try again.",
      response.status,
    );
  }

  if (!response.ok) {
    const error = (payload as { error?: ApiErrorShape }).error;
    throw new ApiClientError(
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? "Something went wrong. Please try again.",
      response.status,
      error?.fields,
    );
  }

  return (payload as { data: T }).data;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", body: formData, json: false }),
};

/** Build a query string, dropping empty values so URLs stay clean. */
export function queryString(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const result = search.toString();
  return result ? `?${result}` : "";
}
