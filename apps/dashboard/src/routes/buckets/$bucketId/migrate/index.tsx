import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  cancelStorageMigrationServerFn,
  getBucketDetailsServerFn,
  getStorageMigrationServerFn,
  listStorageMigrationsServerFn,
} from "@/server/storage/actions";
import { parseWorkspaceSearchValue, workspacePageLoaderDeps } from "@/utils/workspace-route-search";
import { GlossyButton } from "@/components/shared/glossy-button";
import { SimpleTooltip } from "@/components/shared/tooltip";
import { StatusChip } from "@/components/shared/status-chip";
import { formatRelativeTime } from "@/utils/dashboard";
import { hapticToast as toast } from "@/utils/haptic-toast";
import type { StorageMigration, StorageMigrationStatus } from "@/backend/storage";

export const Route = createFileRoute("/buckets/$bucketId/migrate/")({
  validateSearch: (search: Record<string, unknown>) => {
    const workspace = parseWorkspaceSearchValue(search.workspace);
    return workspace ? { workspace } : {};
  },
  loaderDeps: ({ search }) => workspacePageLoaderDeps(search),
  loader: async ({ params, deps }) => {
    const workspace = deps.workspace;
    const bucket = await getBucketDetailsServerFn({ data: { workspace, bucketId: params.bucketId } }).catch(() => null);
    return { workspace, bucket };
  },
  component: MigrationsIndexPage,
});

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTransferredItems(count: number) {
  const label = count === 1 ? "item" : "items";
  return `${count.toLocaleString()} ${label} transferred`;
}

const MIGRATION_POLL_INTERVAL_MS = 3000;
const TERMINAL_MIGRATION_STATUSES = new Set<StorageMigrationStatus>(["completed", "failed", "cancelled"]);

const STATUS_LABEL: Record<StorageMigrationStatus, string> = {
  queued: "QUEUED",
  running: "RUNNING",
  completed: "SUCCEEDED",
  failed: "FAILED",
  cancelled: "CANCELLED",
};

function isMigrationTerminal(status: StorageMigrationStatus) {
  return TERMINAL_MIGRATION_STATUSES.has(status);
}

