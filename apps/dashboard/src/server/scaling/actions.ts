import { createServerFn } from "@tanstack/react-start";
import type { ScalingGroup, BackendApi } from "@/backend";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";

function supportsAutoscalingPlan(planType?: string) {
  const normalized = String(planType ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized.includes("developer") || normalized.includes("pro") || normalized.includes("team");
}

async function canUseAutoscaling(api: BackendApi) {
  const profile = await api.settings.getProfile();
  return supportsAutoscalingPlan(profile.subscription?.planType);
}

async function resolveTeamIdFromWorkspace(api: BackendApi, workspace?: string) {
  return resolveTeamId(api, workspace);
}

async function canUseAutoscalingForWorkspace(
  api: BackendApi,
  input: {
    workspace?: string;
    teamId?: string;
  },
) {
  if (input.teamId) {
    const workspaceSlug = input.workspace?.trim().toLowerCase();
    if (!workspaceSlug) {
      return true;
    }

    try {
      const team = await api.teams.getByName(workspaceSlug);
      if (!team.subscriptionType) {
        return true;
      }

      return supportsAutoscalingPlan(team.subscriptionType);
    } catch {
      return true;
    }
  }

  return canUseAutoscaling(api);
}

export const listScalingGroupsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string } | undefined;

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    const canUse = await canUseAutoscalingForWorkspace(api, {
      workspace: payload?.workspace,
      teamId,
    });

    if (!canUse) {
      return { items: [], message: null };
    }

    return api.scaling.list({ teamId });
  });
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

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload.workspace);
    const canUse = await canUseAutoscalingForWorkspace(api, {
      workspace: payload.workspace,
      teamId,
    });

    if (!canUse) {
      throw new Error("Autoscaling is not available on your current plan");
    }

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
      return api.scaling.update(payload.id.trim(), input);
    }

    return api.scaling.create(input);
  });
});

export const toggleScalingGroupServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { id: string; active: boolean; workspace?: string } | undefined;
  const groupId = payload?.id?.trim();
  if (!groupId) {
    throw new Error("Scaling group ID is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    const canUse = await canUseAutoscalingForWorkspace(api, {
      workspace: payload?.workspace,
      teamId,
    });

    if (!canUse) {
      throw new Error("Autoscaling is not available on your current plan");
    }

    return api.scaling.toggle(groupId, {
      active: Boolean(payload?.active),
      teamId,
    });
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

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamIdFromWorkspace(api, payload?.workspace);
    const canUse = await canUseAutoscalingForWorkspace(api, {
      workspace: payload?.workspace,
      teamId,
    });

    if (!canUse) {
      throw new Error("Autoscaling is not available on your current plan");
    }

    return api.scaling.remove(groupId, { teamId });
  });
});

export type { ScalingGroup };
