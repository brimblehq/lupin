import { type BackendClient } from "./client";
import { type ApiListResponse } from "./types";

export interface BucketRecord {
  id: string;
  name: string;
  projectId?: string;
  teamId?: string;
  region?: string;
  createdAt: string;
  updatedAt?: string;
  [key: string]: any;
}

export type PaginatedBucketsResponse = ApiListResponse<BucketRecord>;

export const createStorageApi = (client: BackendClient) => {
  const basePath = "/core/v1/storage/buckets"; // Notice we use /core as configured in client

  return {
    listBuckets: (params?: { projectId?: string; teamId?: string }) => {
      return client
        .request<any>(basePath, {
          method: "GET",
          query: params as Record<string, string>,
        })
        .then((res) => {
          const data = res?.data?.data ?? res?.data ?? res;
          return Array.isArray(data) ? { items: data } : data;
        });
    },

    createBucket: (data: { name: string; teamId?: string; region?: string; isPublic?: boolean }) => {
      return client
        .request<any>(basePath, {
          method: "POST",
          body: data,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    getBucket: (bucketId: string, params?: { teamId?: string }) => {
      return client
        .request<any>(`${basePath}/${bucketId}`, {
          method: "GET",
          query: params as Record<string, string>,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    updateBucket: (bucketId: string, data: { name?: string; isPublic?: boolean; force?: boolean }) => {
      return client
        .request<any>(`${basePath}/${bucketId}`, {
          method: "PATCH",
          body: data,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    deleteBucket: (bucketId: string, data?: { force?: boolean; teamId?: string }) => {
      return client
        .request<any>(`${basePath}/${bucketId}`, {
          method: "DELETE",
          query: data as any,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    createToken: (bucketId: string, data?: { teamId?: string; name?: string }) => {
      return client
        .request<any>(`${basePath}/${bucketId}/tokens`, {
          method: "POST",
          body: data,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    presignDownload: (data: { bucketId: string; path: string; expiresSeconds?: number }) => {
      return client
        .request<any>(`/core/v1/storage/buckets/${data.bucketId}/user-presign-download`, {
          method: "POST",
          body: data,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    createUserToken: (bucketId: string, data?: { teamId?: string; name?: string }) => {
      return client
        .request<any>(`${basePath}/${bucketId}/user-tokens`, {
          method: "POST",
          body: data,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    listObjects: (bucketId: string, params?: { prefix?: string }) => {
      return client
        .request<any>(`${basePath}/${bucketId}/objects`, {
          method: "GET",
          query: params as Record<string, string>,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    listUserObjects: (bucketId: string, params?: { teamId?: string }) => {
      return client
        .request<any>(`${basePath}/${bucketId}/user-objects`, {
          method: "GET",
          query: params as Record<string, string>,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    deleteObject: (bucketId: string, data: { path: string }) => {
      return client
        .request<any>(`${basePath}/${bucketId}/objects`, {
          method: "DELETE",
          body: data,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    userPresignUpload: (data: { bucketId: string; path: string; contentType?: string; size: number; teamId?: string }) => {
      return client
        .request<any>(`${basePath}/${data.bucketId}/user-presign-upload`, {
          method: "POST",
          body: data,
          query: data.teamId ? { teamId: data.teamId } : undefined,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    userConfirmUpload: (data: { bucketId: string; uploadId: string; teamId?: string }) => {
      return client
        .request<any>(`${basePath}/${data.bucketId}/user-uploads/${data.uploadId}/confirm`, {
          method: "POST",
          query: data.teamId ? { teamId: data.teamId } : undefined,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    userMultipartInitiate: (data: { bucketId: string; path: string; contentType?: string; size: number; teamId?: string }) => {
      return client
        .request<any>(`${basePath}/${data.bucketId}/user-multipart/initiate`, {
          method: "POST",
          body: data,
          query: data.teamId ? { teamId: data.teamId } : undefined,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    userMultipartPartUrls: (data: { bucketId: string; uploadId: string; totalParts: number; teamId?: string }) => {
      return client
        .request<any>(`${basePath}/${data.bucketId}/user-multipart/${data.uploadId}/part-urls`, {
          method: "POST",
          body: { totalParts: data.totalParts },
          query: data.teamId ? { teamId: data.teamId } : undefined,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    userMultipartComplete: (data: {
      bucketId: string;
      uploadId: string;
      parts: { PartNumber: number; ETag: string }[];
      teamId?: string;
    }) => {
      return client
        .request<any>(`${basePath}/${data.bucketId}/user-multipart/${data.uploadId}/complete`, {
          method: "POST",
          body: { parts: data.parts },
          query: data.teamId ? { teamId: data.teamId } : undefined,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },

    userMultipartAbort: (data: { bucketId: string; uploadId: string; teamId?: string }) => {
      return client
        .request<any>(`${basePath}/${data.bucketId}/user-multipart/${data.uploadId}/abort`, {
          method: "DELETE",
          query: data.teamId ? { teamId: data.teamId } : undefined,
        })
        .then((res) => res?.data?.data ?? res?.data ?? res);
    },
  };
};

export type StorageApi = ReturnType<typeof createStorageApi>;
