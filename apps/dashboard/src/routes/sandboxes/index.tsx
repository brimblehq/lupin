import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import { Cube } from "@phosphor-icons/react";
import { SandboxStatus } from "@/backend/sandboxes";
import type { PaginatedSandboxesResponse, SandboxResponse } from "@/backend/sandboxes";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { FilterDropdown, type FilterOption } from "@/components/shared/filter-dropdown";
import { NumberPagination } from "@/components/shared/pagination";
import { CreateSandboxCard } from "@/components/sandboxes/create-sandbox-card";
import { SandboxCard } from "@/components/sandboxes/sandbox-card";
import { SandboxIntroModal } from "@/components/sandboxes/sandbox-intro-modal";
import type { Region } from "@/backend/regions";
import { buildRegionLabel } from "@/lib/regions/format";
import { listRegionsServerFn } from "@/server/regions/actions";
import { listSandboxesServerFn } from "@/server/sandboxes/actions";
import { usePlanGate } from "@/hooks/use-plan-gate";
import { parsePositivePageSearchValue, parseTextSearchValue, parseWorkspaceSearchValue } from "@/utils/workspace-route-search";

const SANDBOXES_PAGE_LIMIT = 9;

export const Route = createFileRoute("/sandboxes/")({
  staleTime: 0,
  preloadStaleTime: 0,
  validateSearch: (search: Record<string, unknown>) => {
    const next: { page?: number; workspace?: string; search?: string } = {};
    const workspace = parseWorkspaceSearchValue(search.workspace);
    const page = parsePositivePageSearchValue(search.page);
    const searchQuery = parseTextSearchValue(search.search);
    if (workspace) next.workspace = workspace;
    if (page) next.page = page;
    if (searchQuery) next.search = searchQuery;
    return next;
  },
  loaderDeps: ({ search }) => ({
    page: parsePositivePageSearchValue(search.page) ?? 1,
    workspace: parseWorkspaceSearchValue(search.workspace),
    search: parseTextSearchValue(search.search),
  }),
  loader: async ({ deps }) => {
    const workspace = deps.workspace;
    const search = deps.search;

    const [sandboxesResult, regions] = await Promise.all([
      (
        listSandboxesServerFn as unknown as (input: {
          data: { page?: number; limit?: number; search?: string; workspace?: string };
        }) => Promise<PaginatedSandboxesResponse>
      )({
        data: { page: deps.page, limit: SANDBOXES_PAGE_LIMIT, ...(search ? { search } : {}), workspace },
      }),
      (listRegionsServerFn as unknown as (input: { data: { type: "sandbox"; enabled: boolean; workspace?: string } }) => Promise<Region[]>)(
        {
          data: { type: "sandbox", enabled: true, workspace },
        },
      ),
    ]);

    const regionLabels: Record<string, string> = {};
    for (const region of regions) {
      if (region.id) {
        regionLabels[region.id] = buildRegionLabel(region);
      }
    }

    return {
      workspace,
      search,
      sandboxes: sandboxesResult.items,
      regionLabels,
      pagination: {
        currentPage: sandboxesResult.currentPage,
        totalPages: sandboxesResult.totalPages,
      },
    };
  },
  component: SandboxesListPage,
});

const STATUS_OPTIONS: FilterOption[] = [
  { label: "All statuses", value: "all" },
  { label: "Ready", value: SandboxStatus.Ready, dot: "#13d282" },
  { label: "Starting", value: SandboxStatus.Starting, dot: "#4879f8" },
  { label: "Paused", value: SandboxStatus.Paused, dot: "#ff7a00" },
  { label: "Pausing", value: SandboxStatus.Pausing, dot: "#ff7a00" },
  { label: "Resuming", value: SandboxStatus.Resuming, dot: "#ff7a00" },
  { label: "Failed", value: SandboxStatus.Failed, dot: "#fc391e" },
  { label: "Destroyed", value: SandboxStatus.Destroyed, dot: "#ef4444" },
];

type StatusFilter = "all" | SandboxStatus;
const SANDBOX_LIST_REFRESH_INTERVAL_MS = 30_000;

