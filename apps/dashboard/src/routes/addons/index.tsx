import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { LoaderCircle } from "lucide-react";
import { SearchFilterBar } from "../../components/shared/search-filter-bar";
import { DashButton } from "../../components/shared/dash-button";
import { AddonCard } from "../../components/shared/addon-card";
import { NumberPagination } from "../../components/shared/pagination";
import type { DiscoverAddon } from "@/utils/discover-mcp";
import { mapMcpTemplateToAddon } from "@/utils/discover-mcp";
import { listMcpTemplatesServerFn, listMcpCategoriesServerFn } from "@/server/mcp/actions";
import type { McpServerListResult } from "@/backend/mcp";
import { parsePositivePageSearchValue, parseTextSearchValue } from "@/utils/workspace-route-search";
import { useHaptics } from "@/hooks/use-haptics";

const ADDONS_PAGE_SIZE = 18;

export const Route = createFileRoute("/addons/")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  validateSearch: (search: Record<string, unknown>) => {
    const next: { page?: number; category?: string; q?: string } = {};
    const page = parsePositivePageSearchValue(search.page);
    const q = parseTextSearchValue(search.q);
    if (page && page > 1) next.page = page;
    if (typeof search.category === "string" && search.category.trim()) {
      next.category = search.category.trim();
    }
    if (q) next.q = q;
    return next;
  },
  loaderDeps: ({ search }) => ({
    page: parsePositivePageSearchValue(search.page) ?? 1,
    category: parseTextSearchValue(search.category),
    q: parseTextSearchValue(search.q),
  }),
  loader: async ({ deps }) => {
    const page = deps.page;
    const offset = (page - 1) * ADDONS_PAGE_SIZE;

    const [result, categories] = await Promise.all([
      (
        listMcpTemplatesServerFn as unknown as (input: {
          data?: { query?: string; limit?: number; offset?: number; category?: string };
        }) => Promise<McpServerListResult>
      )({
        data: {
          query: deps.q,
          limit: ADDONS_PAGE_SIZE,
          offset,
          category: deps.category,
        },
      }),
      (listMcpCategoriesServerFn as unknown as () => Promise<string[]>)().catch(() => [] as string[]),
    ]);

    const addons = result.servers.map(mapMcpTemplateToAddon);
    const total = result.pagination.total ?? addons.length;
    const totalPages = Math.max(1, Math.ceil(total / ADDONS_PAGE_SIZE));

    return { addons, total, page, totalPages, categories };
  },
  component: AddonsPage,
});

const ease = [0.16, 1, 0.3, 1] as const;

function AddonGrid({ items, delayOffset = 0 }: { items: DiscoverAddon[]; delayOffset?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((addon, i) => (
        <motion.div
          key={addon.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.04 * (i + delayOffset), ease }}
        >
          <AddonCard addon={addon} />
        </motion.div>
      ))}
    </div>
  );
}

