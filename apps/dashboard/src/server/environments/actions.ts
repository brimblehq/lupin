import { createServerFn } from "@tanstack/react-start";
import { createBackendApi } from "@/backend";
import config from "@/config";
import { getServerAccessToken } from "@/server/auth/cookies";

function getServerBackendApi() {
  return createBackendApi({
    baseUrl: config.apiUrl,
    getAccessToken: getServerAccessToken,
  });
}

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
  return getServerBackendApi().environments.get(projectId, { target });
});

export const listProjectEnvironmentTargetsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { projectId: string } | undefined;
  const projectId = payload?.projectId?.trim();

  if (!projectId) {
    throw new Error("Project ID is required");
  }

  return getServerBackendApi().environments.listTargets(projectId);
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

  const environments = Array.isArray(payload?.environments)
    ? payload!.environments
    : [];
  if (environments.length === 0) {
    throw new Error("At least one environment variable is required");
  }

  return getServerBackendApi().environments.add(projectId, {
    target: payload?.target,
    editor: Boolean(payload?.editor),
    environments,
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

  return getServerBackendApi().environments.update(projectId, envId, {
    name,
    value,
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

  return getServerBackendApi().environments.remove(projectId, envId);
});

export const decryptProjectEnvironmentValuesServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        environments: Array<{ name: string; value: string }>;
      }
    | undefined;

  const environments = Array.isArray(payload?.environments)
    ? payload!.environments
    : [];

  if (environments.length === 0) {
    return [];
  }

  return getServerBackendApi().environments.decrypt(environments);
});
