import { asRecord, pickBoolean, pickNonEmptyString, pickNumber, pickString } from "./normalize";
import type { ApiClient } from "./types";
import {
  DESTROY_TIMEOUT_VALUES,
  SANDBOX_ACTIVITY_STATUS_VALUES,
  SANDBOX_DESTROY_REASON_VALUES,
  SANDBOX_STATUS_VALUES,
  SNAPSHOT_MODE_VALUES,
  SNAPSHOT_STATUS_VALUES,
  DestroyTimeout,
  SandboxActivityStatus,
  SandboxDestroyReason,
  SandboxStatus,
  SnapshotMode,
  SnapshotStatus,
} from "./sandboxes/enums";
import type {
  CreateSandboxInput,
  CreateSandboxResponse,
  CreateSnapshotInput,
  ListSandboxActivityInput,
  ListSandboxesInput,
  ListSnapshotsInput,
  PaginatedSandboxActivityResponse,
  PaginatedSandboxesResponse,
  PaginatedSnapshotsResponse,
  SandboxActivityResponse,
  SandboxResponse,
  SandboxSpecs,
  SandboxTemplate,
  SnapshotResponse,
} from "./sandboxes/types";

export type * from "./sandboxes/types";
export * from "./sandboxes/enums";

export interface SandboxesApi {
  listTemplates(): Promise<SandboxTemplate[]>;
  create(input: CreateSandboxInput): Promise<CreateSandboxResponse>;
  getById(sandboxId: string, input?: { teamId?: string }): Promise<SandboxResponse>;
  list(input?: ListSandboxesInput): Promise<PaginatedSandboxesResponse>;
  pause(sandboxId: string): Promise<void>;
  resume(sandboxId: string): Promise<void>;
  destroy(sandboxId: string): Promise<void>;
  listAllSnapshots(input?: ListSnapshotsInput): Promise<PaginatedSnapshotsResponse>;
  listSandboxSnapshots(sandboxId: string, input?: ListSnapshotsInput): Promise<PaginatedSnapshotsResponse>;
  createSnapshot(sandboxId: string, input: CreateSnapshotInput): Promise<SnapshotResponse>;
  deleteSnapshot(snapshotId: string): Promise<void>;
  listSandboxActivity(sandboxId: string, input?: ListSandboxActivityInput): Promise<PaginatedSandboxActivityResponse>;
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

function mapSandboxStatus(value: unknown): SandboxStatus {
  if (SANDBOX_STATUS_VALUES.includes(value as SandboxStatus)) {
    return value as SandboxStatus;
  }

  throw new Error("Invalid sandbox status from API");
}

function mapSnapshotMode(value: unknown): SnapshotMode {
  if (SNAPSHOT_MODE_VALUES.includes(value as SnapshotMode)) {
    return value as SnapshotMode;
  }

  throw new Error("Invalid snapshot mode from API");
}

function mapSnapshotStatus(value: unknown): SnapshotStatus {
  if (SNAPSHOT_STATUS_VALUES.includes(value as SnapshotStatus)) {
    return value as SnapshotStatus;
  }

  throw new Error("Invalid snapshot status from API");
}

function mapSnapshotResponse(value: unknown): SnapshotResponse | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = pickNonEmptyString(row, "id");
  const sandboxId = pickNonEmptyString(row, "sandbox_id");
  const name = pickNonEmptyString(row, "name");
  const sourceTemplate = pickNonEmptyString(row, "source_template");
  const createdAt = pickString(row, "created_at");

  if (!id || !sandboxId || !name || !sourceTemplate || !createdAt) {
    return null;
  }

  return {
    id,
    sandboxId,
    name,
    imageTag: pickString(row, "image_tag") ?? "",
    sourceTemplate,
    status: mapSnapshotStatus(row.status),
    failureReason: pickString(row, "failure_reason") ?? null,
    sizeBytes: pickNumber(row, "size_bytes") ?? null,
    createdAt,
  };
}

function mapSandboxActivityStatus(value: unknown): SandboxActivityStatus {
  if (SANDBOX_ACTIVITY_STATUS_VALUES.includes(value as SandboxActivityStatus)) {
    return value as SandboxActivityStatus;
  }

  throw new Error("Invalid sandbox activity status from API");
}

function mapSandboxActivityResponse(value: unknown): SandboxActivityResponse | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = pickNonEmptyString(row, "id");
  const command = pickString(row, "command");
  const startedAt = pickString(row, "started_at");

  if (!id || command === undefined || !startedAt) {
    return null;
  }

  return {
    id,
    command,
    status: mapSandboxActivityStatus(row.status),
    startedAt,
    endedAt: pickString(row, "ended_at") ?? null,
    durationMs: pickNumber(row, "duration_ms") ?? null,
    exitCode: pickNumber(row, "exit_code") ?? null,
    error: pickString(row, "error") ?? null,
  };
}

