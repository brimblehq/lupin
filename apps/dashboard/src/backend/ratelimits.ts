import type { ApiClient } from "./types";

export interface RateLimitMatcher {
  methods?: string[];
  paths?: string[];
}

export interface RateLimitZone {
  name: string;
  key: string;
  window: string;
  events: number;
  matcher?: RateLimitMatcher;
  ipv4Prefix?: number;
  ipv6Prefix?: number;
}

export interface RatelimitSettings {
  project: string;
  enabled: boolean;
  zones: RateLimitZone[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RatelimitSettingsInput {
  enabled?: boolean;
  zones?: RateLimitZone[];
}

export interface RatelimitsApi {
  getSettings(projectId: string, input?: { teamId?: string }): Promise<RatelimitSettings>;
  updateSettings(projectId: string, input: RatelimitSettingsInput & { teamId?: string }): Promise<RatelimitSettings>;
}

interface Envelope<T> {
  message: string;
  data: T;
}

export function createRatelimitsApi(client: ApiClient): RatelimitsApi {
  const basePath = "/core/v1/ratelimits";

  return {
    async getSettings(projectId, input) {
      const response = await client.request<Envelope<RatelimitSettings>>(`${basePath}/${encodeURIComponent(projectId)}`, {
        method: "GET",
        query: { teamId: input?.teamId },
      });
      return response.data;
    },
    async updateSettings(projectId, input) {
      const response = await client.request<Envelope<RatelimitSettings>>(`${basePath}/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        query: { teamId: input.teamId },
        body: { enabled: input.enabled, zones: input.zones },
      });
      return response.data;
    },
  };
}
