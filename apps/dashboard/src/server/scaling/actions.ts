import { createServerFn } from "@tanstack/react-start";
import { createBackendApi, type ScalingGroup } from "@/backend";
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
  if (!match?.id) {
    return undefined;
  }

  return match.id;
}

export const listScalingGroupsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string } | undefined;
  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);
  return getServerBackendApi().scaling.list({ teamId });
});

type SaveScalingGroupRequest = {
  id?: string;
  workspace?: string;
  name: string;
  active: boolean;
  replicas: number;
  minContainers: number;
  maxContainers: number;
  maxCpuThreshold: number;
  maxMemoryThreshold: number;
};

export const saveScalingGroupServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as SaveScalingGroupRequest | undefined;
  if (!payload) {
    throw new Error("Scaling payload is required");
  }

  const name = payload.name?.trim();
  if (!name) {
    throw new Error("Scaling group name is required");
  }

  const teamId = await resolveTeamIdFromWorkspace(payload.workspace);
  const input = {
    teamId,
    name,
    active: Boolean(payload.active),
    replicas: payload.replicas,
    minContainers: payload.minContainers,
    maxContainers: payload.maxContainers,
    maxCpuThreshold: payload.maxCpuThreshold,
    maxMemoryThreshold: payload.maxMemoryThreshold,
  };

  if (payload.id?.trim()) {
    return getServerBackendApi().scaling.update(payload.id.trim(), input);
  }

  return getServerBackendApi().scaling.create(input);
});

export const toggleScalingGroupServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { id: string; active: boolean; workspace?: string } | undefined;
  const groupId = payload?.id?.trim();
  if (!groupId) {
    throw new Error("Scaling group ID is required");
  }

  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);
  return getServerBackendApi().scaling.toggle(groupId, {
    active: Boolean(payload?.active),
    teamId,
  });
});

export const deleteScalingGroupServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { id: string; workspace?: string } | undefined;
  const groupId = payload?.id?.trim();
  if (!groupId) {
    throw new Error("Scaling group ID is required");
  }

  const teamId = await resolveTeamIdFromWorkspace(payload?.workspace);
  return getServerBackendApi().scaling.remove(groupId, { teamId });
});

export type { ScalingGroup };
