import axios, { type AxiosInstance, type AxiosError } from "axios";
import pino from "pino";
import { BackendApiError } from "./errors";
import type { ApiClient, ApiRequestOptions } from "./types";

export interface BackendClientConfig {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  defaultHeaders?: Record<string, string>;
  signatureSecret?: string | null;
  apiKey?: string | null;
}

export interface BackendClient extends ApiClient {
  readonly config: BackendClientConfig;
}

type SupportedLogLevel = "debug" | "info" | "warn" | "error";

function resolveLogLevel(): SupportedLogLevel {
  const runtimeLevel = (typeof process !== "undefined" ? process.env.LOG_LEVEL : undefined) ?? import.meta.env.VITE_LOG_LEVEL;
  const normalized = runtimeLevel?.trim().toLowerCase();

  if (normalized === "debug" || normalized === "info" || normalized === "warn" || normalized === "error") {
    return normalized;
  }

  return import.meta.env.DEV ? "debug" : "info";
}

const backendClientLogger = pino({
  name: "backend-client",
  level: resolveLogLevel(),
  browser: {
    asObject: true,
  },
});

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  throw new Error("Base64 encoding is not supported in this environment");
}

function utf8ToBytes(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

async function hmacSha256Hex(input: string, secret: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const key = await globalThis.crypto.subtle.importKey("raw", utf8ToBytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

    const signature = await globalThis.crypto.subtle.sign("HMAC", key, utf8ToBytes(input));

    return Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  const crypto = await import("node:crypto");
  return crypto.createHmac("sha256", secret).update(input).digest("hex");
}

async function createBrimbleSignatureHeader(data: unknown, expiryInSeconds: number, secret: string | null | undefined) {
  const normalizedSecret = secret?.trim();
  if (!normalizedSecret) {
    return "";
  }

  const payload = {
    data,
    expiry: Date.now() + expiryInSeconds * 1000,
  };
  const payloadJson = JSON.stringify(payload);
  const hmacHex = await hmacSha256Hex(payloadJson, normalizedSecret);
  const payloadBase64 = bytesToBase64(utf8ToBytes(payloadJson));

  return `${hmacHex}.${payloadBase64}`;
}

async function createPaymentKeyHeader(length: number) {
  const bytes = new Uint8Array(length);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytesToBase64(bytes);
  }

  const crypto = await import("node:crypto");
  return crypto.randomBytes(length).toString("base64");
}

export function createBackendClient(config: BackendClientConfig): BackendClient {
  const http: AxiosInstance = axios.create({
    baseURL: config.baseUrl,
    timeout: 25_000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  const buildUrl = (path: string, query?: ApiRequestOptions["query"]) => {
    let url: URL;

    if (path.startsWith("http")) {
      url = new URL(path);
    } else if (path.startsWith("/")) {
      url = new URL(path, config.baseUrl);
    } else {
      url = new URL(path, `${config.baseUrl.replace(/\/$/, "")}/`);
    }

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  };

  const humanizeMessage = (raw: string): string => {
    const lower = raw.toLowerCase();
    if (
      lower.includes("timeout") ||
      lower.includes("timed out") ||
      lower.includes("etimedout") ||
      lower.includes("econnaborted") ||
      lower.includes("upstream request")
    ) {
      return "The request took too long to complete. Please try again.";
    }
    if (lower.includes("network error") || lower.includes("econnrefused") || lower.includes("enotfound")) {
      return "Unable to reach the server. Please check your connection and try again.";
    }
    if (lower.includes("econnreset") || lower.includes("socket hang up")) {
      return "The connection was interrupted. Please try again.";
    }
    return raw;
  };

  const getErrorMessage = (payload: any, fallback: string) => {
    let message = fallback;
    if (payload) {
      if (typeof payload === "string") message = payload;
      else if (typeof payload?.error === "string") message = payload.error;
      else if (typeof payload?.message === "string") message = payload.message;
      else if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
        const first = payload.errors[0];
        if (typeof first?.msg === "string") message = first.msg;
        else if (typeof first?.message === "string") message = first.message;
      }
    }
    return humanizeMessage(message);
  };

  return {
    config,
    async request<TResponse = unknown, TBody = unknown>(path: string, options?: ApiRequestOptions<TBody>): Promise<TResponse> {
      const method = options?.method ?? "GET";
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(config.defaultHeaders ?? {}),
        ...(options?.headers ?? {}),
      };

      if (!headers["X-Brimble-Signature"]) {
        const signature = await createBrimbleSignatureHeader({}, 30, config.signatureSecret);
        if (signature) {
          headers["X-Brimble-Signature"] = signature;
        }
      }

      const skipAuth = headers.Authorization === "";
      if (skipAuth) {
        delete headers.Authorization;
      }

      const accessToken = await config.getAccessToken?.();
      if (accessToken && !skipAuth && !headers.Authorization) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      if (accessToken && !skipAuth && !headers["X-Payment-Key"]) {
        const paymentKey = await createPaymentKeyHeader(16);
        if (paymentKey) {
          headers["X-Payment-Key"] = paymentKey;
        }
      }

      const requestUrl = buildUrl(path, options?.query);
      try {
        const response = await http.request<TResponse>({
          url: requestUrl,
          method,
          headers,
          signal: options?.signal,
          data: method === "GET" ? undefined : options?.body,
          ...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
        });

        return response.data;
      } catch (error) {
        const axiosError = error as AxiosError<any>;
        const payload = axiosError.response?.data;
        const status = axiosError.response?.status;
        const logLevel: "warn" | "error" = status === 401 ? "warn" : "error";
        backendClientLogger[logLevel](
          {
            method,
            requestUrl,
            status,
            data: payload,
          },
          "Backend client request failed",
        );
        throw new BackendApiError({
          code: typeof (payload as any)?.code === "string" ? (payload as any).code : `HTTP_${axiosError.response?.status ?? 500}`,
          status: axiosError.response?.status,
          message: getErrorMessage(payload, axiosError.response?.statusText || axiosError.message || "Request failed"),
          details: payload,
        });
      }
    },
  };
}
