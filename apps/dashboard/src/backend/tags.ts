import type { ApiClient } from "./types";
import { asRecord, asString } from "./normalize";

export interface BackendTag {
  id: string;
  name: string;
  color: string;
  teamId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagsApi {
  list(input?: { teamId?: string }): Promise<BackendTag[]>;
  create(input: { name: string; color: string; teamId?: string }): Promise<BackendTag>;
  update(tagId: string, input: { name?: string; color?: string }): Promise<BackendTag>;
  remove(tagId: string): Promise<void>;
  toggleAssignment(input: {
    tagId: string;
    projectId: string;
  }): Promise<{ assigned: boolean }>;
}

function mapTag(raw: any): BackendTag {
  const row = asRecord(raw) ?? {};
  return {
    id: String(row._id ?? row.id ?? ""),
    name: String(row.name ?? ""),
    color: String(row.color ?? "#6366f1"),
    teamId: asString(row.teamId) ?? null,
    createdBy: String(row.createdBy ?? ""),
    createdAt: asString(row.createdAt) ?? "",
    updatedAt: asString(row.updatedAt) ?? "",
  };
}

export function createTagsApi(client: ApiClient): TagsApi {
  const endpoint = "/core/v1/tags";

  return {
    async list(input) {
      const response = await client.request<any>(endpoint, {
        method: "GET",
        query: { teamId: input?.teamId },
      });
      const data = response?.data ?? response ?? [];
      return Array.isArray(data) ? data.map(mapTag) : [];
    },

    async create(input) {
      const response = await client.request<any>(endpoint, {
        method: "POST",
        body: {
          name: input.name,
          color: input.color,
          ...(input.teamId ? { teamId: input.teamId } : {}),
        },
      });
      const root = response?.data ?? response ?? {};
      return mapTag(root);
    },

    async update(tagId, input) {
      const response = await client.request<any>(
        `${endpoint}/${encodeURIComponent(tagId)}`,
        {
          method: "PATCH",
          body: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.color !== undefined ? { color: input.color } : {}),
          },
        },
      );
      const root = response?.data ?? response ?? {};
      return mapTag(root);
    },

    async remove(tagId) {
      await client.request<any>(
        `${endpoint}/${encodeURIComponent(tagId)}`,
        { method: "DELETE" },
      );
    },

    async toggleAssignment(input) {
      const response = await client.request<any>(
        `${endpoint}/assignments/toggle`,
        {
          method: "PUT",
          body: {
            tagId: input.tagId,
            projectId: input.projectId,
          },
        },
      );
      const root = asRecord(response?.data ?? response) ?? {};
      return { assigned: root.assigned === true };
    },
  };
}
