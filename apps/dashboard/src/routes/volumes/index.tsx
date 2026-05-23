import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import * as Yup from "yup";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { VolumesPending } from "@/components/shared/route-pending";
import { consumePendingVolumesAction } from "@/utils/topbar-navigation";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { FilterDropdown, type FilterOption } from "@/components/shared/filter-dropdown";
import { NumberPagination } from "@/components/shared/pagination";
import { useHaptics } from "@/hooks/use-haptics";
import { VolumeRow } from "@/components/volumes/volume-row";
import { CreateVolumeModal } from "@/components/volumes/create-volume-modal";
import { DeleteVolumeModal } from "@/components/volumes/delete-volume-modal";
import { SnapshotRow } from "@/components/sandboxes/snapshot-row";
import { DeleteSnapshotModal } from "@/components/sandboxes/delete-snapshot-modal";
import { VolumeType, type PaginatedVolumesResponse, type VolumeResponse } from "@/backend/volumes";
import type { PaginatedSnapshotsResponse, SnapshotResponse } from "@/backend/sandboxes";
import type { Region } from "@/backend/regions";
import { listRegionsServerFn } from "@/server/regions/actions";
import { listVolumesServerFn } from "@/server/volumes/actions";
import { listSandboxSnapshotsServerFn } from "@/server/sandboxes/actions";
import { workspaceLoaderDeps } from "@/utils/workspace-route-search";

const FOCUS_HIGHLIGHT_MS = 2000;

type TabKey = "volumes" | "snapshots";

const VOLUMES_PAGE_SIZE = 10;
const SNAPSHOTS_PAGE_SIZE = 10;

interface VolumesSearch {
  workspace?: string;
  focus?: string;
  create?: boolean;
  type?: VolumeType;
  region?: string;
  tab?: TabKey;
  page?: number;
  snapshotsPage?: number;
}

const volumesSearchSchema = Yup.object({
  workspace: Yup.string().trim(),
  focus: Yup.string().trim(),
  create: Yup.boolean(),
  type: Yup.mixed<VolumeType>().oneOf(Object.values(VolumeType)),
  region: Yup.string().trim(),
  tab: Yup.mixed<TabKey>().oneOf(["volumes", "snapshots"]),
  page: Yup.number().integer().min(1),
  snapshotsPage: Yup.number().integer().min(1),
});

type StatusFilter = "all" | "attached" | "detached";
type SnapshotStatusFilter = "all" | "ready" | "creating" | "failed";

const STATUS_OPTIONS: FilterOption[] = [
  { label: "All volumes", value: "all" },
  { label: "Attached", value: "attached", dot: "#13d282" },
  { label: "Detached", value: "detached", dot: "#9ca3af" },
];

const SNAPSHOT_STATUS_OPTIONS: FilterOption[] = [
  { label: "All snapshots", value: "all" },
  { label: "Ready", value: "ready", dot: "#13d282" },
  { label: "Creating", value: "creating", dot: "#ff7a00" },
  { label: "Failed", value: "failed", dot: "#fc391e" },
];

export const Route = createFileRoute("/volumes/")({
  pendingComponent: VolumesPending,
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  validateSearch: (search: Record<string, unknown>): VolumesSearch =>
    volumesSearchSchema.validateSync(search, { stripUnknown: true }) as VolumesSearch,
  loaderDeps: ({ search }) => ({
    ...workspaceLoaderDeps(search),
    page: search.page ?? 1,
    snapshotsPage: search.snapshotsPage ?? 1,
  }),
  loader: async ({ deps }) => {
    const workspace = deps.workspace;

    const [volumesResult, regions, snapshotsResult] = await Promise.all([
      (listVolumesServerFn as unknown as (input: {
        data: { workspace?: string; page?: number; limit?: number };
      }) => Promise<PaginatedVolumesResponse>)({
        data: { workspace, page: deps.page, limit: VOLUMES_PAGE_SIZE },
      }),
      (listRegionsServerFn as unknown as (input: { data: { type: "sandbox"; enabled: boolean; workspace?: string } }) => Promise<Region[]>)({
        data: { type: "sandbox", enabled: true, workspace },
      }),
      (listSandboxSnapshotsServerFn as unknown as (input: {
        data: { workspace?: string; page?: number; limit?: number };
      }) => Promise<PaginatedSnapshotsResponse>)({
        data: { workspace, page: deps.snapshotsPage, limit: SNAPSHOTS_PAGE_SIZE },
      }),
    ]);

    return {
      workspace,
      volumesPage: volumesResult,
      regions,
      snapshotsPage: snapshotsResult,
    };
  },
  component: VolumesListPage,
});

