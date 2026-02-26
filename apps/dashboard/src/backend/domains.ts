import type { ApiClient, ApiListResponse } from "./types";
import config from "@/config";
import {
  asNonEmptyString,
  asRecord,
  pickBoolean,
  pickNonEmptyString,
  pickNumber,
  pickString,
} from "./normalize";

export interface DomainRecord {
  id: string;
  name: string;
  projectId?: string;
  projectName?: string;
  active: boolean;
  enabled?: boolean;
  isCustom?: boolean;
  isExpired?: boolean;
  purchased?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string;
  redirect?: {
    url?: string;
    status?: number;
  } | null;
}

export interface DomainDetailDnsRecord {
  id: string;
  name: string;
  type: string;
  value: string;
  ttl?: number;
  isProxied?: boolean;
}

export interface DomainDetailsRecord extends DomainRecord {
  registrar?: string;
  creatorName?: string;
  expiresAt?: string;
  renewalPrice?: number;
  renewalDuration?: number;
  autoRenewal?: boolean;
  nameservers?: string[];
  nameserver?: {
    expected: string[];
    actual: string[];
  } | null;
  dnsRecords: DomainDetailDnsRecord[];
}

export interface PaginatedDomainsResponse extends ApiListResponse<DomainRecord> {
  currentPage: number;
  totalPages: number;
}

export interface ListDomainsInput {
  projectName?: string;
  q?: string;
  page?: number;
  teamId?: string;
}

export interface AddDomainInput {
  name: string;
  projectId?: string;
  teamId?: string;
}

export interface UpdateDomainInput {
  id: string;
  name?: string;
  redirect?: {
    url?: string;
    status?: number;
  } | null;
  teamId?: string;
}

export interface SearchDomainResult {
  domainName: string;
  purchasable: boolean;
  purchasePrice?: number;
  renewalPrice?: number;
}

export interface PurchaseDomainInput {
  name: string;
  duration: number;
  cardId: string;
  projectId?: string;
  privacyEnabled: boolean;
  autoRenewal: boolean;
  teamId?: string;
}

export interface RenewDomainInput {
  domainId: string;
  duration: number;
  autoRenew: boolean;
  teamId?: string;
}

export interface DomainsApi {
  list(input?: ListDomainsInput): Promise<PaginatedDomainsResponse>;
  getStatus(domainName: string, input?: { teamId?: string }): Promise<DomainRecord | null>;
  getByName(
    domainName: string,
    input?: { teamId?: string },
  ): Promise<DomainDetailsRecord | null>;
  add(input: AddDomainInput): Promise<DomainRecord>;
  update(input: UpdateDomainInput): Promise<DomainRecord>;
  transfer(input: { domainId: string; projectId: string; teamId?: string }): Promise<void>;
  searchSale(domainName: string): Promise<SearchDomainResult[]>;
  purchaseSale(input: PurchaseDomainInput): Promise<void>;
  renewSale(input: RenewDomainInput): Promise<void>;
  verify(domainId: string): Promise<DomainRecord>;
  remove(input: { domainId: string; projectId?: string; teamId?: string }): Promise<void>;
  createDnsRecord(input: {
    domain: string;
    record: { type: string; value: string; name: string; ttl?: number; isProxied?: boolean };
    teamId?: string;
  }): Promise<DomainDetailDnsRecord>;
  updateDnsRecord(input: {
    domain: string;
    recordId: string;
    record: { type: string; value: string; name: string; ttl?: number; isProxied?: boolean };
    teamId?: string;
  }): Promise<DomainDetailDnsRecord>;
  deleteDnsRecord(input: { domain: string; recordId: string; teamId?: string }): Promise<void>;
}

