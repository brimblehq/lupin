import type { ApiClient } from "./types";
import { asRecord } from "./normalize";

export type AblyTokenScope = "user" | "sandbox";

export interface GetAblyTokenInput {
  scope: AblyTokenScope;
  sandboxId?: string;
  sandboxIds?: string[];
}

export type AblyTokenRequestValue = string | number | boolean | object;
export type AblyTokenRequest = Record<string, AblyTokenRequestValue>;

export interface AblyApi {
  getToken(input: GetAblyTokenInput): Promise<AblyTokenRequest>;
}

function sanitizeIds(ids: string[] | undefined): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }

  const unique = new Set<string>();
  for (const value of ids) {
    const trimmed = value.trim();
    if (trimmed) {
      unique.add(trimmed);
    }
  }

  return [...unique];
}

export function createAblyApi(client: ApiClient): AblyApi {
  return {
    async getToken(input) {
      const normalizedScope = input.scope;
      const normalizedSandboxId = input.sandboxId?.trim();
      const normalizedSandboxIds = sanitizeIds(input.sandboxIds);

      const response = await client.request<unknown>("/core/v1/ably/token", {
        method: "GET",
        query: {
          scope: normalizedScope,
          sandboxId: normalizedSandboxId || undefined,
          sandboxIds: normalizedSandboxIds.length > 0 ? normalizedSandboxIds.join(",") : undefined,
        },
      });

      const responseRow = asRecord(response);
      const dataRow = asRecord(responseRow?.data);
      const nestedDataRow = asRecord(dataRow?.data);

      if (nestedDataRow) {
        return nestedDataRow as AblyTokenRequest;
      }

      if (dataRow) {
        return dataRow as AblyTokenRequest;
      }

      if (responseRow) {
        return responseRow as AblyTokenRequest;
      }

      return {};
    },
  };
}
