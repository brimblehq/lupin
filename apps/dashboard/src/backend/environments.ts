import { formatDistanceToNow } from "date-fns";
import type { ApiClient } from "./types";
import { asRecord, asString, pickBoolean, pickString } from "./normalize";

export interface ProjectEnvironmentVariable {
  id: string;
  envId?: string | null;
  source?: "environment";
  name: string;
  value: string;
  environment?: string;
  user?: string;
  avatar?: string;
  isSystem?: boolean;
  encrypted?: boolean;
  sharedSource?: "own" | "inherited";
  sourceEnvironment?: string;
  inheritable?: boolean;
  sourceProject?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectEnvironmentSnapshot {
  envs: ProjectEnvironmentVariable[];
  deployId?: string;
}

export interface ProjectEnvironment {
  _id: string;
  name: string;
  slug: string;
  owner?: string;
  team?: string | null;
  inherit_from?: string | null;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
  projectCount?: number;
}

export interface EffectiveEnvironmentVariable {
  id?: string;
  name: string;
  value: string;
  source: "inherited" | "own";
  sourceEnvironment?: string;
  inheritable?: boolean;
  sourceProject?: string | null;
  user?: string;
  avatar?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EnvironmentVariableInput {
  name: string;
  value: string;
  inheritable?: boolean;
}

export interface ProjectEnvironmentsApi {
  listEnvironments(input?: { teamId?: string }): Promise<ProjectEnvironment[]>;
  getEnvironment(environmentId: string, input?: { teamId?: string }): Promise<ProjectEnvironment>;
  createEnvironment(input: { name: string; teamId?: string; inheritFrom?: string }): Promise<ProjectEnvironment>;
  updateEnvironment(
    environmentId: string,
    input: { name?: string; inheritFrom?: string | null; teamId?: string },
  ): Promise<ProjectEnvironment>;
  deleteEnvironment(environmentId: string, input: { moveTo: string; teamId?: string }): Promise<{ success: boolean }>;
  listEnvironmentVariables(
    environmentId: string,
    input?: { teamId?: string; projectId?: string },
  ): Promise<EffectiveEnvironmentVariable[]>;
  saveEnvironmentVariables(
    environmentId: string,
    input: { variables: EnvironmentVariableInput[]; teamId?: string; projectId?: string },
  ): Promise<EffectiveEnvironmentVariable[]>;
  updateEnvironmentVariable(
    environmentId: string,
    variableId: string,
    input: EnvironmentVariableInput & { teamId?: string },
  ): Promise<{ success: boolean }>;
  deleteEnvironmentVariable(environmentId: string, variableId: string, input?: { teamId?: string }): Promise<{ success: boolean }>;
  get(projectId: string, input?: { target?: string; includeEnvironment?: boolean }): Promise<ProjectEnvironmentSnapshot>;
  listTargets(projectId: string): Promise<string[]>;
  add(
    projectId: string,
    input: {
      environments: Array<{ name: string; value: string }>;
      target?: string;
      editor?: boolean;
    },
  ): Promise<ProjectEnvironmentSnapshot | null>;
  update(projectId: string, envId: string, input: { name: string; value: string }): Promise<{ success: boolean }>;
  remove(projectId: string, envId: string): Promise<{ success: boolean }>;
  decrypt(input: Array<{ name: string; value: string }>): Promise<Array<{ name: string; value: string }>>;
}

function unwrapData<T = any>(payload: any): T {
  if (payload?.data?.data !== undefined) {
    return payload.data.data as T;
  }

  if (payload?.data !== undefined) {
    return payload.data as T;
  }

  return payload as T;
}

function mapSharedSource(value: unknown): "own" | "inherited" | undefined {
  const source = asString(value);
  if (source === "own" || source === "inherited") {
    return source;
  }
}

function mapEnvVariable(item: any): ProjectEnvironmentVariable {
  const row = asRecord(item) ?? {};
  const userValue = row.user;
  const userRecord = asRecord(userValue);
  const nestedEnvironment = asRecord(row.environment);
  const nestedVariable = asRecord(row.variable);

  const name = asString(row.name) ?? asString(nestedVariable?.name) ?? "";

  const value = asString(row.value) ?? asString(nestedVariable?.value) ?? "";

  const environment = pickString(row, "environment", "deployment") ?? pickString(nestedEnvironment, "name", "slug");

  const source = asString(row.source) === "environment" ? "environment" : undefined;
  const envId = pickString(row, "id", "_id") ?? null;
  const id = envId ? envId : `${source === "environment" ? "shared" : "env"}:${name}:${environment ?? "default"}`;

  const user = asString(userValue) ?? pickString(userRecord, "username", "name");

  const avatar = pickString(userRecord, "avatar") ?? asString(row.avatar);

  const isSystem = pickBoolean(row, "is_system", "isSystem") ?? false;
  const encrypted = typeof value === "string" && value.startsWith("U2FsdGVkX1");

  return {
    id,
    envId,
    source,
    name,
    value,
    environment,
    user,
    avatar,
    isSystem,
    encrypted,
    sharedSource: mapSharedSource(row.sharedSource),
    sourceEnvironment: asString(row.sourceEnvironment) ?? undefined,
    inheritable: pickBoolean(row, "inheritable") ?? undefined,
    sourceProject: asString(row.sourceProject) ?? null,
    createdAt: asString(row.createdAt) ?? asString(nestedVariable?.createdAt),
    updatedAt: asString(row.updatedAt) ?? asString(nestedVariable?.updatedAt),
  };
}

function mapSnapshot(payload: any): ProjectEnvironmentSnapshot {
  const data = unwrapData<any>(payload) ?? {};
  const rootEnvs = Array.isArray(data?.envs)
    ? data.envs
    : Array.isArray(data?.environments)
      ? data.environments
      : Array.isArray(data)
        ? data
        : [];

  const mappedEnvs = rootEnvs.map(mapEnvVariable).filter((env: ProjectEnvironmentVariable) => env.name);

  return {
    envs: mappedEnvs,
    deployId: pickString(asRecord(data), "deployId", "deploy_id"),
  };
}

function mapProjectEnvironment(item: any): ProjectEnvironment {
  const row = asRecord(item) ?? {};
  return {
    _id: String(row._id ?? row.id ?? ""),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    owner: asString(row.owner),
    team: asString(row.team) ?? null,
    inherit_from: asString(row.inherit_from) ?? null,
    isDefault: pickBoolean(row, "isDefault", "is_default") ?? false,
    createdAt: asString(row.createdAt),
    updatedAt: asString(row.updatedAt),
    projectCount: typeof row.projectCount === "number" ? row.projectCount : undefined,
  };
}

function mapEffectiveEnvironmentVariable(item: any): EffectiveEnvironmentVariable {
  const row = asRecord(item) ?? {};
  const source = asString(row.source) === "inherited" ? "inherited" : "own";
  return {
    id: asString(row._id) ?? asString(row.id) ?? undefined,
    name: String(row.name ?? ""),
    value: String(row.value ?? ""),
    source,
    sourceEnvironment: asString(row.sourceEnvironment) ?? undefined,
    inheritable: pickBoolean(row, "inheritable") ?? undefined,
    sourceProject: asString(row.sourceProject) ?? null,
    user: pickString(row, "user") ?? undefined,
    avatar: pickString(row, "avatar") ?? undefined,
    createdAt: asString(row.createdAt) ?? undefined,
    updatedAt: asString(row.updatedAt) ?? undefined,
  };
}

export function formatEnvRelativeTime(date?: string): string {
  if (!date) {
    return "unknown";
  }

  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true }).replace("about ", "");
  } catch {
    return date;
  }
}

