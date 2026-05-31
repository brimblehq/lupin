import { useEffect, useState } from "react";
import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { BucketList, type Bucket } from "../../../../components/shared/bucket-list";
import { AddBucketModal, type AddBucketFormValues } from "../../../../components/shared/add-bucket-modal";
import { TabHeader } from "../../../../components/shared/tab-header";
import { ProjectDomainsPending } from "@/components/shared/route-pending";
import { PlanUpgradePrompt } from "@/components/shared/plan-upgrade-prompt";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { invalidateActiveMatches } from "@/utils/router-invalidate";
import type { BucketRecord, PaginatedBucketsResponse } from "@/backend/storage";
import { listBucketsServerFn, createBucketServerFn, deleteBucketServerFn } from "@/server/storage/actions";
import { Plus } from "lucide-react";
import { GlossyButton } from "../../../../components/shared/glossy-button";
import { formatRelativeTime } from "@/utils/dashboard";
import { usePlanGate } from "@/hooks/use-plan-gate";
import { FeatureFlags, useFeatureFlag } from "@/lib/feature-flags";

const parentRoute = getRouteApi("/projects/$projectId");

export const Route = createFileRoute("/projects/$projectId/storage/")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  validateSearch: (search: Record<string, unknown>) => {
    const next: { workspace?: string; q?: string } = {};

    const rawWorkspace = search.workspace;
    if (typeof rawWorkspace === "string" && rawWorkspace.trim()) {
      next.workspace = rawWorkspace.trim();
    }

    if (typeof search.q === "string") {
      next.q = search.q;
    }

    return next;
  },
  loaderDeps: ({ search }) => ({
    workspace: search.workspace,
    q: search.q,
  }),
  loader: async ({ params, deps, context }) => {
    const contextWorkspace = (context as { workspace?: string }).workspace;
    const workspace = deps.workspace ?? contextWorkspace;

    const buckets = await listBucketsServerFn({
      data: {
        workspace,
        projectId: params.projectId,
      },
    }).catch(() => ({ items: [], currentPage: 1, totalPages: 1 }) as PaginatedBucketsResponse);

    return {
      buckets,
    };
  },
  component: ProjectStoragePage,
  pendingComponent: ProjectDomainsPending,
});

function mapBucketToRow(bucket: BucketRecord): Bucket {
  const addedAtSource = bucket.updatedAt || bucket.createdAt || new Date().toISOString();
  return {
    id: bucket.id,
    name: bucket.name,
    projectId: bucket.projectId,
    region: bucket.region,
    createdAt: formatRelativeTime(addedAtSource),
  };
}

function ProjectStoragePage() {
  const { projectId } = Route.useParams();
  const router = useRouter();
  const search = Route.useSearch();
  const { workspace } = parentRoute.useLoaderData() as { workspace?: string };
  const { canWrite } = useWorkspaceRole();
  const { objectStorageEnabled } = usePlanGate();
  const bucketFeatureEnabled = useFeatureFlag(FeatureFlags.ENABLE_BUCKETS);
  const { buckets: bucketsResult } = Route.useLoaderData();
  const [addBucketOpen, setAddBucketOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(search.q ?? "");
  const [rows, setRows] = useState<Bucket[]>(() => (bucketsResult?.items || []).map(mapBucketToRow));

  const createBucket = useServerFn(createBucketServerFn);
  const deleteBucket = useServerFn(deleteBucketServerFn);

  useEffect(() => {
    if (bucketsResult?.items) {
      setRows(bucketsResult.items.map(mapBucketToRow));
    }
  }, [bucketsResult?.items]);

  async function handleAddBucket(data: AddBucketFormValues) {
    const created = await createBucket({
      data: {
        workspace,
        name: data.name,
        projectId,
        region: data.region,
        isPublic: data.isPublic,
      },
    });
    setRows((prev) => [mapBucketToRow(created), ...prev]);
    toast.success("Bucket created successfully");
    void invalidateActiveMatches(router);
  }

  async function handleDeleteBucket(bucket: Bucket) {
    if (!bucket.id) throw new Error("Bucket ID is missing");

    await deleteBucket({
      data: {
        workspace,
        bucketId: bucket.id,
      },
    });

    setRows((prev) => prev.filter((row) => row.id !== bucket.id));
    toast.success("Bucket deleted successfully");
    void invalidateActiveMatches(router);
  }

  if (!objectStorageEnabled || !bucketFeatureEnabled) {
    return (
      <div className="mx-auto flex max-w-[1000px] flex-col gap-4 py-8">
        <TabHeader title="Storage Buckets">
          Manage object storage buckets associated with your project. Upload, manage, and deliver files.
        </TabHeader>
        <PlanUpgradePrompt feature="Object Storage" description="Upgrade your plan to create and manage project storage buckets." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4 py-8">
      <div className="flex items-center justify-between">
        <TabHeader title="Storage Buckets">
          Manage object storage buckets associated with your project. Upload, manage, and deliver files.
        </TabHeader>

        {canWrite && (
          <GlossyButton onClick={() => setAddBucketOpen(true)}>
            <Plus className="size-4" />
            Create Bucket
          </GlossyButton>
        )}
      </div>

      <BucketList
        buckets={rows}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onDeleteBucket={canWrite ? handleDeleteBucket : undefined}
        onCreate={canWrite ? () => setAddBucketOpen(true) : undefined}
      />

      {canWrite && (
        <AddBucketModal open={addBucketOpen} workspace={workspace} onOpenChange={setAddBucketOpen} onContinue={handleAddBucket} />
      )}
    </div>
  );
}
