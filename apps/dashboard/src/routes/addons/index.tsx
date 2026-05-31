import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import { LoaderCircle } from "lucide-react";
import { debounce, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { hapticToast as toast } from "@/utils/haptic-toast";
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
import { AddonsPending } from "@/components/shared/route-pending";
import { FeatureFlags, useFeatureFlagStrict } from "@/lib/feature-flags";

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
  loader: async () => {
    const [result, categories] = await Promise.all([
      (
        listMcpTemplatesServerFn as unknown as (input: {
          data?: { query?: string; limit?: number; offset?: number; category?: string };
        }) => Promise<McpServerListResult>
      )({
        data: {
          limit: ADDONS_PAGE_SIZE,
          offset: 0,
        },
      }),
      (listMcpCategoriesServerFn as unknown as () => Promise<string[]>)().catch(() => [] as string[]),
    ]);

    const addons = result.servers.map(mapMcpTemplateToAddon);
    const total = result.pagination.total ?? addons.length;
    const totalPages = Math.max(1, Math.ceil(total / ADDONS_PAGE_SIZE));

    return { addons, total, page: 1, totalPages, categories };
  },
  component: AddonsPage,
  pendingComponent: AddonsPending,
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
  const haptics = useHaptics();
  const mcpServersEnabled = useFeatureFlagStrict(FeatureFlags.ENABLE_MCP_SERVERS);
  const [{ q: searchQuery, page, category }, setSearchParams] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      page: parseAsInteger.withDefault(1),
      category: parseAsString.withDefault(""),
    },
    {
      history: "replace",
      clearOnDefault: true,
    },
  );
  const loaderData = Route.useLoaderData();
  const [addonData, setAddonData] = useState<{
    addons: DiscoverAddon[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    addons: loaderData.addons,
    total: loaderData.total,
    page: loaderData.page,
    totalPages: loaderData.totalPages,
  });
  const [isLoadingAddons, setIsLoadingAddons] = useState(false);
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const listMcpTemplates = useServerFn(listMcpTemplatesServerFn as any) as (input: {
    data?: { query?: string; limit?: number; offset?: number; category?: string };
  }) => Promise<McpServerListResult>;

  const activeCategory = category.trim() ? category.trim() : undefined;
  const displayAddons = addonData.addons;
  const displayTotal = addonData.total;
  const isSearchSettling = isLoadingAddons;
  const showBlockingLoader = isLoadingAddons && displayAddons.length === 0;

  useEffect(() => {
    setAddonData({
      addons: loaderData.addons,
      total: loaderData.total,
      page: loaderData.page,
      totalPages: loaderData.totalPages,
    });
  }, [loaderData.addons, loaderData.page, loaderData.total, loaderData.totalPages]);

  useEffect(() => {
    if (!mcpServersEnabled) {
      return;
    }

    let cancelled = false;
    const nextPage = page > 0 ? page : 1;
    const query = searchQuery.trim() || undefined;
    const nextCategory = activeCategory;
    const offset = (nextPage - 1) * ADDONS_PAGE_SIZE;

    setIsLoadingAddons(true);
    setLoadingPage(nextPage);

    void listMcpTemplates({
      data: {
        query,
        limit: ADDONS_PAGE_SIZE,
        offset,
        category: nextCategory,
      },
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        const addons = result.servers.map(mapMcpTemplateToAddon);
        const total = result.pagination.total ?? addons.length;
        const totalPages = Math.max(1, Math.ceil(total / ADDONS_PAGE_SIZE));

        setAddonData({
          addons,
          total,
          page: nextPage,
          totalPages,
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        toast.error("Unable to load MCP servers");
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setIsLoadingAddons(false);
        setLoadingPage(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeCategory, listMcpTemplates, mcpServersEnabled, page, searchQuery]);

  function selectCategory(cat?: string) {
    haptics.selection();
    const nextCategory = cat === activeCategory ? undefined : cat;
    if (nextCategory === activeCategory) {
      return;
    }

    void setSearchParams({
      category: nextCategory || "",
      page: 1,
    });
  }

  if (!mcpServersEnabled) {
    return (
      <div className="px-4 py-8 md:px-10">
        <div className="flex h-[50vh] flex-col items-center justify-center text-center">
          <h2 className="text-sm font-medium text-dash-text-strong">Discover is not available</h2>
          <p className="mt-1 max-w-[320px] text-sm text-dash-text-faded">MCP server discovery is not enabled for this workspace.</p>
        </div>
      </div>
    );
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
        <SearchFilterBar
          value={searchQuery}
          onChange={(nextSearchQuery) => {
            void setSearchParams(
              {
                q: nextSearchQuery,
                page: 1,
              },
              {
                limitUrlUpdates: debounce(300),
              },
            );
          }}
          placeholder="Search MCP servers..."
          loading={isSearchSettling}
        />
      </div>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          {showBlockingLoader ? (
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
              key={`grid-${activeCategory ?? "all"}-${searchQuery}-${addonData.page}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <AddonGrid items={displayAddons} />
              {addonData.totalPages > 1 && (
                <div className="mt-6 flex justify-end">
                  <NumberPagination
                    currentPage={addonData.page}
                    totalPages={addonData.totalPages}
                    isLoading={isLoadingAddons && !showBlockingLoader}
                    loadingPage={loadingPage}
                    onPageChange={(nextPage) => {
                      void setSearchParams({
                        page: nextPage,
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
