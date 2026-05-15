import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import config from "@/config";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";

const isProduction = process.env.NODE_ENV === "production";
const environmentPreferenceCookieBaseOptions = {
  httpOnly: false,
  sameSite: "strict" as const,
  secure: isProduction,
  path: "/",
};
const environmentPreferenceCookieMaxAge = 60 * 60 * 24 * 30;

function buildEnvironmentPreferenceCookieName(workspace?: string) {
  const scope = (workspace?.trim().toLowerCase() || "__personal__").replace(/[^a-z0-9_-]/g, "_");
  return `${config.environmentPreferenceCookiePrefix}${scope}`;
}

async function resolveWorkspaceTeamId(api: any, workspace?: string) {
  return resolveTeamId(api, workspace);
}

export const listProjectEnvironmentsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string } | undefined;

  return withTokenRefresh(async (api) => {
    const teamId = await resolveWorkspaceTeamId(api, payload?.workspace);
    return api.environments.listEnvironments({ teamId });
  });
});

export const getActiveEnvironmentPreferenceServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string } | undefined;
  const cookieName = buildEnvironmentPreferenceCookieName(payload?.workspace);
  const environmentId = getCookie(cookieName)?.trim();
  return environmentId || null;
});

export const setActiveEnvironmentPreferenceServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; environmentId?: string } | undefined;
  const cookieName = buildEnvironmentPreferenceCookieName(payload?.workspace);
  const environmentId = payload?.environmentId?.trim();

  if (environmentId) {
    setCookie(cookieName, environmentId, {
      ...environmentPreferenceCookieBaseOptions,
      maxAge: environmentPreferenceCookieMaxAge,
    });
  } else {
    deleteCookie(cookieName, environmentPreferenceCookieBaseOptions);
  }

  return { success: true };
});

export const getProjectEnvironmentDetailsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { environmentId: string; workspace?: string } | undefined;

  const environmentId = payload?.environmentId?.trim();
  if (!environmentId) {
    throw new Error("Environment ID is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveWorkspaceTeamId(api, payload?.workspace);
    return api.environments.getEnvironment(environmentId, { teamId });
  });
});

export const createProjectEnvironmentServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        name: string;
        workspace?: string;
        inheritFrom?: string;
      }
    | undefined;

  const name = payload?.name?.trim();
  if (!name) {
    throw new Error("Environment name is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveWorkspaceTeamId(api, payload?.workspace);
    return api.environments.createEnvironment({
      name,
      teamId,
      inheritFrom: payload?.inheritFrom?.trim() || undefined,
    });
  });
});

export const updateProjectEnvironmentServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        environmentId: string;
        workspace?: string;
        name?: string;
        inheritFrom?: string | null;
      }
    | undefined;

  const environmentId = payload?.environmentId?.trim();
  if (!environmentId) {
    throw new Error("Environment ID is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveWorkspaceTeamId(api, payload?.workspace);
    return api.environments.updateEnvironment(environmentId, {
      teamId,
      name: payload?.name?.trim() || undefined,
      inheritFrom: typeof payload?.inheritFrom === "string" ? payload.inheritFrom.trim() || null : (payload?.inheritFrom ?? undefined),
    });
  });
});

export const deleteProjectEnvironmentServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        environmentId: string;
        moveTo: string;
        workspace?: string;
      }
    | undefined;

  const environmentId = payload?.environmentId?.trim();
  const moveTo = payload?.moveTo?.trim();

  if (!environmentId) {
    throw new Error("Environment ID is required");
  }
  if (!moveTo) {
    throw new Error("moveTo environment ID is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveWorkspaceTeamId(api, payload?.workspace);
    return api.environments.deleteEnvironment(environmentId, {
      moveTo,
      teamId,
    });
  });
});

export const getEnvironmentVariablesServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { environmentId: string; workspace?: string } | undefined;

  const environmentId = payload?.environmentId?.trim();
  if (!environmentId) {
    throw new Error("Environment ID is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveWorkspaceTeamId(api, payload?.workspace);
    return api.environments.listEnvironmentVariables(environmentId, { teamId });
  });
});

export const saveEnvironmentVariablesServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        environmentId: string;
        workspace?: string;
        variables: Array<{ name: string; value: string; inheritable?: boolean }>;
      }
    | undefined;

  const environmentId = payload?.environmentId?.trim();
  if (!environmentId) {
    throw new Error("Environment ID is required");
  }

  const variables = Array.isArray(payload?.variables) ? payload.variables : [];
  if (!variables.length) {
    throw new Error("At least one variable is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveWorkspaceTeamId(api, payload?.workspace);
    return api.environments.saveEnvironmentVariables(environmentId, {
      teamId,
      variables,
    });
  });
});

export const updateEnvironmentVariableServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        environmentId: string;
        variableId: string;
        workspace?: string;
        name: string;
        value: string;
        inheritable?: boolean;
      }
    | undefined;

  const environmentId = payload?.environmentId?.trim();
  const variableId = payload?.variableId?.trim();
  const name = payload?.name?.trim();
  const value = payload?.value;
  if (!environmentId) {
    throw new Error("Environment ID is required");
  }
  if (!variableId) {
    throw new Error("Variable ID is required");
  }
  if (!name) {
    throw new Error("Variable name is required");
  }
  if (typeof value !== "string") {
    throw new Error("Variable value is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveWorkspaceTeamId(api, payload?.workspace);
    return api.environments.updateEnvironmentVariable(environmentId, variableId, {
      teamId,
      name,
      value,
      inheritable: payload?.inheritable,
    });
  });
});

export const deleteEnvironmentVariableServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { environmentId: string; variableId: string; workspace?: string } | undefined;

  const environmentId = payload?.environmentId?.trim();
  const variableId = payload?.variableId?.trim();
  if (!environmentId) {
    throw new Error("Environment ID is required");
  }
  if (!variableId) {
    throw new Error("Variable ID is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveWorkspaceTeamId(api, payload?.workspace);
    return api.environments.deleteEnvironmentVariable(environmentId, variableId, {
      teamId,
    });
  });
});

export const getProjectEnvironmentServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        target?: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  const target = payload?.target?.trim() || undefined;

  return withTokenRefresh(async (api) => {
    return api.environments.get(projectId, { target });
  });
});

export const listProjectEnvironmentTargetsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { projectId: string } | undefined;
  const projectId = payload?.projectId?.trim();

  if (!projectId) {
    throw new Error("Project ID is required");
  }

  return withTokenRefresh(async (api) => {
    return api.environments.listTargets(projectId);
  });
});

export const addProjectEnvironmentVariablesServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        target?: string;
        editor?: boolean;
        environments: Array<{ name: string; value: string }>;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  const environments = Array.isArray(payload?.environments) ? payload!.environments : [];
  if (environments.length === 0) {
    throw new Error("At least one environment variable is required");
  }

  return withTokenRefresh(async (api) => {
    return api.environments.add(projectId, {
      target: payload?.target,
      editor: Boolean(payload?.editor),
      environments,
    });
  });
});

export const updateProjectEnvironmentVariableServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        envId: string;
        name: string;
        value: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  const envId = payload?.envId?.trim();
  const name = payload?.name?.trim();
  const value = payload?.value;

  if (!projectId) {
    throw new Error("Project ID is required");
  }
  if (!envId) {
    throw new Error("Environment variable ID is required");
  }
  if (!name) {
    throw new Error("Environment variable name is required");
  }
  if (typeof value !== "string") {
    throw new Error("Environment variable value is required");
  }

  return withTokenRefresh(async (api) => {
    return api.environments.update(projectId, envId, {
      name,
      value,
    });
  });
});

export const deleteProjectEnvironmentVariableServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { projectId: string; envId: string } | undefined;
  const projectId = payload?.projectId?.trim();
  const envId = payload?.envId?.trim();

  if (!projectId) {
    throw new Error("Project ID is required");
  }
  if (!envId) {
    throw new Error("Environment variable ID is required");
  }

  return withTokenRefresh(async (api) => {
    return api.environments.remove(projectId, envId);
  });
});

export const decryptProjectEnvironmentValuesServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        environments: Array<{ name: string; value: string }>;
      }
    | undefined;

  const environments = Array.isArray(payload?.environments) ? payload!.environments : [];

  if (environments.length === 0) {
    return [];
  }

  return withTokenRefresh(async (api) => {
    return api.environments.decrypt(environments);
  });
});
