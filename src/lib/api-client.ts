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
  return (await requestFull<T>(path, options)).data;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Like `request`, but keeps `meta` as well as `data` — list endpoints return
 * pagination there and the caller usually needs both.
 */
async function requestFull<T, M = PageMeta>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta?: M }> {
  const { body, json = true, headers, ...rest } = options;

  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(json && body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...csrfHeader(),
      ...headers,
    },
    body: body === undefined ? undefined : json ? JSON.stringify(body) : (body as BodyInit),
    credentials: "same-origin",
  });

  if (response.status === 204) return { data: undefined as T };

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

  return payload as { data: T; meta?: M };
}

/**
 * Echo the readable CSRF cookie into a header. The server compares the two;
 * a cross-origin page can cause the cookie to be sent but cannot read it, so
 * it cannot set the matching header.
 */
function csrfHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|;\s*)vk_csrf=([^;]*)/);
  return match?.[1] ? { "x-csrf-token": decodeURIComponent(match[1]) } : {};
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  /** Get with pagination meta — returns `{ data, meta }` so the caller has `total`, `page` etc. */
  getFull: <T, M = PageMeta>(path: string, options?: RequestOptions) =>
    requestFull<T, M>(path, { ...options, method: "GET" }),
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