function SandboxesListPage() {
  const loaderData = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/sandboxes/" });
  const workspace = loaderData.workspace;

  const isRouterLoading = useRouterState({ select: (s) => s.isLoading });
  const pendingPage = useRouterState({
    select: (s) => {
      const activeSearch = (s.location.search ?? s.resolvedLocation?.search) as Record<string, unknown> | undefined;
      return parsePositivePageSearchValue(activeSearch?.page) ?? 1;
    },
  });

  const listSandboxes = useServerFn(listSandboxesServerFn);
  const { sandboxMaxCount } = usePlanGate();

  const [query, setQuery] = useState(loaderData.search ?? "");
  const [activeSearch, setActiveSearch] = useState(loaderData.search ?? "");
  const [isSearching, setIsSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sandboxes, setSandboxes] = useState<SandboxResponse[]>(loaderData.sandboxes);
  const [regionLabels, setRegionLabels] = useState<Record<string, string>>(loaderData.regionLabels);
  const [pagination, setPagination] = useState(loaderData.pagination);

  const provisionedCount = useMemo(() => sandboxes.filter((sandbox) => sandbox.status !== SandboxStatus.Destroyed).length, [sandboxes]);
  const atLimit = sandboxMaxCount > 0 && provisionedCount >= sandboxMaxCount;

  useEffect(() => {
    setSandboxes(loaderData.sandboxes);
    setRegionLabels(loaderData.regionLabels);
    setPagination(loaderData.pagination);
    setActiveSearch(loaderData.search ?? "");
    setQuery(loaderData.search ?? "");
  }, [loaderData.pagination, loaderData.regionLabels, loaderData.sandboxes, loaderData.search]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      const trimmedQuery = query.trim();
      if (trimmedQuery === activeSearch) {
        return;
      }

      setIsSearching(true);

      void listSandboxes({
        data: {
          page: 1,
          limit: SANDBOXES_PAGE_LIMIT,
          ...(trimmedQuery ? { search: trimmedQuery } : {}),
          workspace,
        },
      })
        .then((sandboxResult) => {
          if (!active) {
            return;
          }
          setSandboxes(sandboxResult.items);
          setPagination({ currentPage: sandboxResult.currentPage, totalPages: sandboxResult.totalPages });
          setActiveSearch(trimmedQuery);
        })
        .catch(() => {
          // keep current rows visible on search failure
        })
        .finally(() => {
          if (active) {
            setIsSearching(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [activeSearch, listSandboxes, query, workspace]);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      if (!active || document.visibilityState !== "visible") {
        return;
      }

      try {
        const sandboxResult = await listSandboxes({
          data: {
            page: pagination.currentPage,
            limit: SANDBOXES_PAGE_LIMIT,
            ...(activeSearch ? { search: activeSearch } : {}),
            workspace,
          },
        });
        if (!active) {
          return;
        }

        setSandboxes(sandboxResult.items);
        setPagination({ currentPage: sandboxResult.currentPage, totalPages: sandboxResult.totalPages });
      } catch {
        // polling failures are non-blocking; keep cached rows visible
      }
    };

    void poll();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    };
    const onFocus = () => {
      void poll();
    };

    const interval = window.setInterval(() => {
      void poll();
    }, SANDBOX_LIST_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [activeSearch, listSandboxes, pagination.currentPage, workspace]);

  function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage === pagination.currentPage || nextPage > pagination.totalPages) {
      return;
    }

    void navigate({
      to: "/sandboxes",
      search: {
        ...(search.workspace ? { workspace: search.workspace } : {}),
        ...(activeSearch ? { search: activeSearch } : {}),
        ...(nextPage > 1 ? { page: nextPage } : {}),
      },
    });
  }

  const filtered = useMemo(() => {
    return sandboxes.filter((sandbox) => {
      if (statusFilter !== "all" && sandbox.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [sandboxes, statusFilter]);

  let emptyMessage = "No sandboxes yet — spin one up to get started.";
  if (activeSearch) {
    emptyMessage = `No sandboxes found for "${activeSearch}".`;
  } else if (statusFilter !== "all") {
    emptyMessage = "No sandboxes match this status.";
  }

  return (
    <>
      <div className="mb-4">
        <SearchFilterBar
          value={query}
          onChange={setQuery}
          placeholder="Search sandboxes"
          loading={isSearching}
          rightSlot={
            <FilterDropdown
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={STATUS_OPTIONS}
              placeholder="All Statuses"
              dropdownWidth={180}
            />
          }
        />
      </div>

      <div className="mb-4">
        <CreateSandboxCard
          className="col-span-full"
          disabled={atLimit}
          disabledMessage={
            atLimit
              ? `You've reached the maximum sandboxes for your plan (${provisionedCount}/${sandboxMaxCount}). Destroy one to create another.`
              : undefined
          }
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${query}:${statusFilter}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((sandbox) => (
              <motion.div layout key={sandbox.id}>
                <SandboxCard sandbox={sandbox} regionLabel={regionLabels[sandbox.region]} />
              </motion.div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center py-10">
              <Cube size={40} weight="fill" className="mb-2 text-dash-text-faded/50" />
              <span className="text-sm text-dash-text-faded">{emptyMessage}</span>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex justify-end">
        <NumberPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
          isLoading={isRouterLoading}
          loadingPage={isRouterLoading ? pendingPage : null}
        />
      </div>

      <SandboxIntroModal />
    </>
  );
}
