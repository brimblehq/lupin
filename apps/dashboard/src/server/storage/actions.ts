import { createServerFn } from "@tanstack/react-start";
import * as Yup from "yup";
import {
  CORS_METHODS,
  S3_CREDENTIAL_ROLES,
  type CorsMethod,
  type CorsRule,
  type S3CredentialRole,
  type CreateFolderResult,
  type DeleteObjectResult,
  type ListObjectsData,
  type MultipartAbortResult,
  type MultipartCompletePart,
  type MultipartInitiateResult,
  type MultipartPartUrlsResult,
  type UploadConfirmResult,
  type UserPresignUploadResult,
  type StorageOverview,
  type StorageCredentialRecord,
  type PaginatedBucketsResponse,
  type StorageRegion,
  type BulkDeleteObjectItem,
  type StartStorageMigrationInput,
  type StorageMigration,
} from "@/backend/storage";
import { withTokenRefresh, resolveTeamId } from "../shared/backend";

interface StorageOverviewInput {
  workspace?: string;
  teamId?: string;
}

interface ListBucketsInput {
  workspace?: string;
  projectId?: string;
  teamId?: string;
  page?: number;
  limit?: number;
}

interface SearchBucketsInput {
  workspace?: string;
  teamId?: string;
  q: string;
  page?: number;
  limit?: number;
}

interface CreateBucketInput {
  workspace?: string;
  name: string;
  projectId?: string;
  teamId?: string;
  region?: string;
  isPublic?: boolean;
}

interface DeleteBucketInput {
  workspace?: string;
  bucketId: string;
  force?: boolean;
  teamId?: string;
  twoFactorToken?: string;
}

interface GetBucketDetailsInput {
  workspace?: string;
  bucketId: string;
  teamId?: string;
}

interface ListStorageMigrationsInput {
  workspace?: string;
  bucketId: string;
  teamId?: string;
}

interface GetStorageMigrationInput extends ListStorageMigrationsInput {
  migrationId: string;
}

interface BulkDeleteObjectsInput {
  workspace?: string;
  bucketId: string;
  objects: BulkDeleteObjectItem[];
  teamId?: string;
}

interface StartStorageMigrationServerInput extends StartStorageMigrationInput {
  workspace?: string;
  bucketId: string;
}

const storageOverviewSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  teamId: Yup.string().trim().optional(),
});

const listBucketsSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  projectId: Yup.string().trim().optional(),
  teamId: Yup.string().trim().optional(),
  page: Yup.number().integer().min(1).optional(),
  limit: Yup.number().integer().min(1).max(100).optional(),
});

const searchBucketsSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  teamId: Yup.string().trim().optional(),
  q: Yup.string().trim().required("Search query is required"),
  page: Yup.number().integer().min(1).optional(),
  limit: Yup.number().integer().min(1).max(100).optional(),
});

const createBucketSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  name: Yup.string().trim().required("Bucket name is required"),
  projectId: Yup.string().trim().optional(),
  teamId: Yup.string().trim().optional(),
  region: Yup.string().trim().optional(),
  isPublic: Yup.boolean().optional(),
});

const listBucketObjectsSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  prefix: Yup.string().trim().optional(),
  continuationToken: Yup.string().optional(),
  maxKeys: Yup.number().integer().min(1).max(1000).optional(),
  teamId: Yup.string().trim().optional(),
});

const searchBucketObjectsSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  q: Yup.string().trim().required("Search query is required"),
  prefix: Yup.string().trim().optional(),
  continuationToken: Yup.string().optional(),
  maxKeys: Yup.number().integer().min(1).max(1000).optional(),
  teamId: Yup.string().trim().optional(),
});

const createBucketCredentialsSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  role: Yup.mixed<S3CredentialRole>()
    .oneOf([...S3_CREDENTIAL_ROLES], "Select a valid credential role")
    .required("Role is required"),
  teamId: Yup.string().trim().optional(),
});

const listBucketCredentialsSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  teamId: Yup.string().trim().optional(),
});

const deleteObjectSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  path: Yup.string().trim().required("Path is required"),
  recursive: Yup.boolean().optional(),
  teamId: Yup.string().trim().optional(),
});

const bulkDeleteObjectItemSchema = Yup.object({
  path: Yup.string().trim().required("Path is required"),
  recursive: Yup.boolean().optional(),
});

const bulkDeleteObjectsSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  objects: Yup.array()
    .of(bulkDeleteObjectItemSchema)
    .min(1, "Select at least one object")
    .max(100, "You can delete up to 100 objects at once")
    .required(),
  teamId: Yup.string().trim().optional(),
});

const presignUploadSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  path: Yup.string().trim().required("Path is required"),
  size: Yup.number().integer().moreThan(0, "Size must be greater than 0").required("Size is required"),
  contentType: Yup.string().trim().optional(),
  teamId: Yup.string().trim().optional(),
});

const confirmUploadSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  uploadId: Yup.string().trim().required("Upload ID is required"),
  teamId: Yup.string().trim().optional(),
});

const multipartInitiateSchema = presignUploadSchema;

const multipartPartUrlsSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  id: Yup.string().trim().required("Upload record id is required"),
  totalParts: Yup.number().integer().moreThan(0, "totalParts must be a positive integer").required(),
  teamId: Yup.string().trim().optional(),
});

const multipartCompletePartSchema = Yup.object({
  PartNumber: Yup.number().integer().moreThan(0).required(),
  ETag: Yup.string().required(),
});

const multipartCompleteSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  id: Yup.string().trim().required("Upload record id is required"),
  parts: Yup.array().of(multipartCompletePartSchema).min(1, "At least one part is required").required(),
  teamId: Yup.string().trim().optional(),
});

const multipartAbortSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  id: Yup.string().trim().required("Upload record id is required"),
  teamId: Yup.string().trim().optional(),
});

const revokeBucketCredentialSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  credentialId: Yup.string().trim().required("Credential ID is required"),
  teamId: Yup.string().trim().optional(),
});

const corsRuleSchema = Yup.object({
  allowedOrigins: Yup.array()
    .of(Yup.string().trim().required("Origin cannot be empty"))
    .min(1, "Each rule needs at least one origin")
    .required(),
  allowedMethods: Yup.array()
    .of(
      Yup.mixed<CorsMethod>()
        .oneOf([...CORS_METHODS])
        .required(),
    )
    .min(1, "Each rule needs at least one method")
    .required(),
  allowedHeaders: Yup.array().of(Yup.string().trim().required()).optional(),
  exposeHeaders: Yup.array().of(Yup.string().trim().required()).optional(),
  maxAgeSeconds: Yup.number().integer().min(0).optional(),
});

const setBucketCorsSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  corsRules: Yup.array().of(corsRuleSchema).required(),
  teamId: Yup.string().trim().optional(),
});

const createFolderSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  path: Yup.string().trim().required("Folder path is required"),
  teamId: Yup.string().trim().optional(),
});

const listStorageMigrationsSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  teamId: Yup.string().trim().optional(),
});

const getStorageMigrationSchema = listStorageMigrationsSchema.shape({
  migrationId: Yup.string().trim().required("Migration ID is required"),
});

const startStorageMigrationSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  sourceBucket: Yup.string().trim().required("Source bucket is required"),
  sourceRegion: Yup.string().trim().required("Source region is required"),
  sourceEndpoint: Yup.string().trim().optional(),
  accessKeyId: Yup.string().trim().required("Access key ID is required"),
  secretAccessKey: Yup.string().trim().required("Secret access key is required"),
  sourcePrefix: Yup.string().trim().optional(),
  destinationPrefix: Yup.string().trim().optional(),
  teamId: Yup.string().trim().optional(),
});

export const listBucketsServerFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: ListBucketsInput | undefined) => listBucketsSchema.validateSync(data ?? {}, { stripUnknown: true }))
  .handler(async ({ data: payload }): Promise<PaginatedBucketsResponse> => {
    return withTokenRefresh(async (api) => {
      const teamId = payload.teamId || (await resolveTeamId(api, payload.workspace));
      return api.storage.listBuckets({
        page: payload.page,
        limit: payload.limit,
        projectId: payload.projectId,
        teamId,
      });
    });
  });

export const searchBucketsServerFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: SearchBucketsInput) => searchBucketsSchema.validateSync(data, { stripUnknown: true }))
  .handler(async ({ data: payload }): Promise<PaginatedBucketsResponse> => {
    return withTokenRefresh(async (api) => {
      const teamId = payload.teamId || (await resolveTeamId(api, payload.workspace));
      return api.storage.searchBuckets({
        q: payload.q,
        page: payload.page,
        limit: payload.limit,
        teamId,
      });
    });
  });

