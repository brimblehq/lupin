import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import type { BackendApi } from "@/backend";
import type { DomainDetailsRecord, DomainRecord, PaginatedDomainsResponse } from "@/backend/domains";
import type { PaginatedProjectsResponse } from "@/backend/projects";
import config from "@/config";
import type { TransferDomainWorkspacePayload } from "./types";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";
import { domainsLogger, domainsDnsLogger } from "@/server/shared/logger";
import { resolveEnvironmentId } from "@/utils/environment-selection";

async function resolveTeamIdFromWorkspace(api: BackendApi, workspace?: string) {
  return resolveTeamId(api, workspace);
}

function buildEnvironmentPreferenceCookieName(workspace?: string) {
  const scope = (workspace?.trim().toLowerCase() || "__personal__").replace(/[^a-z0-9_-]/g, "_");
  return `${config.environmentPreferenceCookiePrefix}${scope}`;
}

async function resolveDomainsEnvironmentId(
  api: BackendApi,
  input: {
    workspace?: string;
    teamId?: string;
    requestedEnvironmentId?: string;
  },
) {
  const requestedEnvironmentId = input.requestedEnvironmentId?.trim() || undefined;
  if (requestedEnvironmentId === "all") {
    return undefined;
  }

  const preferredEnvironmentId = getCookie(buildEnvironmentPreferenceCookieName(input.workspace))?.trim() || null;
  const environments = await api.environments.listEnvironments({ teamId: input.teamId }).catch(() => []);

  return resolveEnvironmentId({
    requestedEnvironmentId,
    preferredEnvironmentId,
    environments,
  });
}

export const listDomainsPageServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        page?: number;
        q?: string;
        projectName?: string;
        environmentId?: string;
      }
    | undefined;

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    const environmentId = await resolveDomainsEnvironmentId(api, {
      workspace: payload?.workspace,
      teamId,
      requestedEnvironmentId: payload?.environmentId,
    });

    return api.domains.list({
      page: payload?.page,
      q: payload?.q,
      projectName: payload?.projectName,
      teamId,
      environmentId,
      useEnvironmentHeader: Boolean(environmentId),
    });
  });
});

export const refreshDomainStatusServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        domainName: string;
        environmentId?: string;
      }
    | undefined;

  const domainName = payload?.domainName?.trim();
  if (!domainName) {
    throw new Error("Domain name is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    const environmentId = await resolveDomainsEnvironmentId(api, {
      workspace: payload?.workspace,
      teamId,
      requestedEnvironmentId: payload?.environmentId,
    });
    return api.domains.getStatus(domainName, {
      teamId,
      environmentId,
      useEnvironmentHeader: Boolean(environmentId),
    });
  });
});

export const getDomainDetailsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        domainName: string;
        environmentId?: string;
      }
    | undefined;

  const domainName = payload?.domainName?.trim();
  if (!domainName) {
    throw new Error("Domain name is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    const environmentId = await resolveDomainsEnvironmentId(api, {
      workspace: payload?.workspace,
      teamId,
      requestedEnvironmentId: payload?.environmentId,
    });

    let domain = await api.domains.getByName(domainName, {
      teamId,
      environmentId,
      useEnvironmentHeader: Boolean(environmentId),
    });

    if (!domain && teamId) {
      domain = await api.domains.getByName(domainName, {});
    }

    if (!domain) {
      throw new Error(`Domain not found: ${domainName}`);
    }

    return domain;
  });
});

export const createProjectDomainServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        id?: string;
        projectId?: string;
        name: string;
      }
    | undefined;

  const name = payload?.name?.trim().toLowerCase();
  if (!name) {
    throw new Error("Domain name is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    const domainProjectId = payload?.id?.trim() || payload?.projectId?.trim();
    return api.domains.add({
      name,
      id: domainProjectId,
      projectId: domainProjectId,
      teamId,
    });
  });
});

