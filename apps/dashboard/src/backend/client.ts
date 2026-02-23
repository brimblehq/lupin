import { BackendNotImplementedError } from "./errors";
import type { ApiClient, ApiRequestOptions } from "./types";

export interface BackendClientConfig {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
}

export interface BackendClient extends ApiClient {
  readonly config: BackendClientConfig;
}

export function createBackendClient(config: BackendClientConfig): BackendClient {
  return {
    config,
    async request<TResponse = unknown, TBody = unknown>(
      path: string,
      options?: ApiRequestOptions<TBody>,
    ): Promise<TResponse> {
      void path;
      void options;
      void config;

      throw new BackendNotImplementedError("client", "request");
    },
  };
}