function AddonsPage() {
  const navigate = useNavigate({ from: "/addons/" });
  const haptics = useHaptics();
  const routeSearch = Route.useSearch();
  const [searchQuery, setSearchQuery] = useState(routeSearch.q ?? "");
  const loaderData = Route.useLoaderData();
  const isRouterLoading = useRouterState({ select: (s) => s.isLoading });
  const pendingSearch = useRouterState({
    select: (s) => {
      const pending = s.pendingLocation ?? s.location;
      const pendingSearchRow = pending.search as Record<string, unknown>;
      return {
        q: parseTextSearchValue(pendingSearchRow.q),
        category: parseTextSearchValue(pendingSearchRow.category),
      };
    },
  });
  const pendingPage = useRouterState({
    select: (s) => {
      const pending = s.pendingLocation ?? s.location;
      return parsePositivePageSearchValue((pending.search as Record<string, unknown>)?.page) ?? 1;
    },
  });

  const activeCategory = routeSearch.category ?? undefined;
  const displayAddons = loaderData.addons;
  const displayTotal = loaderData.total;
  const settledSearchQuery = routeSearch.q?.trim() ?? "";
  const pendingSearchQuery = searchQuery.trim();
  const isSearchSettling = pendingSearchQuery !== settledSearchQuery;
  const isSearchOrCategoryLoading =
    isRouterLoading &&
    ((pendingSearch.q ?? undefined) !== (routeSearch.q ?? undefined) ||
      (pendingSearch.category ?? undefined) !== (routeSearch.category ?? undefined));

  function buildAddonsSearch(next: { page?: number; category?: string; q?: string }) {
    return {
      page: next.page,
      category: next.category,
      q: next.q,
    };
  }

  useEffect(() => {
    setSearchQuery(routeSearch.q ?? "");
  }, [routeSearch.q]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextQ = searchQuery.trim() || undefined;
      if ((routeSearch.q ?? undefined) === nextQ) {
        return;
      }

      void navigate({
        to: "/addons/",
        replace: true,
        search: buildAddonsSearch({
          category: routeSearch.category,
          q: nextQ,
          page: undefined,
        }),
      });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [navigate, routeSearch.category, routeSearch.q, searchQuery]);

  function selectCategory(cat?: string) {
    haptics.selection();
    const nextCategory = cat === activeCategory ? undefined : cat;
    if (nextCategory === activeCategory) {
      return;
    }

    void navigate({
      to: "/addons/",
      search: buildAddonsSearch({
        category: nextCategory,
        q: routeSearch.q,
        page: undefined,
      }),
    });
  }

  return (
    <div className="px-4 py-8 md:px-10">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease }}
        className="relative overflow-clip rounded-[4px] border-[0.5px] border-dash-border-soft"
      >
        <div className="relative z-10 px-8 py-8">
          <h2 className="text-base font-medium tracking-[-0.03px] text-dash-text-strong">Discover MCP Servers</h2>
          <p className="mt-1 max-w-[560px] text-sm font-light leading-[1.3] text-dash-text-extra-faded">
            Browse deployable MCP servers from the marketplace and connect them to your Brimble projects.
          </p>
          <div className="mt-4">
            <DashButton size="sm" disabled>
              {displayTotal} server{displayTotal === 1 ? "" : "s"} available
            </DashButton>
          </div>
        </div>
        <img
          src="/images/addons-curve.svg"
          alt=""
          className="pointer-events-none absolute right-0 top-0 hidden h-full lg:block dark:brightness-[3]"
        />
      </motion.div>

      {loaderData.categories.length > 0 && (
        <div className="scrollbar-hidden mt-5 flex gap-2 overflow-x-auto">
          <button
            onClick={() => selectCategory(undefined)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors ${
              !activeCategory ? "bg-dash-text-strong text-dash-bg" : "bg-dash-bg-elevated text-dash-text-faded hover:text-dash-text-body"
            }`}
          >
            All
          </button>
          {loaderData.categories.map((cat) => (
            <button
              key={cat}
              onClick={() => selectCategory(cat)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs capitalize transition-colors ${
                activeCategory === cat
                  ? "bg-dash-text-strong text-dash-bg"
                  : "bg-dash-bg-elevated text-dash-text-faded hover:text-dash-text-body"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        <SearchFilterBar value={searchQuery} onChange={setSearchQuery} placeholder="Search MCP servers..." loading={isSearchSettling} />
      </div>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          {isSearchOrCategoryLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center justify-center gap-3 py-16"
            >
              <LoaderCircle className="size-5 animate-spin text-dash-text-faded" />
              <p className="text-sm text-dash-text-faded">Loading servers...</p>
            </motion.div>
          ) : displayAddons.length ? (
            <motion.div
              key={`grid-${activeCategory ?? "all"}-${routeSearch.q ?? ""}-${loaderData.page}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <AddonGrid items={displayAddons} />
              {loaderData.totalPages > 1 && (
                <div className="mt-6 flex justify-end">
                  <NumberPagination
                    currentPage={loaderData.page}
                    totalPages={loaderData.totalPages}
                    isLoading={isRouterLoading}
                    loadingPage={isRouterLoading ? pendingPage : null}
                    onPageChange={(nextPage) => {
                      navigate({
                        to: "/addons/",
                        search: buildAddonsSearch({
                          category: routeSearch.category,
                          q: routeSearch.q,
                          page: nextPage === 1 ? undefined : nextPage,
                        }),
                      });
                    }}
                  />
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="py-12 text-center text-sm text-dash-text-faded"
            >
              No MCP servers match your search.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
