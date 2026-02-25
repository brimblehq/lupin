import type { ApiClient } from "./types";

export interface ScalingGroup {
  id: string;
  name: string;
  replicas: number;
  minContainers: number;
  maxContainers: number;
  maxCpuThreshold: number;
  maxMemoryThreshold: number;
  minApplicationResponseTime?: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListScalingGroupsInput {
  teamId?: string;
}

export interface SaveScalingGroupInput {
  name: string;
  active: boolean;
  replicas: number;
  minContainers: number;
  maxContainers: number;
  maxCpuThreshold: number;
  maxMemoryThreshold: number;
  teamId?: string;
}

export interface ToggleScalingGroupInput {
  active: boolean;
  teamId?: string;
}

export interface ScalingApi {
  list(input?: ListScalingGroupsInput): Promise<{ items: ScalingGroup[]; message?: string }>;
  create(input: SaveScalingGroupInput): Promise<ScalingGroup>;
  update(groupId: string, input: SaveScalingGroupInput): Promise<ScalingGroup>;
  toggle(groupId: string, input: ToggleScalingGroupInput): Promise<{ success: boolean }>;
  remove(groupId: string, input?: { teamId?: string }): Promise<{ success: boolean }>;
}

function mapScalingGroup(group: any): ScalingGroup {
  let replicas = 2;
  if (typeof group?.replicas === "number" && Number.isFinite(group.replicas)) {
    replicas = group.replicas;
  }

  let minContainers = 1;
  if (typeof group?.min_containers === "number" && Number.isFinite(group.min_containers)) {
    minContainers = group.min_containers;
  }

  let maxContainers = 5;
  if (typeof group?.max_containers === "number" && Number.isFinite(group.max_containers)) {
    maxContainers = group.max_containers;
  }

  let maxCpuThreshold = 70;
  if (typeof group?.max_cpu === "number" && Number.isFinite(group.max_cpu)) {
    maxCpuThreshold = group.max_cpu;
  }

  let maxMemoryThreshold = 70;
  if (typeof group?.max_memory === "number" && Number.isFinite(group.max_memory)) {
    maxMemoryThreshold = group.max_memory;
  }

  let minApplicationResponseTime: number | undefined;
  if (
    typeof group?.min_application_response_time === "number" &&
    Number.isFinite(group.min_application_response_time)
  ) {
    minApplicationResponseTime = group.min_application_response_time;
  }

  return {
    id: String(group?._id ?? group?.id ?? ""),
    name: String(group?.name ?? ""),
    replicas,
    minContainers,
    maxContainers,
    maxCpuThreshold,
    maxMemoryThreshold,
    minApplicationResponseTime,
    active: Boolean(group?.active),
    createdAt: typeof group?.createdAt === "string" ? group.createdAt : undefined,
    updatedAt: typeof group?.updatedAt === "string" ? group.updatedAt : undefined,
  };
}

function buildTeamQuery(teamId?: string) {
  if (!teamId) {
    return undefined;
  }

  return { teamId };
}

function toApiPayload(input: SaveScalingGroupInput) {
  const payload: Record<string, unknown> = {
    name: input.name,
    active: input.active,
    replicas: input.replicas,
    min_containers: input.minContainers,
    max_containers: input.maxContainers,
    max_cpu: input.maxCpuThreshold,
    max_memory: input.maxMemoryThreshold,
  };

  if (input.teamId) {
    payload.team_id = input.teamId;
  }

  return payload;
}

export function createScalingApi(client: ApiClient): ScalingApi {
  const basePath = "/core/v1/autoscaling";

  return {
    async list(input) {
      const response = await client.request<any>(basePath, {
        method: "GET",
        query: buildTeamQuery(input?.teamId),
      });

      const root = response?.data?.data ?? response?.data ?? response ?? [];
      const items = Array.isArray(root) ? root.map(mapScalingGroup) : [];
      const message =
        typeof response?.data?.message === "string"
          ? response.data.message
          : typeof response?.message === "string"
            ? response.message
            : undefined;

      return { items, message };
    },
    async create(input) {
      const response = await client.request<any>(basePath, {
        method: "POST",
        body: toApiPayload(input),
      });

      const root = response?.data?.data ?? response?.data ?? response;
      return mapScalingGroup(root);
    },
    async update(groupId, input) {
      const response = await client.request<any>(`${basePath}/${encodeURIComponent(groupId)}`, {
        method: "PUT",
        body: toApiPayload(input),
      });

      const root = response?.data?.data ?? response?.data ?? response;
      return mapScalingGroup(root);
    },
    async toggle(groupId, input) {
      await client.request<any>(`${basePath}/${encodeURIComponent(groupId)}/toggle`, {
        method: "PUT",
        body: {
          active: input.active,
          ...(input.teamId ? { team_id: input.teamId } : {}),
        },
      });

      return { success: true };
    },
    async remove(groupId, input) {
      await client.request<any>(`${basePath}/${encodeURIComponent(groupId)}`, {
        method: "DELETE",
        query: buildTeamQuery(input?.teamId),
      });

      return { success: true };
    },
  };
}