export const updateDomainServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        id: string;
        name?: string;
        redirect?: {
          url?: string;
          status?: number;
        } | null;
      }
    | undefined;

  const id = payload?.id?.trim();
  if (!id) {
    throw new Error("Domain id is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    return api.domains.update({
      id,
      name: payload?.name?.trim(),
      redirect: payload?.redirect ?? null,
      teamId,
    });
  });
});

export const transferDomainServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        domainId: string;
        projectId: string;
      }
    | undefined;

  const domainId = payload?.domainId?.trim();
  const projectId = payload?.projectId?.trim();
  if (!domainId) {
    throw new Error("Domain id is required");
  }
  if (!projectId) {
    throw new Error("Project id is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    await api.domains.transfer({
      domainId,
      projectId,
      teamId,
    });

    return { success: true };
  });
});

export const transferDomainWorkspaceServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as TransferDomainWorkspacePayload | undefined;

  const domainId = payload?.domainId?.trim();
  if (!domainId) {
    throw new Error("Domain id is required");
  }

  const targetTeamId =
    typeof payload?.targetTeamId === "string" && payload.targetTeamId.trim() ? payload.targetTeamId.trim() : null;

  return withTokenRefresh(
    async (api) => {
      await api.domains.transferWorkspace({ domainId, targetTeamId });
      return { success: true };
    },
    { stepUpToken: payload?.twoFactorToken },
  );
});

export const deleteDomainServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        domainId: string;
        projectId?: string;
        twoFactorToken?: string;
      }
    | undefined;

  const domainId = payload?.domainId?.trim();
  if (!domainId) {
    throw new Error("Domain id is required");
  }

  const projectId = payload?.projectId?.trim() || undefined;

  return withTokenRefresh(
    async (api) => {
      const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
      await api.domains.remove({
        domainId,
        projectId,
        teamId,
      });

      return { success: true };
    },
    { stepUpToken: payload?.twoFactorToken },
  );
});

export const searchDomainSaleServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        name: string;
      }
    | undefined;

  const name = payload?.name?.trim().toLowerCase();
  if (!name) {
    return [];
  }

  return withTokenRefresh(async (api) => {
    return api.domains.searchSale(name);
  });
});

export const purchaseDomainServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        name: string;
        duration: number;
        projectId?: string;
        privacyEnabled: boolean;
        autoRenewal: boolean;
      }
    | undefined;

  const name = payload?.name?.trim();
  if (!name) {
    throw new Error("Domain name is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    const requestPayload = {
      name,
      duration: payload?.duration ?? 1,
      projectId: payload?.projectId,
      privacyEnabled: payload?.privacyEnabled ?? false,
      autoRenewal: payload?.autoRenewal ?? false,
      teamId,
    };

    await api.domains.purchaseSale(requestPayload);

    return { success: true };
  });
});

export const renewDomainSaleServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        domainId: string;
        duration?: number;
        autoRenew?: boolean;
      }
    | undefined;

  const domainId = payload?.domainId?.trim();
  if (!domainId) {
    throw new Error("Domain id is required");
  }

  const durationRaw = Number(payload?.duration ?? 1);
  const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.floor(durationRaw) : 1;

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    const requestPayload = {
      id: domainId,
      duration,
      autoRenew: Boolean(payload?.autoRenew),
      teamId,
    };

    domainsLogger.debug("renew request payload:", requestPayload);

    return api.domains.renewSale(requestPayload);
  });
});

export const listDomainProjectsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
      }
    | undefined;

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);

    return api.projects.list({
      teamId,
      sort: "updatedAt",
      page: 1,
      limit: 100,
    }) as Promise<PaginatedProjectsResponse>;
  });
});

