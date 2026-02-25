import { formatDistanceToNow } from "date-fns";
import type { ApiClient } from "./types";
import { asRecord, asString, pickBoolean, pickString } from "./normalize";

export interface ProjectEnvironmentVariable {
  id: string;
  name: string;
  value: string;
  environment?: string;
  user?: string;
  avatar?: string;
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectEnvironmentSnapshot {
  envs: ProjectEnvironmentVariable[];
  deployId?: string;
}

export interface ProjectEnvironmentsApi {
  get(projectId: string, input?: { target?: string }): Promise<ProjectEnvironmentSnapshot>;
  listTargets(projectId: string): Promise<string[]>;
  add(
    projectId: string,
    input: {
      environments: Array<{ name: string; value: string }>;
      target?: string;
      editor?: boolean;
    },
  ): Promise<ProjectEnvironmentSnapshot | null>;
  update(
    projectId: string,
    envId: string,
    input: { name: string; value: string },
  ): Promise<{ success: boolean }>;
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

function mapEnvVariable(item: any): ProjectEnvironmentVariable {
  const row = asRecord(item) ?? {};
  const userValue = row.user;
  const userRecord = asRecord(userValue);

  const user =
    asString(userValue) ??
    pickString(userRecord, "username", "name");

  const avatar =
    pickString(userRecord, "avatar") ??
    asString(row.avatar);

  const isSystem = pickBoolean(row, "is_system", "isSystem") ?? false;

  return {
    id: String(row._id ?? row.id ?? `${row.name ?? ""}-${row.environment ?? ""}`),
    name: String(row.name ?? ""),
    value: String(row.value ?? ""),
    environment: pickString(row, "environment", "deployment"),
    user,
    avatar,
    isSystem,
    createdAt: asString(row.createdAt),
    updatedAt: asString(row.updatedAt),
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

  return {
    envs: rootEnvs.map(mapEnvVariable).filter((env) => env.name),
    deployId: pickString(asRecord(data), "deployId", "deploy_id"),
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
  const decryptPath = "/core/v1/decrypt";

  return {
    async get(projectId, input) {
      const target = input?.target?.trim();
      const path = target
        ? `${basePath}/${encodeURIComponent(projectId)}/${encodeURIComponent(target)}`
        : `${basePath}/${encodeURIComponent(projectId)}`;
      const response = await client.request(path, { method: "GET" });
      return mapSnapshot(response);
    },
    async listTargets(projectId) {
      const response = await client.request(
        `${basePath}/${encodeURIComponent(projectId)}/environments`,
        { method: "GET" },
      );
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
      await client.request(
        `${basePath}/${encodeURIComponent(projectId)}/${encodeURIComponent(envId)}`,
        {
          method: "PATCH",
          body: {
            environment: {
              name: input.name,
              value: input.value,
            },
          },
        },
      );

      return { success: true };
    },
    async remove(projectId, envId) {
      await client.request(
        `${basePath}/${encodeURIComponent(projectId)}/${encodeURIComponent(envId)}`,
        { method: "DELETE" },
      );

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