function MigrationsIndexPage() {
  const { workspace, bucket } = Route.useLoaderData();
  const { bucketId } = Route.useParams();
  const listMigrations = useServerFn(listStorageMigrationsServerFn);
  const getMigration = useServerFn(getStorageMigrationServerFn);
  const cancelMigration = useServerFn(cancelStorageMigrationServerFn);
  const [jobs, setJobs] = useState<StorageMigration[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listMigrations({ data: { workspace, bucketId } })
      .then((rows) => {
        if (!cancelled) setJobs(rows);
      })
      .catch((error) => {
        if (!cancelled) {
          setJobs([]);
          toast.error(error instanceof Error ? error.message : "Failed to load migrations");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bucketId, listMigrations, workspace]);

  useEffect(() => {
    const activeJobs = jobs.filter((job) => !isMigrationTerminal(job.status));
    if (activeJobs.length === 0) return;

    const interval = window.setInterval(() => {
      void Promise.all(
        activeJobs.map((job) => getMigration({ data: { workspace, bucketId, migrationId: job.id } }).catch(() => null)),
      ).then((updates) => {
        const nextJobs = updates.filter((job): job is StorageMigration => job !== null);
        if (nextJobs.length === 0) return;
        setJobs((current) =>
          current.map((job) => {
            const nextJob = nextJobs.find((candidate) => candidate.id === job.id);
            return nextJob ?? job;
          }),
        );
      });
    }, MIGRATION_POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [bucketId, getMigration, jobs, workspace]);

  async function handleCancelMigration(job: StorageMigration) {
    if (isMigrationTerminal(job.status)) return;

    try {
      setCancellingId(job.id);
      const updated = await cancelMigration({ data: { workspace, bucketId, migrationId: job.id } });
      setJobs((current) => current.map((candidate) => (candidate.id === updated.id ? updated : candidate)));
      toast.success("Migration cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel migration");
    } finally {
      setCancellingId(null);
    }
  }

  const bucketName = bucket?.name || "this bucket";

  return (
    <div className="flex max-w-[1000px] flex-col gap-4">
      <Link
        to="/buckets/$bucketId"
        params={{ bucketId }}
        search={workspace ? { workspace } : {}}
        className="flex w-fit items-center gap-1.5 text-xs text-dash-text-faded transition-colors hover:text-dash-text-strong"
      >
        <ArrowLeft className="size-3.5" />
        Back to {bucketName}
      </Link>

      <div className="flex flex-row items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="truncate text-base font-semibold tracking-[-0.03px] text-dash-text-strong">Migrations</h2>
          <p className="text-sm font-light leading-[1.3] text-dash-text-extra-faded">
            Move data into {bucketName} from any S3-compatible source. We only read from the source — nothing is deleted.
          </p>
        </div>
        {jobs.length > 0 && (
          <Link to="/buckets/$bucketId/migrate/new" params={{ bucketId }} search={workspace ? { workspace } : {}} className="shrink-0">
            <GlossyButton variant="black" className="flex items-center gap-1.5">
              <Plus className="size-3.5" />
              New migration
            </GlossyButton>
          </Link>
        )}
      </div>

      <div className="mt-2">
        {loading ? (
          <MigrationListSkeleton />
        ) : jobs.length === 0 ? (
          <MigrationsEmptyState bucketId={bucketId} workspace={workspace} />
        ) : (
          <MigrationsTable jobs={jobs} cancellingId={cancellingId} onCancel={handleCancelMigration} />
        )}
      </div>
    </div>
  );
}

function MigrationsTable({
  jobs,
  cancellingId,
  onCancel,
}: {
  jobs: StorageMigration[];
  cancellingId: string | null;
  onCancel: (job: StorageMigration) => void;
}) {
  return (
    <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-[0.5px] border-dash-border bg-dash-bg-elevated/50">
            <th className="px-3.5 py-2 text-left text-xs font-medium text-dash-text-faded">Source</th>
            <th className="hidden px-3 py-2 text-left text-xs font-medium text-dash-text-faded sm:table-cell">Destination</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-faded">Status</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-faded">Progress</th>
            <th className="hidden px-3 py-2 text-left text-xs font-medium text-dash-text-faded sm:table-cell">Started</th>
            <th className="px-3.5 py-2 text-right text-xs font-medium text-dash-text-faded"></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <MigrationRow key={job.id} job={job} cancelling={cancellingId === job.id} onCancel={onCancel} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MigrationRow({
  job,
  cancelling,
  onCancel,
}: {
  job: StorageMigration;
  cancelling: boolean;
  onCancel: (job: StorageMigration) => void;
}) {
  const canCancel = !isMigrationTerminal(job.status);

  return (
    <tr className="border-b-[0.5px] border-dash-border last:border-b-0">
      <td className="px-3.5 py-3 align-top">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-dash-text-strong">{job.sourceBucket}</span>
          <span className="font-mono text-[11px] text-dash-text-extra-faded">{job.sourceRegion}</span>
        </div>
      </td>
      <td className="hidden px-3 py-3 align-top sm:table-cell">
        <span className="font-mono text-xs text-dash-text-faded">{job.destinationPrefix || "—"}</span>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex w-fit flex-col gap-1">
          <StatusChip status={STATUS_LABEL[job.status]} className="w-fit" />
          {job.errorMessage && (
            <SimpleTooltip content={job.errorMessage}>
              <p className="max-w-[220px] cursor-help truncate text-[11px] text-dash-text-extra-faded">{job.errorMessage}</p>
            </SimpleTooltip>
          )}
          {job.failedObjects > 0 && (
            <p className="max-w-[220px] truncate text-[11px] text-dash-text-extra-faded">{job.failedObjects.toLocaleString()} failed</p>
          )}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex min-w-[140px] flex-col gap-0.5">
          <span className="text-xs text-dash-text-faded">{formatTransferredItems(job.copiedObjects)}</span>
          <span className="text-[11px] text-dash-text-extra-faded">{formatBytes(job.copiedBytes)}</span>
        </div>
      </td>
      <td className="hidden px-3 py-3 align-top text-xs text-dash-text-faded sm:table-cell">
        {formatRelativeTime(job.startedAt || job.createdAt)}
      </td>
      <td className="px-3.5 py-3 text-right align-top">
        {canCancel && (
          <button
            type="button"
            disabled={cancelling}
            onClick={() => onCancel(job)}
            className="text-xs font-medium text-[#ef2f1f] transition-opacity hover:opacity-75 disabled:opacity-50"
          >
            {cancelling ? "Cancelling..." : "Cancel"}
          </button>
        )}
      </td>
    </tr>
  );
}

function MigrationListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/40" />
      ))}
    </div>
  );
}

function MigrationsEmptyState({ bucketId, workspace }: { bucketId: string; workspace?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[4px] border-[0.5px] border-dashed border-dash-border bg-dash-bg-elevated/30 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-dash-bg-elevated text-dash-text-faded">
        <img src="/icons/migration.svg" alt="" className="size-5 opacity-70 dark:invert" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-dash-text-strong">No migrations yet</span>
        <span className="text-xs text-dash-text-faded">Import data from AWS, R2, B2, Wasabi, Spaces or any S3-compatible source.</span>
      </div>
      <Link to="/buckets/$bucketId/migrate/new" params={{ bucketId }} search={workspace ? { workspace } : {}}>
        <GlossyButton variant="black" className="flex items-center gap-1.5">
          <Plus className="size-3.5" />
          Start a migration
        </GlossyButton>
      </Link>
    </div>
  );
}
