import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { PageHeader } from "../../components/shared/page-header";
import { ProjectCard } from "../../components/shared/project-card";
import type { Project } from "../../components/shared/project-card";
import { CreateProjectCard } from "../../components/shared/create-project-card";
import { NumberPagination } from "../../components/shared/pagination";
import { TagFilterBar } from "../../components/projects/tag-filter-bar";
import { SearchFilterBar } from "../../components/shared/search-filter-bar";
import { FilterDropdown, type FilterOption } from "../../components/shared/filter-dropdown";
import { listProjectsPageServerFn } from "@/server/projects/actions";
import type { Project as BackendProject, PaginatedProjectsResponse } from "@/backend/projects";
import { formatRelativeTime } from "@/utils/dashboard";
import { parsePositivePageSearchValue, parseTextSearchValue, parseWorkspaceSearchValue, workspacePageLoaderDeps } from "@/utils/workspace-route-search";
import { useTagsStore } from "@/hooks/use-tags-store";

function mapBackendProject(project: BackendProject): Project {
  return {
    name: project.name,
    slug: project.slug || project.name,
    id: project.id,
    status: project.status,
    commitMessage: project.log?.message || "No recent activity",
    branch: project.repo?.branch || "main",
    updatedAt: formatRelativeTime(project.updatedAt),
    tags: project.tags,
  };
}

const PROJECT_TYPE_FILTER_OPTIONS: FilterOption[] = [
  { label: "All Projects", value: "all" },
  { label: "Web Services", value: "web-service" },
  { label: "Static Sites", value: "static" },
  { label: "Databases", value: "database" },
  { label: "Workers", value: "worker" },
];

export const Route = createFileRoute("/projects/")({
  staleTime: 30_000,
  preloadStaleTime: 30_000,
  validateSearch: (search: Record<string, unknown>) => {
    const next: { page?: number; workspace?: string; q?: string; type?: string } = {};
    const page = parsePositivePageSearchValue(search.page);
    const workspace = parseWorkspaceSearchValue(search.workspace);
    const q = parseTextSearchValue(search.q);
    const type = parseTextSearchValue(search.type);
    if (page) {
      next.page = page;
    }
    if (workspace) {
      next.workspace = workspace;
    }
    if (q) {
      next.q = q;
    }
    if (type) {
      next.type = type;
    }

    return next;
  },
  loaderDeps: ({ search }) => ({
    ...workspacePageLoaderDeps(search),
    q: parseTextSearchValue(search.q),
    type: parseTextSearchValue(search.type),
  }),
  loader: async ({ deps }) => {
    const result = await (listProjectsPageServerFn as unknown as (input: {
      data: { page?: number; workspace?: string; q?: string; serviceType?: string };
    }) => Promise<PaginatedProjectsResponse>)({
      data: {
        page: deps.page,
        workspace: deps.workspace,
        q: deps.q,
        serviceType: deps.type && deps.type !== "all" ? deps.type : undefined,
      },
    });

    return {
      projects: result.items.map(mapBackendProject),
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        total: result.total,
        overallTotalProjects: result.overallTotalProjects,
      },
    };
  },
  component: ProjectsPage,
});

