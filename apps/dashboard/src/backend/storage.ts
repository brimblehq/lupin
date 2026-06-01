import { type BackendClient } from "./client";

type ApiEnvelope<T> = {
  message?: string;
  data?: T;
};

export interface BucketRecord {
  id?: string;
  _id?: string;
  name: string;
  bucket_name?: string;
  projectId?: string;
  teamId?: string;
  project?: string | null;
  team?: string | null;
  region?: string;
  quota?: number;
  storage_used?: number;
  reserved_bytes?: number;
  objectCount?: number;
  status?: string;
  cors_rules?: CorsRule[];
  lifecycle_rules?: object[];
  createdAt: string;
  updatedAt?: string;
  url?: string;
}

export const S3_CREDENTIAL_ROLES = ["ReadOnly", "Editor"] as const;

export type S3CredentialRole = (typeof S3_CREDENTIAL_ROLES)[number];

export interface CreateS3CredentialsInput {
  role: S3CredentialRole;
  teamId?: string;
}

export interface S3CredentialsRecord {
  id: string;
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  role: S3CredentialRole;
  region: string;
  endpoint: string;
}

export interface StorageCredentialRecord {
  id: string;
  name: string;
  accessKeyId: string;
  policyNames: string[];
  role: S3CredentialRole;
  provider: string;
  createdAt: string;
  updatedAt: string;
  lastRotatedAt: string | null;
}

export interface PaginatedBucketsResponse {
  items: BucketRecord[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  limit: number;
}

export interface StorageObject {
  key: string;
  path: string;
  size: number;
  etag: string;
  last_modified: string | null;
  public_url: string | null;
}

export interface ListObjectsData {
  objects: StorageObject[];
  continuationToken: string | null;
  isTruncated: boolean;
}

export interface DeleteObjectResult {
  deleted: boolean;
  deletedCount: number;
}

export interface BulkDeleteObjectItem {
  path: string;
  recursive?: boolean;
}

export interface StorageRegion {
  id: string;
  name: string;
  geography: string;
  description: string;
  default: boolean;
}

export interface UserPresignUploadResult {
  uploadId: string;
  url: string;
  method: "PUT";
  expiresIn: number;
  key: string;
}

export interface UploadConfirmResult {
  key: string;
  path: string;
  size: number;
  url: string | null;
}

export interface MultipartInitiateResult {
  /** Upload record id — use in part-urls / complete / abort URLs. */
  id: string;
  /** Provider multipart id — internal only; do not pass back. */
  uploadId: string;
  key: string;
}

export interface MultipartPartUrl {
  PartNumber: number;
  URL: string;
}

export interface MultipartPartUrlsResult {
  urls: MultipartPartUrl[];
}

export interface MultipartCompletePart {
  PartNumber: number;
  ETag: string;
}

export interface MultipartAbortResult {
  aborted: boolean;
}

export const CORS_METHODS = ["GET", "HEAD", "PUT", "POST", "DELETE"] as const;
export type CorsMethod = (typeof CORS_METHODS)[number];

export interface CorsRule {
  allowedOrigins: string[];
  allowedMethods: CorsMethod[];
  allowedHeaders?: string[];
  exposeHeaders?: string[];
  maxAgeSeconds?: number;
}

export interface ListObjectsParams {
  prefix?: string;
  continuationToken?: string;
  maxKeys?: number;
  teamId?: string;
}

export interface SearchObjectsParams extends ListObjectsParams {
  q: string;
}

export interface StorageGraphPoint {
  date: string;
  storageUsed: number;
}

export interface StorageOverview {
  totalStorageUsed: number;
  totalFiles: number;
  totalBuckets: number;
  usageGraph: StorageGraphPoint[];
}

export type StorageMigrationStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface StartStorageMigrationInput {
  sourceBucket: string;
  sourceRegion: string;
  sourceEndpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  sourcePrefix?: string;
  destinationPrefix?: string;
  teamId?: string;
}

export interface StorageMigration {
  id: string;
  bucket: string;
  sourceBucket: string;
  sourceRegion: string;
  sourcePrefix: string | null;
  destinationPrefix: string | null;
  status: StorageMigrationStatus;
  totalObjects: number;
  copiedObjects: number;
  failedObjects: number;
  totalBytes: number;
  copiedBytes: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderInput {
  path: string;
  teamId?: string;
}

export interface CreateFolderResult {
  key: string;
  path: string;
  size: number;
  public_url: string | null;
}

export type StorageTokenResult = Record<string, string | number | boolean | object>;

export interface PresignDownloadResult {
  url: string;
  expiresIn?: number;
}

interface RawPaginatedBucketsResponse {
  data?: BucketRecord[];
  items?: BucketRecord[];
  totalCount?: number;
  total?: number;
  currentPage?: number;
  totalPages?: number;
  limit?: number;
}

function unwrapData<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === "object" && "data" in payload && payload.data !== undefined) {
    return payload.data;
  }
  return payload as T;
}

