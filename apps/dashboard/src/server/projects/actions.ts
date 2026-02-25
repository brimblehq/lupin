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

function assignFiniteNumber(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    target[key] = value;
  }
}

export const listHomeProjectsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as unknown as { workspace?: string } | undefined;
  const workspaceSlug = payload?.workspace?.trim().toLowerCase();

  let teamId: string | undefined;

  if (workspaceSlug) {
    const teams = await getServerBackendApi().workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  return getServerBackendApi().projects.list({
    sort: "updatedAt",
    teamId,
  });
});

export const listProjectsPageServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        page?: number;
        q?: string;
        serviceType?: string;
      }
    | undefined;

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  const requestedPage = payload?.page;
  const query = payload?.q?.trim();
  const serviceType = payload?.serviceType?.trim();

  let page = 1;
  if (typeof requestedPage === "number" && Number.isFinite(requestedPage) && requestedPage > 0) {
    page = Math.floor(requestedPage);
  }

  let teamId: string | undefined;

  if (workspaceSlug) {
    const teams = await getServerBackendApi().workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  return getServerBackendApi().projects.list({
    q: query || undefined,
    serviceType: serviceType || undefined,
    sort: "updatedAt",
    page,
    teamId,
  });
});

export const createProjectServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | ({
        workspace?: string;
      } & Record<string, unknown>)
    | undefined;

  const workspaceSlug =
    typeof payload?.workspace === "string"
      ? payload.workspace.trim().toLowerCase()
      : undefined;
  let teamId: string | undefined;

  if (workspaceSlug) {
    const teams = await getServerBackendApi().workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  const body: Record<string, unknown> = { ...(payload ?? {}) };
  delete body.workspace;

  if (typeof body.name !== "string" || !body.name.trim()) {
    throw new Error("Project name is required");
  }

  const finalBody: Record<string, unknown> = {
    ...body,
    ...(teamId ? { teamId } : {}),
  };

  if (process.env.NODE_ENV !== "production") {
    const maskedBody: Record<string, unknown> = { ...finalBody };
    if (Array.isArray(maskedBody.environments)) {
      maskedBody.environments = maskedBody.environments.map((env) => {
        if (!env || typeof env !== "object") return env;
        const row = env as Record<string, unknown>;
        return {
          ...row,
          value:
            typeof row.value === "string" && row.value.length > 0
              ? "[REDACTED]"
              : row.value,
        };
      });
    }

    console.log("[createProjectServerFn] resolved deploy payload", {
      teamId,
      body: maskedBody,
    });
  }

  return getServerBackendApi().projects.create({
    ...finalBody,
  });
});

export const validateDockerImageServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        imageUri?: string;
        credentials?: {
          username?: string;
          token?: string;
        };
      }
    | undefined;

  const imageUri = payload?.imageUri?.trim();
  if (!imageUri) {
    throw new Error("Docker image is required");
  }

  const username = payload?.credentials?.username?.trim();
  const token = payload?.credentials?.token?.trim();
  const hasBothCredentials = Boolean(username && token);
  const hasOneCredential = Boolean(username || token);

  if (hasOneCredential && !hasBothCredentials) {
    throw new Error("Provide both registry username and token for private images.");
  }

  return getServerBackendApi().projects.validateDockerImage({
    imageUri,
    ...(hasBothCredentials
      ? {
          credentials: {
            username: username!,
            token: token!,
          },
        }
      : {}),
  });
});

export const listAvailableDatabasesServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return getServerBackendApi().projects.listAvailableDatabases();
});

export const createDatabaseProjectServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        name?: string;
        dbImage?: string;
        configurations?: {
          cpu?: number;
          memory?: number;
          storage?: number;
          region?: string;
        };
        whitelistedIps?: string[];
        environments?: Array<{ name?: string; value?: string }>;
      }
    | undefined;

  const name = payload?.name?.trim();
  if (!name) {
    throw new Error("Database name is required");
  }

  const dbImage = payload?.dbImage?.trim();
  if (!dbImage) {
    throw new Error("Database engine is required");
  }

  const region = payload?.configurations?.region?.trim();
  if (!region) {
    throw new Error("Region is required");
  }

  const cpu = payload?.configurations?.cpu;
  const memory = payload?.configurations?.memory;
  const storage = payload?.configurations?.storage;

  if (typeof cpu !== "number" || !Number.isFinite(cpu)) {
    throw new Error("CPU value should be a number");
  }
  if (typeof memory !== "number" || !Number.isFinite(memory)) {
    throw new Error("Memory value should be a number");
  }
  if (typeof storage !== "number" || !Number.isFinite(storage)) {
    throw new Error("Storage value should be a number");
  }

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  let teamId: string | undefined;

  if (workspaceSlug) {
    const teams = await getServerBackendApi().workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  const environments = Array.isArray(payload?.environments)
    ? payload!.environments
        .map((env) => ({
          name: env?.name?.trim() ?? "",
          value: env?.value ?? "",
        }))
        .filter((env) => env.name && env.value)
    : [];

  const whitelistedIps = Array.isArray(payload?.whitelistedIps)
    ? payload!.whitelistedIps.map((ip) => ip.trim()).filter(Boolean)
    : [];

  return getServerBackendApi().projects.createDatabase({
    name,
    dbImage,
    teamId,
    configurations: {
      cpu,
      memory,
      storage,
      region,
    },
    whitelistedIps,
    environments,
  });
});