export function createProjectEnvironmentsApi(client: ApiClient): ProjectEnvironmentsApi {
  const basePath = "/core/v1/envs";
  const environmentsPath = "/core/v1/environments";
  const decryptPath = "/core/v1/decrypt";

  return {
    async listEnvironments(input) {
      const response = await client.request(environmentsPath, {
        method: "GET",
        query: {
          teamId: input?.teamId,
        },
      });

      const data = unwrapData<any[]>(response);
      if (!Array.isArray(data)) {
        return [];
      }

      return data.map(mapProjectEnvironment).filter((env) => Boolean(env._id) && Boolean(env.name));
    },
    async getEnvironment(environmentId, input) {
      const response = await client.request(`${environmentsPath}/${encodeURIComponent(environmentId)}`, {
        method: "GET",
        query: {
          teamId: input?.teamId,
        },
      });

      return mapProjectEnvironment(unwrapData(response));
    },
    async createEnvironment(input) {
      const response = await client.request(environmentsPath, {
        method: "POST",
        body: {
          name: input.name,
          teamId: input.teamId,
          inheritFrom: input.inheritFrom,
        },
      });

      return mapProjectEnvironment(unwrapData(response));
    },
    async updateEnvironment(environmentId, input) {
      const response = await client.request(`${environmentsPath}/${encodeURIComponent(environmentId)}`, {
        method: "PATCH",
        query: {
          teamId: input.teamId,
        },
        body: {
          name: input.name,
          inheritFrom: input.inheritFrom,
        },
      });

      return mapProjectEnvironment(unwrapData(response));
    },
    async deleteEnvironment(environmentId, input) {
      await client.request(`${environmentsPath}/${encodeURIComponent(environmentId)}`, {
        method: "DELETE",
        query: {
          moveTo: input.moveTo,
          teamId: input.teamId,
        },
      });

      return { success: true };
    },
    async listEnvironmentVariables(environmentId, input) {
      const response = await client.request(`${environmentsPath}/${encodeURIComponent(environmentId)}/variables`, {
        method: "GET",
        query: {
          teamId: input?.teamId,
          projectId: input?.projectId,
        },
      });

      const data = unwrapData<any[]>(response);
      if (!Array.isArray(data)) {
        return [];
      }

      return data.map(mapEffectiveEnvironmentVariable).filter((row) => Boolean(row.name));
    },
    async saveEnvironmentVariables(environmentId, input) {
      const response = await client.request(`${environmentsPath}/${encodeURIComponent(environmentId)}/variables`, {
        method: "POST",
        query: {
          teamId: input.teamId,
          projectId: input.projectId,
        },
        body: {
          projectId: input.projectId,
          variables: input.variables.map((variable) => ({
            name: variable.name,
            value: variable.value,
            inheritable: variable.inheritable,
          })),
        },
      });

      const data = unwrapData<any[]>(response);
      if (!Array.isArray(data)) {
        return [];
      }

      return data.map(mapEffectiveEnvironmentVariable).filter((row) => Boolean(row.name));
    },
    async updateEnvironmentVariable(environmentId, variableId, input) {
      await client.request(`${environmentsPath}/${encodeURIComponent(environmentId)}/variables/${encodeURIComponent(variableId)}`, {
        method: "PATCH",
        query: {
          teamId: input.teamId,
        },
        body: {
          name: input.name,
          value: input.value,
          inheritable: input.inheritable,
        },
      });

      return { success: true };
    },
    async deleteEnvironmentVariable(environmentId, variableId, input) {
      await client.request(`${environmentsPath}/${encodeURIComponent(environmentId)}/variables/${encodeURIComponent(variableId)}`, {
        method: "DELETE",
        query: {
          teamId: input?.teamId,
        },
      });

      return { success: true };
    },
    async get(projectId, input) {
      const target = input?.target?.trim();
      const path = target
        ? `${basePath}/${encodeURIComponent(projectId)}/${encodeURIComponent(target)}`
        : `${basePath}/${encodeURIComponent(projectId)}`;
      const response = await client.request(path, {
        method: "GET",
        query: {
          includeEnvironment: input?.includeEnvironment ? true : undefined,
        },
      });
      return mapSnapshot(response);
    },
    async listTargets(projectId) {
      const response = await client.request(`${basePath}/${encodeURIComponent(projectId)}/environments`, { method: "GET" });
      const data = unwrapData<any>(response);
      if (!Array.isArray(data)) {
        return ["PRODUCTION"];
      }

      const targets = data
        .filter((value: unknown) => typeof value === "string")
        .map((value: string) => value.trim())
        .filter(Boolean);

      if (targets.length === 0) {
        return ["PRODUCTION"];
      }

      return targets;
    },
    async add(projectId, input) {
      const target = input.target?.trim();
      const hasEditor = Boolean(input.editor);
      const path = target
        ? `${basePath}/${encodeURIComponent(projectId)}/${encodeURIComponent(target)}`
        : `${basePath}/${encodeURIComponent(projectId)}`;

      const response = await client.request(path, {
        method: "POST",
        query: hasEditor ? { editor: true } : undefined,
        body: {
          environments: input.environments.map((env) => ({
            name: env.name,
            value: env.value,
          })),
        },
      });

      try {
        return mapSnapshot(response);
      } catch {
        return null;
      }
    },
    async update(projectId, envId, input) {
      await client.request(`${basePath}/${encodeURIComponent(projectId)}/${encodeURIComponent(envId)}`, {
        method: "PATCH",
        body: {
          environment: {
            name: input.name,
            value: input.value,
          },
        },
      });

      return { success: true };
    },
    async remove(projectId, envId) {
      await client.request(`${basePath}/${encodeURIComponent(projectId)}/${encodeURIComponent(envId)}`, { method: "DELETE" });

      return { success: true };
    },
    async decrypt(input) {
      const response = await client.request(decryptPath, {
        method: "POST",
        body: {
          environments: input,
        },
      });

      const data = unwrapData<any[]>(response);
      if (!Array.isArray(data)) {
        return [];
      }

      return data
        .filter((row) => row && typeof row === "object")
        .map((row) => ({
          name: String(row?.name ?? ""),
          value: String(row?.value ?? ""),
        }));
    },
  };
}