export const createDomainDnsRecordServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        domainName: string;
        record: { type: string; name: string; value: string; ttl?: number; isProxied?: boolean };
      }
    | undefined;

  const domainName = payload?.domainName?.trim();
  if (!domainName) {
    throw new Error("Domain name is required");
  }

  const type = payload?.record?.type?.trim().toUpperCase();
  const name = payload?.record?.name?.trim();
  const value = payload?.record?.value?.trim();
  if (!type || !name || !value) {
    throw new Error("Record type, name, and value are required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    const requestPayload = {
      domain: domainName,
      teamId,
      record: {
        type,
        name,
        value,
        ttl: typeof payload?.record?.ttl === "number" ? payload.record.ttl : 3600,
        isProxied: Boolean(payload?.record?.isProxied),
      },
    };

    domainsDnsLogger.debug("create", requestPayload);

    return api.domains.createDnsRecord(requestPayload);
  });
});

export const updateDomainDnsRecordServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        domainName: string;
        recordId: string;
        record: { type: string; name: string; value: string; ttl?: number; isProxied?: boolean };
      }
    | undefined;

  const domainName = payload?.domainName?.trim();
  const recordId = payload?.recordId?.trim();
  if (!domainName) {
    throw new Error("Domain name is required");
  }
  if (!recordId) {
    throw new Error("Record id is required");
  }

  const type = payload?.record?.type?.trim().toUpperCase();
  const name = payload?.record?.name?.trim();
  const value = payload?.record?.value?.trim();
  if (!type || !name || !value) {
    throw new Error("Record type, name, and value are required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    const requestPayload = {
      domain: domainName,
      recordId,
      teamId,
      record: {
        type,
        name,
        value,
        ttl: typeof payload?.record?.ttl === "number" ? payload.record.ttl : 3600,
        isProxied: Boolean(payload?.record?.isProxied),
      },
    };

    domainsDnsLogger.debug("update", requestPayload);

    return api.domains.updateDnsRecord(requestPayload);
  });
});

export const deleteDomainDnsRecordServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        domainName: string;
        recordId: string;
      }
    | undefined;

  const domainName = payload?.domainName?.trim();
  const recordId = payload?.recordId?.trim();
  if (!domainName) {
    throw new Error("Domain name is required");
  }
  if (!recordId) {
    throw new Error("Record id is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    domainsDnsLogger.debug("delete", {
      domain: domainName,
      recordId,
      teamId,
    });
    await api.domains.deleteDnsRecord({
      domain: domainName,
      recordId,
      teamId,
    });

    return { success: true };
  });
});

export const transferOutServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        domainName: string;
        twoFactorToken?: string;
      }
    | undefined;

  const domainName = payload?.domainName?.trim();
  if (!domainName) {
    throw new Error("Domain name is required");
  }

  return withTokenRefresh(
    async (api) => {
      const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
      return api.domains.transferOut(domainName, teamId);
    },
    { stepUpToken: payload?.twoFactorToken },
  );
});

export const setDomainNameserversServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        domainId: string;
        nameservers: string[];
      }
    | undefined;

  const domainId = payload?.domainId?.trim();
  if (!domainId) {
    throw new Error("Domain ID is required");
  }

  const nameservers = (payload?.nameservers ?? []).map((ns) => ns.trim()).filter(Boolean);
  if (nameservers.length < 2) {
    throw new Error("Provide at least 2 nameservers");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    return api.domains.setNameservers({ domainId, nameservers, teamId });
  });
});

export const transferInServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        name: string;
        authCode: string;
        duration?: number;
        privacyEnabled?: boolean;
        autoRenewal?: boolean;
        projectId?: string;
      }
    | undefined;

  const name = payload?.name?.trim().toLowerCase();
  if (!name) {
    throw new Error("Domain name is required");
  }

  const authCode = payload?.authCode?.trim();
  if (!authCode) {
    throw new Error("Auth code is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    return api.domains.transferIn({
      name,
      authCode,
      duration: payload?.duration ?? 1,
      privacyEnabled: Boolean(payload?.privacyEnabled),
      autoRenewal: Boolean(payload?.autoRenewal),
      projectId: payload?.projectId,
      teamId,
    });
  });
});

export type { DomainDetailsRecord, DomainRecord, PaginatedDomainsResponse };