export const getProjectDetailsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        workspace?: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  return getServerBackendApi().projects.getById(projectId);
});

export const getProjectScreenshotServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  return getServerBackendApi().projects.getScreenshot(projectId);
});

export const redeployProjectServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        workspace?: string;
        logId?: string;
        startOnly?: boolean;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  let teamId: string | undefined;

  if (workspaceSlug) {
    const teams = await getServerBackendApi().workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  return getServerBackendApi().projects.redeploy(projectId, {
    teamId,
    logId: payload?.logId,
    startOnly: payload?.startOnly,
  });
});

export const saveProjectGeneralConfigServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        workspace?: string;
        name: string;
        branch?: string;
        rootDirectory?: string;
        framework?: string;
        region?: string;
        cpu?: number;
        memory?: number;
        storage?: number;
        authEnabled?: boolean;
        buildCacheEnabled?: boolean;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  const name = payload?.name?.trim();
  if (!name) {
    throw new Error("Project name is required");
  }

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  let teamId: string | undefined;

  if (workspaceSlug) {
    const teams = await getServerBackendApi().workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  const body: Record<string, unknown> = {
    name,
  };

  if (typeof payload?.framework === "string") {
    body.framework = payload.framework;
  }

  if (typeof payload?.rootDirectory === "string") {
    if (payload.rootDirectory === "./") {
      body.rootDirectory = "";
    } else {
      body.rootDirectory = payload.rootDirectory;
    }
  }

  if (typeof payload?.branch === "string" && payload.branch.trim()) {
    body.repo = {
      branch: payload.branch.trim(),
    };
  }

  if (typeof payload?.authEnabled === "boolean") {
    body.authEnabled = payload.authEnabled;
  }

  if (typeof payload?.buildCacheEnabled === "boolean") {
    body.buildCacheEnabled = payload.buildCacheEnabled;
  }

  const nextConfigurations: Record<string, unknown> = {};
  assignFiniteNumber(nextConfigurations, "cpu", payload?.cpu);
  assignFiniteNumber(nextConfigurations, "memory", payload?.memory);
  assignFiniteNumber(nextConfigurations, "storage", payload?.storage);

  if (typeof payload?.region === "string" && payload.region.trim()) {
    nextConfigurations.region = payload.region.trim();
  }

  if (Object.keys(nextConfigurations).length > 0) {
    body.configurations = nextConfigurations;
  }

  return getServerBackendApi().projects.redeploy(projectId, {
    teamId,
    payload: body,
  });
});

export const backupDatabaseProjectServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        workspace?: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  let teamId: string | undefined;

  if (workspaceSlug) {
    const teams = await getServerBackendApi().workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  return getServerBackendApi().projects.databaseBackup(projectId, { teamId });
});

export const refreshDatabaseProjectServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        workspace?: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  let teamId: string | undefined;

  if (workspaceSlug) {
    const teams = await getServerBackendApi().workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  return getServerBackendApi().projects.databaseRefresh(projectId, { teamId });
});

export const updateDatabaseProjectConfigServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        workspace?: string;
        name: string;
        password?: string;
        configurations?: Record<string, unknown> | null;
        whitelistedIps?: string[];
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  const name = payload?.name?.trim();
  if (!name) {
    throw new Error("Database name is required");
  }

  const password = payload?.password ?? "";

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  let teamId: string | undefined;

  if (workspaceSlug) {
    const teams = await getServerBackendApi().workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  return getServerBackendApi().projects.updateDatabaseConfig(projectId, {
    teamId,
    name,
    password,
    configurations: payload?.configurations ?? null,
    whitelistedIps: Array.isArray(payload?.whitelistedIps) ? payload.whitelistedIps : [],
  });
});

export const decryptDatabaseConnectionUriServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { encryptedConnectionUri?: string } | undefined;
  const encryptedConnectionUri = payload?.encryptedConnectionUri?.trim();

  if (!encryptedConnectionUri) {
    throw new Error("Encrypted connection URI is required");
  }

  const decrypted = await getServerBackendApi().environments.decrypt([
    {
      name: "DATABASE_URL",
      value: encryptedConnectionUri,
    },
  ]);

  const connectionUri = decrypted[0]?.value?.trim();
  if (!connectionUri) {
    throw new Error("Failed to decrypt database connection URI");
  }

  return { connectionUri } as const;
});

export const deleteProjectServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        workspace?: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  let teamId: string | undefined;

  if (workspaceSlug) {
    const teams = await getServerBackendApi().workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  await getServerBackendApi().projects.remove(projectId, { teamId });
  return { success: true };
});
