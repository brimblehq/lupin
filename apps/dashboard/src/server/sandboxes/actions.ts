import { createServerFn } from "@tanstack/react-start";
import * as Yup from "yup";
import { DestroyTimeout, SnapshotMode } from "@/backend";
import type { CreateSandboxInput } from "@/backend";
import { resolveTeamId, withTokenRefresh } from "@/server/shared/backend";
import { MOUNT_PATH_ERROR, MOUNT_PATH_PATTERN, MOUNT_PATH_ROOT_ERROR } from "@/lib/mount-path";

const DESTROY_TIMEOUT_OPTIONS = Object.values(DestroyTimeout);
const SNAPSHOT_MODE_OPTIONS = Object.values(SnapshotMode);

const sandboxSpecsSchema = Yup.object({
  cpu: Yup.number().integer().min(1).max(2000),
  memory: Yup.number().integer().min(1).max(2048),
  disk: Yup.number().integer().min(1).max(5),
});

const createSandboxSchema = Yup.object({
  workspace: Yup.string().trim(),
  name: Yup.string().trim().min(3).max(48),
  region: Yup.string().trim().required("Region is required"),
  template: Yup.string().trim(),
  teamId: Yup.string().trim(),
  environmentId: Yup.string().trim(),
  specs: sandboxSpecsSchema,
  autoDestroy: Yup.boolean(),
  destroyTimeout: Yup.mixed<DestroyTimeout>().oneOf(DESTROY_TIMEOUT_OPTIONS),
  oneShot: Yup.boolean(),
  blockOutbound: Yup.boolean(),
  persistent: Yup.boolean(),
  persistentDiskGB: Yup.number().integer().min(10).max(50),
  volumeId: Yup.string().trim(),
  mountPath: Yup.string().trim().test("mount-path-format", "", function (value) {
    if (!value) return true;
    if (!MOUNT_PATH_PATTERN.test(value)) return this.createError({ message: MOUNT_PATH_ERROR });
    if (value === "/") return this.createError({ message: MOUNT_PATH_ROOT_ERROR });
    return true;
  }),
  fromSnapshot: Yup.string().trim(),
  snapshotMode: Yup.mixed<SnapshotMode>().oneOf(SNAPSHOT_MODE_OPTIONS),
  snapshotFrequency: Yup.string().trim(),
}).test("destroyTimeout-rule", "Destroy timeout must match auto-destroy settings", (value) => {
  if (!value) {
    return true;
  }

  if (value.autoDestroy === true) {
    return Boolean(value.destroyTimeout);
  }

  if (value.destroyTimeout) {
    return false;
  }

  return true;
}).test("persistentDisk-rule", "Persistent disk settings are invalid", (value) => {
  if (!value) {
    return true;
  }

  if (value.persistent === true) {
    return value.persistentDiskGB !== undefined && !value.volumeId;
  }

  if (value.persistentDiskGB) {
    return false;
  }

  if (value.volumeId && value.persistent) {
    return false;
  }

  return true;
}).test("mountPath-rule", "", function (value) {
  if (!value) {
    return true;
  }

  const wantsPersistent = value.persistent || Boolean(value.volumeId);
  const hasMount = Boolean(value.mountPath?.trim());

  if (wantsPersistent && !hasMount) {
    return this.createError({ message: "mountPath is required when using persistent storage" });
  }

  if (!wantsPersistent && hasMount) {
    return this.createError({ message: "mountPath requires persistent=true or volumeId" });
  }

  return true;
}).test("snapshot-rule", "Snapshot settings are invalid", (value) => {
  if (!value) {
    return true;
  }

  const mode = value.snapshotMode ?? SnapshotMode.Manual;

  if (mode === SnapshotMode.Automatic) {
    return Boolean(value.snapshotFrequency);
  }

  if (value.snapshotFrequency) {
    return false;
  }

  return true;
});

const getSandboxSchema = Yup.object({
  sandboxId: Yup.string().trim().required("Sandbox id is required"),
  workspace: Yup.string().trim(),
  teamId: Yup.string().trim(),
});

const listSandboxesSchema = Yup.object({
  page: Yup.number().integer().min(1),
  limit: Yup.number().integer().min(1).max(100),
  workspace: Yup.string().trim(),
  teamId: Yup.string().trim(),
});

