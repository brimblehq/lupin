import type { ApiClient } from "./types";

export type XFrameOptions = "DENY" | "SAMEORIGIN" | "disabled";
export type XContentTypeOptions = "nosniff" | "disabled";
export type XRobotsTag = "index, follow" | "noindex, nofollow" | "noindex, follow" | "index, nofollow" | "disabled";

export interface NetworkSettings {
  id: string;
  project: string;
  cache: {
    purgeOnDeploy: boolean;
    bypassCache: boolean;
  };
  responseRules: {
    xFrameOptions: XFrameOptions;
    xContentTypeOptions: XContentTypeOptions;
    xRobotsTag: XRobotsTag;
    hstsEnabled: boolean;
    markdownForAgents: boolean;
  };
  firewall: {
    pathBlocking: boolean;
    browserIntegrityCheck: boolean;
    underAttackMode: boolean;
  };
  cloudflare: {
    lastSyncedAt?: string;
    syncError?: string;
  };
}

export interface NetworkSyncResult {
  synced: boolean;
  hosts: string[];
  zones?: { domain: string; zoneId: string }[];
  message?: string;
}

export interface NetworkSettingsInput {
  cache?: Partial<NetworkSettings["cache"]>;
  responseRules?: Partial<NetworkSettings["responseRules"]>;
  firewall?: Partial<NetworkSettings["firewall"]>;
}

export interface NetworkSettingsApi {
  getSettings(projectId: string, input?: { teamId?: string }): Promise<{ settings: NetworkSettings; hosts: string[] }>;
  updateSettings(
    projectId: string,
    input: NetworkSettingsInput & { teamId?: string },
  ): Promise<{ settings: NetworkSettings; hosts: string[]; sync: NetworkSyncResult }>;
  purgeCache(projectId: string, input?: { teamId?: string }): Promise<{ hosts: string[]; purged: boolean }>;
}

interface Envelope<T> {
  message: string;
  data: T;
}

export function createNetworkingApi(client: ApiClient): NetworkSettingsApi {
  const basePath = "/core/v1/networking";

  return {
    async getSettings(projectId, input) {
      const response = await client.request<Envelope<{ settings: NetworkSettings; hosts: string[] }>>(
        `${basePath}/${encodeURIComponent(projectId)}`,
        { method: "GET", query: { teamId: input?.teamId } },
      );
      return response.data;
    },
    async updateSettings(projectId, input) {
      const response = await client.request<Envelope<{ settings: NetworkSettings; hosts: string[]; sync: NetworkSyncResult }>>(
        `${basePath}/${encodeURIComponent(projectId)}`,
        {
          method: "PATCH",
          query: { teamId: input.teamId },
          body: {
            cache: input.cache,
            responseRules: input.responseRules,
            firewall: input.firewall,
          },
        },
      );
      return response.data;
    },
    async purgeCache(projectId, input) {
      const response = await client.request<Envelope<{ hosts: string[]; purged: boolean }>>(
        `${basePath}/${encodeURIComponent(projectId)}/purge-cache`,
        { method: "POST", query: { teamId: input?.teamId } },
      );
      return response.data;
    },
  };
}
