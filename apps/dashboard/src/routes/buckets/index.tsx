import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { BucketList, type Bucket } from "../../components/shared/bucket-list";
import { AddBucketModal } from "../../components/shared/add-bucket-modal";
import { BucketStatsRow } from "../../components/shared/bucket-stats-row";
import { formatRelativeTime } from "@/utils/dashboard";
import { parseTextSearchValue, parseWorkspaceSearchValue, workspacePageLoaderDeps } from "@/utils/workspace-route-search";
import { invalidateActiveMatches } from "@/utils/router-invalidate";
import type { PaginatedBucketsResponse } from "@/backend/storage";
import { listBucketsServerFn, createBucketServerFn, deleteBucketServerFn, createBucketTokenServerFn } from "@/server/storage/actions";

export const Route = createFileRoute("/buckets/")({
  staleTime: 60_000,
  preloadStaleTime: 60_000,
  validateSearch: (search: Record<string, unknown>) => {
    const next: { workspace?: string; q?: string } = {};
    const workspace = parseWorkspaceSearchValue(search.workspace);
    const q = parseTextSearchValue(search.q);

    if (workspace) {
      next.workspace = workspace;
    }
    if (q) {
      next.q = q;
    }
    return next;
  },
  loaderDeps: ({ search }) => ({
    ...workspacePageLoaderDeps(search),
    q: parseTextSearchValue(search.q),
  }),
  loader: async ({ deps }) => {
    const workspace = deps.workspace;

    const buckets = await (
      listBucketsServerFn as unknown as (input: { data: { workspace?: string; q?: string } }) => Promise<PaginatedBucketsResponse>
    )({
      data: { workspace, q: deps.q },
    }).catch(
      () =>
        ({
          items: [],
          currentPage: 1,
          totalPages: 1,
        }) as PaginatedBucketsResponse,
    );

    return {
      workspace,
      bucketsResult: buckets,
    };
  },
  component: BucketsPage,
  pendingComponent: () => <div className="p-8 text-center text-sm text-gray-500">Loading buckets...</div>,
});

function mapBucketToRow(bucket: any): Bucket {
  const addedAtSource = bucket.updatedAt || bucket.createdAt || new Date().toISOString();
  return {
    id: bucket.id || bucket._id,
    name: bucket.name,
    projectId: bucket.projectId,
    region: bucket.region,
    createdAt: formatRelativeTime(addedAtSource),
    objectCount: bucket.objectCount ?? 0,
    storageUsed: bucket.storage_used ?? 0,
    quota: bucket.quota ?? 1 * 1024 * 1024 * 1024,
  };
}

