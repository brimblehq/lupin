import { createServerFn } from "@tanstack/react-start";
import { createBackendApi } from "@/backend";
import type {
  DomainDetailsRecord,
  DomainRecord,
  PaginatedDomainsResponse,
} from "@/backend/domains";
import type { PaginatedProjectsResponse } from "@/backend/projects";
import config from "@/config";
import { getServerAccessToken } from "@/server/auth/cookies";

function getServerBackendApi() {
  return createBackendApi({
    baseUrl: config.apiUrl,
    getAccessToken: getServerAccessToken,
  });
}

async function resolveTeamIdFromWorkspace(workspace?: string) {
  const workspaceSlug = workspace?.trim().toLowerCase();
  if (!workspaceSlug) {
    return undefined;
  }

  const teams = await getServerBackendApi().workspaces.list();
  const match = teams.items.find((item) => item.slug === workspaceSlug);
  if (match?.id) {
    return match.id;
  }

  return undefined;
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
      }
    | undefined;

  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);

  return getServerBackendApi().domains.list({
    page: payload?.page,
    q: payload?.q,
    projectName: payload?.projectName,
    teamId,
  });
});

export const refreshDomainStatusServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        domainName: string;
      }
    | undefined;

  const domainName = payload?.domainName?.trim();
  if (!domainName) {
    throw new Error("Domain name is required");
  }

  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);
  return getServerBackendApi().domains.getStatus(domainName, { teamId });
});

export const getDomainDetailsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        domainName: string;
      }
    | undefined;

  const domainName = payload?.domainName?.trim();
  if (!domainName) {
    throw new Error("Domain name is required");
  }

  const api = getServerBackendApi();
  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);

  let domain = await api.domains.getByName(domainName, { teamId });

  if (!domain && teamId) {
    domain = await api.domains.getByName(domainName, {});
  }

  if (!domain) {
    throw new Error(`Domain not found: ${domainName}`);
  }

  return domain;
});

export const createProjectDomainServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        projectId?: string;
        name: string;
      }
    | undefined;

  const name = payload?.name?.trim().toLowerCase();
  if (!name) {
    throw new Error("Domain name is required");
  }

  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);
  return getServerBackendApi().domains.add({
    name,
    projectId: payload?.projectId,
    teamId,
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

  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);
  return getServerBackendApi().domains.update({
    id,
    name: payload?.name?.trim(),
    redirect: payload?.redirect ?? null,
    teamId,
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

  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);
  await getServerBackendApi().domains.transfer({
    domainId,
    projectId,
    teamId,
  });

  return { success: true };
});

export const deleteDomainServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        domainId: string;
        projectId?: string;
      }
    | undefined;

  const domainId = payload?.domainId?.trim();
  if (!domainId) {
    throw new Error("Domain id is required");
  }

  let projectId: string | undefined;
  if (typeof payload?.projectId === "string" && payload.projectId.trim()) {
    projectId = payload.projectId.trim();
  }

  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);
  await getServerBackendApi().domains.remove({
    domainId,
    projectId,
    teamId,
  });

  return { success: true };
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

  return getServerBackendApi().domains.searchSale(name);
});

export const purchaseDomainServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        name: string;
        duration: number;
        cardId: string;
        projectId?: string;
        privacyEnabled: boolean;
        autoRenewal: boolean;
      }
    | undefined;

  const name = payload?.name?.trim();
  if (!name) {
    throw new Error("Domain name is required");
  }

  const cardId = payload?.cardId?.trim();
  if (!cardId) {
    throw new Error("Payment method is required");
  }

  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);

  await getServerBackendApi().domains.purchaseSale({
    name,
    duration: payload?.duration ?? 1,
    cardId,
    projectId: payload?.projectId,
    privacyEnabled: payload?.privacyEnabled ?? false,
    autoRenewal: payload?.autoRenewal ?? false,
    teamId,
  });

  return { success: true };
});

export const listDomainProjectsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
      }
    | undefined;

  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);

  return getServerBackendApi().projects.list({
    teamId,
    sort: "updatedAt",
    page: 1,
    limit: 100,
  }) as Promise<PaginatedProjectsResponse>;
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

  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);
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

  if (process.env.NODE_ENV !== "production") {
    console.log("[domains.dns] create", requestPayload);
  }

  return getServerBackendApi().domains.createDnsRecord(requestPayload);
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

  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);
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

  if (process.env.NODE_ENV !== "production") {
    console.log("[domains.dns] update", requestPayload);
  }

  return getServerBackendApi().domains.updateDnsRecord(requestPayload);
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

  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);
  if (process.env.NODE_ENV !== "production") {
    console.log("[domains.dns] delete", {
      domain: domainName,
      recordId,
      teamId,
    });
  }
  await getServerBackendApi().domains.deleteDnsRecord({
    domain: domainName,
    recordId,
    teamId,
  });

  return { success: true };
});

export type { DomainDetailsRecord, DomainRecord, PaginatedDomainsResponse };