const listSnapshotsSchema = Yup.object({
  page: Yup.number().integer().min(1),
  limit: Yup.number().integer().min(1).max(100),
  workspace: Yup.string().trim(),
  teamId: Yup.string().trim(),
});

const listOneSandboxSnapshotsSchema = Yup.object({
  sandboxId: Yup.string().trim().required("Sandbox id is required"),
  page: Yup.number().integer().min(1),
  limit: Yup.number().integer().min(1).max(100),
  workspace: Yup.string().trim(),
  teamId: Yup.string().trim(),
});

const listSandboxActivitySchema = Yup.object({
  sandboxId: Yup.string().trim().required("Sandbox id is required"),
  page: Yup.number().integer().min(1),
  limit: Yup.number().integer().min(1).max(100),
  since: Yup.string().trim(),
  until: Yup.string().trim(),
  workspace: Yup.string().trim(),
  teamId: Yup.string().trim(),
});

const createSnapshotSchema = Yup.object({
  sandboxId: Yup.string().trim().required("Sandbox id is required"),
  name: Yup.string()
    .trim()
    .matches(/^[a-z0-9-]{1,40}$/, "Use lowercase letters, numbers, and hyphens — up to 40 characters")
    .required("Snapshot name is required"),
  workspace: Yup.string().trim(),
  teamId: Yup.string().trim(),
});

const deleteSnapshotSchema = Yup.object({
  snapshotId: Yup.string().trim().required("Snapshot id is required"),
  workspace: Yup.string().trim(),
  teamId: Yup.string().trim(),
});

const getAblyTokenSchema = Yup.object({
  scope: Yup.mixed<"user" | "sandbox">().oneOf(["user", "sandbox"]).required("Ably token scope is required"),
  sandboxId: Yup.string().trim(),
  sandboxIds: Yup.array(Yup.string().trim()),
}).test("sandbox-scope", "Sandbox scope requires sandbox id(s)", (value) => {
  if (!value) {
    return true;
  }

  if (value.scope !== "sandbox") {
    return true;
  }

  const hasSandboxId = Boolean(value.sandboxId);
  const hasSandboxIds = Array.isArray(value.sandboxIds) && value.sandboxIds.length > 0;
  return hasSandboxId || hasSandboxIds;
});

type CreateSandboxPayload = CreateSandboxInput & { workspace?: string };
type GetSandboxPayload = { sandboxId: string; workspace?: string; teamId?: string };
type ListSandboxesPayload = { page?: number; limit?: number; workspace?: string; teamId?: string };
type ListSnapshotsPayload = { page?: number; limit?: number; workspace?: string; teamId?: string };
type AblyTokenScope = "user" | "sandbox";
type GetAblyTokenPayload = { scope: AblyTokenScope; sandboxId?: string; sandboxIds?: string[] };

export const listSandboxTemplatesServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return withTokenRefresh((api) => api.sandboxes.listTemplates());
});

export const createSandboxServerFn = createServerFn({
  method: "POST",
}).inputValidator((input: CreateSandboxPayload | undefined) => {
  return createSandboxSchema.validateSync(input ?? {}, { stripUnknown: true }) as CreateSandboxPayload;
}).handler(async ({ data: payload }) => {
  const workspaceSlug = payload.workspace?.trim().toLowerCase();
  const explicitTeamId = payload.teamId?.trim();

  return withTokenRefresh(async (api) => {
    const resolvedTeamId = explicitTeamId || (workspaceSlug ? await resolveTeamId(api, workspaceSlug) : undefined);
    const body: CreateSandboxInput = {
      ...(payload.name ? { name: payload.name } : {}),
      region: payload.region,
      ...(payload.template ? { template: payload.template } : {}),
      ...(resolvedTeamId ? { teamId: resolvedTeamId } : {}),
      ...(payload.environmentId ? { environmentId: payload.environmentId } : {}),
      ...(payload.specs ? { specs: payload.specs } : {}),
      ...(payload.autoDestroy !== undefined ? { autoDestroy: payload.autoDestroy } : {}),
      ...(payload.destroyTimeout ? { destroyTimeout: payload.destroyTimeout } : {}),
      ...(payload.oneShot !== undefined ? { oneShot: payload.oneShot } : {}),
      ...(payload.blockOutbound !== undefined ? { blockOutbound: payload.blockOutbound } : {}),
      ...(payload.persistent !== undefined ? { persistent: payload.persistent } : {}),
      ...(payload.persistentDiskGB !== undefined ? { persistentDiskGB: payload.persistentDiskGB } : {}),
      ...(payload.volumeId ? { volumeId: payload.volumeId } : {}),
      ...(payload.mountPath ? { mountPath: payload.mountPath.trim() } : {}),
      ...(payload.fromSnapshot ? { fromSnapshot: payload.fromSnapshot } : {}),
      ...(payload.snapshotMode ? { snapshotMode: payload.snapshotMode } : {}),
      ...(payload.snapshotFrequency ? { snapshotFrequency: payload.snapshotFrequency } : {}),
    };

    return api.sandboxes.create(body);
  });
});