export const getStorageOverviewServerFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: StorageOverviewInput | undefined) => storageOverviewSchema.validateSync(data ?? {}, { stripUnknown: true }))
  .handler(async ({ data: { workspace, teamId } }): Promise<StorageOverview> => {
    return withTokenRefresh(async (api) => {
      const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
      return api.storage.getOverview(resolvedTeam ? { teamId: resolvedTeam } : undefined);
    });
  });

export const listStorageRegionsServerFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<StorageRegion[]> => {
  return withTokenRefresh(async (api) => api.storage.listRegions());
});

export const createBucketServerFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: CreateBucketInput) => createBucketSchema.validateSync(data, { stripUnknown: true }))
  .handler(async ({ data: payload }) => {
    return withTokenRefresh(async (api) => {
      const teamId = payload.teamId || (await resolveTeamId(api, payload.workspace));
      return api.storage.createBucket({
        name: payload.name,
        projectId: payload.projectId,
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

const deleteBucketSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  force: Yup.boolean().optional(),
  teamId: Yup.string().trim().optional(),
  twoFactorToken: Yup.string().trim().optional(),
});

const getBucketDetailsSchema = Yup.object({
  workspace: Yup.string().trim().optional(),
  bucketId: Yup.string().trim().required("Bucket ID is required"),
  teamId: Yup.string().trim().optional(),
});

export const deleteBucketServerFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: DeleteBucketInput) => deleteBucketSchema.validateSync(data, { stripUnknown: true }))
  .handler(async ({ data: { workspace, bucketId, force, teamId, twoFactorToken } }) => {
    return withTokenRefresh(
      async (api) => {
        const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
        await api.storage.deleteBucket(bucketId, { force, teamId: resolvedTeam });
        return { success: true as const };
      },
      { stepUpToken: twoFactorToken },
    );
  });

export const getBucketDetailsServerFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: GetBucketDetailsInput) => getBucketDetailsSchema.validateSync(data, { stripUnknown: true }))
  .handler(async ({ data: { workspace, bucketId, teamId } }) => {
    return withTokenRefresh(async (api) => {
      const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
      return api.storage.getBucket(bucketId, { teamId: resolvedTeam });
    });
  });

export const listBucketObjectsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }): Promise<ListObjectsData> => {
  const { workspace, bucketId, prefix, continuationToken, maxKeys, teamId } = listBucketObjectsSchema.validateSync(data ?? {}, {
    stripUnknown: true,
  });

  return withTokenRefresh(async (api) => {
    const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
    return api.storage.listUserObjects(bucketId, {
      prefix,
      continuationToken,
      maxKeys,
      teamId: resolvedTeam,
    });
  });
});

export const searchBucketObjectsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }): Promise<ListObjectsData> => {
  const { workspace, bucketId, q, prefix, continuationToken, maxKeys, teamId } = searchBucketObjectsSchema.validateSync(data ?? {}, {
    stripUnknown: true,
  });

  return withTokenRefresh(async (api) => {
    const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
    return api.storage.searchUserObjects(bucketId, {
      q,
      prefix,
      continuationToken,
      maxKeys,
      teamId: resolvedTeam,
    });
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

export const createBucketCredentialsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = createBucketCredentialsSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const teamId = payload.teamId || (await resolveTeamId(api, payload.workspace));
    return api.storage.createCredentials(payload.bucketId, {
      role: payload.role,
      teamId,
    });
  });
});

export const listBucketCredentialsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }): Promise<StorageCredentialRecord[]> => {
  const { workspace, bucketId, teamId } = listBucketCredentialsSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
    return api.storage.listCredentials(bucketId, { teamId: resolvedTeam });
  });
});

export const revokeBucketCredentialServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }): Promise<{ deleted: boolean }> => {
  const { workspace, bucketId, credentialId, teamId } = revokeBucketCredentialSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
    return api.storage.revokeCredential(bucketId, credentialId, { teamId: resolvedTeam });
  });
});

export const setBucketCorsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const { workspace, bucketId, corsRules, teamId } = setBucketCorsSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
    return api.storage.setCors(bucketId, { corsRules: corsRules as CorsRule[], teamId: resolvedTeam });
  });
});

export const createFolderServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }): Promise<CreateFolderResult> => {
  const payload = createFolderSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const teamId = payload.teamId || (await resolveTeamId(api, payload.workspace));
    return api.storage.createFolder(payload.bucketId, {
      path: payload.path,
      teamId,
    });
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
}).handler(async ({ data }): Promise<UserPresignUploadResult> => {
  const { workspace, bucketId, path, size, contentType, teamId } = presignUploadSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
    return api.storage.userPresignUpload({ bucketId, path, size, contentType, teamId: resolvedTeam });
  });
});

