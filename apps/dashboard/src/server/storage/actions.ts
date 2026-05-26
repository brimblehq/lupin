import { createServerFn } from "@tanstack/react-start";
import { withTokenRefresh, resolveTeamId } from "../shared/backend";

export const listBucketsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; projectId?: string; teamId?: string; q?: string } | undefined;

  return withTokenRefresh(async (api) => {
    const teamId = payload?.teamId || (await resolveTeamId(api, payload?.workspace));
    return api.storage.listBuckets({
      projectId: payload?.projectId,
      teamId,
    });
  });
});

export const createBucketServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; name: string; teamId?: string; region?: string; isPublic?: boolean } | undefined;
  if (!payload?.name) throw new Error("Bucket name is required");

  return withTokenRefresh(async (api) => {
    const teamId = payload?.teamId || (await resolveTeamId(api, payload?.workspace));
    return api.storage.createBucket({
      name: payload.name,
      teamId,
      region: payload.region,
      isPublic: payload.isPublic,
    });
  });
});

export const updateBucketServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; bucketId: string; name?: string; isPublic?: boolean } | undefined;
  if (!payload?.bucketId) throw new Error("Bucket ID is required");

  return withTokenRefresh(async (api) => {
    return api.storage.updateBucket(payload.bucketId, {
      name: payload.name,
      isPublic: payload.isPublic,
    });
  });
});

export const deleteBucketServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; bucketId: string; force?: boolean; teamId?: string } | undefined;
  if (!payload?.bucketId) throw new Error("Bucket ID is required");

  return withTokenRefresh(async (api) => {
    const teamId = payload?.teamId || (await resolveTeamId(api, payload?.workspace));
    await api.storage.deleteBucket(payload.bucketId, {
      force: payload.force,
      teamId,
    });
    return { success: true };
  });
});

export const getBucketDetailsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; bucketId: string; teamId?: string } | undefined;
  if (!payload?.bucketId) throw new Error("Bucket ID is required");

  return withTokenRefresh(async (api) => {
    const teamId = payload?.teamId || (await resolveTeamId(api, payload?.workspace));
    return api.storage.getBucket(payload.bucketId, { teamId });
  });
});

export const listBucketObjectsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; bucketId: string; teamId?: string } | undefined;
  if (!payload?.bucketId) throw new Error("Bucket ID is required");

  return withTokenRefresh(async (api) => {
    const teamId = payload?.teamId || (await resolveTeamId(api, payload?.workspace));
    return api.storage.listUserObjects(payload.bucketId, { teamId });
  });
});

export const createBucketTokenServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; bucketId: string; name?: string; teamId?: string } | undefined;
  if (!payload?.bucketId) throw new Error("Bucket ID is required");

  return withTokenRefresh(async (api) => {
    const teamId = payload?.teamId || (await resolveTeamId(api, payload?.workspace));
    return api.storage.createUserToken(payload.bucketId, { teamId, name: payload.name });
  });
});

export const generateDownloadUrlServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; bucketId: string; path: string } | undefined;
  if (!payload?.bucketId || !payload?.path) throw new Error("Bucket ID and path are required");

  return withTokenRefresh(async (api) => {
    return api.storage.presignDownload({ bucketId: payload.bucketId, path: payload.path });
  });
});

export const presignUploadServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; bucketId: string; path: string; contentType?: string; size: number } | undefined;
  if (!payload?.bucketId || !payload?.path || !payload?.size) throw new Error("Missing required upload parameters");
  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, payload.workspace);
    return api.storage.userPresignUpload({ ...payload, teamId });
  });
});

export const initiateMultipartUploadServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; bucketId: string; path: string; contentType?: string; size: number } | undefined;
  if (!payload?.bucketId || !payload?.path || !payload?.size) throw new Error("Missing required upload parameters");
  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, payload.workspace);
    return api.storage.userMultipartInitiate({ ...payload, teamId });
  });
});

export const getMultipartUrlsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; bucketId: string; uploadId: string; totalParts: number } | undefined;
  if (!payload?.bucketId || !payload?.uploadId || !payload?.totalParts) throw new Error("Missing required parameters");
  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, payload.workspace);
    return api.storage.userMultipartPartUrls({ ...payload, teamId });
  });
});

export const completeMultipartUploadServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; bucketId: string; uploadId: string; parts: any[] } | undefined;
  if (!payload?.bucketId || !payload?.uploadId || !payload?.parts) throw new Error("Missing required parameters");
  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, payload.workspace);
    return api.storage.userMultipartComplete({ ...payload, teamId });
  });
});

export const abortMultipartUploadServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; bucketId: string; uploadId: string } | undefined;
  if (!payload?.bucketId || !payload?.uploadId) throw new Error("Missing required parameters");
  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, payload.workspace);
    return api.storage.userMultipartAbort({ ...payload, teamId });
  });
});

export const confirmUploadServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; bucketId: string; uploadId: string } | undefined;
  if (!payload?.bucketId || !payload?.uploadId) throw new Error("Missing required parameters");
  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, payload.workspace);
    return api.storage.userConfirmUpload({ ...payload, teamId });
  });
});

export const deleteObjectServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; bucketId: string; path: string } | undefined;
  if (!payload?.bucketId || !payload?.path) throw new Error("Missing required parameters");
  return withTokenRefresh(async (api) => {
    return api.storage.deleteObject(payload.bucketId, { path: payload.path });
  });
});
