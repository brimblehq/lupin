import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { LoaderCircle } from "lucide-react";
import { SearchFilterBar } from "../../components/shared/search-filter-bar";
import { DashButton } from "../../components/shared/dash-button";
import { AddonCard } from "../../components/shared/addon-card";
import { NumberPagination } from "../../components/shared/pagination";
import type { DiscoverAddon } from "@/utils/discover-mcp";
import { mapMcpTemplateToAddon } from "@/utils/discover-mcp";
import { listMcpTemplatesServerFn, listMcpCategoriesServerFn } from "@/server/mcp/actions";
import type { McpServerListResult } from "@/backend/mcp";
import { parsePositivePageSearchValue } from "@/utils/workspace-route-search";
import { useHaptics } from "@/hooks/use-haptics";

const ADDONS_PAGE_SIZE = 18;

export const Route = createFileRoute("/addons/")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  validateSearch: (search: Record<string, unknown>) => {
    const next: { page?: number; category?: string } = {};
    const page = parsePositivePageSearchValue(search.page);
    if (page && page > 1) next.page = page;
    if (typeof search.category === "string" && search.category.trim()) {
      next.category = search.category.trim();
    }
    return next;
  },
  loaderDeps: ({ search }) => ({
    page: parsePositivePageSearchValue(search.page) ?? 1,
    category: typeof search.category === "string" ? search.category.trim() : undefined,
  }),
  loader: async ({ deps }) => {
    const page = deps.page;
    const offset = (page - 1) * ADDONS_PAGE_SIZE;

    const [result, categories] = await Promise.all([
      (listMcpTemplatesServerFn as unknown as (input: {
        data?: { limit?: number; offset?: number; category?: string };
      }) => Promise<McpServerListResult>)({
        data: {
          limit: ADDONS_PAGE_SIZE,
          offset,
          category: deps.category,
        },
      }),
      (listMcpCategoriesServerFn as unknown as () => Promise<string[]>)().catch(
        () => [] as string[],
      ),
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
  const [search, setSearch] = useState("");
  const routeSearch = Route.useSearch();
  const { addons, total, page, totalPages, categories } = Route.useLoaderData();
  const activeCategory = routeSearch.category ?? undefined;
  const isLoading = useRouterState({ select: (s) => s.isLoading });
  const pendingPage = useRouterState({
    select: (s) => {
      const pending = s.pendingLocation ?? s.location;
      return parsePositivePageSearchValue(
        (pending.search as Record<string, unknown>)?.page,
      ) ?? 1;
    },
  });

  const filteredAddons = useMemo(() => {
    if (!search.trim()) return addons;
    const q = search.trim().toLowerCase();
    return addons.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q),
    );
  }, [addons, search]);

  function selectCategory(cat?: string) {
    haptics.selection();
    navigate({
      to: "/addons",
      search: {
        category: cat,
        page: undefined,
      },
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
          <h2 className="text-base font-medium tracking-[-0.03px] text-dash-text-strong">
            Discover MCP Servers
          </h2>
          <p className="mt-1 max-w-[560px] text-sm font-light leading-[1.3] text-dash-text-extra-faded">
            Browse deployable MCP servers from the marketplace and connect them to your Brimble
            projects.
          </p>
          <div className="mt-4">
            <DashButton size="sm" disabled>
              {total} server{total === 1 ? "" : "s"} available
            </DashButton>
          </div>
        </div>
        <img
          src="/images/addons-curve.svg"
          alt=""
          className="pointer-events-none absolute right-0 top-0 hidden h-full lg:block dark:brightness-[3]"
        />
      </motion.div>

      {/* Category pills */}
      {categories.length > 0 && (
        <div className="scrollbar-hidden mt-5 flex gap-2 overflow-x-auto">
          <button
            onClick={() => selectCategory(undefined)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
              !activeCategory
                ? "bg-dash-text-strong text-dash-bg"
                : "bg-dash-bg-elevated text-dash-text-faded hover:text-dash-text-body"
            }`}
          >
            All
            {isLoading && !activeCategory && (
              <LoaderCircle className="size-3 animate-spin" />
            )}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => selectCategory(cat === activeCategory ? undefined : cat)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs capitalize transition-colors ${
                activeCategory === cat
                  ? "bg-dash-text-strong text-dash-bg"
                  : "bg-dash-bg-elevated text-dash-text-faded hover:text-dash-text-body"
              }`}
            >
              {cat}
              {isLoading && activeCategory === cat && (
                <LoaderCircle className="size-3 animate-spin" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        <SearchFilterBar
          value={search}
          onChange={setSearch}
          placeholder="Search MCP servers..."
        />
      </div>

      <div className="mt-6">
        {filteredAddons.length ? (
          <>
            <AddonGrid items={filteredAddons} />
            {!search.trim() && (
              <div className="mt-6 flex justify-end">
                <NumberPagination
                  currentPage={page}
                  totalPages={totalPages}
                  isLoading={isLoading}
                  loadingPage={isLoading ? pendingPage : null}
                  onPageChange={(nextPage) => {
                    navigate({
                      to: "/addons",
                      search: {
                        ...routeSearch,
                        page: nextPage === 1 ? undefined : nextPage,
                      },
                    });
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="py-12 text-center text-sm text-dash-text-faded">
            No MCP servers match your search.
          </div>
        )}
      </div>
    </div>
  );
}
