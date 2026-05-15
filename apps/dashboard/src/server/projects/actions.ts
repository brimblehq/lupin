import { createServerFn } from "@tanstack/react-start";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";
import { projectsLogger } from "@/server/shared/logger";
import type { SetProjectPasswordProtectionPayload } from "./types";

function assignFiniteNumber(target: Record<string, unknown>, key: string, value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    target[key] = value;
  }
}

export const listHomeProjectsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as unknown as { workspace?: string; environmentId?: string } | undefined;
  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  const environmentId = payload?.environmentId?.trim();

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    return api.projects.list({
      sort: "updatedAt",
      teamId,
      environmentId: environmentId || undefined,
      useEnvironmentHeader: Boolean(environmentId),
    });
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
        status?: string;
        environmentId?: string;
      }
    | undefined;

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  const requestedPage = payload?.page;
  const query = payload?.q?.trim();
  const serviceType = payload?.serviceType?.trim();
  const status = payload?.status?.trim();
  const environmentId = payload?.environmentId?.trim();

  let page = 1;
  if (typeof requestedPage === "number" && Number.isFinite(requestedPage) && requestedPage > 0) {
    page = Math.floor(requestedPage);
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    return api.projects.list({
      q: query || undefined,
      serviceType: serviceType || undefined,
      status: status || undefined,
      environmentId: environmentId || undefined,
      useEnvironmentHeader: Boolean(environmentId),
      sort: "updatedAt",
      page,
      teamId,
    });
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

  const workspaceSlug = typeof payload?.workspace === "string" ? payload.workspace.trim().toLowerCase() : undefined;

  const body: Record<string, unknown> = { ...(payload ?? {}) };
  delete body.workspace;

  if (typeof body.name !== "string" || !body.name.trim()) {
    throw new Error("Project name is required");
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    const finalBody: Record<string, unknown> = {
      ...body,
      ...(teamId ? { teamId } : {}),
    };

    const maskedBody: Record<string, unknown> = { ...finalBody };
    if (Array.isArray(maskedBody.environments)) {
      maskedBody.environments = maskedBody.environments.map((env) => {
        if (!env || typeof env !== "object") return env;
        const row = env as Record<string, unknown>;
        return {
          ...row,
          value: typeof row.value === "string" && row.value.length > 0 ? "[REDACTED]" : row.value,
        };
      });
    }

    projectsLogger.debug("resolved deploy payload", {
      teamId,
      body: maskedBody,
    });

    return api.projects.create({
      ...finalBody,
    });
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

  return withTokenRefresh((api) =>
    api.projects.validateDockerImage({
      imageUri,
      ...(hasBothCredentials
        ? {
            credentials: {
              username: username!,
              token: token!,
            },
          }
        : {}),
    }),
  );
});

export const listAvailableDatabasesServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return withTokenRefresh((api) => api.projects.listAvailableDatabases());
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

  const environments = Array.isArray(payload?.environments)
    ? payload!.environments
        .map((env) => ({
          name: env?.name?.trim() ?? "",
          value: env?.value ?? "",
        }))
        .filter((env) => env.name && env.value)
    : [];

  const whitelistedIps = Array.isArray(payload?.whitelistedIps) ? payload!.whitelistedIps.map((ip) => ip.trim()).filter(Boolean) : [];

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    return api.projects.createDatabase({
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

  return withTokenRefresh((api) => api.projects.getById(projectId));
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

  return withTokenRefresh((api) => api.projects.getScreenshot(projectId));
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

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    return api.projects.redeploy(projectId, {
      teamId,
      logId: payload?.logId,
      startOnly: payload?.startOnly,
    });
  });
});

export const debugSuggestionsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        logId: string;
        messageId: string;
        message: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  const logId = payload?.logId?.trim();
  const messageId = payload?.messageId?.trim();
  const message = payload?.message;

  if (!projectId) {
    throw new Error("Project ID is required");
  }
  if (!logId) {
    throw new Error("Log ID is required");
  }
  if (!messageId) {
    throw new Error("Message ID is required");
  }
  if (!message?.trim()) {
    throw new Error("Message is required");
  }

  return withTokenRefresh((api) => api.projects.debugSuggestions(projectId, { logId, messageId, message }));
});

export const debugSuggestionsPrServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        logId: string;
        messageId: string;
        message: string;
        debug?: {
          framework: unknown | null;
          envNames: string[];
          rootDir: unknown[];
          suggestions: unknown;
        } | null;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  const logId = payload?.logId?.trim();
  const messageId = payload?.messageId?.trim();
  const message = payload?.message;

  if (!projectId) {
    throw new Error("Project ID is required");
  }
  if (!logId) {
    throw new Error("Log ID is required");
  }
  if (!messageId) {
    throw new Error("Message ID is required");
  }
  if (!message?.trim()) {
    throw new Error("Message is required");
  }

  return withTokenRefresh((api) =>
    api.projects.debugSuggestionsPr(projectId, {
      logId,
      messageId,
      message,
      debug: (payload?.debug as never) ?? null,
    }),
  );
});

