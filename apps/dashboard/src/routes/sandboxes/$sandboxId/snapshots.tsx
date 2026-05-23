import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { TabHeader } from "@/components/shared/tab-header";
import { SnapshotRow } from "@/components/sandboxes/snapshot-row";
import { DeleteSnapshotModal } from "@/components/sandboxes/delete-snapshot-modal";
import { snapshotEventBus } from "@/lib/sandboxes/snapshot-event-bus";
import { listOneSandboxSnapshotsServerFn } from "@/server/sandboxes/actions";
import { SnapshotStatus, type PaginatedSnapshotsResponse, type SandboxResponse, type SnapshotResponse } from "@/backend/sandboxes";
import { workspaceLoaderDeps } from "@/utils/workspace-route-search";

export const Route = createFileRoute("/sandboxes/$sandboxId/snapshots")({
  staleTime: 60_000,
  preloadStaleTime: 60_000,
  loaderDeps: ({ search }) => workspaceLoaderDeps(search),
  loader: async ({ params, deps }) => {
    const workspace = deps.workspace;
    const result = await (
      listOneSandboxSnapshotsServerFn as unknown as (input: {
        data: { sandboxId: string; workspace?: string; page?: number; limit?: number };
      }) => Promise<PaginatedSnapshotsResponse>
    )({
      data: { sandboxId: params.sandboxId, workspace, page: 1, limit: 50 },
    });

    return { snapshots: result.items, workspace };
  },
  component: SandboxSnapshotsPanel,
});

const parentRouteApi = getRouteApi("/sandboxes/$sandboxId");

function SandboxSnapshotsPanel() {
  const { sandbox } = parentRouteApi.useLoaderData() as { sandbox: SandboxResponse };
  const { snapshots: initial, workspace } = Route.useLoaderData();

  const [snapshots, setSnapshots] = useState<SnapshotResponse[]>(initial);
  const [deleteTarget, setDeleteTarget] = useState<SnapshotResponse | null>(null);

  useEffect(() => {
    setSnapshots(initial);
  }, [initial]);

  useEffect(() => {
    return snapshotEventBus.subscribe(sandbox.id, (event) => {
      setSnapshots((prev) =>
        prev.map((snapshot) => {
          if (snapshot.id !== event.snapshotId) return snapshot;
          if (event.type === "completed") {
            return {
              ...snapshot,
              status: SnapshotStatus.Ready,
              sizeBytes: event.sizeBytes,
              imageTag: event.imageTag ?? snapshot.imageTag,
            };
          }
          return {
            ...snapshot,
            status: SnapshotStatus.Failed,
            failureReason: event.reason,
          };
        }),
      );
    });
  }, [sandbox.id]);

  const handleDeleted = useCallback((snapshotId: string) => {
    setSnapshots((prev) => prev.filter((snapshot) => snapshot.id !== snapshotId));
    setDeleteTarget(null);
  }, []);

  const isEmpty = snapshots.length === 0;
  const sorted = useMemo(
    () => [...snapshots].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
    [snapshots],
  );

  return (
    <div className="flex flex-col gap-6">
      <TabHeader title="Snapshots">Point-in-time images of this sandbox you can restore from later.</TabHeader>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[4px] border-[0.5px] border-dash-border py-14">
          <img src="/icons/disk.svg" alt="" className="size-10 opacity-50 invert dark:invert-0" />
          <p className="max-w-[320px] text-center text-sm text-dash-text-faded">
            No snapshots yet — use the Snapshot button above to capture this sandbox's state.
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key="snapshots"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex flex-col overflow-hidden rounded-[4px] border-[0.5px] border-dash-border">
              {sorted.map((snapshot) => (
                <div key={snapshot.id} className="border-b-[0.5px] border-dash-border last:border-b-0">
                  <SnapshotRow
                    snapshot={snapshot}
                    sourceSandboxName={sandbox.name}
                    onDeleteRequest={setDeleteTarget}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {deleteTarget ? (
        <DeleteSnapshotModal
          open={Boolean(deleteTarget)}
          onOpenChange={(next) => {
            if (!next) setDeleteTarget(null);
          }}
          snapshot={deleteTarget}
          sourceSandboxName={sandbox.name}
          workspace={workspace}
          onDeleted={handleDeleted}
        />
      ) : null}
    </div>
  );
}
