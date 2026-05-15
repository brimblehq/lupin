import { createServerFn } from "@tanstack/react-start";
import { SignJWT, importPKCS8 } from "jose";
import { addSeconds, getUnixTime } from "date-fns";
import type { BackendApi } from "@/backend";
import { listDeploymentRunLogsFromSupabase } from "@/backend/deployment-run-logs";
import type { PaginatedDeploymentsResponse, DeploymentLog } from "@/backend/deployments";
import config from "@/config";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";

async function mintSupabaseAccessToken(ownerId: string): Promise<string> {
  if (!config.supabaseJwtPrivateKey || !config.supabaseJwtKid) {
    throw new Error("Supabase signing key is not configured");
  }
  const privateKey = await importPKCS8(config.supabaseJwtPrivateKey, "ES256");
  return new SignJWT({ role: "authenticated", sub: ownerId })
    .setProtectedHeader({ alg: "ES256", kid: config.supabaseJwtKid, typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(getUnixTime(addSeconds(new Date(), 30)))
    .sign(privateKey);
}

async function resolveTeamIdFromWorkspace(api: BackendApi, workspace?: string) {
  return resolveTeamId(api, workspace);
}

async function resolveLogOwnerId(api: BackendApi, workspace?: string) {
  const workspaceSlug = workspace?.trim();
  const teamId = await resolveTeamIdFromWorkspace(api, workspace);
  if (teamId) {
    return teamId;
  }

  if (workspaceSlug) {
    throw new Error("Workspace not found for deployment logs");
  }

  const profile = await api.settings.getProfile();
  const userId = profile?.id?.trim();

  if (!userId) {
    throw new Error("Unable to resolve current user for deployment logs");
  }

  return userId;
}

export const listDeploymentsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        workspace?: string;
        page?: number;
        limit?: number;
        filterBy?: "createdAt" | "startTime" | "endTime" | "status";
        statuses?: string;
        environment?: string;
        start?: string;
        end?: string;
        search?: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);

    return api.deployments.list(projectId, {
      page: payload?.page,
      limit: payload?.limit,
      filterBy: payload?.filterBy,
      statuses: payload?.statuses,
      environment: payload?.environment,
      start: payload?.start,
      end: payload?.end,
      search: payload?.search,
      teamId,
    });
  });
});

export const getDeploymentDetailsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        logId: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  const logId = payload?.logId?.trim();
  if (!projectId || !logId) {
    throw new Error("Project ID and Log ID are required");
  }

  return withTokenRefresh(async (api) => {
    return api.deployments.getById(projectId, logId);
  });
});

export const redeployServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        logId: string;
        workspace?: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  const logId = payload?.logId?.trim();
  if (!projectId || !logId) {
    throw new Error("Project ID and Log ID are required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    return api.deployments.redeploy(projectId, logId, { teamId });
  });
});

export const cancelDeploymentServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        logId: string;
        workspace?: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  const logId = payload?.logId?.trim();
  if (!projectId || !logId) {
    throw new Error("Project ID and Log ID are required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    await api.deployments.cancel(projectId, logId, { teamId });
    return { success: true };
  });
});

export interface DeploymentRunLogsResponse {
  entries: import("@/utils/deployment-logs").DeploymentDrawerLogEntry[];
}

export const listDeploymentRunLogsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        logId: string;
        workspace?: string;
      }
    | undefined;

  const logId = payload?.logId?.trim();
  if (!logId) {
    throw new Error("Deployment log ID is required");
  }

  const ownerId = await withTokenRefresh(async (api) => {
    return resolveLogOwnerId(api, payload?.workspace);
  });

  const accessToken = await mintSupabaseAccessToken(ownerId);

  const rows = await listDeploymentRunLogsFromSupabase({
    supabaseUrl: config.supabaseUrl,
    supabaseKey: config.supabaseAnonKey,
    accessToken,
    tableName: config.supabaseTableName,
    filter: {
      logId,
      ownerId,
    },
  });

  const { mapDeploymentRunLogsToDrawerEntries } = await import("@/utils/deployment-logs");

  return {
    entries: mapDeploymentRunLogsToDrawerEntries(rows),
  };
});

export const downloadDeploymentLogsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { projectId: string; logId: string; workspace?: string } | undefined;

  const projectId = payload?.projectId?.trim();
  const logId = payload?.logId?.trim();
  if (!projectId || !logId) {
    throw new Error("Project ID and Log ID are required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    return api.deployments.downloadLogs(projectId, logId, { teamId });
  });
});

export type { PaginatedDeploymentsResponse, DeploymentLog };
