import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { BucketList, type Bucket } from "../../components/shared/bucket-list";
import { AddBucketModal, type AddBucketFormValues } from "../../components/shared/add-bucket-modal";
import { NumberPagination } from "../../components/shared/pagination";
import { BucketStatsRow } from "../../components/shared/bucket-stats-row";
import { PageHeader } from "../../components/shared/page-header";
import { PlanUpgradePrompt } from "@/components/shared/plan-upgrade-prompt";
import { GlossyButton } from "../../components/shared/glossy-button";
import { ToggleSwitch } from "@/components/shared/toggle-switch";
import { formatRelativeTime } from "@/utils/dashboard";
import { parseTextSearchValue, parseWorkspaceSearchValue, workspacePageLoaderDeps } from "@/utils/workspace-route-search";
import { invalidateActiveMatches } from "@/utils/router-invalidate";
import { usePlanGate } from "@/hooks/use-plan-gate";
import { FeatureFlags, useFeatureFlag } from "@/lib/feature-flags";
import type { BucketRecord, PaginatedBucketsResponse, StorageGraphPoint, StorageOverview } from "@/backend/storage";
import {
  listBucketsServerFn,
  searchBucketsServerFn,
  getStorageOverviewServerFn,
  createBucketServerFn,
  deleteBucketServerFn,
} from "@/server/storage/actions";

const STORAGE_OVERVIEW_DAYS = 7;
const BUCKETS_PAGE_SIZE = 20;
const BUCKET_SEARCH_DEBOUNCE_MS = 300;