function normalizePaginatedBuckets(
  payload: ApiEnvelope<RawPaginatedBucketsResponse | BucketRecord[]> | RawPaginatedBucketsResponse | BucketRecord[],
): PaginatedBucketsResponse {
  const data = unwrapData(payload);

  if (Array.isArray(data)) {
    return {
      items: data,
      totalCount: data.length,
      currentPage: 1,
      totalPages: 1,
      limit: data.length || 20,
    };
  }

  let items: BucketRecord[] = [];
  if (Array.isArray(data?.data)) {
    items = data.data;
  } else if (Array.isArray(data?.items)) {
    items = data.items;
  }
  const totalCount = data?.totalCount ?? data?.total ?? items.length;
  const limit = data?.limit ?? (items.length || 20);

  return {
    items,
    totalCount,
    currentPage: data?.currentPage ?? 1,
    totalPages: data?.totalPages ?? Math.max(1, Math.ceil(totalCount / limit)),
    limit,
  };
}

interface RawStorageCredential {
  _id: string;
  name: string;
  access_key_id: string;
  policy_names: string[];
  role: S3CredentialRole;
  provider: string;
  createdAt: string;
  updatedAt: string;
  last_rotated_at: string | null;
}

function mapStorageCredentialRecord(raw: RawStorageCredential): StorageCredentialRecord {
  return {
    id: raw._id,
    name: raw.name,
    accessKeyId: raw.access_key_id,
    policyNames: raw.policy_names,
    role: raw.role,
    provider: raw.provider,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    lastRotatedAt: raw.last_rotated_at,
  };
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const createStorageApi = (client: BackendClient) => {
  const storagePath = "/core/v1/storage";
  const basePath = `${storagePath}/buckets`;

  return {
    getOverview: (params?: { teamId?: string }): Promise<StorageOverview> => {
      return client
        .request<ApiEnvelope<StorageOverview>>(`${storagePath}/overview`, {
          method: "GET",
          query: params?.teamId ? { teamId: params.teamId } : undefined,
        })
        .then(unwrapData);
    },

    listRegions: (): Promise<StorageRegion[]> => {
      return client
        .request<ApiEnvelope<{ regions?: StorageRegion[] }>>(`${storagePath}/regions`, {
          method: "GET",
        })
        .then(unwrapData)
        .then((data) => (Array.isArray(data.regions) ? data.regions : []));
    },

    listBuckets: (params?: { page?: number; limit?: number; projectId?: string; teamId?: string }): Promise<PaginatedBucketsResponse> => {
      return client
        .request<ApiEnvelope<RawPaginatedBucketsResponse | BucketRecord[]>>(basePath, {
          method: "GET",
          query: params,
        })
        .then(normalizePaginatedBuckets);
    },

    searchBuckets: (params: { q: string; page?: number; limit?: number; teamId?: string }): Promise<PaginatedBucketsResponse> => {
      return client
        .request<ApiEnvelope<RawPaginatedBucketsResponse>>(`${basePath}/search`, {
          method: "GET",
          query: params,
        })
        .then(normalizePaginatedBuckets);
    },

    createBucket: (data: {
      name: string;
      projectId?: string;
      teamId?: string;
      region?: string;
      isPublic?: boolean;
    }): Promise<BucketRecord> => {
      return client
        .request<ApiEnvelope<BucketRecord>, { name: string; projectId?: string; teamId?: string; region?: string; isPublic?: boolean }>(
          basePath,
          {
            method: "POST",
            body: data,
          },
        )
        .then(unwrapData);
    },

    getBucket: (bucketId: string, params?: { teamId?: string }): Promise<BucketRecord> => {
      return client
        .request<ApiEnvelope<BucketRecord>>(`${basePath}/${bucketId}`, {
          method: "GET",
          query: params,
        })
        .then(unwrapData);
    },

    updateBucket: (bucketId: string, data: { name?: string; isPublic?: boolean; force?: boolean }): Promise<BucketRecord> => {
      return client
        .request<ApiEnvelope<BucketRecord>, { name?: string; isPublic?: boolean; force?: boolean }>(`${basePath}/${bucketId}`, {
          method: "PATCH",
          body: data,
        })
        .then(unwrapData);
    },

    deleteBucket: (bucketId: string, data?: { force?: boolean; teamId?: string }): Promise<unknown> => {
      return client
        .request<ApiEnvelope<unknown>>(`${basePath}/${bucketId}`, {
          method: "DELETE",
          query: data,
        })
        .then(unwrapData);
    },

    createToken: (bucketId: string, data?: { teamId?: string; name?: string }): Promise<StorageTokenResult> => {
      return client
        .request<ApiEnvelope<StorageTokenResult>, { teamId?: string; name?: string } | undefined>(`${basePath}/${bucketId}/tokens`, {
          method: "POST",
          body: data,
        })
        .then(unwrapData);
    },

    presignDownload: (data: { bucketId: string; path: string; expiresSeconds?: number }): Promise<PresignDownloadResult> => {
      return client
        .request<ApiEnvelope<PresignDownloadResult>, { bucketId: string; path: string; expiresSeconds?: number }>(
          `/core/v1/storage/buckets/${data.bucketId}/user-presign-download`,
          {
            method: "POST",
            body: data,
          },
        )
        .then(unwrapData);
    },

    createUserToken: (bucketId: string, data?: { teamId?: string; name?: string }): Promise<StorageTokenResult> => {
      return client
        .request<ApiEnvelope<StorageTokenResult>, { teamId?: string; name?: string } | undefined>(`${basePath}/${bucketId}/user-tokens`, {
          method: "POST",
          body: data,
        })
        .then(unwrapData);
    },

    createCredentials: (bucketId: string, data: CreateS3CredentialsInput) => {
      return client
        .request<ApiEnvelope<S3CredentialsRecord>, CreateS3CredentialsInput>(`${basePath}/${bucketId}/credentials`, {
          method: "POST",
          body: data,
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        })
        .then(unwrapData);
    },

    listCredentials: (bucketId: string, params?: { teamId?: string }): Promise<StorageCredentialRecord[]> => {
      return client
        .request<ApiEnvelope<RawStorageCredential[]>>(`${basePath}/${bucketId}/credentials`, {
          method: "GET",
          query: params?.teamId ? { teamId: params.teamId } : undefined,
        })
        .then(unwrapData)
        .then((rows) => rows.map(mapStorageCredentialRecord));
    },

    revokeCredential: (bucketId: string, credentialId: string, params?: { teamId?: string }): Promise<{ deleted: boolean }> => {
      return client
        .request<ApiEnvelope<{ deleted: boolean }>, { teamId?: string }>(`${basePath}/${bucketId}/credentials/${credentialId}`, {
          method: "DELETE",
          body: params?.teamId ? { teamId: params.teamId } : {},
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        })
        .then(unwrapData);
    },

    setCors: (bucketId: string, data: { corsRules: CorsRule[]; teamId?: string }): Promise<BucketRecord> => {
      return client
        .request<ApiEnvelope<BucketRecord>, { corsRules: CorsRule[]; teamId?: string }>(`${basePath}/${bucketId}/cors`, {
          method: "PUT",
          body: data.teamId ? { corsRules: data.corsRules, teamId: data.teamId } : { corsRules: data.corsRules },
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        })
        .then(unwrapData);
    },

    createFolder: (bucketId: string, data: CreateFolderInput): Promise<CreateFolderResult> => {
      return client
        .request<ApiEnvelope<CreateFolderResult>, Pick<CreateFolderInput, "path">>(`${basePath}/${bucketId}/user-folders`, {
          method: "POST",
          body: { path: data.path },
          query: data.teamId ? { teamId: data.teamId } : undefined,
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        })
        .then(unwrapData);
    },

    listObjects: (bucketId: string, params?: { prefix?: string }): Promise<unknown> => {
      return client
        .request<ApiEnvelope<unknown>>(`${basePath}/${bucketId}/objects`, {
          method: "GET",
          query: params,
        })
        .then(unwrapData);
    },

    listUserObjects: (bucketId: string, params?: ListObjectsParams): Promise<ListObjectsData> => {
      const query: Record<string, string> = {};
      if (params?.prefix) query.prefix = params.prefix;
      if (params?.continuationToken) query.continuationToken = params.continuationToken;
      if (params?.maxKeys != null) query.maxKeys = String(params.maxKeys);
      if (params?.teamId) query.teamId = params.teamId;

      return client
        .request<ApiEnvelope<ListObjectsData>>(`${basePath}/${bucketId}/user-objects`, {
          method: "GET",
          query: Object.keys(query).length ? query : undefined,
        })
        .then((res) => {
          const data = unwrapData(res);
          return {
            objects: Array.isArray(data?.objects) ? data.objects : [],
            continuationToken: data?.continuationToken ?? null,
            isTruncated: Boolean(data?.isTruncated),
          };
        });
    },

    searchUserObjects: (bucketId: string, params: SearchObjectsParams): Promise<ListObjectsData> => {
      const query: Record<string, string> = { q: params.q };
      if (params.prefix) query.prefix = params.prefix;
      if (params.continuationToken) query.continuationToken = params.continuationToken;
      if (params.maxKeys != null) query.maxKeys = String(params.maxKeys);
      if (params.teamId) query.teamId = params.teamId;

      return client
        .request<ApiEnvelope<ListObjectsData>>(`${basePath}/${bucketId}/user-objects/search`, {
          method: "GET",
          query,
        })
        .then((res) => {
          const data = unwrapData(res);
          return {
            objects: Array.isArray(data?.objects) ? data.objects : [],
            continuationToken: data?.continuationToken ?? null,
            isTruncated: Boolean(data?.isTruncated),
          };
        });
    },

    deleteObject: (bucketId: string, data: { path: string; recursive?: boolean; teamId?: string }): Promise<DeleteObjectResult> => {
      const { path, recursive, teamId } = data;
      const body: { path: string; recursive?: boolean } = { path };
      if (recursive) body.recursive = true;
      return client
        .request<ApiEnvelope<DeleteObjectResult>, { path: string; recursive?: boolean }>(`${basePath}/${bucketId}/user-objects`, {
          method: "DELETE",
          body,
          query: teamId ? { teamId } : undefined,
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        })
        .then(unwrapData);
    },

    bulkDeleteObjects: (bucketId: string, data: { objects: BulkDeleteObjectItem[]; teamId?: string }): Promise<DeleteObjectResult> => {
      return client
        .request<ApiEnvelope<DeleteObjectResult>, { objects: BulkDeleteObjectItem[] }>(`${basePath}/${bucketId}/user-objects/bulk`, {
          method: "DELETE",
          body: { objects: data.objects },
          query: data.teamId ? { teamId: data.teamId } : undefined,
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        })
        .then(unwrapData);
    },

    startMigration: (bucketId: string, data: StartStorageMigrationInput): Promise<StorageMigration> => {
      return client
        .request<ApiEnvelope<StorageMigration>, StartStorageMigrationInput>(`${basePath}/${bucketId}/migrations`, {
          method: "POST",
          body: data,
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        })
        .then(unwrapData);
    },

    listMigrations: (bucketId: string, params?: { teamId?: string }): Promise<StorageMigration[]> => {
      return client
        .request<ApiEnvelope<StorageMigration[]>>(`${basePath}/${bucketId}/migrations`, {
          method: "GET",
          query: params?.teamId ? { teamId: params.teamId } : undefined,
        })
        .then(unwrapData);
    },

    getMigration: (bucketId: string, migrationId: string, params?: { teamId?: string }): Promise<StorageMigration> => {
      return client
        .request<ApiEnvelope<StorageMigration>>(`${basePath}/${bucketId}/migrations/${migrationId}`, {
          method: "GET",
          query: params?.teamId ? { teamId: params.teamId } : undefined,
        })
        .then(unwrapData);
    },

    cancelMigration: (bucketId: string, migrationId: string, params?: { teamId?: string }): Promise<StorageMigration> => {
      return client
        .request<ApiEnvelope<StorageMigration>, { teamId?: string } | undefined>(
          `${basePath}/${bucketId}/migrations/${migrationId}/cancel`,
          {
            method: "POST",
            body: params?.teamId ? { teamId: params.teamId } : undefined,
            headers: { "Idempotency-Key": generateIdempotencyKey() },
          },
        )
        .then(unwrapData);
    },

    userPresignUpload: (data: {
      bucketId: string;
      path: string;
      size: number;
      contentType?: string;
      teamId?: string;
    }): Promise<UserPresignUploadResult> => {
      return client
        .request<ApiEnvelope<UserPresignUploadResult>, { path: string; size: number; contentType?: string }>(
          `${basePath}/${data.bucketId}/user-presign-upload`,
          {
            method: "POST",
            body: { path: data.path, size: data.size, contentType: data.contentType },
            query: data.teamId ? { teamId: data.teamId } : undefined,
            headers: { "Idempotency-Key": generateIdempotencyKey() },
          },
        )
        .then(unwrapData);
    },

    userConfirmUpload: (data: { bucketId: string; uploadId: string; teamId?: string }): Promise<UploadConfirmResult> => {
      return client
        .request<ApiEnvelope<UploadConfirmResult>>(`${basePath}/${data.bucketId}/user-uploads/${data.uploadId}/confirm`, {
          method: "POST",
          query: data.teamId ? { teamId: data.teamId } : undefined,
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        })
        .then(unwrapData);
    },

    userMultipartInitiate: (data: {
      bucketId: string;
      path: string;
      size: number;
      contentType?: string;
      teamId?: string;
    }): Promise<MultipartInitiateResult> => {
      return client
        .request<ApiEnvelope<MultipartInitiateResult>, { path: string; size: number; contentType?: string }>(
          `${basePath}/${data.bucketId}/user-multipart/initiate`,
          {
            method: "POST",
            body: { path: data.path, size: data.size, contentType: data.contentType },
            query: data.teamId ? { teamId: data.teamId } : undefined,
            headers: { "Idempotency-Key": generateIdempotencyKey() },
          },
        )
        .then(unwrapData);
    },

    userMultipartPartUrls: (data: {
      bucketId: string;
      /** Upload record id from MultipartInitiateResult.id (NOT .uploadId — that's the provider id) */
      id: string;
      totalParts: number;
      teamId?: string;
    }): Promise<MultipartPartUrlsResult> => {
      return client
        .request<ApiEnvelope<MultipartPartUrlsResult>, { totalParts: number }>(
          `${basePath}/${data.bucketId}/user-multipart/${data.id}/part-urls`,
          {
            method: "POST",
            body: { totalParts: data.totalParts },
            query: data.teamId ? { teamId: data.teamId } : undefined,
          },
        )
        .then(unwrapData);
    },

    userMultipartComplete: (data: {
      bucketId: string;
      /** Upload record id from MultipartInitiateResult.id */
      id: string;
      parts: MultipartCompletePart[];
      teamId?: string;
    }): Promise<UploadConfirmResult> => {
      return client
        .request<ApiEnvelope<UploadConfirmResult>, { parts: MultipartCompletePart[] }>(
          `${basePath}/${data.bucketId}/user-multipart/${data.id}/complete`,
          {
            method: "POST",
            body: { parts: data.parts },
            query: data.teamId ? { teamId: data.teamId } : undefined,
            headers: { "Idempotency-Key": generateIdempotencyKey() },
          },
        )
        .then(unwrapData);
    },

    userMultipartAbort: (data: {
      bucketId: string;
      /** Upload record id from MultipartInitiateResult.id */
      id: string;
      teamId?: string;
    }): Promise<MultipartAbortResult> => {
      return client
        .request<ApiEnvelope<MultipartAbortResult>>(`${basePath}/${data.bucketId}/user-multipart/${data.id}/abort`, {
          method: "DELETE",
          query: data.teamId ? { teamId: data.teamId } : undefined,
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        })
        .then(unwrapData);
    },
  };
};

export type StorageApi = ReturnType<typeof createStorageApi>;