function mapDomainRecord(domain: any): DomainRecord | null {
  const row = asRecord(domain) ?? {};
  const whoisRecord = asRecord(row.whois);
  const whoisUserRecord = asRecord(whoisRecord?.user);
  const projectRecord = asRecord(row.project);

  const name = pickNonEmptyString(row, "name") ?? pickNonEmptyString(whoisRecord, "name") ?? "";
  if (!name) {
    return null;
  }

  let projectId: string | undefined;
  let projectName: string | undefined;
  if (projectRecord) {
    if (projectRecord.id != null || projectRecord._id != null) {
      projectId = String(projectRecord.id ?? projectRecord._id);
    }
    projectName = pickNonEmptyString(projectRecord, "name");
  } else {
    projectId = asNonEmptyString(row.project);
  }

  let createdByName: string | undefined;
  const firstName = pickNonEmptyString(whoisUserRecord, "first_name") ?? "";
  const lastName = pickNonEmptyString(whoisUserRecord, "last_name") ?? "";
  if (firstName || lastName) {
    createdByName = `${firstName} ${lastName}`.trim();
  }

  const active = pickBoolean(row, "active", "enabled") ?? false;
  const enabled = pickBoolean(row, "enabled");

  let isCustom = pickBoolean(row, "isCustom", "is_custom");
  if (isCustom === undefined) {
    const lowerName = name.toLowerCase();
    const isBrimbleManagedDefault =
      lowerName.endsWith(".brimble.app") || lowerName.endsWith(".brimble.io");

    if (isBrimbleManagedDefault) {
      isCustom = false;
    }
  }

  const isExpired = pickBoolean(row, "isExpired");
  const purchased = pickBoolean(row, "purchased");

  let redirect: DomainRecord["redirect"] = null;
  const redirectRecord = asRecord(row.redirect);
  if (redirectRecord) {
    redirect = {
      url: pickNonEmptyString(redirectRecord, "url"),
      status: pickNumber(redirectRecord, "status"),
    };
  }

  const createdAt = pickString(row, "createdAt", "created_at");
  const updatedAt = pickString(row, "updatedAt", "updated_at");

  return {
    id: String(row.id ?? row._id ?? name),
    name,
    projectId,
    projectName,
    active,
    enabled,
    isCustom,
    isExpired,
    purchased,
    createdAt,
    updatedAt,
    createdByName,
    redirect,
  };
}