function parsePositiveIntegerSearchValue(value: unknown, fallback: number): number {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

export const Route = createFileRoute("/buckets/")({
  staleTime: 60_000,
  preloadStaleTime: 60_000,
  validateSearch: (search: Record<string, unknown>) => {
    const next: { workspace?: string; q?: string; page?: number } = {};
    const workspace = parseWorkspaceSearchValue(search.workspace);
    const q = parseTextSearchValue(search.q);
    const page = parsePositiveIntegerSearchValue(search.page, 1);

    if (workspace) {
      next.workspace = workspace;
    }
    if (q) {
      next.q = q;
    }
    if (page > 1) {
      next.page = page;
    }
    return next;
  },
  loaderDeps: ({ search }) => ({
    ...workspacePageLoaderDeps(search),
  }),
  loader: async ({ deps }) => {
    const workspace = deps.workspace;

    const [buckets, overview] = await Promise.all([
      listBucketsServerFn({
        data: { workspace, page: 1, limit: BUCKETS_PAGE_SIZE },
      }).catch(
        () =>
          ({
            items: [],
            totalCount: 0,
            currentPage: 1,
            totalPages: 1,
            limit: BUCKETS_PAGE_SIZE,
          }) as PaginatedBucketsResponse,
      ),
      getStorageOverviewServerFn({
        data: { workspace },
      }).catch(() => null),
    ]);

    return {
      workspace,
      bucketsResult: buckets,
      overview,
    };
  },
  component: BucketsPage,
  pendingComponent: BucketsPending,
});

function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-dash-border-soft/60 ${className}`} />;
}

function BucketsPending() {
  return (
    <div className="max-w-[1000px]" aria-hidden="true">
      <div className="mb-8 flex items-center gap-6">
        <div className="size-[100px] shrink-0 animate-pulse rounded-[4px] bg-dash-border-soft/50" />
        <div className="flex min-w-0 flex-col gap-3">
          <SkeletonBar className="h-7 w-48" />
          <SkeletonBar className="h-3.5 w-[420px] max-w-full" />
          <SkeletonBar className="h-3.5 w-[360px] max-w-full" />
        </div>
      </div>

      <hr className="border-dash-border-soft mb-8 -mx-4 md:-mx-10" />

      <div className="mb-8 flex flex-col gap-3 lg:h-[160px] lg:flex-row">
        <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-[4px] border-[0.5px] border-dash-border lg:w-[36%]">
          <div className="flex h-[30px] items-center border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-2">
            <SkeletonBar className="h-2.5 w-24" />
          </div>
          <div className="px-2 pb-3 pt-2">
            <SkeletonBar className="h-2.5 w-32" />
          </div>
          <div className="mt-auto h-[65px] w-full animate-pulse bg-gradient-to-t from-dash-border-soft/40 to-transparent" />
        </div>

        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="flex min-h-[132px] flex-1 flex-col overflow-hidden rounded-[4px] border-[0.5px] border-dash-border">
            <div className="flex h-[30px] items-center border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-2.5">
              <SkeletonBar className="h-2.5 w-20" />
            </div>
            <div className="flex flex-1 flex-col items-start justify-center gap-3 px-4 py-4 lg:py-0">
              <SkeletonBar className="h-10 w-16" />
              <SkeletonBar className="h-3.5 w-28" />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 h-[48px] w-full overflow-hidden rounded-[4px] border-[0.5px] border-dash-border">
        <div className="flex size-full items-center px-4">
          <SkeletonBar className="h-3.5 w-56" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="min-h-[168px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30 p-4">
            <div className="flex items-start justify-between">
              <SkeletonBar className="h-4 w-28" />
              <SkeletonBar className="h-6 w-6 rounded-full" />
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <SkeletonBar className="h-3 w-32" />
              <SkeletonBar className="h-3 w-24" />
            </div>
            <div className="mt-8 flex items-center justify-between">
              <SkeletonBar className="h-3 w-16" />
              <SkeletonBar className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function mapBucketToRow(bucket: BucketRecord): Bucket {
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

function buildFlatUsageGraph(storageUsed: number): StorageGraphPoint[] {
  return Array.from({ length: STORAGE_OVERVIEW_DAYS }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (STORAGE_OVERVIEW_DAYS - index - 1));
    return {
      date: date.toISOString().slice(0, 10),
      storageUsed,
    };
  });
}

function buildFallbackOverview(rows: Bucket[]): StorageOverview {
  const totalStorageUsed = rows.reduce((acc, row) => acc + (row.storageUsed || 0), 0);
  return {
    totalStorageUsed,
    totalFiles: rows.reduce((acc, row) => acc + (row.objectCount || 0), 0),
    totalBuckets: rows.length,
    usageGraph: buildFlatUsageGraph(totalStorageUsed),
  };
}

function StorageOverviewSection({
  visible,
  onVisibleChange,
  overview,
}: {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  overview: StorageOverview;
}) {
  return (
    <section className="mb-8 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-dash-text-strong">Storage overview</h2>
          <p className="mt-1 text-xs text-dash-text-faded">Usage, bucket count, and stored files across object storage.</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-dash-text-faded">
          <span>Show overview</span>
          <ToggleSwitch checked={visible} onChange={onVisibleChange} size="sm" />
        </label>
      </div>

      {visible && (
        <BucketStatsRow
          totalBuckets={overview.totalBuckets}
          totalFiles={overview.totalFiles}
          totalStorageUsed={overview.totalStorageUsed}
          usageGraph={overview.usageGraph}
        />
      )}
    </section>
  );
}

function BucketsPage() {
  const { canWrite } = useWorkspaceRole();
  const { objectStorageEnabled } = usePlanGate();
  const bucketFeatureEnabled = useFeatureFlag(FeatureFlags.ENABLE_BUCKETS);
  const router = useRouter();
  const search = Route.useSearch();
  const { bucketsResult, overview, workspace } = Route.useLoaderData() as {
    bucketsResult: PaginatedBucketsResponse;
    overview: StorageOverview | null;
    workspace?: string;
  };
  const [{ q, page }, setSearchParams] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      page: parseAsInteger.withDefault(1),
    },
    {
      history: "replace",
      clearOnDefault: true,
    },
  );
  const [addBucketOpen, setAddBucketOpen] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [searchQuery, setSearchQuery] = useState(q);
  const [isSearching, setIsSearching] = useState(false);
  const [isBucketsLoading, setIsBucketsLoading] = useState(false);
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const [rows, setRows] = useState<Bucket[]>(() => (bucketsResult?.items || []).map(mapBucketToRow));
  const [pagination, setPagination] = useState(() => ({
    currentPage: bucketsResult.currentPage,
    totalPages: bucketsResult.totalPages,
  }));

  const createBucket = useServerFn(createBucketServerFn);
  const listBuckets = useServerFn(listBucketsServerFn);
  const searchBuckets = useServerFn(searchBucketsServerFn);
  const deleteBucket = useServerFn(deleteBucketServerFn);

  useEffect(() => {
    setRows((bucketsResult?.items || []).map(mapBucketToRow));
    setPagination({
      currentPage: bucketsResult.currentPage,
      totalPages: bucketsResult.totalPages,
    });
  }, [bucketsResult]);

  useEffect(() => {
    setSearchQuery(q);
  }, [q]);

  useEffect(() => {
    const nextQuery = searchQuery.trim();

    const timeout = window.setTimeout(() => {
      if (nextQuery === q) {
        return;
      }

      setIsSearching(true);
      void setSearchParams({ q: nextQuery, page: 1 });
    }, BUCKET_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [q, searchQuery, setSearchParams]);

  useEffect(() => {
    let active = true;
    const nextPage = page > 0 ? page : 1;
    const nextQuery = q.trim();

    setIsBucketsLoading(true);
    setLoadingPage(nextPage);

    const request = nextQuery
      ? searchBuckets({
          data: {
            workspace: search.workspace,
            q: nextQuery,
            page: nextPage,
            limit: BUCKETS_PAGE_SIZE,
          },
        })
      : listBuckets({
          data: {
            workspace: search.workspace,
            page: nextPage,
            limit: BUCKETS_PAGE_SIZE,
          },
        });

    void request
      .then((result) => {
        if (!active) {
          return;
        }

        setRows(result.items.map(mapBucketToRow));
        setPagination({ currentPage: result.currentPage, totalPages: result.totalPages });
      })
      .catch(() => {
        if (!active) {
          return;
        }
        toast.error("Unable to load buckets");
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setIsSearching(false);
        setIsBucketsLoading(false);
        setLoadingPage(null);
      });

    return () => {
      active = false;
    };
  }, [listBuckets, page, q, search.workspace, searchBuckets]);

  function handlePageChange(page: number) {
    if (page < 1 || page === pagination.currentPage || page > pagination.totalPages) return;
    setLoadingPage(page);
    void setSearchParams({ page });
  }

  async function handleAddBucket(data: AddBucketFormValues): Promise<void> {
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
    if (!bucketId) {
      throw new Error("Bucket created but the response did not include a bucket ID.");
    }

    setRows((prev) => [mapBucketToRow(created), ...prev]);
    toast.success("Bucket created successfully");
    void invalidateActiveMatches(router);
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
    void invalidateActiveMatches(router);
  }

  const isEmptyState = rows.length === 0 && !searchQuery;
  const storageOverview = overview ?? buildFallbackOverview(rows);

  if (!objectStorageEnabled || !bucketFeatureEnabled) {
    return (
      <div className="max-w-[1000px]">
        <PageHeader title="Object Storage" image="/images/fire-stick.svg">
          Store, organize, and manage application assets, user uploads, media files, and static content from a unified object storage
          system.
        </PageHeader>

        <hr className="border-dash-border-soft mb-8 -mx-4 md:-mx-10" />

        <PlanUpgradePrompt feature="Object Storage" description="Upgrade your plan to create and manage storage buckets." />
      </div>
    );
  }

  if (isEmptyState) {
    return (
      <div className="max-w-[1000px]">
        <PageHeader title="Object Storage" image="/images/fire-stick.svg">
          Store, organize, and manage application assets, user uploads, media files, and static content from a unified object storage
          system.
        </PageHeader>

        <hr className="border-dash-border-soft mb-8 -mx-4 md:-mx-10" />

        <StorageOverviewSection visible={showOverview} onVisibleChange={setShowOverview} overview={storageOverview} />

        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <h3 className="text-base font-medium leading-5 tracking-[-0.03px] text-dash-text-strong">Object storage</h3>
          <p className="mt-2 text-center text-sm font-light leading-[1.5] text-dash-text-extra-faded">
            Store, organize, and manage application <br />
            assets, user uploads,
          </p>

          {canWrite && (
            <GlossyButton className="mt-6" onClick={() => setAddBucketOpen(true)}>
              Create bucket
            </GlossyButton>
          )}
        </div>

        {canWrite && (
          <AddBucketModal open={addBucketOpen} workspace={workspace} onOpenChange={setAddBucketOpen} onContinue={handleAddBucket} />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[1000px]">
      <PageHeader title="Object Storage" image="/images/fire-stick.svg">
        Store, organize, and manage application assets, user uploads, media files, and static content from a unified object storage system.
      </PageHeader>

      <hr className="border-dash-border-soft mb-8 -mx-4 md:-mx-10" />

      <StorageOverviewSection visible={showOverview} onVisibleChange={setShowOverview} overview={storageOverview} />

      <div>
        <BucketList
          buckets={rows}
          workspace={workspace}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchLoading={isSearching || isBucketsLoading}
          disableClientFilter
          onDeleteBucket={canWrite ? handleDeleteBucket : undefined}
          onCreate={canWrite ? () => setAddBucketOpen(true) : undefined}
        />
      </div>

      <div className="mt-6 flex justify-end">
        <NumberPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
          isLoading={isBucketsLoading}
          loadingPage={loadingPage}
        />
      </div>

      {canWrite && (
        <AddBucketModal open={addBucketOpen} workspace={workspace} onOpenChange={setAddBucketOpen} onContinue={handleAddBucket} />
      )}
    </div>
  );
}
