export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions<TBody = unknown> {
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: TBody;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Per-request timeout in milliseconds. Overrides the client's default 25s. */
  timeout?: number;
}

export interface ApiClient {
  request<TResponse = unknown, TBody = unknown>(path: string, options?: ApiRequestOptions<TBody>): Promise<TResponse>;
}

export interface ApiListResponse<TItem> {
  items: TItem[];
  total?: number;
  cursor?: string | null;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}