function ProjectsPage() {
  const navigate = useNavigate({ from: "/projects/" });
  const search = Route.useSearch();
  const loaderData = Route.useLoaderData();
  const [projects, setProjects] = useState(loaderData.projects);
  const [pagination, setPagination] = useState(loaderData.pagination);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(search.q ?? "");
  const [isFilterChanging, setIsFilterChanging] = useState(false);
  const activeProjectType = search.type ?? "all";

  const refreshSignal = useTagsStore((s) => s._refreshSignal);
  const tags = useTagsStore((s) => s.tags);
  const prevSignal = useRef(refreshSignal);
  const prevWorkspace = useRef(search.workspace);

  function buildProjectsSearch(next: {
    page?: number;
    workspace?: string;
    q?: string;
    type?: string;
  }) {
    return {
      page: next.page,
      workspace: next.workspace,
      q: next.q,
      type: next.type,
    };
  }

  useEffect(() => {
    setProjects(loaderData.projects);
    setPagination(loaderData.pagination);
    setIsFilterChanging(false);
  }, [loaderData]);

  useEffect(() => {
    setSearchQuery(search.q ?? "");
  }, [search.q]);

  useEffect(() => {
    if (prevWorkspace.current === search.workspace) return;
    prevWorkspace.current = search.workspace;
    setActiveTagId(null);
  }, [search.workspace]);

  useEffect(() => {
    if (!activeTagId) return;
    if (!tags.some((t) => t.id === activeTagId)) {
      setActiveTagId(null);
    }
  }, [activeTagId, tags]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextQ = searchQuery.trim() || undefined;
      if ((search.q ?? undefined) === nextQ) {
        return;
      }

      navigate({
        to: "/projects",
        replace: true,
        search: buildProjectsSearch({
          workspace: search.workspace,
          q: nextQ,
          type: search.type,
          page: undefined,
        }),
      });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [navigate, search, search.q, searchQuery]);

  useEffect(() => {
    if (prevSignal.current === refreshSignal) return;
    prevSignal.current = refreshSignal;

    void (async () => {
      try {
        const result = await (listProjectsPageServerFn as unknown as (input: {
          data: { page?: number; workspace?: string; q?: string; serviceType?: string };
        }) => Promise<PaginatedProjectsResponse>)({
          data: {
            page: search.page,
            workspace: search.workspace,
            q: search.q,
            serviceType: search.type && search.type !== "all" ? search.type : undefined,
          },
        });
        setProjects(result.items.map(mapBackendProject));
        setPagination({
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          total: result.total,
          overallTotalProjects: result.overallTotalProjects,
        });
      } catch {}
    })();
  }, [refreshSignal, search.page, search.q, search.type, search.workspace]);

  const filteredProjects = activeTagId
    ? projects.filter((p) =>
        p.tags?.some((t) => t.id === activeTagId),
      )
    : projects;
  const hasSearchQuery = Boolean(search.q?.trim());
  const settledSearchQuery = search.q?.trim() ?? "";
  const pendingSearchQuery = searchQuery.trim();
  const isSearchSettling = pendingSearchQuery !== settledSearchQuery;

  let emptyStateMessage = "No projects found.";
  if (hasSearchQuery && search.q) {
    emptyStateMessage = `No projects found for "${search.q}".`;
  } else if (activeTagId) {
    emptyStateMessage = "No projects match this tag.";
  }

  function handlePageChange(page: number) {
    if (page < 1 || page === pagination.currentPage || page > pagination.totalPages) {
      return;
    }

    navigate({
      to: "/projects",
      search: buildProjectsSearch({
        workspace: search.workspace,
        q: search.q,
        type: search.type,
        page: page === 1 ? undefined : page,
      }),
    });
  }

  function handleProjectTagsChange(projectId: string | undefined, nextTags: Project["tags"]) {
    if (!projectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? { ...project, tags: nextTags }
          : project,
      ),
    );
  }

  return (
    <div className="max-w-[1000px]">
      <PageHeader title="Projects" image="/images/bee.svg">
        Manage your deployed projects from one place. Track recent updates, jump
        into configurations, and spin up new deployments quickly.
      </PageHeader>

      <hr className="border-dash-border-soft mb-8 -mx-4 md:-mx-10" />

      <TagFilterBar activeTagId={activeTagId} onFilterChange={setActiveTagId} projects={projects} />

      <div className="mb-4 mt-4">
        <SearchFilterBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search projects"
          loading={isSearchSettling}
          rightSlot={(
            <FilterDropdown
              value={activeProjectType}
              onChange={(value) => {
                const nextType = value === "all" ? undefined : value;
                if ((search.type ?? undefined) === nextType) {
                  return;
                }
                setIsFilterChanging(true);
                navigate({
                  to: "/projects",
                  search: buildProjectsSearch({
                    workspace: search.workspace,
                    q: search.q,
                    type: nextType,
                    page: undefined,
                  }),
                });
              }}
              loading={isFilterChanging}
              options={PROJECT_TYPE_FILTER_OPTIONS}
              placeholder="All Projects"
            />
          )}
        />
      </div>

      <div className="mb-4">
        <CreateProjectCard className="col-span-full" />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${search.q ?? ""}:${activeTagId ?? "all"}:${pagination.currentPage}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project, i) => (
              <motion.div layout key={`${project.name}-${i}`}>
                <ProjectCard
                  project={project}
                  onTagsChange={(nextTags) => handleProjectTagsChange(project.id, nextTags)}
                />
              </motion.div>
            ))}
          </div>

          {filteredProjects.length === 0 ? (
            <div className="mt-4 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-4 py-3 text-sm text-dash-text-faded">
              {emptyStateMessage}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex justify-end">
        <NumberPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
