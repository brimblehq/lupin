import { asRecord, pickBoolean, pickNonEmptyString, pickNumber, pickString } from "./normalize";
import type { ApiClient } from "./types";
import {
  VolumeType,
  type CreateVolumeInput,
  type ListVolumesInput,
  type PaginatedVolumesResponse,
  type RegionSummary,
  type VolumeResponse,
} from "./volumes/types";

export type * from "./volumes/types";
export { VolumeType } from "./volumes/types";

const VOLUME_TYPE_VALUES = Object.values(VolumeType);

function mapVolumeType(value: unknown): VolumeType {
  const raw = typeof value === "string" ? value : "";
  return VOLUME_TYPE_VALUES.includes(raw as VolumeType) ? (raw as VolumeType) : VolumeType.Sandbox;
}

export interface VolumesApi {
  list(input?: ListVolumesInput): Promise<PaginatedVolumesResponse>;
  create(input: CreateVolumeInput): Promise<VolumeResponse>;
  getById(volumeId: string): Promise<VolumeResponse>;
  remove(volumeId: string): Promise<void>;
}

function getRootPayload(value: unknown): unknown {
  const root = asRecord(value);
  if (!root) {
    return value;
  }

  const dataRow = asRecord(root.data);
  if (dataRow && "data" in dataRow) {
    if (Array.isArray(dataRow.data)) {
      return dataRow;
    }

    return dataRow.data;
  }

  if ("data" in root) {
    return root.data;
  }

  return value;
}

function mapRegionSummary(value: unknown): RegionSummary | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = pickNonEmptyString(row, "id");
  const name = pickNonEmptyString(row, "name");
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    country: pickString(row, "country") ?? "",
    continent: pickString(row, "continent") ?? null,
    provider: pickString(row, "provider") ?? "",
    isPaid: pickBoolean(row, "is_paid") ?? false,
  };
}

function mapVolumeResponse(value: unknown): VolumeResponse | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = pickNonEmptyString(row, "id");
  const name = pickNonEmptyString(row, "name");
  const sizeGB = pickNumber(row, "size");

  if (!id || !name || sizeGB === undefined) {
    return null;
  }

  return {
    id,
    name,
    type: mapVolumeType(row.type),
    sizeGB,
    team: pickString(row, "team") ?? null,
    csiVolumeId: pickString(row, "csi_volume_id") ?? null,
    region: mapRegionSummary(row.region),
    attachedSandboxId: pickString(row, "attached_sandbox_id") ?? null,
    attachedProjectId: pickString(row, "attached_project_id") ?? null,
    lastAttachedAt: pickString(row, "last_attached_at") ?? null,
    createdAt: pickString(row, "created_at") ?? null,
    updatedAt: pickString(row, "updated_at") ?? null,
  };
}

export function createVolumesApi(client: ApiClient): VolumesApi {
  return {
    async list(input) {
      const response = await client.request<unknown>("/core/v1/volumes", {
        method: "GET",
        query: {
          page: input?.page,
          limit: input?.limit,
          teamId: input?.teamId,
        },
      });

      const root = asRecord(getRootPayload(response));
      if (!root) {
        throw new Error("Invalid list volumes response from API");
      }

      const rows = Array.isArray(root.data) ? root.data : [];
      const items = rows.map(mapVolumeResponse).filter((item): item is VolumeResponse => item !== null);
      const totalCount = pickNumber(root, "totalCount") ?? 0;
      const currentPage = pickNumber(root, "currentPage") ?? 1;
      const totalPages = pickNumber(root, "totalPages") ?? 1;
      const limit = pickNumber(root, "limit") ?? (input?.limit ?? 15);

      return {
        items,
        totalCount,
        currentPage,
        totalPages,
        limit,
      };
    },

    async create(input) {
      const response = await client.request<unknown, CreateVolumeInput>("/core/v1/volumes", {
        method: "POST",
        body: input,
      });

      const mapped = mapVolumeResponse(getRootPayload(response));
      if (!mapped) {
        throw new Error("Invalid create volume response from API");
      }

      return mapped;
    },

    async getById(volumeId) {
      const response = await client.request<unknown>(`/core/v1/volumes/${encodeURIComponent(volumeId)}`, { method: "GET" });
      const mapped = mapVolumeResponse(getRootPayload(response));
      if (!mapped) {
        throw new Error("Invalid get volume response from API");
      }

      return mapped;
    },

    async remove(volumeId) {
      await client.request<unknown>(`/core/v1/volumes/${encodeURIComponent(volumeId)}`, { method: "DELETE" });
    },
  };
}