function mapDestroyTimeout(value: unknown): DestroyTimeout | null {
  if (value == null) {
    return null;
  }

  if (DESTROY_TIMEOUT_VALUES.includes(value as DestroyTimeout)) {
    return value as DestroyTimeout;
  }

  throw new Error("Invalid destroy timeout from API");
}

function mapDestroyReason(value: unknown): SandboxDestroyReason | null {
  if (value == null) {
    return null;
  }

  if (SANDBOX_DESTROY_REASON_VALUES.includes(value as SandboxDestroyReason)) {
    return value as SandboxDestroyReason;
  }

  throw new Error("Invalid sandbox destroy reason from API");
}

function mapSandboxSpecs(value: unknown): SandboxSpecs {
  const row = asRecord(value);
  if (!row) {
    throw new Error("Invalid sandbox specs from API");
  }

  const cpu = pickNumber(row, "cpu");
  const memory = pickNumber(row, "memory");
  const disk = pickNumber(row, "disk");

  if (cpu === undefined || memory === undefined || disk === undefined) {
    throw new Error("Sandbox specs missing required fields");
  }

  return { cpu, memory, disk };
}

function mapTemplate(value: unknown): SandboxTemplate | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const name = pickNonEmptyString(row, "name");
  const displayName = pickNonEmptyString(row, "display_name");
  if (!name || !displayName) {
    return null;
  }

  return {
    name,
    displayName,
    description: pickString(row, "description") ?? "",
  };
}

function mapEntityId(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  const row = asRecord(value);
  if (!row) {
    return null;
  }

  return pickNonEmptyString(row, "id", "_id") ?? null;
}

function mapCreateSandboxResponse(value: unknown): CreateSandboxResponse {
  const row = asRecord(value);
  if (!row) {
    throw new Error("Invalid create sandbox response from API");
  }

  const id = pickNonEmptyString(row, "id");
  const template = pickNonEmptyString(row, "template");
  const createdAt = pickString(row, "created_at");
  const status = mapSandboxStatus(row.status);

  if (!id || !template || !createdAt) {
    throw new Error("Invalid create sandbox response from API");
  }

  return {
    id,
    template,
    status,
    createdAt,
    expiresAt: pickString(row, "expires_at") ?? null,
  };
}

function mapSandboxResponse(value: unknown): SandboxResponse | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = pickNonEmptyString(row, "id");
  const name = pickNonEmptyString(row, "name");
  const template = pickNonEmptyString(row, "template");
  const region = mapEntityId(row.region);
  const regionRecord = asRecord(row.region);
  const regionName = regionRecord ? (pickNonEmptyString(regionRecord, "name") ?? null) : null;
  const regionCountry = regionRecord ? (pickNonEmptyString(regionRecord, "country") ?? null) : null;
  const createdAt = pickString(row, "created_at");
  const lastActivityAt = pickString(row, "last_activity_at");
  const expiresAt = pickString(row, "expires_at");

  if (!id || !template || !region || !createdAt || !lastActivityAt || !expiresAt) {
    return null;
  }

  const status = mapSandboxStatus(row.status);
  const snapshotMode = mapSnapshotMode(row.snapshot_mode);
  const destroyTimeout = mapDestroyTimeout(pickString(row, "destroy_timeout"));
  const destroyReason = mapDestroyReason(pickString(row, "destroy_reason"));
  const specs = mapSandboxSpecs(row.specs);

  return {
    id,
    name: name ?? `sandbox-${id.slice(-8)}`,
    template,
    status,
    region,
    regionName,
    regionCountry,
    specs,
    teamId: mapEntityId(row.team),
    projectEnvironmentId: mapEntityId(row.project_environment),
    autoDestroy: pickBoolean(row, "auto_destroy") ?? false,
    destroyTimeout,
    oneShot: pickBoolean(row, "one_shot") ?? false,
    blockOutbound: pickBoolean(row, "block_outbound") ?? false,
    persistent: pickBoolean(row, "persistent") ?? false,
    persistentDiskGB: pickNumber(row, "persistent_disk_gb") ?? null,
    pausedAt: pickString(row, "paused_at") ?? null,
    fromSnapshot: pickString(row, "from_snapshot") ?? null,
    snapshotMode,
    snapshotFrequency: pickString(row, "snapshot_frequency") ?? null,
    createdAt,
    lastActivityAt,
    expiresAt,
    destroyedAt: pickString(row, "destroyed_at") ?? null,
    destroyReason,
  };
}