function mapDomainDetailsRecord(domain: any): DomainDetailsRecord | null {
  const base = mapDomainRecord(domain);
  if (!base) {
    return null;
  }

  const row = asRecord(domain) ?? {};
  const whoisRecord = asRecord(row.whois);
  const whoisUserRecord = asRecord(whoisRecord?.user);
  const nameserverRecord = asRecord(row.nameserver);
  const registrar = pickNonEmptyString(whoisRecord, "registrar");

  let creatorName: string | undefined;
  const firstName = pickNonEmptyString(whoisUserRecord, "first_name") ?? "";
  const lastName = pickNonEmptyString(whoisUserRecord, "last_name") ?? "";
  if (firstName || lastName) {
    creatorName = `${firstName} ${lastName}`.trim();
  }

  const expiresAt = pickNonEmptyString(whoisRecord, "expires_at", "renewal_date");
  const renewalPrice = pickNumber(whoisRecord, "renewal_price", "renewalPrice");
  const renewalDuration = pickNumber(row, "renewal_duration", "renewalDuration");
  const autoRenewal = pickBoolean(row, "auto_renewal", "autoRenewal");

  let nameservers: string[] = [];
  if (Array.isArray(row.nameservers)) {
    nameservers = row.nameservers
      .map((item: unknown) => {
        if (typeof item === "string") {
          return item.trim();
        }
        return "";
      })
      .filter(Boolean);
  }

  let nameserver: DomainDetailsRecord["nameserver"] = null;
  if (nameserverRecord) {
    let expected: string[] = [];
    if (Array.isArray(nameserverRecord.expected)) {
      expected = nameserverRecord.expected
        .map((item: unknown) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    }

    let actual: string[] = [];
    if (Array.isArray(nameserverRecord.actual)) {
      actual = nameserverRecord.actual
        .map((item: unknown) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    }

    nameserver = { expected, actual };
  }

  let dnsRecords: DomainDetailDnsRecord[] = [];
  if (Array.isArray(row.dns)) {
    dnsRecords = row.dns
      .map((record: any) => {
        const recordRow = asRecord(record) ?? {};
        const name = pickNonEmptyString(recordRow, "name") ?? "";
        const type = pickNonEmptyString(recordRow, "type") ?? "";
        const value = pickNonEmptyString(recordRow, "value") ?? "";

        if (!name && !type && !value) {
          return null;
        }

        const ttl = pickNumber(recordRow, "ttl");
        const isProxied = pickBoolean(recordRow, "isProxied", "is_proxied");

        return {
          id: String(recordRow.id ?? recordRow._id ?? `${type}:${name}:${value}`),
          name,
          type,
          value,
          ttl,
          isProxied,
        } satisfies DomainDetailDnsRecord;
      })
      .filter((record: DomainDetailDnsRecord | null): record is DomainDetailDnsRecord => {
        return record !== null;
      });
  }

  return {
    ...base,
    registrar,
    creatorName,
    expiresAt,
    renewalPrice,
    renewalDuration,
    autoRenewal,
    nameservers,
    nameserver,
    dnsRecords,
  };
}

function mapDnsRecord(record: any): DomainDetailDnsRecord | null {
  const recordRow = asRecord(record) ?? {};
  const name = pickNonEmptyString(recordRow, "name") ?? "";
  const type = pickNonEmptyString(recordRow, "type") ?? "";
  const value = pickNonEmptyString(recordRow, "value") ?? "";

  if (!name && !type && !value) {
    return null;
  }

  return {
    id: String(recordRow.id ?? recordRow._id ?? `${type}:${name}:${value}`),
    name,
    type,
    value,
    ttl: pickNumber(recordRow, "ttl"),
    isProxied: pickBoolean(recordRow, "isProxied", "is_proxied"),
  };
}

export function createDomainsApi(client: ApiClient): DomainsApi {
  const listEndpoint = "/core/v1/domains";

  return {
    async list(input) {
      const response = await client.request<any>(listEndpoint, {
        method: "GET",
        query: {
          name: input?.projectName,
          q: input?.q,
          page: input?.page,
          teamId: input?.teamId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      let rawDomains: any[] = [];
      if (Array.isArray(root?.domains)) {
        rawDomains = root.domains;
      } else if (Array.isArray(root)) {
        rawDomains = root;
      }

      const items = rawDomains
        .map((domain: any) => mapDomainRecord(domain))
        .filter((domain: DomainRecord | null): domain is DomainRecord => domain !== null);

      const rootRecord = asRecord(root);
      const currentPage = pickNumber(rootRecord, "currentPage", "current_page") ?? 1;
      const totalPages = pickNumber(rootRecord, "totalPages", "total_pages") ?? 1;
      const total = pickNumber(rootRecord, "total", "overallTotalDomains", "count");

      return {
        items,
        currentPage,
        totalPages,
        total,
      };
    },

    async getStatus(domainName, input) {
      const response = await client.request<any>(
        `${listEndpoint}/${encodeURIComponent(domainName)}/status`,
        {
          method: "GET",
          query: {
            teamId: input?.teamId,
          },
        },
      );

      const root = response?.data?.data ?? response?.data ?? response ?? null;
      if (!root) {
        return null;
      }

      return mapDomainRecord(root);
    },

    async getByName(domainName, input) {
      const response = await client.request<any>(
        `${listEndpoint}/${encodeURIComponent(domainName)}`,
        {
          method: "GET",
          query: {
            teamId: input?.teamId,
          },
        },
      );

      const root = response?.data?.data ?? response?.data ?? response ?? null;
      if (!root) {
        return null;
      }

      return mapDomainDetailsRecord(root);
    },

    async add(input) {
      const response = await client.request<any>(
        `${listEndpoint}/${input.projectId ? encodeURIComponent(input.projectId) : ""}`,
        {
          method: "POST",
          body: {
            name: input.name,
            teamId: input.teamId,
          },
        },
      );

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const mapped = mapDomainRecord(root);
      if (!mapped) {
        throw new Error("Invalid domain response");
      }

      return mapped;
    },

    async update(input) {
      const response = await client.request<any>(
        `${listEndpoint}/${encodeURIComponent(input.id)}`,
        {
          method: "PATCH",
          body: {
            name: input.name,
            redirect: input.redirect,
            teamId: input.teamId,
          },
        },
      );

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const mapped = mapDomainRecord(root);
      if (!mapped) {
        throw new Error("Invalid domain response");
      }

      return mapped;
    },

    async transfer(input) {
      await client.request<any>(
        `${listEndpoint}/${encodeURIComponent(input.domainId)}/transfer/${encodeURIComponent(input.projectId)}`,
        {
          method: "POST",
          body: {
            teamId: input.teamId,
          },
        },
      );
    },

    async searchSale(domainName) {
      const response = await client.request<any>("/core/v1/domains/sale/search", {
        method: "POST",
        body: {
          name: domainName,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? [];
      const items = Array.isArray(root) ? root : [];

      return items
        .map((item: any) => {
          const row = asRecord(item);
          const name = pickString(row, "domainName", "name") ?? "";
          if (!name) {
            return null;
          }

          return {
            domainName: name,
            purchasable: Boolean(row?.purchasable),
            purchasePrice: pickNumber(row, "purchasePrice"),
            renewalPrice: pickNumber(row, "renewalPrice"),
          } satisfies SearchDomainResult;
        })
        .filter((item: SearchDomainResult | null): item is SearchDomainResult => item !== null);
    },

    async purchaseSale(input) {
      const endpoint = "/core/v1/domains/sale/purchase";
      const body = {
        name: input.name,
        duration: input.duration,
        cardId: input.cardId,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        privacyEnabled: input.privacyEnabled,
        autoRenewal: input.autoRenewal,
        teamId: input.teamId,
      };
      await client.request<any>(endpoint, {
        method: "POST",
        body,
      });
    },

    async renewSale(input) {
      const endpoint = "/core/v1/domains/sale/renew";
      const body = {
        id: input.domainId,
        duration: input.duration,
        auto_renew: input.autoRenew,
        teamId: input.teamId,
      };

      console.log("[domains.renewSale] request", {
        endpoint,
        payload: body,
      });

      try {
        const response = await client.request<any>(endpoint, {
          method: "POST",
          body,
        });

        console.log("[domains.renewSale] response", {
          endpoint,
          response,
        });
      } catch (error) {
        const err = error as {
          message?: string;
          status?: number;
          code?: string;
          details?: unknown;
        };

        console.log("[domains.renewSale] error", {
          endpoint,
          error: {
            message: err?.message,
            status: err?.status,
            code: err?.code,
            details: err?.details,
          },
        });
        console.log(
          "[domains.renewSale] error details json",
          JSON.stringify(err?.details ?? null, null, 2),
        );

        throw error;
      }
    },

    async verify() {
      throw new Error("Not implemented: domains.verify");
    },

    async remove(input) {
      const domainId = input.domainId.trim();
      if (!domainId) {
        throw new Error("Domain id is required");
      }

      let path = `${listEndpoint}/${encodeURIComponent(domainId)}`;
      if (input.projectId && input.projectId.trim()) {
        path = `${path}/${encodeURIComponent(input.projectId.trim())}`;
      }

      await client.request<any>(path, {
        method: "DELETE",
        query: {
          teamId: input.teamId,
        },
      });
    },

    async createDnsRecord(input) {
      const response = await client.request<any>(config.dnsApiUrl, {
        method: "POST",
        query: {
          teamId: input.teamId,
        },
        body: {
          domain: input.domain,
          record: input.record,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const record =
        mapDnsRecord(root?.record) ??
        mapDnsRecord(root?.dns) ??
        mapDnsRecord(root);

      if (!record) {
        return {
          id: `${input.record.type}:${input.record.name}:${input.record.value}`,
          name: input.record.name,
          type: input.record.type,
          value: input.record.value,
        };
      }

      return record;
    },

    async updateDnsRecord(input) {
      const response = await client.request<any>(
        `${config.dnsApiUrl}/${encodeURIComponent(input.domain)}/${encodeURIComponent(input.recordId)}`,
        {
          method: "PATCH",
          query: {
            teamId: input.teamId,
          },
          body: {
            record: input.record,
          },
        },
      );

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const record =
        mapDnsRecord(root?.record) ??
        mapDnsRecord(root?.dns) ??
        mapDnsRecord(root);

      if (!record) {
        return {
          id: input.recordId,
          name: input.record.name,
          type: input.record.type,
          value: input.record.value,
        };
      }

      return {
        ...record,
        id: record.id || input.recordId,
      };
    },

    async deleteDnsRecord(input) {
      await client.request<any>(
        `${config.dnsApiUrl}/${encodeURIComponent(input.domain)}/${encodeURIComponent(input.recordId)}`,
        {
          method: "DELETE",
          query: {
            teamId: input.teamId,
          },
        },
      );
    },
  };
}
