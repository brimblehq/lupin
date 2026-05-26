import { useEffect, useState } from "react";
import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { BucketList, type Bucket } from "../../../../components/shared/bucket-list";
import { AddBucketModal } from "../../../../components/shared/add-bucket-modal";
import { TabHeader } from "../../../../components/shared/tab-header";
import { ProjectDomainsPending } from "@/components/shared/route-pending";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { invalidateActiveMatches } from "@/utils/router-invalidate";
import type { PaginatedBucketsResponse } from "@/backend/storage";
import {
  listBucketsServerFn,
  createBucketServerFn,
  deleteBucketServerFn,
} from "@/server/storage/actions";
import { Plus } from "lucide-react";
import { formatRelativeTime } from "@/utils/dashboard";

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
    const workspace = deps.workspace ?? (context as any).workspace;

    const buckets = await (listBucketsServerFn as unknown as (input: {
      data: { workspace?: string; projectId?: string; q?: string };
    }) => Promise<PaginatedBucketsResponse>)({
      data: {
        workspace,
        projectId: params.projectId,
      },
    }).catch(() => ({ items: [], currentPage: 1, totalPages: 1 } as PaginatedBucketsResponse));

    return {
      buckets,
    };
  },
  component: ProjectStoragePage,
  pendingComponent: ProjectDomainsPending,
});

function mapBucketToRow(bucket: any): Bucket {
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
  const { workspace } = parentRoute.useLoaderData() as any;
  const { canWrite } = useWorkspaceRole();
  const { buckets: bucketsResult } = Route.useLoaderData();
  const [addBucketOpen, setAddBucketOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(search.q ?? "");
  const [rows, setRows] = useState<Bucket[]>(() => (bucketsResult?.items || []).map(mapBucketToRow));
  
  const createBucket = useServerFn(createBucketServerFn as any) as (args: {
    data: { workspace?: string; name: string; projectId?: string; region?: string };
  }) => Promise<any>;
  const deleteBucket = useServerFn(deleteBucketServerFn as any) as (args: {
    data: { workspace?: string; bucketId: string };
  }) => Promise<{ success: boolean }>;

  useEffect(() => {
    if (bucketsResult?.items) {
      setRows(bucketsResult.items.map(mapBucketToRow));
    }
  }, [bucketsResult?.items]);

  async function handleAddBucket(name: string, region?: string) {
    const created = await createBucket({
      data: {
        workspace,
        name,
        projectId,
        region,
      },
    });
    setRows((prev) => [mapBucketToRow(created), ...prev]);
    toast.success("Bucket created successfully");
    invalidateActiveMatches(router);
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
    invalidateActiveMatches(router);
  }

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4 py-8">
      <div className="flex items-center justify-between">
        <TabHeader title="Storage Buckets">
          Manage object storage buckets associated with your project. Upload, manage, and deliver files.
        </TabHeader>

        {canWrite && (
          <button
            onClick={() => setAddBucketOpen(true)}
            className="flex items-center gap-2 rounded-[4px] bg-[#3c6ce7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#345cc7]"
          >
            <Plus className="size-4" />
            Create Bucket
          </button>
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
        <AddBucketModal
          open={addBucketOpen}
          onOpenChange={setAddBucketOpen}
          onContinue={handleAddBucket}
        />
      )}
    </div>
  );
}