export const transferProjectServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        teamId: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  const teamId = payload?.teamId?.trim();

  if (!projectId) {
    throw new Error("Project ID is required");
  }
  if (!teamId) {
    throw new Error("Please select a workspace to transfer to.");
  }

  return withTokenRefresh((api) => api.projects.transfer(projectId, { teamId }));
});

export const setProjectPasswordProtectionServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as SetProjectPasswordProtectionPayload | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }
  if (typeof payload?.passwordEnabled !== "boolean") {
    throw new Error("`passwordEnabled` is required");
  }

  let password: string | undefined;
  if (payload.passwordEnabled) {
    password = typeof payload.password === "string" ? payload.password : "";
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
  }

  return withTokenRefresh(async (api) => {
    const workspaceSlug = payload?.workspace?.trim().toLowerCase();
    const teamId = workspaceSlug ? await resolveTeamId(api, workspaceSlug) : undefined;
    return api.projects.setPasswordProtection(projectId, {
      teamId,
      passwordEnabled: payload!.passwordEnabled!,
      password,
    });
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
  const nameChanged = name !== projectId;

  const body: Record<string, unknown> = {};

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

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    if (nameChanged) {
      await api.projects.redeploy(projectId, {
        teamId,
        payload: { name },
      });
    }

    return api.projects.redeploy(projectId, {
      teamId,
      payload: body,
    });
  });
});

export const saveProjectBuildConfigServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        workspace?: string;
        installCommand?: string;
        buildCommand?: string;
        startCommand?: string;
        healthCheckPath?: string;
        preStartCommand?: string;
        dockerImage?: string;
        outputDirectory?: string;
        watchPaths?: string[];
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();

  const body: Record<string, unknown> = {};

  if (typeof payload?.installCommand === "string") {
    body.installCommand = payload.installCommand;
  }
  if (typeof payload?.buildCommand === "string") {
    body.buildCommand = payload.buildCommand;
  }
  if (typeof payload?.startCommand === "string") {
    body.startCommand = payload.startCommand;
  }
  if (typeof payload?.healthCheckPath === "string") {
    body.healthCheckPath = payload.healthCheckPath;
  }
  if (typeof payload?.preStartCommand === "string") {
    body.preStartCommand = payload.preStartCommand;
  }
  if (typeof payload?.outputDirectory === "string") {
    body.outputDirectory = payload.outputDirectory;
  }
  if (Array.isArray(payload?.watchPaths)) {
    body.watchPaths = payload.watchPaths.map((p) => p.trim()).filter((p) => p.length > 0);
  }

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    return api.projects.redeploy(projectId, {
      teamId,
      payload: body,
    });
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

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    return api.projects.databaseBackup(projectId, { teamId });
  });
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

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    return api.projects.databaseRefresh(projectId, { teamId });
  });
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
        twoFactorToken?: string;
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

  return withTokenRefresh(
    async (api) => {
      const teamId = await resolveTeamId(api, workspaceSlug);

      return api.projects.updateDatabaseConfig(projectId, {
        teamId,
        name,
        password,
        configurations: payload?.configurations ?? null,
        whitelistedIps: Array.isArray(payload?.whitelistedIps) ? payload.whitelistedIps : [],
      });
    },
    { stepUpToken: payload?.twoFactorToken },
  );
});

export const decryptDatabaseConnectionUriServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { encryptedConnectionUri?: string } | undefined;
  const encryptedConnectionUri = payload?.encryptedConnectionUri?.trim();

  if (!encryptedConnectionUri) {
    throw new Error("Encrypted connection URI is required");
  }

  return withTokenRefresh(async (api) => {
    const decrypted = await api.environments.decrypt([
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
});

export const moveProjectEnvironmentServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        environmentId: string;
        inheritEnvVars?: boolean;
        workspace?: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  const environmentId = payload?.environmentId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }
  if (!environmentId) {
    throw new Error("Environment ID is required");
  }

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    return api.projects.updateEnvironment(projectId, {
      teamId,
      environmentId,
      inheritEnvVars: Boolean(payload?.inheritEnvVars),
    });
  });
});

export const deleteProjectServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        workspace?: string;
        twoFactorToken?: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();

  return withTokenRefresh(
    async (api) => {
      const teamId = await resolveTeamId(api, workspaceSlug);
      await api.projects.remove(projectId, { teamId });
      return { success: true };
    },
    { stepUpToken: payload?.twoFactorToken },
  );
});

export const linkRepoServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        workspace?: string;
        repo: { name: string; installationId: number | string; git: string };
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) throw new Error("Project ID is required");
  if (!payload?.repo?.name) throw new Error("Repository name is required");

  const workspaceSlug = payload.workspace?.trim().toLowerCase();

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    return api.projects.linkRepo(projectId, { repo: payload.repo, teamId });
  });
});

export const unlinkRepoServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { projectId: string; workspace?: string } | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) throw new Error("Project ID is required");

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    return api.projects.unlinkRepo(projectId, { teamId });
  });
});