export const getSandboxServerFn = createServerFn({
  method: "GET",
}).inputValidator((input: GetSandboxPayload | undefined) => {
  return getSandboxSchema.validateSync(input ?? {}, { stripUnknown: true }) as GetSandboxPayload;
}).handler(async ({ data: payload }) => {
  const workspaceSlug = payload.workspace?.trim().toLowerCase();
  const explicitTeamId = payload.teamId?.trim();

  return withTokenRefresh(async (api) => {
    const teamId = explicitTeamId || (workspaceSlug ? await resolveTeamId(api, workspaceSlug) : undefined);
    return api.sandboxes.getById(payload.sandboxId, { teamId });
  });
});

export const listSandboxesServerFn = createServerFn({
  method: "GET",
}).inputValidator((input: ListSandboxesPayload | undefined) => {
  return listSandboxesSchema.validateSync(input ?? {}, { stripUnknown: true }) as ListSandboxesPayload;
}).handler(async ({ data: payload }) => {
  const workspaceSlug = payload.workspace?.trim().toLowerCase();
  const explicitTeamId = payload.teamId?.trim();

  return withTokenRefresh(async (api) => {
    const teamId = explicitTeamId || (workspaceSlug ? await resolveTeamId(api, workspaceSlug) : undefined);

    return api.sandboxes.list({
      page: payload.page ?? 1,
      limit: payload.limit ?? 15,
      teamId,
    });
  });
});

export const listSandboxSnapshotsServerFn = createServerFn({
  method: "GET",
}).inputValidator((input: ListSnapshotsPayload | undefined) => {
  return listSnapshotsSchema.validateSync(input ?? {}, { stripUnknown: true }) as ListSnapshotsPayload;
}).handler(async ({ data: payload }) => {
  const workspaceSlug = payload.workspace?.trim().toLowerCase();
  const explicitTeamId = payload.teamId?.trim();

  return withTokenRefresh(async (api) => {
    const teamId = explicitTeamId || (workspaceSlug ? await resolveTeamId(api, workspaceSlug) : undefined);

    return api.sandboxes.listAllSnapshots({
      page: payload.page ?? 1,
      limit: payload.limit ?? 50,
      teamId,
    });
  });
});

export const pauseSandboxServerFn = createServerFn({
  method: "POST",
}).inputValidator((input: GetSandboxPayload | undefined) => {
  return getSandboxSchema.validateSync(input ?? {}, { stripUnknown: true }) as GetSandboxPayload;
}).handler(async ({ data: payload }) => {
  return withTokenRefresh(async (api) => {
    await api.sandboxes.pause(payload.sandboxId);
    return { success: true as const };
  });
});

export const resumeSandboxServerFn = createServerFn({
  method: "POST",
}).inputValidator((input: GetSandboxPayload | undefined) => {
  return getSandboxSchema.validateSync(input ?? {}, { stripUnknown: true }) as GetSandboxPayload;
}).handler(async ({ data: payload }) => {
  return withTokenRefresh(async (api) => {
    await api.sandboxes.resume(payload.sandboxId);
    return { success: true as const };
  });
});

