import type { ApiClient } from "./types";

export interface Region {
  id: string;
  name: string;
  country: string;
  continent?: string;
  provider?: string;
  providerIdentifier?: string;
  enabled: boolean;
  isPaid: boolean;
  default: boolean;
  type: "web" | "database" | "both";
}

export interface ListRegionsInput {
  type?: "web" | "database";
  enabled?: boolean;
  teamId?: string;
}

export interface RegionsApi {
  list(input?: ListRegionsInput): Promise<Region[]>;
}

function mapRegion(raw: any): Region | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = String(raw._id ?? raw.id ?? "");
  const name = typeof raw.name === "string" ? raw.name : "";
  if (!id && !name) {
    return null;
  }

  return {
    id,
    name,
    country: typeof raw.country === "string" ? raw.country : "",
    continent: typeof raw.continent === "string" ? raw.continent : undefined,
    provider: typeof raw.provider === "string" ? raw.provider : undefined,
    providerIdentifier:
      typeof raw.provider_identifier === "string"
        ? raw.provider_identifier
        : typeof raw.providerIdentifier === "string"
          ? raw.providerIdentifier
          : undefined,
    enabled: Boolean(raw.enabled ?? true),
    isPaid: Boolean(raw.is_paid ?? raw.isPaid ?? false),
    default: Boolean(raw.default),
    type: raw.type === "web" || raw.type === "database" ? raw.type : "both",
  };
}

export function createRegionsApi(client: ApiClient): RegionsApi {
  return {
    async list(input) {
      const response = await client.request<any>("/core/v1/regions", {
        method: "GET",
        query: {
          type: input?.type,
          enabled: input?.enabled,
          teamId: input?.teamId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? [];

      // The API may return providers with nested regions, or a flat array
      let rawRegions: any[] = [];

      if (Array.isArray(root)) {
        // Could be flat regions or providers with nested regions
        const firstItem = root[0];
        if (firstItem && Array.isArray(firstItem.regions)) {
          // Provider format: [{ name, regions: [...] }]
          for (const provider of root) {
            if (Array.isArray(provider.regions)) {
              for (const region of provider.regions) {
                rawRegions.push(region);
              }
            }
          }
        } else {
          rawRegions = root;
        }
      } else if (root && typeof root === "object") {
        const providers = Array.isArray((root as any).providers) ? (root as any).providers : [];

        if (providers.length) {
          for (const provider of providers) {
            if (Array.isArray(provider?.regions)) {
              for (const region of provider.regions) {
                rawRegions.push(region);
              }
            }
          }
        }
      }

      return rawRegions.map(mapRegion).filter((r): r is Region => r !== null);
    },
  };
}
