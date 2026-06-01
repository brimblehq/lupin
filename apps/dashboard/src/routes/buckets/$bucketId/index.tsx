import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Copy,
  Check,
  Folder,
  FolderPlus,
  ChevronRight,
  MoreHorizontal,
  Upload,
  KeyRound,
  Search,
  X,
  Info,
  CheckIcon,
  CloudDownload,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { Modal, ModalHeader, ModalFooter, ModalCancelButton, ModalContinueButton } from "@/components/shared/modal";
import { WarningModal } from "@/components/shared/warning-modal";
import { PlanUpgradePrompt } from "@/components/shared/plan-upgrade-prompt";
import { CursorPagination } from "@/components/shared/pagination";
import { useServerFn } from "@tanstack/react-start";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { GlossyButton } from "@/components/shared/glossy-button";
import { FolderTrashIcon } from "@/components/shared/folder-trash-icon";
import { formatRelativeTime } from "@/utils/dashboard";
import { parseWorkspaceSearchValue, workspacePageLoaderDeps } from "@/utils/workspace-route-search";
import { uploadPresignedObject } from "@/lib/storage/upload-presigned-object";
import { usePlanGate } from "@/hooks/use-plan-gate";
import { FeatureFlags, useFeatureFlag } from "@/lib/feature-flags";
import {
  getBucketDetailsServerFn,
  listBucketObjectsServerFn,
  searchBucketObjectsServerFn,
  createBucketCredentialsServerFn,
  listBucketCredentialsServerFn,
  revokeBucketCredentialServerFn,
  setBucketCorsServerFn,
  createFolderServerFn,
  generateDownloadUrlServerFn,
  presignUploadServerFn,
  confirmUploadServerFn,
  initiateMultipartUploadServerFn,
  getMultipartUrlsServerFn,
  completeMultipartUploadServerFn,
  abortMultipartUploadServerFn,
  deleteObjectServerFn,
  bulkDeleteObjectsServerFn,
  updateBucketServerFn,
  listStorageMigrationsServerFn,
} from "@/server/storage/actions";
import { CreateS3CredentialsModal, RevokeCredentialModal, S3CredentialsCreatedModal } from "@/components/buckets/s3-credentials-modals";
import { DeleteBucketModal } from "@/components/buckets/delete-bucket-modal";
import { ActiveCredentialsList } from "@/components/buckets/active-credentials-list";
import { FileIcon } from "@/components/buckets/file-icon";
import { FilePreviewTooltip } from "@/components/buckets/file-preview-tooltip";
import { CorsConfigSection } from "@/components/buckets/cors-config-section";
import { CorsConfigDrawer } from "@/components/buckets/cors-config-drawer";
import type {
  CorsRule,
  CreateFolderResult,
  CreateS3CredentialsInput,
  DeleteObjectResult,
  MultipartAbortResult,
  MultipartCompletePart,
  MultipartInitiateResult,
  MultipartPartUrlsResult,
  S3CredentialRole,
  S3CredentialsRecord,
  StorageCredentialRecord,
  StorageObject,
  ListObjectsData,
  UploadConfirmResult,
  UserPresignUploadResult,
  StorageMigration,
  StorageMigrationStatus,
} from "@/backend/storage";

const OBJECTS_PAGE_SIZE = 35;
const BULK_DELETE_OBJECTS_LIMIT = 100;
const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024;
const MULTIPART_PART_SIZE_BYTES = 10 * 1024 * 1024;
const SEARCH_DEBOUNCE_MS = 300;
const OBJECTS_TRANSITION = { duration: 0.16, ease: [0.16, 1, 0.3, 1] } as const;
const BUCKET_SECTION_HEADING_CLASS_NAME = "text-base font-semibold text-dash-text-strong";
const UPLOAD_UNLOAD_WARNING = "Uploads are still in progress. Leaving this page will cancel them.";
const MIGRATION_STATUS_POLL_INTERVAL_MS = 5000;
const ACTIVE_MIGRATION_STATUSES = new Set<StorageMigrationStatus>(["queued", "running"]);

export const Route = createFileRoute("/buckets/$bucketId/")({
  validateSearch: (search: Record<string, unknown>) => {
    const workspace = parseWorkspaceSearchValue(search.workspace);
    const rawPath = typeof search.path === "string" ? search.path : "";
    const path = rawPath.replace(/^\/+/, "").replace(/\/+$/, "").trim();
    return {
      ...(workspace ? { workspace } : {}),
      ...(path ? { path } : {}),
    };
  },
  loaderDeps: ({ search }) => workspacePageLoaderDeps(search),
  loader: async ({ params, deps }) => {
    const workspace = deps.workspace;
    const bucketId = params.bucketId;
    const bucket = await getBucketDetailsServerFn({ data: { workspace, bucketId } }).catch(() => null);
    return { workspace, bucket };
  },
  component: BucketDetailPage,
  pendingComponent: BucketDetailPending,
});

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function fileTypeLabel(key: string): string {
  const idx = key.lastIndexOf(".");
  if (idx === -1 || idx === key.length - 1) return "File";
  return key.slice(idx + 1).toUpperCase();
}

interface FolderEntry {
  name: string;
  itemCount: number;
  fullPrefix: string;
}

interface ObjectPageRequestData {
  workspace?: string;
  bucketId: string;
  prefix?: string;
  continuationToken?: string;
  maxKeys?: number;
  teamId?: string;
}

interface SearchObjectPageRequestData extends ObjectPageRequestData {
  q: string;
}

interface UploadProgressState {
  fileName: string;
  fileIndex: number;
  fileCount: number;
  uploadedBytes: number;
  totalBytes: number;
  status: string;
}

function buildObjectsDescription(path?: string, query?: string): string {
  if (query) {
    if (path) return `Showing object key matches for "${query}" inside ${path}.`;
    return `Showing object key matches for "${query}" in this bucket.`;
  }
  if (path) return `Showing objects inside ${path}.`;
  return "Showing every object stored in this bucket.";
}

function getObjectsEmptyTitle(isSearching: boolean, hasPrefix: boolean): string {
  if (isSearching) return "No objects match this search";
  if (hasPrefix) return "This folder is empty";
  return "No objects yet";
}

function getObjectsEmptyDescription(isSearching: boolean, canWrite: boolean): string {
  if (isSearching) return "Search matches object keys only";
  if (canWrite) return "Upload a file or create a folder to get started";
  return "Upload files using your API key";
}

function getUploadProgressPercent(progress: UploadProgressState | null) {
  if (!progress || progress.totalBytes <= 0) return 0;
  return Math.min(100, Math.round((progress.uploadedBytes / progress.totalBytes) * 100));
}

function getUploadToastDescription(fileCount: number, currentFileIndex: number, detail: string) {
  if (fileCount <= 1) return detail;
  const filesLeft = Math.max(fileCount - currentFileIndex, 0);
  const fileLabel = filesLeft === 1 ? "file" : "files";
  return `${detail} · ${filesLeft} ${fileLabel} left`;
}