export const destroySandboxServerFn = createServerFn({
  method: "POST",
}).inputValidator((input: GetSandboxPayload | undefined) => {
  return getSandboxSchema.validateSync(input ?? {}, { stripUnknown: true }) as GetSandboxPayload;
}).handler(async ({ data: payload }) => {
  return withTokenRefresh(async (api) => {
    await api.sandboxes.destroy(payload.sandboxId);
    return { success: true as const };
  });
});

type ListOneSandboxSnapshotsPayload = { sandboxId: string; page?: number; limit?: number; workspace?: string; teamId?: string };
type CreateSnapshotPayload = { sandboxId: string; name: string; workspace?: string; teamId?: string };
type DeleteSnapshotPayload = { snapshotId: string; workspace?: string; teamId?: string };
type ListSandboxActivityPayload = {
  sandboxId: string;
  page?: number;
  limit?: number;
  since?: string;
  until?: string;
  workspace?: string;
  teamId?: string;
};

export const listOneSandboxSnapshotsServerFn = createServerFn({
  method: "GET",
}).inputValidator((input: ListOneSandboxSnapshotsPayload | undefined) => {
  return listOneSandboxSnapshotsSchema.validateSync(input ?? {}, { stripUnknown: true }) as ListOneSandboxSnapshotsPayload;
}).handler(async ({ data: payload }) => {
  const workspaceSlug = payload.workspace?.trim().toLowerCase();
  const explicitTeamId = payload.teamId?.trim();

  return withTokenRefresh(async (api) => {
    const teamId = explicitTeamId || (workspaceSlug ? await resolveTeamId(api, workspaceSlug) : undefined);

    return api.sandboxes.listSandboxSnapshots(payload.sandboxId, {
      page: payload.page ?? 1,
      limit: payload.limit ?? 50,
      teamId,
    });
  });
});

export const createSandboxSnapshotServerFn = createServerFn({
  method: "POST",
}).inputValidator((input: CreateSnapshotPayload | undefined) => {
  return createSnapshotSchema.validateSync(input ?? {}, { stripUnknown: true }) as CreateSnapshotPayload;
}).handler(async ({ data: payload }) => {
  return withTokenRefresh((api) => api.sandboxes.createSnapshot(payload.sandboxId, { name: payload.name }));
});

export const deleteSandboxSnapshotServerFn = createServerFn({
  method: "POST",
}).inputValidator((input: DeleteSnapshotPayload | undefined) => {
  return deleteSnapshotSchema.validateSync(input ?? {}, { stripUnknown: true }) as DeleteSnapshotPayload;
}).handler(async ({ data: payload }) => {
  return withTokenRefresh(async (api) => {
    await api.sandboxes.deleteSnapshot(payload.snapshotId);
    return { success: true as const };
  });
});

export const listSandboxActivityServerFn = createServerFn({
  method: "GET",
}).inputValidator((input: ListSandboxActivityPayload | undefined) => {
  return listSandboxActivitySchema.validateSync(input ?? {}, { stripUnknown: true }) as ListSandboxActivityPayload;
}).handler(async ({ data: payload }) => {
  const workspaceSlug = payload.workspace?.trim().toLowerCase();
  const explicitTeamId = payload.teamId?.trim();

  return withTokenRefresh(async (api) => {
    const teamId = explicitTeamId || (workspaceSlug ? await resolveTeamId(api, workspaceSlug) : undefined);

    return api.sandboxes.listSandboxActivity(payload.sandboxId, {
      page: payload.page ?? 1,
      limit: payload.limit ?? 15,
      since: payload.since,
      until: payload.until,
      teamId,
    });
  });
});

export const getAblyTokenServerFn = createServerFn({
  method: "GET",
}).inputValidator((input: Partial<GetAblyTokenPayload> | undefined) => {
  return getAblyTokenSchema.validateSync(input ?? {}, {
    stripUnknown: true,
  }) as GetAblyTokenPayload;
}).handler(async ({ data: payload }) => {
  const sandboxIds = payload.sandboxIds?.filter((id): id is string => Boolean(id));

  return withTokenRefresh((api) =>
    api.ably.getToken({
      scope: payload.scope,
      sandboxId: payload.sandboxId,
      sandboxIds,
    }),
  );
});