export const initiateMultipartUploadServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }): Promise<MultipartInitiateResult> => {
  const { workspace, bucketId, path, size, contentType, teamId } = multipartInitiateSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
    return api.storage.userMultipartInitiate({ bucketId, path, size, contentType, teamId: resolvedTeam });
  });
});

export const getMultipartUrlsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }): Promise<MultipartPartUrlsResult> => {
  const { workspace, bucketId, id, totalParts, teamId } = multipartPartUrlsSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
    return api.storage.userMultipartPartUrls({ bucketId, id, totalParts, teamId: resolvedTeam });
  });
});

export const completeMultipartUploadServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }): Promise<UploadConfirmResult> => {
  const { workspace, bucketId, id, parts, teamId } = multipartCompleteSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
    return api.storage.userMultipartComplete({ bucketId, id, parts: parts as MultipartCompletePart[], teamId: resolvedTeam });
  });
});

export const abortMultipartUploadServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }): Promise<MultipartAbortResult> => {
  const { workspace, bucketId, id, teamId } = multipartAbortSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
    return api.storage.userMultipartAbort({ bucketId, id, teamId: resolvedTeam });
  });
});

export const confirmUploadServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }): Promise<UploadConfirmResult> => {
  const { workspace, bucketId, uploadId, teamId } = confirmUploadSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
    return api.storage.userConfirmUpload({ bucketId, uploadId, teamId: resolvedTeam });
  });
});

export const deleteObjectServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }): Promise<DeleteObjectResult> => {
  const { workspace, bucketId, path, recursive, teamId } = deleteObjectSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
    return api.storage.deleteObject(bucketId, { path, recursive, teamId: resolvedTeam });
  });
});

export const bulkDeleteObjectsServerFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: BulkDeleteObjectsInput) => bulkDeleteObjectsSchema.validateSync(data, { stripUnknown: true }))
  .handler(async ({ data: { workspace, bucketId, objects, teamId } }): Promise<DeleteObjectResult> => {
    return withTokenRefresh(async (api) => {
      const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
      return api.storage.bulkDeleteObjects(bucketId, {
        objects,
        teamId: resolvedTeam,
      });
    });
  });

export const listStorageMigrationsServerFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: ListStorageMigrationsInput) => listStorageMigrationsSchema.validateSync(data, { stripUnknown: true }))
  .handler(async ({ data: { workspace, bucketId, teamId } }): Promise<StorageMigration[]> => {
    return withTokenRefresh(async (api) => {
      const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
      return api.storage.listMigrations(bucketId, { teamId: resolvedTeam });
    });
  });

export const getStorageMigrationServerFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: GetStorageMigrationInput) => getStorageMigrationSchema.validateSync(data, { stripUnknown: true }))
  .handler(async ({ data: { workspace, bucketId, migrationId, teamId } }): Promise<StorageMigration> => {
    return withTokenRefresh(async (api) => {
      const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
      return api.storage.getMigration(bucketId, migrationId, { teamId: resolvedTeam });
    });
  });

export const startStorageMigrationServerFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: StartStorageMigrationServerInput) => startStorageMigrationSchema.validateSync(data, { stripUnknown: true }))
  .handler(async ({ data: payload }): Promise<StorageMigration> => {
    return withTokenRefresh(async (api) => {
      const teamId = payload.teamId || (await resolveTeamId(api, payload.workspace));
      return api.storage.startMigration(payload.bucketId, {
        sourceBucket: payload.sourceBucket,
        sourceRegion: payload.sourceRegion,
        sourceEndpoint: payload.sourceEndpoint,
        accessKeyId: payload.accessKeyId,
        secretAccessKey: payload.secretAccessKey,
        sourcePrefix: payload.sourcePrefix,
        destinationPrefix: payload.destinationPrefix,
        teamId,
      });
    });
  });

export const cancelStorageMigrationServerFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: GetStorageMigrationInput) => getStorageMigrationSchema.validateSync(data, { stripUnknown: true }))
  .handler(async ({ data: { workspace, bucketId, migrationId, teamId } }): Promise<StorageMigration> => {
    return withTokenRefresh(async (api) => {
      const resolvedTeam = teamId || (await resolveTeamId(api, workspace));
      return api.storage.cancelMigration(bucketId, migrationId, { teamId: resolvedTeam });
    });
  });