function VolumesListPage() {
  const loaderData = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const haptics = useHaptics();
  const workspace = loaderData.workspace;
  const activeTab: TabKey = search.tab ?? "volumes";

  const listVolumes = useServerFn(listVolumesServerFn);
  const listSnapshots = useServerFn(listSandboxSnapshotsServerFn);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [snapshotQuery, setSnapshotQuery] = useState("");
  const [snapshotStatusFilter, setSnapshotStatusFilter] = useState<SnapshotStatusFilter>("all");
  const [volumes, setVolumes] = useState<VolumeResponse[]>(loaderData.volumesPage.items);
  const [volumesTotalPages, setVolumesTotalPages] = useState<number>(loaderData.volumesPage.totalPages);
  const [regions, setRegions] = useState<Region[]>(loaderData.regions);
  const [snapshots, setSnapshots] = useState<SnapshotResponse[]>(loaderData.snapshotsPage.items);
  const [snapshotsTotalPages, setSnapshotsTotalPages] = useState<number>(loaderData.snapshotsPage.totalPages);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VolumeResponse | null>(null);
  const [deleteSnapshotTarget, setDeleteSnapshotTarget] = useState<SnapshotResponse | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const volumesPage = search.page ?? 1;
  const snapshotsPage = search.snapshotsPage ?? 1;

  function switchTab(next: TabKey) {
    if (next === activeTab) return;
    haptics.selection();
    void navigate({
      search: (prev: VolumesSearch) => ({ ...prev, tab: next === "volumes" ? undefined : next }),
      replace: true,
    });
  }

  function handleVolumesPageChange(nextPage: number) {
    if (nextPage < 1 || nextPage === volumesPage || nextPage > volumesTotalPages) return;
    void navigate({
      to: "/volumes",
      search: { ...search, page: nextPage === 1 ? undefined : nextPage } as VolumesSearch,
    });
  }

  function handleSnapshotsPageChange(nextPage: number) {
    if (nextPage < 1 || nextPage === snapshotsPage || nextPage > snapshotsTotalPages) return;
    void navigate({
      to: "/volumes",
      search: { ...search, snapshotsPage: nextPage === 1 ? undefined : nextPage } as VolumesSearch,
    });
  }

  useEffect(() => {
    setVolumes(loaderData.volumesPage.items);
    setVolumesTotalPages(loaderData.volumesPage.totalPages);
    setRegions(loaderData.regions);
    setSnapshots(loaderData.snapshotsPage.items);
    setSnapshotsTotalPages(loaderData.snapshotsPage.totalPages);
  }, [loaderData.volumesPage, loaderData.regions, loaderData.snapshotsPage]);

  useEffect(() => {
    if (search.create || consumePendingVolumesAction() === "create-volume") {
      setCreateOpen(true);
    }

    const handler = () => setCreateOpen(true);
    window.addEventListener("brimble:create-volume", handler);
    return () => window.removeEventListener("brimble:create-volume", handler);
  }, [search.create]);

  useEffect(() => {
    if (!search.focus) return;
    const element = rowRefs.current.get(search.focus);
    if (!element) return;
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightedId(search.focus);
    const timer = window.setTimeout(() => {
      setHighlightedId(null);
      void navigate({
        search: (prev: VolumesSearch) => {
          const { focus: _focus, ...rest } = prev;
          return rest;
        },
        replace: true,
      });
    }, FOCUS_HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [search.focus, navigate, volumes]);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      if (!active || document.visibilityState !== "visible") {
        return;
      }

      try {
        const result = await listVolumes({ data: { workspace, page: volumesPage, limit: VOLUMES_PAGE_SIZE } });
        if (!active) {
          return;
        }
        setVolumes(result.items);
        setVolumesTotalPages(result.totalPages);
      } catch {
        // polling failures are non-blocking; keep cached rows visible
      }
    };

    const interval = window.setInterval(() => {
      void poll();
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [listVolumes, workspace, volumesPage]);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      if (!active || document.visibilityState !== "visible") return;
      try {
        const result = await listSnapshots({ data: { workspace, page: snapshotsPage, limit: SNAPSHOTS_PAGE_SIZE } });
        if (!active) return;
        setSnapshots(result.items);
        setSnapshotsTotalPages(result.totalPages);
      } catch {
        // keep last-good snapshots on transient failures
      }
    };

    const interval = window.setInterval(() => {
      void poll();
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [listSnapshots, workspace, snapshotsPage]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return volumes.filter((volume) => {
      const isAttached = Boolean(volume.attachedSandboxId || volume.attachedProjectId);
      if (statusFilter === "attached" && !isAttached) return false;
      if (statusFilter === "detached" && isAttached) return false;
      if (!q) return true;
      const regionName = volume.region?.name?.toLowerCase() ?? "";
      return volume.name.toLowerCase().includes(q) || regionName.includes(q);
    });
  }, [query, statusFilter, volumes]);

  const handleCreated = useCallback((volume: VolumeResponse) => {
    setVolumes((prev) => [volume, ...prev.filter((existing) => existing.id !== volume.id)]);
  }, []);

  const handleDeleted = useCallback((volumeId: string) => {
    setVolumes((prev) => prev.filter((volume) => volume.id !== volumeId));
    setDeleteTarget(null);
  }, []);

  const filteredSnapshots = useMemo(() => {
    const q = snapshotQuery.trim().toLowerCase();
    return snapshots
      .filter((snapshot) => {
        if (snapshotStatusFilter !== "all" && snapshot.status !== snapshotStatusFilter) return false;
        if (!q) return true;
        return snapshot.name.toLowerCase().includes(q) || snapshot.sourceTemplate.toLowerCase().includes(q);
      })
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [snapshots, snapshotQuery, snapshotStatusFilter]);

  const handleSnapshotDeleted = useCallback((snapshotId: string) => {
    setSnapshots((prev) => prev.filter((snapshot) => snapshot.id !== snapshotId));
    setDeleteSnapshotTarget(null);
  }, []);

  const isEmpty = volumes.length === 0;
  const snapshotsEmpty = snapshots.length === 0;

  let emptyMessage = "No volumes match your filters.";
  if (query.trim()) {
    emptyMessage = `No volumes found for "${query.trim()}".`;
  } else if (statusFilter !== "all") {
    emptyMessage = "No volumes match this status.";
  }

  let snapshotsEmptyMessage = "No snapshots match your filters.";
  if (snapshotQuery.trim()) {
    snapshotsEmptyMessage = `No snapshots found for "${snapshotQuery.trim()}".`;
  } else if (snapshotStatusFilter !== "all") {
    snapshotsEmptyMessage = "No snapshots match this status.";
  }

  return (
    <div className="max-w-[1000px]">
      <PageHeader title="Volumes & Snapshots" image="/images/pepper.svg">
        Persistent storage and re-runnable sandbox images. Manage your block volumes and the snapshots you've taken from sandboxes.
      </PageHeader>

      <div className="mb-5 inline-flex items-center rounded-[4px] border-[0.5px] border-dash-border p-0.5">
        {(["volumes", "snapshots"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => switchTab(tab)}
            className={`shrink-0 whitespace-nowrap rounded-[3px] px-3 py-1 text-xs font-medium transition-colors ${
              tab === activeTab ? "bg-dash-bg-elevated text-dash-text-strong" : "text-dash-text-faded hover:text-dash-text-body"
            }`}
          >
            {tab === "volumes" ? "Volumes" : "Snapshots"}
          </button>
        ))}
      </div>

      {activeTab === "volumes" ? (
        <>
          <div className="mb-4">
            <SearchFilterBar
              value={query}
              onChange={setQuery}
              placeholder="Search volumes"
              rightSlot={
                <FilterDropdown
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as StatusFilter)}
                  options={STATUS_OPTIONS}
                  placeholder="All volumes"
                  dropdownWidth={180}
                />
              }
            />
          </div>

          {isEmpty ? (
            <div className="mt-4 flex flex-col items-center justify-center gap-3 py-14">
              <img src="/icons/storage.svg" alt="" className="size-10 opacity-50 invert dark:invert-0" />
              <p className="max-w-[320px] text-center text-sm text-dash-text-faded">
                You don't have any volumes yet. Volumes let you keep data across sandbox and project restarts.
              </p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex h-[34px] items-center gap-1.5 rounded-[4px] border border-[#232931] bg-gradient-to-b from-[#545459] via-[#45454b] to-[#2d2d32] px-3 text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-opacity hover:opacity-90"
              >
                <Plus className="size-3.5" />
                Create volume
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${query}:${statusFilter}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {filtered.length > 0 ? (
                  <div className="flex flex-col overflow-hidden rounded-[4px] border-[0.5px] border-dash-border">
                    {filtered.map((volume) => (
                      <div
                        key={volume.id}
                        ref={(el) => {
                          if (el) rowRefs.current.set(volume.id, el);
                          else rowRefs.current.delete(volume.id);
                        }}
                        className={`border-b-[0.5px] border-dash-border transition-shadow last:border-b-0 ${
                          highlightedId === volume.id ? "rounded-[4px] ring-2 ring-[#4879f8]" : ""
                        }`}
                      >
                        <VolumeRow volume={volume} onDeleteRequest={setDeleteTarget} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col items-center justify-center py-10">
                    <img src="/icons/storage.svg" alt="" className="mb-2 size-10 opacity-50 invert dark:invert-0" />
                    <span className="text-sm text-dash-text-faded">{emptyMessage}</span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {volumesTotalPages > 1 ? (
            <div className="mt-6 flex justify-end">
              <NumberPagination
                currentPage={volumesPage}
                totalPages={volumesTotalPages}
                onPageChange={handleVolumesPageChange}
              />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="mb-4">
            <SearchFilterBar
              value={snapshotQuery}
              onChange={setSnapshotQuery}
              placeholder="Search snapshots"
              rightSlot={
                <FilterDropdown
                  value={snapshotStatusFilter}
                  onChange={(value) => setSnapshotStatusFilter(value as SnapshotStatusFilter)}
                  options={SNAPSHOT_STATUS_OPTIONS}
                  placeholder="All snapshots"
                  dropdownWidth={180}
                />
              }
            />
          </div>

          {snapshotsEmpty ? (
            <div className="mt-4 flex flex-col items-center justify-center gap-3 py-14">
              <img src="/icons/disk.svg" alt="" className="size-10 opacity-50 invert dark:invert-0" />
              <p className="max-w-[360px] text-center text-sm text-dash-text-faded">
                No snapshots yet — open a sandbox and use its Snapshot button to capture its state.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${snapshotQuery}:${snapshotStatusFilter}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {filteredSnapshots.length > 0 ? (
                  <div className="flex flex-col overflow-hidden rounded-[4px] border-[0.5px] border-dash-border">
                    {filteredSnapshots.map((snapshot) => (
                      <div key={snapshot.id} className="border-b-[0.5px] border-dash-border last:border-b-0">
                        <SnapshotRow snapshot={snapshot} onDeleteRequest={setDeleteSnapshotTarget} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col items-center justify-center py-10">
                    <img src="/icons/disk.svg" alt="" className="mb-2 size-10 opacity-50 invert dark:invert-0" />
                    <span className="text-sm text-dash-text-faded">{snapshotsEmptyMessage}</span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {snapshotsTotalPages > 1 ? (
            <div className="mt-6 flex justify-end">
              <NumberPagination
                currentPage={snapshotsPage}
                totalPages={snapshotsTotalPages}
                onPageChange={handleSnapshotsPageChange}
              />
            </div>
          ) : null}
        </>
      )}

      <CreateVolumeModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        regions={regions}
        workspace={workspace}
        defaultType={search.type}
        defaultRegion={search.region}
        onCreated={handleCreated}
      />

      {deleteTarget ? (
        <DeleteVolumeModal
          open={Boolean(deleteTarget)}
          onOpenChange={(next) => {
            if (!next) setDeleteTarget(null);
          }}
          volume={deleteTarget}
          workspace={workspace}
          onDeleted={handleDeleted}
        />
      ) : null}

      {deleteSnapshotTarget ? (
        <DeleteSnapshotModal
          open={Boolean(deleteSnapshotTarget)}
          onOpenChange={(next) => {
            if (!next) setDeleteSnapshotTarget(null);
          }}
          snapshot={deleteSnapshotTarget}
          workspace={workspace}
          onDeleted={handleSnapshotDeleted}
        />
      ) : null}
    </div>
  );
}