function hasActiveMigration(migrations: StorageMigration[]) {
  return migrations.some((migration) => ACTIVE_MIGRATION_STATUSES.has(migration.status));
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function waitForUploadFeedbackPaint() {
  await waitForNextFrame();
  await waitForNextFrame();
}

function ObjectTableSkeleton() {
  return (
    <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-8" />
          <col className="w-auto" />
          <col className="hidden w-[18%] sm:table-column" />
          <col className="hidden w-[18%] sm:table-column" />
          <col className="hidden w-[20%] sm:table-column" />
          <col className="w-10" />
        </colgroup>
        <thead>
          <tr className="border-b border-dash-border bg-dash-bg-elevated/50">
            <th className="py-2 pl-3 pr-1 text-left text-xs font-medium text-dash-text-faded"></th>
            <th className="py-2 pl-1 text-left text-xs font-medium text-dash-text-faded">Name</th>
            <th className="hidden py-2 text-left text-xs font-medium text-dash-text-faded sm:table-cell">Size</th>
            <th className="hidden py-2 text-left text-xs font-medium text-dash-text-faded sm:table-cell">Type</th>
            <th className="hidden py-2 text-right text-xs font-medium text-dash-text-faded sm:table-cell">Modified</th>
            <th className="py-2 pr-3.5 text-right text-xs font-medium text-dash-text-faded"></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 4 }).map((_, index) => (
            <tr key={index} className={index < 3 ? "border-b border-dash-border" : ""}>
              <td className="py-2.5 pl-3 pr-1 align-middle text-sm">
                <span className="block size-3.5 animate-pulse rounded-[3px] bg-dash-border/70" />
              </td>
              <td className="py-2.5 pl-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="size-4 shrink-0 animate-pulse rounded-[3px] bg-dash-border/70" />
                  <span className="h-3.5 w-[160px] max-w-[60%] animate-pulse rounded-full bg-dash-border/70" />
                </div>
                <span className="mt-2 block h-3 w-28 animate-pulse rounded-full bg-dash-border/60 sm:hidden" />
              </td>
              <td className="hidden py-2.5 text-sm sm:table-cell">
                <span className="block h-3.5 w-16 animate-pulse rounded-full bg-dash-border/70" />
              </td>
              <td className="hidden py-2.5 text-sm sm:table-cell">
                <span className="block h-3.5 w-14 animate-pulse rounded-full bg-dash-border/70" />
              </td>
              <td className="hidden py-2.5 text-right text-sm sm:table-cell">
                <span className="ml-auto block h-3.5 w-20 animate-pulse rounded-full bg-dash-border/70" />
              </td>
              <td className="py-2.5 pr-3.5 text-right text-sm">
                <span className="ml-auto block size-4 animate-pulse rounded-[3px] bg-dash-border/70" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BucketDetailSkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-dash-border/70 ${className}`} />;
}

function BucketDetailPending() {
  return (
    <div className="flex max-w-[1000px] flex-col gap-4" aria-hidden="true">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <BucketDetailSkeletonBar className="h-5 w-40" />
          <BucketDetailSkeletonBar className="h-4 w-48" />
          <BucketDetailSkeletonBar className="h-4 w-64 max-w-full" />
        </div>
        <div className="size-8 shrink-0 animate-pulse rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/50" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[4px] border border-dash-border bg-dash-bg p-4">
            <BucketDetailSkeletonBar className="h-3 w-16" />
            <BucketDetailSkeletonBar className="mt-2 h-5 w-20" />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-[4px] bg-[#4879f8]/[0.06] px-3 py-2.5 dark:bg-[#4879f8]/[0.08]">
        <div className="mt-0.5 size-3.5 shrink-0 animate-pulse rounded-full bg-[#4879f8]/30" />
        <BucketDetailSkeletonBar className="h-4 w-[420px] max-w-full bg-[#4879f8]/20" />
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col">
            <BucketDetailSkeletonBar className="h-5 w-20" />
            <BucketDetailSkeletonBar className="mt-2 h-4 w-72 max-w-full" />
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="h-9 w-full animate-pulse rounded-[4px] border border-dash-border bg-dash-bg sm:w-[280px]" />
            <div className="h-9 w-full animate-pulse rounded-[4px] bg-dash-bg-elevated sm:w-20" />
          </div>
        </div>

        <ObjectTableSkeleton />
      </div>
    </div>
  );
}

function ObjectSelectionCheckbox({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`flex size-3.5 items-center justify-center rounded-[3px] border transition-colors ${
        checked ? "border-[#4879f8] bg-[#4879f8] text-white" : "border-dash-border bg-dash-bg text-transparent hover:border-dash-text-faded"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <CheckIcon className="size-2.5" strokeWidth={3} />
    </button>
  );
}

function groupObjectsByPrefix(objects: StorageObject[], currentPrefix: string): { folders: FolderEntry[]; files: StorageObject[] } {
  const folderMap = new Map<string, FolderEntry>();
  const fileList: StorageObject[] = [];

  for (const obj of objects) {
    const relative = obj.key.slice(currentPrefix.length);
    if (!relative) continue;
    const slashIdx = relative.indexOf("/");
    if (slashIdx === -1) {
      fileList.push(obj);
      continue;
    }
    const name = relative.slice(0, slashIdx);
    const isPlaceholder = relative === `${name}/`;
    const existing = folderMap.get(name);
    if (existing) {
      if (!isPlaceholder) existing.itemCount += 1;
    } else {
      folderMap.set(name, { name, itemCount: isPlaceholder ? 0 : 1, fullPrefix: `${currentPrefix}${name}/` });
    }
  }

  return {
    folders: [...folderMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    files: fileList,
  };
}

function BucketDetailPage() {
  const { canWrite } = useWorkspaceRole();
  const { objectStorageEnabled } = usePlanGate();
  const bucketFeatureEnabled = useFeatureFlag(FeatureFlags.ENABLE_BUCKETS);
  const router = useRouter();
  const navigate = useNavigate({ from: "/buckets/$bucketId/" });
  const { bucketId } = Route.useParams();
  const search = Route.useSearch() as { workspace?: string; path?: string };
  const { bucket, workspace } = Route.useLoaderData() as {
    workspace?: string;
    bucket: BucketRecord | null;
  };
  const bucketLoaded = Boolean(bucket);
  const bucketUrl = bucket?.url || (bucket?.bucket_name ? `https://${bucket.bucket_name}.objects.brimble.io` : "");
  const bucketDisplayUrl = bucketUrl.replace(/^https?:\/\//, "");
  const currentPrefix = search.path ? `${search.path}/` : "";
  const breadcrumbSegments = search.path ? search.path.split("/").filter(Boolean) : [];
  const [objectSearch, setObjectSearch] = useState("");
  const [debouncedObjectSearch, setDebouncedObjectSearch] = useState("");
  const objectSearchQuery = debouncedObjectSearch.trim();
  const isObjectSearchActive = Boolean(objectSearchQuery);
  const objectsDescription = buildObjectsDescription(search.path, objectSearchQuery);
  const [urlCopied, setUrlCopied] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<S3CredentialsRecord | null>(null);
  const [credentialsCreatedModalOpen, setCredentialsCreatedModalOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const emptyUploadInputRef = useRef<HTMLInputElement>(null);

  const createCredentials = useServerFn(createBucketCredentialsServerFn as any) as (args: {
    data: Omit<CreateS3CredentialsInput, "teamId"> & { workspace?: string; bucketId: string };
  }) => Promise<S3CredentialsRecord>;
  const listCredentials = useServerFn(listBucketCredentialsServerFn as any) as (args: {
    data: { workspace?: string; bucketId: string; teamId?: string };
  }) => Promise<StorageCredentialRecord[]>;
  const revokeCredential = useServerFn(revokeBucketCredentialServerFn as any) as (args: {
    data: { workspace?: string; bucketId: string; credentialId: string; teamId?: string };
  }) => Promise<{ deleted: boolean }>;
  const setBucketCors = useServerFn(setBucketCorsServerFn as any) as (args: {
    data: { workspace?: string; bucketId: string; corsRules: CorsRule[]; teamId?: string };
  }) => Promise<unknown>;
  const createFolder = useServerFn(createFolderServerFn as any) as (args: {
    data: { workspace?: string; bucketId: string; path: string };
  }) => Promise<CreateFolderResult>;
  const generateDownloadUrl = useServerFn(generateDownloadUrlServerFn as any) as any;
  const presignUpload = useServerFn(presignUploadServerFn as any) as (args: {
    data: { workspace?: string; bucketId: string; path: string; size: number; contentType?: string; teamId?: string };
  }) => Promise<UserPresignUploadResult>;
  const confirmUpload = useServerFn(confirmUploadServerFn as any) as (args: {
    data: { workspace?: string; bucketId: string; uploadId: string; teamId?: string };
  }) => Promise<UploadConfirmResult>;
  const initiateMultipart = useServerFn(initiateMultipartUploadServerFn as any) as (args: {
    data: { workspace?: string; bucketId: string; path: string; size: number; contentType?: string; teamId?: string };
  }) => Promise<MultipartInitiateResult>;
  const getMultipartUrls = useServerFn(getMultipartUrlsServerFn as any) as (args: {
    data: { workspace?: string; bucketId: string; id: string; totalParts: number; teamId?: string };
  }) => Promise<MultipartPartUrlsResult>;
  const completeMultipart = useServerFn(completeMultipartUploadServerFn as any) as (args: {
    data: { workspace?: string; bucketId: string; id: string; parts: MultipartCompletePart[]; teamId?: string };
  }) => Promise<UploadConfirmResult>;
  const abortMultipart = useServerFn(abortMultipartUploadServerFn as any) as (args: {
    data: { workspace?: string; bucketId: string; id: string; teamId?: string };
  }) => Promise<MultipartAbortResult>;
  const deleteObject = useServerFn(deleteObjectServerFn as any) as (args: {
    data: { workspace?: string; bucketId: string; path: string; recursive?: boolean; teamId?: string };
  }) => Promise<DeleteObjectResult>;
  const bulkDeleteObjects = useServerFn(bulkDeleteObjectsServerFn);
  const listObjects = useServerFn(listBucketObjectsServerFn as any) as (args: { data: ObjectPageRequestData }) => Promise<ListObjectsData>;
  const searchObjects = useServerFn(searchBucketObjectsServerFn as any) as (args: {
    data: SearchObjectPageRequestData;
  }) => Promise<ListObjectsData>;
  const updateBucketAction = useServerFn(updateBucketServerFn as any) as any;
  const listMigrations = useServerFn(listStorageMigrationsServerFn);

  const [openingObject, setOpeningObject] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteBucketOpen, setDeleteBucketOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [pagedObjects, setPagedObjects] = useState<StorageObject[]>([]);
  const [selectedObjectKeys, setSelectedObjectKeys] = useState<Set<string>>(() => new Set());
  const [continuationToken, setContinuationToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [objectPageIndex, setObjectPageIndex] = useState(0);
  const [objectPageCursors, setObjectPageCursors] = useState<(string | undefined)[]>([undefined]);
  const [loadingObjects, setLoadingObjects] = useState(true);
  const [draggingOverEmptyState, setDraggingOverEmptyState] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [migrationOngoing, setMigrationOngoing] = useState(false);
  const reloadObjects = () => setRefreshKey((k) => k + 1);
  const prevPrefixRef = useRef(currentPrefix);
  const [credentials, setCredentials] = useState<StorageCredentialRecord[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(true);
  const [credentialsRefreshKey, setCredentialsRefreshKey] = useState(0);
  const [revokeTarget, setRevokeTarget] = useState<StorageCredentialRecord | null>(null);
  const [corsDrawerOpen, setCorsDrawerOpen] = useState(false);
  const corsRules: CorsRule[] = Array.isArray(bucket?.cors_rules) ? (bucket.cors_rules as CorsRule[]) : [];

  async function handleSaveCors(rules: CorsRule[]) {
    if (!bucket) return;
    try {
      await setBucketCors({
        data: { workspace, bucketId, corsRules: rules },
      });
      toast.success("CORS configuration saved");
      setCorsDrawerOpen(false);
      await router.invalidate();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save CORS configuration");
    }
  }
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<FolderEntry | null>(null);
  const reloadCredentials = () => setCredentialsRefreshKey((k) => k + 1);
  const objectScopeKey = [bucketId, workspace || "", currentPrefix, objectSearchQuery, refreshKey].join(":");
  const objectScopeRef = useRef(objectScopeKey);

  useEffect(() => {
    if (!bucketLoaded) return;
    let cancelled = false;

    async function refreshMigrationStatus() {
      try {
        const migrations = await listMigrations({ data: { workspace, bucketId } });
        if (!cancelled) setMigrationOngoing(hasActiveMigration(migrations));
      } catch {
        if (!cancelled) setMigrationOngoing(false);
      }
    }

    void refreshMigrationStatus();

    if (!migrationOngoing) {
      return () => {
        cancelled = true;
      };
    }

    const interval = window.setInterval(() => {
      void refreshMigrationStatus();
    }, MIGRATION_STATUS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [bucketId, bucketLoaded, listMigrations, migrationOngoing, workspace]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedObjectSearch(objectSearch.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [objectSearch]);

  useEffect(() => {
    if (!bucketLoaded) return;
    let cancelled = false;

    if (objectScopeRef.current !== objectScopeKey) {
      objectScopeRef.current = objectScopeKey;
      if (objectPageIndex !== 0 || objectPageCursors.length !== 1) {
        setPagedObjects([]);
        setContinuationToken(null);
        setHasMore(false);
        setObjectPageCursors([undefined]);
        setObjectPageIndex(0);
        return;
      }
    }

    if (prevPrefixRef.current !== currentPrefix) {
      setPagedObjects([]);
      setContinuationToken(null);
      setHasMore(false);
      prevPrefixRef.current = currentPrefix;
    }
    setLoadingObjects(true);
    const data = {
      workspace,
      bucketId,
      prefix: currentPrefix || undefined,
      continuationToken: objectPageCursors[objectPageIndex],
      maxKeys: OBJECTS_PAGE_SIZE,
    };
    const pageRequest = isObjectSearchActive ? searchObjects({ data: { ...data, q: objectSearchQuery } }) : listObjects({ data });
    pageRequest
      .then((page) => {
        if (cancelled) return;
        setPagedObjects(page.objects);
        setContinuationToken(page.continuationToken);
        setHasMore(page.isTruncated);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setPagedObjects([]);
        setContinuationToken(null);
        setHasMore(false);
        toast.error(e?.message || (isObjectSearchActive ? "Failed to search objects" : "Failed to load objects"));
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingObjects(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    bucketLoaded,
    workspace,
    currentPrefix,
    listObjects,
    searchObjects,
    objectSearchQuery,
    isObjectSearchActive,
    refreshKey,
    objectScopeKey,
    objectPageIndex,
    objectPageCursors,
    bucketId,
  ]);

  useEffect(() => {
    if (!bucket) return;
    let cancelled = false;
    setLoadingCredentials(true);
    listCredentials({ data: { workspace, bucketId } })
      .then((rows) => {
        if (!cancelled) setCredentials(rows);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setCredentials([]);
        toast.error(e?.message || "Failed to load credentials");
      })
      .finally(() => {
        if (!cancelled) setLoadingCredentials(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, workspace, bucketId, listCredentials, credentialsRefreshKey]);

  async function handleDeleteFolder(folder: FolderEntry) {
    if (!bucket) return;
    try {
      const result = await deleteObject({
        data: { workspace, bucketId, path: folder.fullPrefix, recursive: true },
      });
      if (result.deletedCount === 0) {
        toast.success("Nothing to delete");
      } else {
        toast.success(`Deleted ${result.deletedCount} ${result.deletedCount === 1 ? "item" : "items"}`);
      }
      reloadObjects();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete folder");
    }
  }

  async function handleRevokeCredential(credential: StorageCredentialRecord) {
    if (!bucket) return;
    try {
      setRevokingId(credential.id);
      await revokeCredential({
        data: { workspace, bucketId, credentialId: credential.id },
      });
      toast.success("Credentials revoked");
      reloadCredentials();
    } catch (e: any) {
      toast.error(e?.message || "Failed to revoke credentials");
    } finally {
      setRevokingId(null);
    }
  }

  function handleNextObjectsPage() {
    if (!hasMore || !continuationToken || loadingObjects) return;
    setObjectPageCursors((prev) => [...prev.slice(0, objectPageIndex + 1), continuationToken]);
    setObjectPageIndex((page) => page + 1);
  }

  function handlePrevObjectsPage() {
    if (objectPageIndex === 0 || loadingObjects) return;
    setObjectPageIndex((page) => Math.max(page - 1, 0));
  }

  const groupedObjects = groupObjectsByPrefix(pagedObjects, currentPrefix);
  const folders = isObjectSearchActive ? [] : groupedObjects.folders;
  const files = isObjectSearchActive ? pagedObjects : groupedObjects.files;
  const visibleFileKeys = useMemo(() => files.map((file) => file.key), [files]);
  const visibleFileKeySignature = visibleFileKeys.join("\n");
  const selectedVisibleFileCount = visibleFileKeys.filter((key) => selectedObjectKeys.has(key)).length;
  const allVisibleFilesSelected = visibleFileKeys.length > 0 && selectedVisibleFileCount === visibleFileKeys.length;
  const emptyObjectsTitle = getObjectsEmptyTitle(isObjectSearchActive, Boolean(currentPrefix));
  const emptyObjectsDescription = getObjectsEmptyDescription(isObjectSearchActive, canWrite);
  const uploadProgressPercent = getUploadProgressPercent(uploadProgress);
  const objectsTransitionKey = [currentPrefix || "root", objectSearchQuery || "all"].join(":");

  useEffect(() => {
    if (!uploading) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = UPLOAD_UNLOAD_WARNING;
      return UPLOAD_UNLOAD_WARNING;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [uploading]);

  useEffect(() => {
    setSelectedObjectKeys((current) => {
      const visibleKeys = new Set(visibleFileKeySignature ? visibleFileKeySignature.split("\n") : []);
      const next = new Set([...current].filter((key) => visibleKeys.has(key)));
      if (next.size === current.size) return current;
      return next;
    });
  }, [visibleFileKeySignature]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setActionsMenuOpen(false);
      }
    }

    if (actionsMenuOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [actionsMenuOpen]);

  function navigateToPrefix(prefix: string) {
    const normalized = prefix.replace(/^\/+/, "").replace(/\/+$/, "").trim();
    void navigate({
      to: ".",
      search: (prev: any) => ({ ...prev, path: normalized || undefined }),
    } as any);
  }

  function toggleObjectSelection(key: string) {
    setSelectedObjectKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleVisibleObjectSelection() {
    setSelectedObjectKeys((current) => {
      if (allVisibleFilesSelected) {
        return new Set([...current].filter((key) => !visibleFileKeys.includes(key)));
      }

      return new Set([...current, ...visibleFileKeys]);
    });
  }

  async function handleCreateFolder() {
    const raw = newFolderName.trim();
    if (!raw) return;
    if (!bucket) return;
    const path = `${currentPrefix}${raw}`;
    try {
      setIsCreatingFolder(true);
      await createFolder({
        data: {
          workspace,
          bucketId,
          path,
        },
      });
      toast.success("Folder created");
      setNewFolderOpen(false);
      setNewFolderName("");
      reloadObjects();
      await router.invalidate();
    } catch (e: any) {
      toast.error(e.message || "Failed to create folder");
    } finally {
      setIsCreatingFolder(false);
    }
  }

  async function uploadFile(
    file: File,
    callbacks: {
      onProgress?: (uploadedBytes: number) => void;
      onStatus?: (status: string) => void;
    } = {},
  ) {
    const path = `${currentPrefix}${file.name}`;
    const contentType = file.type || "application/octet-stream";

    if (file.size <= MULTIPART_THRESHOLD_BYTES) {
      callbacks.onStatus?.("Preparing upload");
      const presigned = await presignUpload({ data: { workspace, bucketId, path, size: file.size, contentType } });

      callbacks.onStatus?.("Uploading to storage");
      await uploadPresignedObject({
        url: presigned.url,
        body: file,
        contentType,
        onProgress: (uploadedBytes) => callbacks.onProgress?.(uploadedBytes),
      });

      callbacks.onStatus?.("Finalizing upload");
      await confirmUpload({ data: { workspace, bucketId, uploadId: presigned.uploadId } });
      return;
    }

    callbacks.onStatus?.("Preparing multipart upload");
    const init = await initiateMultipart({ data: { workspace, bucketId, path, size: file.size, contentType } });
    const recordId = init.id;
    const totalParts = Math.ceil(file.size / MULTIPART_PART_SIZE_BYTES);

    try {
      const { urls } = await getMultipartUrls({ data: { workspace, bucketId, id: recordId, totalParts } });

      const parts: MultipartCompletePart[] = [];
      let uploadedBeforeCurrentPart = 0;
      for (const { PartNumber, URL } of urls) {
        callbacks.onStatus?.(`Uploading part ${PartNumber} of ${totalParts}`);
        const start = (PartNumber - 1) * MULTIPART_PART_SIZE_BYTES;
        const end = Math.min(start + MULTIPART_PART_SIZE_BYTES, file.size);
        const chunk = file.slice(start, end);

        const etag = await uploadPresignedObject({
          url: URL,
          body: chunk,
          onProgress: (uploadedBytes) => callbacks.onProgress?.(uploadedBeforeCurrentPart + uploadedBytes),
        });
        if (!etag) throw new Error(`Missing ETag for part ${PartNumber}`);

        parts.push({ PartNumber, ETag: etag });
        uploadedBeforeCurrentPart += chunk.size;
      }

      callbacks.onStatus?.("Finalizing multipart upload");
      await completeMultipart({ data: { workspace, bucketId, id: recordId, parts } });
    } catch (err) {
      await abortMultipart({ data: { workspace, bucketId, id: recordId } }).catch(() => {
        // best-effort cleanup; surface the original upload error
      });
      throw err;
    }
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0 || !bucket) return;

    const firstFile = files[0];
    if (!firstFile) return;

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    flushSync(() => {
      setUploading(true);
      setUploadProgress({
        fileName: firstFile.name,
        fileIndex: 1,
        fileCount: files.length,
        uploadedBytes: 0,
        totalBytes,
        status: "Preparing upload",
      });
    });

    const toastId = toast.loading(files.length === 1 ? `Uploading ${files[0].name}` : `Uploading ${files.length} files`, {
      description: getUploadToastDescription(files.length, 1, "Preparing upload..."),
    });
    let completedBytes = 0;

    try {
      await waitForUploadFeedbackPaint();

      for (const [index, file] of files.entries()) {
        let latestFileUploadedBytes = 0;
        const setCurrentProgress = (uploadedBytes: number, status: string) => {
          setUploadProgress({
            fileName: file.name,
            fileIndex: index + 1,
            fileCount: files.length,
            uploadedBytes,
            totalBytes,
            status,
          });
        };

        if (index > 0) {
          flushSync(() => {
            setCurrentProgress(completedBytes, "Preparing upload");
          });
          await waitForUploadFeedbackPaint();
        }

        await uploadFile(file, {
          onStatus: (status) => {
            setCurrentProgress(completedBytes + latestFileUploadedBytes, status);
            toast.loading(files.length === 1 ? `Uploading ${file.name}` : `Uploading ${files.length} files`, {
              id: toastId,
              description: getUploadToastDescription(files.length, index + 1, status),
            });
          },
          onProgress: (fileUploadedBytes) => {
            latestFileUploadedBytes = fileUploadedBytes;
            const uploadedBytes = completedBytes + fileUploadedBytes;
            const percent = totalBytes > 0 ? Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)) : 100;
            setCurrentProgress(uploadedBytes, "Uploading to storage");
            toast.loading(files.length === 1 ? `Uploading ${file.name}` : `Uploading ${files.length} files`, {
              id: toastId,
              description: getUploadToastDescription(files.length, index + 1, `${percent}% complete`),
            });
          },
        });
        completedBytes += file.size;
      }
      toast.success(files.length === 1 ? "File uploaded successfully" : "Files uploaded successfully", { id: toastId });
      reloadObjects();
      await router.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload file", { id: toastId });
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    await uploadFiles(files);
  }

  async function handleEmptyStateDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDraggingOverEmptyState(false);
    if (!canWrite || uploading) return;
    await uploadFiles(Array.from(event.dataTransfer.files));
  }

  async function handleDeleteObject(obj: StorageObject) {
    if (!confirm(`Are you sure you want to delete ${obj.key}?`)) return;
    try {
      setDeleting(obj.key);
      await deleteObject({
        data: { workspace, bucketId, path: obj.key },
      });
      toast.success("Object deleted");
      reloadObjects();
      await router.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete object");
    } finally {
      setDeleting(null);
    }
  }

  async function handleBulkDeleteSelectedObjects() {
    if (!bucket || selectedObjectKeys.size === 0) return;

    const selectedObjects = [...selectedObjectKeys].map((path) => ({ path }));
    let deletedCount = 0;

    try {
      for (let index = 0; index < selectedObjects.length; index += BULK_DELETE_OBJECTS_LIMIT) {
        const objects = selectedObjects.slice(index, index + BULK_DELETE_OBJECTS_LIMIT);
        const result = await bulkDeleteObjects({
          data: {
            workspace,
            bucketId,
            objects,
          },
        });
        deletedCount += result.deletedCount;
      }

      setSelectedObjectKeys(new Set());
      if (deletedCount === 0) {
        toast.success("Nothing to delete");
      } else {
        toast.success(`Deleted ${deletedCount} ${deletedCount === 1 ? "item" : "items"}`);
      }
      reloadObjects();
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete selected files");
    }
  }

  async function handleBucketDeleted() {
    setDeleteBucketOpen(false);
    await router.navigate({ to: "/buckets", search: { workspace } });
  }

  async function handleToggleVisibility() {
    const newVisibility = !bucket.is_public;
    const action = newVisibility ? "make public" : "make private";
    if (!confirm(`Are you sure you want to ${action} this bucket?`)) return;
    try {
      setIsUpdatingVisibility(true);
      await updateBucketAction({ data: { workspace, bucketId, isPublic: newVisibility } });
      toast.success(`Bucket is now ${newVisibility ? "public" : "private"}`);
      await router.invalidate();
    } catch (e: any) {
      toast.error(e.message || "Failed to update visibility");
    } finally {
      setIsUpdatingVisibility(false);
    }
  }

  async function handleCreateCredentials({ role }: { role: S3CredentialRole }) {
    if (!bucket) return;
    const credentials = await createCredentials({
      data: {
        workspace,
        bucketId,
        role,
      },
    });
    setCreatedCredentials(credentials);
    setCredentialsModalOpen(false);
    setCredentialsCreatedModalOpen(true);
    toast.success("S3 credentials created");
    reloadCredentials();
  }

  async function resolveDownloadUrl(key: string): Promise<string> {
    if (!bucket) throw new Error("Bucket not loaded");
    const result = await generateDownloadUrl({
      data: { workspace, bucketId, path: key },
    });
    if (!result?.url) throw new Error("Could not generate URL");
    return result.url;
  }

  async function handleViewObject(obj: StorageObject) {
    if (openingObject) return;
    try {
      setOpeningObject(obj.key);
      if (obj.public_url) {
        window.open(obj.public_url, "_blank");
        return;
      }
      const result = await generateDownloadUrl({
        data: { workspace, bucketId, path: obj.key },
      });
      if (result?.url) {
        window.open(result.url, "_blank");
      } else {
        throw new Error("Could not generate URL");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to open object");
    } finally {
      setOpeningObject(null);
    }
  }

  if (!objectStorageEnabled || !bucketFeatureEnabled) {
    return (
      <div className="max-w-[1000px]">
        <PlanUpgradePrompt feature="Object Storage" description="Upgrade your plan to view and manage storage buckets." />
      </div>
    );
  }

  if (!bucket) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <span className="text-sm text-dash-text-faded">Bucket not found</span>
        <Link to="/buckets" search={{ workspace }} className="text-sm text-[#3c6ce7] hover:underline">
          ← Back to buckets
        </Link>
      </div>
    );
  }

  return (
    <div className="flex max-w-[1000px] flex-col gap-4">
      <div className="flex flex-row items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className={`truncate tracking-[-0.03px] ${BUCKET_SECTION_HEADING_CLASS_NAME}`}>{bucket.name}</h2>
            {migrationOngoing && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#ff9b01]/10 px-2 py-0.5 text-[11px] font-medium text-[#ff9b01]">
                <span className="relative flex size-1.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#ff9b01] opacity-75" />
                  <span className="relative size-1.5 rounded-full bg-[#ff9b01]" />
                </span>
                Migration in progress
              </span>
            )}
          </div>
          <p className="text-sm font-light leading-[1.3] text-dash-text-extra-faded">
            {bucket.region || "Global"} · Created {formatRelativeTime(bucket.createdAt || bucket.updatedAt)}
          </p>
          {bucketDisplayUrl && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(bucketUrl);
                setUrlCopied(true);
                window.setTimeout(() => setUrlCopied(false), 1500);
              }}
              title="Copy bucket URL"
              className="flex w-fit max-w-full items-center gap-1.5 text-dash-text-faded transition-colors hover:text-dash-text-strong"
            >
              <span className="truncate font-mono text-xs">{bucketDisplayUrl}</span>
              {urlCopied ? <Check className="size-3.5 shrink-0 text-[#13d282]" /> : <Copy className="size-3.5 shrink-0" />}
            </button>
          )}
        </div>

        {canWrite && (
          <div className="relative shrink-0" ref={actionsMenuRef}>
            <button
              type="button"
              onClick={() => setActionsMenuOpen((open) => !open)}
              aria-label="Bucket actions"
              className="flex size-8 items-center justify-center rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
            >
              <MoreHorizontal className="size-4" />
            </button>

            {actionsMenuOpen && (
              <div className="absolute right-0 top-full z-40 mt-2 w-[260px] overflow-hidden whitespace-nowrap rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)]">
                <label
                  className={`mx-1 flex cursor-pointer items-center gap-2 rounded-[2px] px-2 py-2 text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated ${
                    uploading ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <Upload className="size-4" />
                  {uploading ? "Uploading..." : "Upload file"}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      setActionsMenuOpen(false);
                      void handleUpload(event);
                    }}
                    disabled={uploading}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    setCredentialsModalOpen(true);
                  }}
                  className="mx-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-[2px] px-2 py-2 text-left text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
                >
                  <KeyRound className="size-4" />
                  Create S3 credentials
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    setNewFolderOpen(true);
                  }}
                  className="mx-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-[2px] px-2 py-2 text-left text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
                >
                  <FolderPlus className="size-4" />
                  New folder
                </button>
                <Link
                  to="/buckets/$bucketId/migrate"
                  params={{ bucketId: bucket._id || bucket.id || "" }}
                  search={workspace ? { workspace } : {}}
                  onClick={() => setActionsMenuOpen(false)}
                  className="mx-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-[2px] px-2 py-2 text-left text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
                >
                  <CloudDownload className="size-4" />
                  Migrate from external bucket
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="rounded-[4px] border border-dash-border bg-dash-bg p-4">
          <span className="text-xs text-dash-text-faded">Objects</span>
          <p className="mt-1 text-lg font-medium text-dash-text-strong">{bucket.objectCount ?? pagedObjects.length}</p>
        </div>
        <div className="rounded-[4px] border border-dash-border bg-dash-bg p-4">
          <span className="text-xs text-dash-text-faded">Storage Used</span>
          <p className="mt-1 text-lg font-medium text-dash-text-strong">{formatBytes(bucket.storage_used || 0)}</p>
        </div>
        <div className="rounded-[4px] border border-dash-border bg-dash-bg p-4">
          <span className="text-xs text-dash-text-faded">Region</span>
          <p className="mt-1 text-lg font-medium text-dash-text-strong">{bucket.region || "Global"}</p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-[4px] bg-[#4879f8]/[0.06] px-3 py-2.5 dark:bg-[#4879f8]/[0.08]">
        <Info className="mt-0.5 size-3.5 shrink-0 text-[#4879f8]" />
        <p className="text-sm leading-[1.4] text-[#4879f8]">Egress is free — we don't charge for data transferred out of your buckets.</p>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col">
            <h3 className={BUCKET_SECTION_HEADING_CLASS_NAME}>Objects</h3>
            <p className="mt-1.5 text-xs leading-[1.4] text-dash-text-faded">{objectsDescription}</p>
            <AnimatePresence initial={false}>
              {breadcrumbSegments.length > 0 && (
                <motion.nav
                  key={search.path}
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={OBJECTS_TRANSITION}
                  className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-dash-text-faded"
                >
                  <button onClick={() => navigateToPrefix("")} className="transition-colors hover:text-dash-text-strong">
                    Root
                  </button>
                  {breadcrumbSegments.map((seg, i) => {
                    const upTo = breadcrumbSegments.slice(0, i + 1).join("/");
                    const isLast = i === breadcrumbSegments.length - 1;
                    return (
                      <span key={`${seg}-${i}`} className="flex items-center gap-1.5">
                        <ChevronRight className="size-3 text-dash-text-extra-faded" />
                        {isLast ? (
                          <span>{seg}</span>
                        ) : (
                          <button onClick={() => navigateToPrefix(upTo)} className="transition-colors hover:text-dash-text-strong">
                            {seg}
                          </button>
                        )}
                      </span>
                    );
                  })}
                </motion.nav>
              )}
            </AnimatePresence>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dash-text-extra-faded" />
              <input
                type="text"
                value={objectSearch}
                onChange={(event) => setObjectSearch(event.target.value)}
                placeholder="Search object keys"
                aria-label="Search object keys"
                className="h-9 w-full rounded-[4px] border border-dash-border bg-dash-bg py-2 pl-9 pr-9 text-sm text-dash-text-strong outline-none transition-colors placeholder:text-dash-text-extra-faded focus:border-[#4879f8]"
              />
              {objectSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setObjectSearch("");
                    setDebouncedObjectSearch("");
                  }}
                  aria-label="Clear object search"
                  className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-[3px] text-dash-text-extra-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <GlossyButton
              type="button"
              variant="black"
              onClick={reloadObjects}
              loading={loadingObjects}
              loadingLabel="Refreshing..."
              className="h-9 rounded-[4px] px-3 text-sm sm:w-auto"
            >
              Refresh
            </GlossyButton>
          </div>
        </div>

        {uploadProgress && (
          <div className="mb-3 rounded-[4px] bg-dash-bg-elevated/40 px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-dash-text-strong">Uploading {uploadProgress.fileName}</p>
                <p className="mt-0.5 text-xs text-dash-text-faded">
                  {uploadProgress.status} · File {uploadProgress.fileIndex} of {uploadProgress.fileCount} ·{" "}
                  {formatBytes(uploadProgress.uploadedBytes)} of {formatBytes(uploadProgress.totalBytes)}
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium text-[#ff7a00]">{uploadProgressPercent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-dash-bg-elevated">
              <div
                className="h-full rounded-full bg-[#ff7a00] transition-[width] duration-150"
                style={{ width: `${uploadProgressPercent}%` }}
              />
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {selectedObjectKeys.size > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: -4 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -4 }}
              transition={OBJECTS_TRANSITION}
              className="overflow-hidden"
            >
              <div className="mb-3 flex items-center justify-between gap-3 rounded-[4px] bg-dash-bg-elevated/50 px-3 py-2">
                <span className="text-xs font-medium text-dash-text-body">
                  {selectedObjectKeys.size} {selectedObjectKeys.size === 1 ? "file" : "files"} selected
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedObjectKeys(new Set())}
                    className="text-xs font-medium text-dash-text-faded transition-colors hover:text-dash-text-strong"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkDeleteOpen(true)}
                    className="text-xs font-medium text-[#ef2f1f] transition-opacity hover:opacity-75"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={objectsTransitionKey}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={OBJECTS_TRANSITION}
          >
            {loadingObjects && folders.length === 0 && files.length === 0 ? (
              <ObjectTableSkeleton />
            ) : folders.length === 0 && files.length === 0 ? (
              <div
                onDragOver={(event) => {
                  if (!canWrite || uploading) return;
                  event.preventDefault();
                  setDraggingOverEmptyState(true);
                }}
                onDragLeave={() => setDraggingOverEmptyState(false)}
                onDrop={(event) => {
                  void handleEmptyStateDrop(event);
                }}
                className={`relative flex h-32 flex-col items-center justify-center gap-2 overflow-hidden rounded-[4px] border border-dash-border bg-dash-bg-elevated/40 transition-colors ${
                  draggingOverEmptyState ? "border-[#4879f8] bg-[#4879f8]/5 ring-2 ring-[#4879f8]/20" : ""
                }`}
              >
                {draggingOverEmptyState && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-dash-bg/90 text-center backdrop-blur-[1px]">
                    <div className="flex size-9 items-center justify-center rounded-full border border-[#4879f8]/30 bg-[#4879f8]/10 text-[#4879f8]">
                      <Upload className="size-4" />
                    </div>
                    <span className="text-sm font-medium text-dash-text-strong">Drop files to upload</span>
                    <span className="text-xs text-dash-text-faded">They will be added to this folder</span>
                  </div>
                )}
                <div
                  className={`flex flex-col items-center justify-center gap-2 transition-opacity ${draggingOverEmptyState ? "opacity-20" : ""}`}
                >
                  <span className="text-sm text-dash-text-faded">{emptyObjectsTitle}</span>
                  {!isObjectSearchActive && canWrite ? (
                    <span className="text-xs text-dash-text-extra-faded">
                      <button
                        type="button"
                        onClick={() => emptyUploadInputRef.current?.click()}
                        disabled={uploading}
                        className="underline underline-offset-2 transition-colors hover:text-dash-text-strong disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Upload a file
                      </button>{" "}
                      or create a folder to get started
                    </span>
                  ) : (
                    <span className="text-xs text-dash-text-extra-faded">{emptyObjectsDescription}</span>
                  )}
                </div>
                <input ref={emptyUploadInputRef} type="file" multiple className="hidden" onChange={(event) => void handleUpload(event)} />
              </div>
            ) : (
              <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col className="w-8" />
                    <col className="w-auto" />
                    <col className="hidden w-[18%] sm:table-column" />
                    <col className="hidden w-[18%] sm:table-column" />
                    <col className="hidden w-[20%] sm:table-column" />
                    <col className="w-10" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-dash-border bg-dash-bg-elevated/50">
                      <th className="py-2 pl-3 pr-1 text-left text-xs font-medium text-dash-text-faded">
                        <ObjectSelectionCheckbox
                          checked={allVisibleFilesSelected}
                          disabled={visibleFileKeys.length === 0}
                          onChange={toggleVisibleObjectSelection}
                          label="Select all visible files"
                        />
                      </th>
                      <th className="py-2 pl-1 text-left text-xs font-medium text-dash-text-faded">Name</th>
                      <th className="hidden py-2 text-left text-xs font-medium text-dash-text-faded sm:table-cell">Size</th>
                      <th className="hidden py-2 text-left text-xs font-medium text-dash-text-faded sm:table-cell">Type</th>
                      <th className="hidden py-2 text-right text-xs font-medium text-dash-text-faded sm:table-cell">Modified</th>
                      <th className="py-2 pr-3.5 text-right text-xs font-medium text-dash-text-faded"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {folders.map((folder, i) => {
                      const isLast = i === folders.length - 1 && files.length === 0;
                      return (
                        <tr
                          key={`folder-${folder.fullPrefix}`}
                          className={`transition-colors hover:bg-dash-bg-elevated ${!isLast ? "border-b border-dash-border" : ""}`}
                        >
                          <td className="py-2.5 pl-3 pr-1 align-middle text-sm"></td>
                          <td className="min-w-0 py-2.5 pl-1 pr-2 text-sm text-dash-text-body">
                            <button
                              onClick={() => navigateToPrefix(folder.fullPrefix)}
                              className="flex max-w-full items-center gap-2 text-left hover:text-[#3c6ce7] hover:underline"
                            >
                              <Folder className="size-4 shrink-0 text-dash-text-faded" />
                              <span className="truncate">{folder.name}</span>
                            </button>
                            <span className="mt-1 block text-xs text-dash-text-faded sm:hidden">
                              Folder ·{" "}
                              {folder.itemCount === 0 ? "Empty" : `${folder.itemCount} ${folder.itemCount === 1 ? "item" : "items"}`}
                            </span>
                          </td>
                          <td className="hidden py-2.5 text-sm text-dash-text-faded sm:table-cell">—</td>
                          <td className="hidden py-2.5 text-sm text-dash-text-faded sm:table-cell">Folder</td>
                          <td className="hidden py-2.5 text-right text-sm text-dash-text-faded sm:table-cell">
                            {folder.itemCount === 0 ? "Empty" : `${folder.itemCount} ${folder.itemCount === 1 ? "item" : "items"}`}
                          </td>
                          <td className="py-2.5 pr-3.5 text-right text-sm">
                            {canWrite && (
                              <button
                                type="button"
                                onClick={() => setDeleteFolderTarget(folder)}
                                aria-label={`Delete folder ${folder.name}`}
                                title="Delete folder"
                                className="inline-flex items-center justify-center align-middle transition-opacity hover:opacity-70"
                              >
                                <FolderTrashIcon className="size-4" color="#ef2f1f" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {files.map((obj, i) => {
                      const displayName = isObjectSearchActive ? obj.key : obj.key.slice(currentPrefix.length);
                      const isLast = i === files.length - 1;
                      const selected = selectedObjectKeys.has(obj.key);
                      return (
                        <tr
                          key={obj.key}
                          className={`transition-colors hover:bg-dash-bg-elevated ${selected ? "bg-dash-bg-elevated/50" : ""} ${
                            !isLast ? "border-b border-dash-border" : ""
                          }`}
                        >
                          <td className="py-2.5 pl-3 pr-1 align-middle text-sm">
                            <ObjectSelectionCheckbox
                              checked={selected}
                              onChange={() => toggleObjectSelection(obj.key)}
                              label={`Select ${displayName}`}
                            />
                          </td>
                          <td className="min-w-0 py-2.5 pl-1 pr-2 text-sm text-dash-text-body">
                            <FilePreviewTooltip obj={obj} resolveUrl={resolveDownloadUrl}>
                              <button
                                onClick={() => handleViewObject(obj)}
                                disabled={openingObject === obj.key}
                                className="flex max-w-full items-center gap-2 text-left hover:text-[#3c6ce7] hover:underline disabled:opacity-60"
                              >
                                <FileIcon name={obj.key} />
                                <span className="truncate">{openingObject === obj.key ? "Opening..." : displayName}</span>
                              </button>
                            </FilePreviewTooltip>
                            <span className="mt-1 block truncate text-xs text-dash-text-faded sm:hidden">
                              {formatBytes(obj.size)} · {fileTypeLabel(obj.key)}
                              {obj.last_modified ? ` · ${formatRelativeTime(obj.last_modified)}` : ""}
                            </span>
                          </td>
                          <td className="hidden py-2.5 text-sm text-dash-text-faded sm:table-cell">{formatBytes(obj.size)}</td>
                          <td className="hidden py-2.5 text-sm text-dash-text-faded sm:table-cell">{fileTypeLabel(obj.key)}</td>
                          <td className="hidden py-2.5 text-right text-sm text-dash-text-faded sm:table-cell">
                            {obj.last_modified ? formatRelativeTime(obj.last_modified) : "—"}
                          </td>
                          <td className="py-2.5 pr-3.5 text-right text-sm">
                            <button
                              type="button"
                              onClick={() => handleDeleteObject(obj)}
                              disabled={deleting === obj.key}
                              aria-label={`Delete ${displayName}`}
                              title="Delete object"
                              className="inline-flex items-center justify-center align-middle transition-opacity hover:opacity-70 disabled:opacity-50"
                            >
                              <FolderTrashIcon className="size-4" color="#ef2f1f" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {(hasMore || objectPageIndex > 0) && !loadingObjects && (
          <div className="mt-3 flex justify-end">
            <CursorPagination
              hasNextPage={hasMore}
              hasPrevPage={objectPageIndex > 0}
              onNext={handleNextObjectsPage}
              onPrev={handlePrevObjectsPage}
              showLabels={false}
              label={`Page ${objectPageIndex + 1}`}
            />
          </div>
        )}
      </div>

      <section className="mt-12 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className={BUCKET_SECTION_HEADING_CLASS_NAME}>API Credentials</h3>
            <p className="mt-1 text-xs text-dash-text-faded">
              S3-compatible access keys for programmatic access to this bucket. Secrets are shown once at creation.
            </p>
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={() => setCredentialsModalOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-dash-text-body transition-colors hover:text-dash-text-strong"
            >
              <KeyRound className="size-3.5" />
              Create credentials
            </button>
          )}
        </div>
        <ActiveCredentialsList
          credentials={credentials}
          loading={loadingCredentials}
          canWrite={canWrite}
          revokingId={revokingId}
          onRevoke={setRevokeTarget}
        />
      </section>

      <section className="mt-12 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className={BUCKET_SECTION_HEADING_CLASS_NAME}>CORS configuration</h3>
            <p className="mt-1 text-xs text-dash-text-faded">
              Origins, methods, and headers allowed by browsers when accessing this bucket directly.
            </p>
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={() => setCorsDrawerOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-dash-text-body transition-colors hover:text-dash-text-strong"
            >
              Configure
            </button>
          )}
        </div>
        <CorsConfigSection rules={corsRules} canWrite={canWrite} />
      </section>

      {canWrite && (
        <>
          <section className="mt-12 flex flex-col gap-4">
            <div>
              <h3 className={BUCKET_SECTION_HEADING_CLASS_NAME}>Danger Zone</h3>
              <p className="mt-1 text-xs text-dash-text-faded">Settings that can permanently affect your bucket and its contents.</p>
            </div>

            <div className="overflow-hidden rounded-[4px] border-[0.5px] border-dash-border">
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <h4 className="text-[13px] font-medium text-dash-text-strong">Bucket Visibility</h4>
                  <p className="mt-1 text-xs text-dash-text-faded">
                    Current visibility: <strong className="text-dash-text-body">{bucket.is_public ? "Public" : "Private"}</strong>.
                    {bucket.is_public ? " Anyone with the URL can view objects." : " Only authorized users can view objects."}
                  </p>
                </div>
                <GlossyButton
                  variant="black"
                  onClick={handleToggleVisibility}
                  disabled={isUpdatingVisibility}
                  loading={isUpdatingVisibility}
                  loadingLabel="Updating..."
                  className="shrink-0"
                >
                  Make {bucket.is_public ? "Private" : "Public"}
                </GlossyButton>
              </div>

              <div className="h-[1px] w-full bg-dash-border" />

              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <h4 className="text-[13px] font-medium text-dash-text-strong">Delete Bucket</h4>
                  <p className="mt-1 text-xs text-dash-text-faded">
                    Permanently delete this bucket and all of its objects. This action is irreversible.
                  </p>
                </div>
                <GlossyButton variant="red" onClick={() => setDeleteBucketOpen(true)} className="shrink-0">
                  Delete Bucket
                </GlossyButton>
              </div>
            </div>
          </section>

          <Modal
            open={newFolderOpen}
            onOpenChange={(open) => {
              setNewFolderOpen(open);
              if (!open) {
                setNewFolderName("");
              }
            }}
            width={420}
            dismissible={!isCreatingFolder}
          >
            <ModalHeader
              title="New folder"
              description={currentPrefix ? `Create a folder inside ${currentPrefix}` : "Create a folder in this bucket."}
            />
            <div className="px-6 py-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-dash-text-strong">Folder path</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || !newFolderName.trim() || isCreatingFolder) return;
                    event.preventDefault();
                    void handleCreateFolder();
                  }}
                  placeholder="reports/2026"
                  autoFocus
                  className="h-10 rounded-[4px] border border-dash-border bg-dash-bg px-3 text-sm text-dash-text-strong outline-none transition-colors placeholder:text-dash-text-extra-faded focus:border-[#4879f8]"
                />
              </div>
            </div>
            <ModalFooter>
              <ModalCancelButton />
              <ModalContinueButton
                onClick={handleCreateFolder}
                loading={isCreatingFolder}
                loadingLabel="Creating..."
                disabled={!newFolderName.trim()}
              >
                Create folder
              </ModalContinueButton>
            </ModalFooter>
          </Modal>

          <CreateS3CredentialsModal
            open={credentialsModalOpen}
            onOpenChange={setCredentialsModalOpen}
            bucketName={bucket.name}
            onCreate={handleCreateCredentials}
          />
          <S3CredentialsCreatedModal
            open={credentialsCreatedModalOpen}
            onOpenChange={setCredentialsCreatedModalOpen}
            credentials={createdCredentials}
          />
          <RevokeCredentialModal
            open={revokeTarget !== null}
            onOpenChange={(open) => {
              if (!open) setRevokeTarget(null);
            }}
            credential={revokeTarget}
            onConfirm={handleRevokeCredential}
          />
          <CorsConfigDrawer open={corsDrawerOpen} onOpenChange={setCorsDrawerOpen} rules={corsRules} onSave={handleSaveCors} />
          <DeleteBucketModal
            open={deleteBucketOpen}
            onOpenChange={setDeleteBucketOpen}
            bucket={bucket}
            bucketId={bucketId}
            workspace={workspace}
            onDeleted={handleBucketDeleted}
          />
          <WarningModal
            open={bulkDeleteOpen}
            onOpenChange={setBulkDeleteOpen}
            title={`Delete ${selectedObjectKeys.size} selected ${selectedObjectKeys.size === 1 ? "file" : "files"}?`}
            description="This permanently deletes the selected files from this bucket. This action cannot be undone."
            confirmLabel="Delete"
            confirmLoadingLabel="Deleting..."
            confirmDisabled={selectedObjectKeys.size === 0}
            onConfirm={handleBulkDeleteSelectedObjects}
          />
          <WarningModal
            open={deleteFolderTarget !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteFolderTarget(null);
            }}
            title={`Delete folder "${deleteFolderTarget?.name ?? ""}"?`}
            description="This permanently deletes the folder and every object inside it. This action cannot be undone."
            confirmLabel="Delete"
            confirmLoadingLabel="Deleting..."
            onConfirm={async () => {
              if (deleteFolderTarget) await handleDeleteFolder(deleteFolderTarget);
            }}
          />
        </>
      )}
    </div>
  );
}