function BucketsPage() {
  const { canWrite } = useWorkspaceRole();
  const router = useRouter();
  const search = Route.useSearch();
  const { bucketsResult, workspace } = Route.useLoaderData() as any;
  const [addBucketOpen, setAddBucketOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(search.q ?? "");
  const [rows, setRows] = useState<Bucket[]>(() => (bucketsResult?.items || []).map(mapBucketToRow));

  const createBucket = useServerFn(createBucketServerFn as any) as (args: {
    data: { workspace?: string; name: string; region?: string; isPublic?: boolean };
  }) => Promise<any>;
  const createToken = useServerFn(createBucketTokenServerFn as any) as (args: {
    data: { workspace?: string; bucketId: string; name?: string };
  }) => Promise<any>;
  const deleteBucket = useServerFn(deleteBucketServerFn as any) as (args: {
    data: { workspace?: string; bucketId: string };
  }) => Promise<{ success: boolean }>;

  useEffect(() => {
    setRows((bucketsResult?.items || []).map(mapBucketToRow));
  }, [bucketsResult?.items]);

  useEffect(() => {
    setSearchQuery(search.q ?? "");
  }, [search.q]);

  async function handleAddBucket(data: {
    name: string;
    description: string;
    region: string;
    isPublic: boolean;
  }): Promise<{ bucket: any; token?: string }> {
    if (!canWrite) {
      throw new Error("You don't have permission to manage buckets in this workspace.");
    }

    const created = await createBucket({
      data: {
        workspace,
        name: data.name,
        region: data.region,
        isPublic: data.isPublic,
      },
    });

    const bucketId = created?.id || created?._id;
    let token: string | undefined;

    if (bucketId) {
      try {
        const tokenResult = await createToken({
          data: { workspace, bucketId: bucketId, name: "Default key" },
        });
        token = tokenResult?.data?.token || (tokenResult as any)?.token;
      } catch {
        // Token generation failed but bucket was created
      }

      setRows((prev) => [mapBucketToRow(created), ...prev]);
      invalidateActiveMatches(router);
    }

    return { bucket: created, token };
  }

  async function handleDeleteBucket(bucket: Bucket) {
    if (!canWrite) {
      throw new Error("You don't have permission to manage buckets in this workspace.");
    }
    if (!bucket.id) throw new Error("Bucket ID is missing");

    await deleteBucket({
      data: { workspace, bucketId: bucket.id, force: true },
    });

    setRows((prev) => prev.filter((row) => row.id !== bucket.id));
    toast.success("Bucket deleted successfully");
    invalidateActiveMatches(router);
  }

  const isEmptyState = rows.length === 0 && !searchQuery;
  const totalFiles = rows.reduce((acc, row) => acc + (row.objectCount || 0), 0);
  const totalStorageUsed = rows.reduce((acc, row) => acc + (row.storageUsed || 0), 0);
  const maxQuota = rows.length > 0 ? Math.max(...rows.map((row) => row.quota || 0)) : 1 * 1024 * 1024 * 1024;

  if (isEmptyState) {
    return (
      <div className="flex max-w-[1000px] flex-col gap-4 py-8">
        <div className="mb-8">
          <h2
            className="text-dash-text-strong"
            style={{
              fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif",
              fontWeight: 500,
              fontSize: "16px",
              lineHeight: "20px",
              letterSpacing: "-0.0016em",
            }}
          >
            Object Storage
          </h2>
          <p
            className="mt-2 max-w-[560px] text-dash-text-extra-faded"
            style={{
              fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif",
              fontWeight: 300,
              fontSize: "14px",
              lineHeight: "150%",
              letterSpacing: "0%",
            }}
          >
            Store, organize, and manage application assets, user uploads, media files, and static content from a unified object storage
            system.
          </p>
        </div>

        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <h3
            className="text-dash-text-strong"
            style={{
              fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif",
              fontWeight: 500,
              fontSize: "16px",
              lineHeight: "20px",
              letterSpacing: "-0.0016em",
            }}
          >
            Object storage
          </h3>
          <p
            className="mt-2 text-dash-text-extra-faded"
            style={{
              fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif",
              fontWeight: 300,
              fontSize: "14px",
              lineHeight: "150%",
              letterSpacing: "0%",
              textAlign: "center",
            }}
          >
            Store, organize, and manage application <br />
            assets, user uploads,
          </p>

          {canWrite && (
            <button
              onClick={() => setAddBucketOpen(true)}
              className="mt-6 flex items-center justify-center bg-[#3c6ce7] text-white transition-colors hover:bg-[#345cc7]"
              style={{
                width: "146px",
                height: "34px",
                gap: "4px",
                padding: "5px 8px 5px 12px",
                borderTopLeftRadius: "4px",
                borderBottomLeftRadius: "4px",
                borderTopRightRadius: "4px",
                borderBottomRightRadius: "4px",
                borderWidth: "1px",
                borderColor: "#3c6ce7",
                fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif",
                fontWeight: 500,
                fontSize: "14px",
              }}
            >
              <span className="text-lg leading-none">+</span>
              <span>Create bucket</span>
            </button>
          )}
        </div>

        {canWrite && <AddBucketModal open={addBucketOpen} onOpenChange={setAddBucketOpen} onContinue={handleAddBucket} />}
      </div>
    );
  }

  return (
    <div className="flex max-w-[1000px] flex-col gap-4 py-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2
            className="text-dash-text-strong"
            style={{
              fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif",
              fontWeight: 500,
              fontSize: "16px",
              lineHeight: "20px",
              letterSpacing: "-0.0016em",
            }}
          >
            Storage Bucket
          </h2>
          <p
            className="mt-2 max-w-[560px] text-dash-text-extra-faded"
            style={{
              fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif",
              fontWeight: 300,
              fontSize: "14px",
              lineHeight: "150%",
              letterSpacing: "0%",
            }}
          >
            Store, organize, and manage application assets, user uploads, media files, and static content from a unified object storage
            system.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => setAddBucketOpen(true)}
            className="flex items-center gap-2 rounded-[4px] bg-[#3c6ce7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#345cc7]"
          >
            Create Bucket
          </button>
        )}
      </div>

      <BucketStatsRow totalBuckets={rows.length} totalFiles={totalFiles} totalStorageUsed={totalStorageUsed} quota={maxQuota} />

      <div>
        <BucketList
          buckets={rows}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onDeleteBucket={canWrite ? handleDeleteBucket : undefined}
          onCreate={canWrite ? () => setAddBucketOpen(true) : undefined}
        />
      </div>

      {canWrite && <AddBucketModal open={addBucketOpen} onOpenChange={setAddBucketOpen} onContinue={handleAddBucket} />}
    </div>
  );
}