export function createSandboxesApi(client: ApiClient): SandboxesApi {
  return {
    async listTemplates() {
      const response = await client.request<unknown>("/core/v1/sandbox/templates", { method: "GET" });
      const payload = getRootPayload(response);
      const row = asRecord(payload);
      const rows = Array.isArray(row?.templates) ? row.templates : [];
      return rows.map(mapTemplate).filter((item): item is SandboxTemplate => item !== null);
    },

    async create(input) {
      const response = await client.request<unknown, CreateSandboxInput>("/core/v1/sandboxes", {
        method: "POST",
        body: input,
      });

      return mapCreateSandboxResponse(getRootPayload(response));
    },

    async getById(sandboxId, input) {
      const response = await client.request<unknown>(`/core/v1/sandboxes/${encodeURIComponent(sandboxId)}`, {
        method: "GET",
        query: { teamId: input?.teamId },
      });
      const item = mapSandboxResponse(getRootPayload(response));
      if (!item) {
        throw new Error("Invalid sandbox response from API");
      }
      return item;
    },

    async list(input) {
      const response = await client.request<unknown>("/core/v1/sandboxes", {
        method: "GET",
        query: {
          page: input?.page,
          limit: input?.limit,
          teamId: input?.teamId,
        },
      });

      const root = asRecord(getRootPayload(response));
      if (!root) {
        throw new Error("Invalid list sandboxes response from API");
      }

      const rows = Array.isArray(root.data) ? root.data : [];
      const items = rows.map(mapSandboxResponse).filter((item): item is SandboxResponse => item !== null);
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

    async pause(sandboxId) {
      await client.request<unknown>(`/core/v1/sandboxes/${encodeURIComponent(sandboxId)}/pause`, { method: "POST" });
    },

    async resume(sandboxId) {
      await client.request<unknown>(`/core/v1/sandboxes/${encodeURIComponent(sandboxId)}/resume`, { method: "POST" });
    },

    async destroy(sandboxId) {
      await client.request<unknown>(`/core/v1/sandboxes/${encodeURIComponent(sandboxId)}`, { method: "DELETE" });
    },

    async listAllSnapshots(input) {
      const response = await client.request<unknown>("/core/v1/sandboxes/snapshots", {
        method: "GET",
        query: {
          page: input?.page,
          limit: input?.limit,
          teamId: input?.teamId,
        },
      });

      const root = asRecord(getRootPayload(response));
      if (!root) {
        throw new Error("Invalid list snapshots response from API");
      }

      const rows = Array.isArray(root.data) ? root.data : [];
      const items = rows.map(mapSnapshotResponse).filter((item): item is SnapshotResponse => item !== null);
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

    async listSandboxSnapshots(sandboxId, input) {
      const response = await client.request<unknown>(`/core/v1/sandboxes/${encodeURIComponent(sandboxId)}/snapshots`, {
        method: "GET",
        query: {
          page: input?.page,
          limit: input?.limit,
          teamId: input?.teamId,
        },
      });

      const root = asRecord(getRootPayload(response));
      if (!root) {
        throw new Error("Invalid list snapshots response from API");
      }

      const rows = Array.isArray(root.data) ? root.data : [];
      const items = rows.map(mapSnapshotResponse).filter((item): item is SnapshotResponse => item !== null);
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

    async createSnapshot(sandboxId, input) {
      const response = await client.request<unknown, CreateSnapshotInput>(
        `/core/v1/sandboxes/${encodeURIComponent(sandboxId)}/snapshots`,
        { method: "POST", body: input },
      );

      const mapped = mapSnapshotResponse(getRootPayload(response));
      if (!mapped) {
        throw new Error("Invalid create snapshot response from API");
      }
      return mapped;
    },

    async deleteSnapshot(snapshotId) {
      await client.request<unknown>(`/core/v1/sandboxes/snapshots/${encodeURIComponent(snapshotId)}`, { method: "DELETE" });
    },

    async listSandboxActivity(sandboxId, input) {
      const response = await client.request<unknown>(`/core/v1/sandboxes/${encodeURIComponent(sandboxId)}/activity`, {
        method: "GET",
        query: {
          page: input?.page,
          limit: input?.limit,
          since: input?.since,
          until: input?.until,
          teamId: input?.teamId,
        },
      });

      const root = asRecord(getRootPayload(response));
      if (!root) {
        throw new Error("Invalid list sandbox activity response from API");
      }

      const rows = Array.isArray(root.data) ? root.data : [];
      const items = rows
        .map(mapSandboxActivityResponse)
        .filter((item): item is SandboxActivityResponse => item !== null);
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
  };
}
