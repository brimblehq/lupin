import { createServerFn } from "@tanstack/react-start";
import * as Yup from "yup";
import { VolumeType, type CreateVolumeInput } from "@/backend/volumes";
import { resolveTeamId, withTokenRefresh } from "@/server/shared/backend";

const VOLUME_TYPE_VALUES = Object.values(VolumeType);

type ListVolumesPayload = {
  workspace?: string;
  page?: number;
  limit?: number;
  teamId?: string;
};

type CreateVolumePayload = {
  workspace?: string;
  name: string;
  sizeGB: number;
  region: string;
  type?: VolumeType;
  teamId?: string;
};

type GetVolumePayload = {
  volumeId: string;
};

type DeleteVolumePayload = {
  volumeId: string;
  workspace?: string;
  twoFactorToken?: string;
};

const listVolumesSchema = Yup.object({
  workspace: Yup.string().trim(),
  page: Yup.number().integer().min(1),
  limit: Yup.number().integer().min(1).max(100),
  teamId: Yup.string().trim(),
});

const createVolumeSchema = Yup.object({
  workspace: Yup.string().trim(),
  name: Yup.string()
    .trim()
    .matches(/^[a-z0-9-]{1,40}$/, "Use lowercase letters, numbers, and hyphens — up to 40 characters")
    .required("Volume name is required"),
  sizeGB: Yup.number().integer().min(10, "Size must be at least 10 GB").max(50, "Size cannot exceed 50 GB").required("Size is required"),
  region: Yup.string().trim().required("Region is required"),
  type: Yup.mixed<VolumeType>().oneOf(VOLUME_TYPE_VALUES),
  teamId: Yup.string().trim(),
});

const getVolumeSchema = Yup.object({
  volumeId: Yup.string().trim().required("Volume id is required"),
});

const deleteVolumeSchema = Yup.object({
  volumeId: Yup.string().trim().required("Volume id is required"),
  workspace: Yup.string().trim(),
  twoFactorToken: Yup.string().trim(),
});

export const listVolumesServerFn = createServerFn({
  method: "GET",
}).inputValidator((input: ListVolumesPayload | undefined) => {
  return listVolumesSchema.validateSync(input ?? {}, {
    stripUnknown: true,
  }) as ListVolumesPayload;
}).handler(async ({ data: payload }) => {
  const workspaceSlug = payload.workspace?.trim().toLowerCase();
  const explicitTeamId = payload.teamId?.trim();

  return withTokenRefresh(async (api) => {
    const teamId = explicitTeamId || (workspaceSlug ? await resolveTeamId(api, workspaceSlug) : undefined);

    return api.volumes.list({
      page: payload.page,
      limit: payload.limit,
      teamId,
    });
  });
});

export const createVolumeServerFn = createServerFn({
  method: "POST",
}).inputValidator((input: CreateVolumePayload | undefined) => {
  return createVolumeSchema.validateSync(input ?? {}, { stripUnknown: true }) as CreateVolumePayload;
}).handler(async ({ data: payload }) => {
  const workspaceSlug = payload.workspace?.trim().toLowerCase();
  const explicitTeamId = payload.teamId?.trim();

  return withTokenRefresh(async (api) => {
    const teamId = explicitTeamId || (workspaceSlug ? await resolveTeamId(api, workspaceSlug) : undefined);

    const body: CreateVolumeInput = {
      name: payload.name,
      sizeGB: payload.sizeGB,
      region: payload.region,
      ...(payload.type ? { type: payload.type } : {}),
      ...(teamId ? { teamId } : {}),
    };

    return api.volumes.create(body);
  });
});

export const getVolumeServerFn = createServerFn({
  method: "GET",
}).inputValidator((input: GetVolumePayload | undefined) => {
  return getVolumeSchema.validateSync(input ?? {}, { stripUnknown: true }) as GetVolumePayload;
}).handler(async ({ data: payload }) => {
  return withTokenRefresh((api) => api.volumes.getById(payload.volumeId));
});

export const deleteVolumeServerFn = createServerFn({
  method: "POST",
}).inputValidator((input: DeleteVolumePayload | undefined) => {
  return deleteVolumeSchema.validateSync(input ?? {}, { stripUnknown: true }) as DeleteVolumePayload;
}).handler(async ({ data: payload }) => {
  return withTokenRefresh(
    async (api) => {
      await api.volumes.remove(payload.volumeId);
      return { success: true as const };
    },
    { stepUpToken: payload.twoFactorToken },
  );
});
