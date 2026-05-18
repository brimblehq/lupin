import { useState, useEffect, useMemo, useRef } from "react";
import { createFileRoute, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { FolderOpen } from "@phosphor-icons/react";
import { Formik, Form as FormikForm } from "formik";
import * as Yup from "yup";
import { PageHeader } from "../../components/shared/page-header";
import { ProjectCard } from "../../components/shared/project-card";
import type { Project } from "../../components/shared/project-card";
import { CreateProjectCard } from "../../components/shared/create-project-card";
import { NumberPagination } from "../../components/shared/pagination";
import { TagFilterBar } from "../../components/projects/tag-filter-bar";
import { SearchFilterBar } from "../../components/shared/search-filter-bar";
import { FilterDropdown, type FilterOption } from "../../components/shared/filter-dropdown";
import { Modal, ModalHeader } from "../../components/shared/modal";
import { GlossyButton } from "../../components/shared/glossy-button";
import { ProjectsListPending } from "@/components/shared/route-pending";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { listProjectsPageServerFn } from "@/server/projects/actions";
import {
  createProjectEnvironmentServerFn,
  deleteProjectEnvironmentServerFn,
  getActiveEnvironmentPreferenceServerFn,
  getProjectEnvironmentDetailsServerFn,
  listProjectEnvironmentsServerFn,
  updateProjectEnvironmentServerFn,
} from "@/server/environments/actions";
import type { ProjectEnvironment } from "@/backend/environments";
import type { Project as BackendProject, PaginatedProjectsResponse } from "@/backend/projects";
import type { FrameworkOption } from "@/backend/frameworks";
import { listFrameworksServerFn } from "@/server/frameworks/actions";
import { formatRelativeTime } from "@/utils/dashboard";
import { resolveEnvironmentId } from "@/utils/environment-selection";
import {
  parsePositivePageSearchValue,
  parseTextSearchValue,
  parseWorkspaceSearchValue,
  workspacePageLoaderDeps,
} from "@/utils/workspace-route-search";
import { useTagsStore } from "@/hooks/use-tags-store";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { getProjectScopedAblyOptions } from "@/lib/ably-auth";
import type { ProjectsRouteLoaderData } from "./types";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

const environmentFormSchema = Yup.object({
  name: Yup.string()
    .trim()
    .min(3, "Name should be at least 3 characters")
    .max(64, "Name should be less than 65 characters")
    .matches(/^[a-zA-Z][a-zA-Z _-]*$/, "Only letters, spaces, hyphens, and underscores")
    .required("Environment name is required"),
  inheritFrom: Yup.string().trim().default(""),
});

const deleteEnvironmentFormSchema = Yup.object({
  moveTo: Yup.string().trim().required("Move target is required"),
});

function mapBackendProject(project: BackendProject, frameworkLogoMap?: Map<string, string>): Project {
  const framework = project.framework?.toLowerCase();
  return {
    name: project.name,
    slug: project.slug || project.name,
    id: project.id,
    status: project.status,
    serviceType: project.serviceType,
    commitMessage: project.log?.message || "No recent activity",
    branch: project.repo?.branch || "main",
    updatedAt: formatRelativeTime(project.updatedAt),
    tags: project.tags,
    domain: project.domain || project.previewUrl || project.domains?.[0]?.name,
    framework,
    frameworkLogo: framework && frameworkLogoMap ? frameworkLogoMap.get(framework) : undefined,
    dbImage: project.dbImage,
  };
}

const PROJECT_TYPE_FILTER_OPTIONS: FilterOption[] = [
  { label: "All Projects", value: "all" },
  { label: "Web Services", value: "web-service" },
  { label: "Static Sites", value: "static" },
  { label: "Databases", value: "database" },
  { label: "Workers", value: "worker" },
];

const PROJECT_STATUS_FILTER_OPTIONS: FilterOption[] = [
  { label: "All Statuses", value: "all" },
  { label: "Active", value: "ACTIVE", dot: "#34d399" },
  { label: "Inactive", value: "INACTIVE", dot: "#9ca3af" },
  { label: "In Progress", value: "INPROGRESS", dot: "#4879f8" },
  { label: "Failed", value: "FAILED", dot: "#fc391e" },
  { label: "Pending", value: "PENDING", dot: "#ff7a00" },
  { label: "Cancelled", value: "CANCELLED", dot: "#9ca3af" },
  { label: "Degraded", value: "DEGRADED", dot: "#f59e0b" },
  { label: "Payment Due", value: "PAYMENT DUE", dot: "#ef4444" },
];

function hasEnvironmentAccessDeniedError(error: unknown): boolean {
  const record = (error ?? null) as { message?: unknown; details?: unknown; data?: unknown } | null;
  const texts: string[] = [];

  if (typeof record?.message === "string") {
    texts.push(record.message);
  }

  if (record?.details && typeof record.details === "object") {
    const detailsRecord = record.details as { message?: unknown };
    if (typeof detailsRecord.message === "string") {
      texts.push(detailsRecord.message);
    }
  }

  if (record?.data && typeof record.data === "object") {
    const dataRecord = record.data as { message?: unknown };
    if (typeof dataRecord.message === "string") {
      texts.push(dataRecord.message);
    }
  }

  return texts.some((text) => text.toLowerCase().includes("you do not have access to this environment"));
}

export const Route = createFileRoute("/projects/")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  pendingComponent: ProjectsListPending,
  validateSearch: (search: Record<string, unknown>) => {
    const next: {
      page?: number;
      workspace?: string;
      q?: string;
      type?: string;
      status?: string;
      environmentId?: string;
    } = {};
    const page = parsePositivePageSearchValue(search.page);
    const workspace = parseWorkspaceSearchValue(search.workspace);
    const q = parseTextSearchValue(search.q);
    const type = parseTextSearchValue(search.type);
    const status = parseTextSearchValue(search.status);
    const environmentId = parseTextSearchValue(search.environmentId);
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
    if (status) {
      next.status = status;
    }
    if (environmentId) {
      next.environmentId = environmentId;
    }

    return next;
  },
  loaderDeps: ({ search }) => ({
    ...workspacePageLoaderDeps(search),
    q: parseTextSearchValue(search.q),
    type: parseTextSearchValue(search.type),
    status: parseTextSearchValue(search.status),
    environmentId: parseTextSearchValue(search.environmentId),
  }),
  loader: async ({ deps }): Promise<ProjectsRouteLoaderData> => {
    const [environments, persistedEnvironmentId, frameworks] = await Promise.all([
      (listProjectEnvironmentsServerFn as unknown as (input: { data?: { workspace?: string } }) => Promise<ProjectEnvironment[]>)({
        data: { workspace: deps.workspace },
      }).catch(() => [] as ProjectEnvironment[]),
      (getActiveEnvironmentPreferenceServerFn as unknown as (input: { data?: { workspace?: string } }) => Promise<string | null>)({
        data: { workspace: deps.workspace },
      }).catch(() => null),
      (listFrameworksServerFn as unknown as () => Promise<FrameworkOption[]>)().catch(() => [] as FrameworkOption[]),
    ]);
    const resolvedEnvironmentId = resolveEnvironmentId({
      requestedEnvironmentId: deps.environmentId,
      preferredEnvironmentId: persistedEnvironmentId,
      environments,
    });

    const loadProjects = async (environmentId?: string) =>
      (listProjectsPageServerFn as unknown as (input: {
        data: {
          page?: number;
          workspace?: string;
          q?: string;
          serviceType?: string;
          status?: string;
          environmentId?: string;
        };
      }) => Promise<PaginatedProjectsResponse>)({
        data: {
          page: deps.page,
          workspace: deps.workspace,
          q: deps.q,
          serviceType: deps.type && deps.type !== "all" ? deps.type : undefined,
          status: deps.status && deps.status !== "all" ? deps.status : undefined,
          environmentId,
        },
      });

    let requestedEnvironmentAccessDenied = false;
    let effectiveResolvedEnvironmentId = resolvedEnvironmentId;
    let result: PaginatedProjectsResponse;

    try {
      result = await loadProjects(resolvedEnvironmentId);
    } catch (error) {
      const canRetryWithoutEnvironment = Boolean(resolvedEnvironmentId && hasEnvironmentAccessDeniedError(error));
      if (!canRetryWithoutEnvironment) {
        throw error;
      }
      requestedEnvironmentAccessDenied = true;
      effectiveResolvedEnvironmentId = undefined;
      result = await loadProjects(undefined);
    }

    const frameworkLogoMap = new Map<string, string>();
    for (const fw of frameworks) {
      if (fw.slug && fw.logo) frameworkLogoMap.set(fw.slug.toLowerCase(), fw.logo);
    }

    return {
      projects: result.items.map((p) => mapBackendProject(p, frameworkLogoMap)),
      frameworkLogos: Object.fromEntries(frameworkLogoMap),
      environments,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        total: result.total ?? 0,
        overallTotalProjects: result.overallTotalProjects,
      },
      workspace: deps.workspace,
      environmentId: deps.environmentId,
      resolvedEnvironmentId: effectiveResolvedEnvironmentId,
      requestedEnvironmentAccessDenied,
    };
  },
  component: ProjectsPage,
});

function EnvironmentManagerModal({
  open,
  onOpenChange,
  environments,
  workspace,
  activeEnvironmentId,
  onEnvironmentListChange,
  onActiveEnvironmentChange,
  canWrite,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environments: ProjectEnvironment[];
  workspace?: string;
  activeEnvironmentId?: string;
  onEnvironmentListChange: (environments: ProjectEnvironment[]) => void;
  onActiveEnvironmentChange: (environmentId?: string) => void;
  canWrite?: boolean;
}) {
  const router = useRouter();
  const createEnvironment = useServerFn(createProjectEnvironmentServerFn as any) as (args: {
    data: { name: string; workspace?: string; inheritFrom?: string };
  }) => Promise<ProjectEnvironment>;
  const updateEnvironment = useServerFn(updateProjectEnvironmentServerFn as any) as (args: {
    data: {
      environmentId: string;
      workspace?: string;
      name?: string;
      inheritFrom?: string | null;
    };
  }) => Promise<ProjectEnvironment>;
  const deleteEnvironment = useServerFn(deleteProjectEnvironmentServerFn as any) as (args: {
    data: { environmentId: string; moveTo: string; workspace?: string };
  }) => Promise<{ success: boolean }>;
  const getEnvironmentDetails = useServerFn(getProjectEnvironmentDetailsServerFn as any) as (args: {
    data: { environmentId: string; workspace?: string };
  }) => Promise<ProjectEnvironment>;

  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [envProjectCounts, setEnvProjectCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;

    if (activeEnvironmentId && environments.some((env) => env._id === activeEnvironmentId)) {
      setSelectedEnvironmentId(activeEnvironmentId);
      return;
    }

    if (environments.length > 0) {
      setSelectedEnvironmentId(environments[0]._id);
    } else {
      setSelectedEnvironmentId(null);
    }
  }, [activeEnvironmentId, environments, open]);

  useEffect(() => {
    if (!open || environments.length === 0) return;
    let cancelled = false;

    void Promise.allSettled(environments.map((env) => getEnvironmentDetails({ data: { environmentId: env._id, workspace } }))).then(
      (results) => {
        if (cancelled) return;
        const counts: Record<string, number> = {};
        results.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value?.projectCount != null) {
            counts[environments[index]._id] = result.value.projectCount;
          }
        });
        setEnvProjectCounts(counts);
      },
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, environments.length]);

  const selectedEnvironment = environments.find((env) => env._id === selectedEnvironmentId) ?? null;

  const formInitialValues = {
    name: selectedEnvironment?.name ?? "",
    inheritFrom: selectedEnvironment?.inherit_from ?? "",
  };

  const inheritOptions = environments.filter((env) => env._id !== selectedEnvironment?._id);

  const moveOptions = environments.filter((env) => env._id !== selectedEnvironment?._id);

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={860}>
      <ModalHeader title="Environment Manager" description="Create, edit, and delete project environments with validation checks." />
      <div className="grid min-h-[460px] grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="border-b border-dash-border p-4 md:border-b-0 md:border-r">
          {canWrite !== false && (
            <button
              type="button"
              onClick={() => setSelectedEnvironmentId(null)}
              className="mb-3 w-full rounded-[6px] border border-dash-border bg-dash-bg-elevated px-3 py-2 text-left text-sm font-medium text-dash-text-strong transition-colors hover:bg-dash-bg"
            >
              + New environment
            </button>
          )}
          <div className="space-y-1">
            {environments.map((environment) => (
              <button
                key={environment._id}
                type="button"
                onClick={() => setSelectedEnvironmentId(environment._id)}
                className={`flex w-full items-center rounded-[6px] px-3 py-2 text-left text-sm transition-colors ${
                  selectedEnvironmentId === environment._id
                    ? "bg-dash-bg-elevated text-dash-text-strong"
                    : "text-dash-text-body hover:bg-dash-bg-elevated"
                }`}
              >
                <span>{environment.name}</span>
                {environment.isDefault ? <span className="ml-1 text-xs text-dash-text-faded">(default)</span> : null}
                {envProjectCounts[environment._id] != null && (
                  <span className="ml-auto text-xs text-dash-text-faded">{envProjectCounts[environment._id]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 md:p-5">
          <Formik
            initialValues={formInitialValues}
            validationSchema={environmentFormSchema}
            enableReinitialize
            onSubmit={async (values) => {
              const name = values.name.trim();
              const inheritFrom = values.inheritFrom.trim();

              setSaving(true);
              try {
                let nextEnvironment: ProjectEnvironment;

                if (selectedEnvironment?._id) {
                  nextEnvironment = await updateEnvironment({
                    data: {
                      environmentId: selectedEnvironment._id,
                      workspace,
                      name,
                      inheritFrom: inheritFrom || null,
                    },
                  });

                  onEnvironmentListChange(environments.map((env) => (env._id === selectedEnvironment._id ? nextEnvironment : env)));
                  toast.success("Environment updated");
                  invalidateActiveMatches(router);
                } else {
                  nextEnvironment = await createEnvironment({
                    data: {
                      workspace,
                      name,
                      inheritFrom: inheritFrom || undefined,
                    },
                  });

                  onEnvironmentListChange([...environments, nextEnvironment]);
                  setSelectedEnvironmentId(nextEnvironment._id);
                  toast.success("Environment created");
                  invalidateActiveMatches(router);
                }
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to save environment");
              } finally {
                setSaving(false);
              }
            }}
          >
            {({ values, errors, touched, handleChange, handleBlur, submitForm }) => (
              <FormikForm className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm text-dash-text-body">Environment name</label>
                  <input
                    name="name"
                    value={values.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="e.g. Staging"
                    className={`w-full input-base px-3 py-2.5 text-sm text-dash-text-strong placeholder:text-[#9ca3af] ${touched.name && errors.name ? "border-[#f05252] focus:border-[#f05252] focus:ring-[#f05252]/20" : "input-focus"}`}
                  />
                  {touched.name && errors.name ? <p className="mt-1 text-xs text-[#f05252]">{errors.name}</p> : null}
                </div>

                <div>
                  <label className="mb-1 block text-sm text-dash-text-body">Inherit from</label>
                  <select
                    name="inheritFrom"
                    value={values.inheritFrom}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full input-base input-focus px-3 py-2.5 text-sm text-dash-text-strong"
                  >
                    <option value="">None</option>
                    {inheritOptions.map((option) => (
                      <option key={option._id} value={option._id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const parent = inheritOptions.find((e) => e._id === values.inheritFrom);
                    if (parent?.inherit_from) {
                      const grandparent = environments.find((e) => e._id === parent.inherit_from);
                      return (
                        <p className="mt-1 text-xs text-[#f59e0b]">
                          {parent.name} already inherits from {grandparent?.name ?? "another environment"}. Only one level of inheritance is
                          supported.
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>

                {canWrite !== false && (
                  <div className="flex items-center gap-2">
                    <GlossyButton type="button" onClick={() => void submitForm()} loading={saving} loadingLabel="Saving...">
                      {selectedEnvironment ? "Update Environment" : "Create Environment"}
                    </GlossyButton>
                  </div>
                )}
              </FormikForm>
            )}
          </Formik>

          {canWrite !== false && selectedEnvironment && !selectedEnvironment.isDefault ? (
            <div className="mt-8 border-t border-dash-border-soft pt-5">
              <h4 className="mb-2 text-sm font-medium text-dash-text-strong">Delete Environment</h4>
              <p className="mb-3 text-xs text-dash-text-faded">Projects in this environment will be moved before deletion.</p>

              <Formik
                initialValues={{ moveTo: moveOptions[0]?._id ?? "" }}
                enableReinitialize
                validationSchema={deleteEnvironmentFormSchema}
                onSubmit={async (values) => {
                  setDeleting(true);
                  try {
                    await deleteEnvironment({
                      data: {
                        environmentId: selectedEnvironment._id,
                        moveTo: values.moveTo,
                        workspace,
                      },
                    });

                    const nextEnvironments = environments.filter((env) => env._id !== selectedEnvironment._id);
                    onEnvironmentListChange(nextEnvironments);

                    if (activeEnvironmentId === selectedEnvironment._id) {
                      onActiveEnvironmentChange(undefined);
                    }

                    setSelectedEnvironmentId(nextEnvironments[0]?._id ?? null);
                    toast.success("Environment deleted");
                    invalidateActiveMatches(router);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Failed to delete environment");
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {({ values, errors, touched, handleChange, handleBlur, submitForm }) => (
                  <FormikForm className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm text-dash-text-body">Move projects to</label>
                      <select
                        name="moveTo"
                        value={values.moveTo}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className="w-full input-base input-focus px-3 py-2.5 text-sm text-dash-text-strong"
                      >
                        <option value="">Select target</option>
                        {moveOptions.map((option) => (
                          <option key={option._id} value={option._id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                      {touched.moveTo && errors.moveTo ? <p className="mt-1 text-xs text-[#f05252]">{errors.moveTo}</p> : null}
                    </div>

                    <GlossyButton
                      type="button"
                      variant="red"
                      onClick={() => void submitForm()}
                      loading={deleting}
                      loadingLabel="Deleting..."
                      disabled={!values.moveTo}
                    >
                      Delete Environment
                    </GlossyButton>
                  </FormikForm>
                )}
              </Formik>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="flex min-h-[168px] flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 px-3.5 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="h-4 w-32 animate-pulse rounded bg-dash-border-soft" />
          <div className="h-5 w-16 animate-pulse rounded-[4px] bg-dash-border-soft" />
        </div>
        <div className="h-4 w-48 animate-pulse rounded bg-dash-border-soft" />
      </div>
      {/* Tags row */}
      <div className="flex items-center gap-2 px-3.5 pb-1.5">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-dash-border-soft" />
          <span className="h-3 w-10 animate-pulse rounded bg-dash-border-soft" />
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-dash-border-soft" />
          <span className="h-3 w-12 animate-pulse rounded bg-dash-border-soft" />
        </span>
      </div>
      <div className="relative flex shrink-0 items-center gap-2 px-3 pb-1 pt-0.5">
        <div className="absolute left-[23px] top-[-6px] h-[16px] w-px bg-dash-border" />
        <div className="size-6 animate-pulse rounded-full bg-dash-border-soft" />
        <div className="h-3.5 w-24 animate-pulse rounded bg-dash-border-soft" />
      </div>
      <div className="flex h-10 shrink-0 items-center justify-between border-t-[0.5px] border-dash-border px-3.5">
        <div className="h-3 w-28 animate-pulse rounded bg-dash-border-soft" />
        <div className="flex items-center gap-1.5">
          <div className="size-4 animate-pulse rounded bg-dash-border-soft" />
          <div className="size-4 animate-pulse rounded bg-dash-border-soft" />
        </div>
      </div>
    </div>
  );
}

function ProjectsPage() {
  const navigate = useNavigate({ from: "/projects/" });
  const router = useRouter();
  const search = Route.useSearch();
  const loaderData = Route.useLoaderData() as ProjectsRouteLoaderData;
  const { canWrite } = useWorkspaceRole();
  const [projects, setProjects] = useState(loaderData.projects);
  const [pagination, setPagination] = useState(loaderData.pagination);
  const [environments, setEnvironments] = useState(loaderData.environments);
  const [environmentModalOpen, setEnvironmentModalOpen] = useState(false);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(search.q ?? "");
  const [isFilterChanging, setIsFilterChanging] = useState(false);
  const [isStatusFilterChanging, setIsStatusFilterChanging] = useState(false);
  const activeProjectType = search.type ?? "all";
  const activeStatus = search.status ?? "all";
  const requestedEnvironmentAccessDenied = Boolean(loaderData.requestedEnvironmentAccessDenied);
  let activeEnvironmentId = search.environmentId ?? loaderData.resolvedEnvironmentId ?? "all";
  if (requestedEnvironmentAccessDenied) {
    activeEnvironmentId = loaderData.resolvedEnvironmentId ?? "all";
  }
  let effectiveEnvironmentId = loaderData.resolvedEnvironmentId;
  if (!requestedEnvironmentAccessDenied && search.environmentId && search.environmentId !== "all") {
    effectiveEnvironmentId = search.environmentId;
  }
  const requestedWorkspace = search.workspace?.trim().toLowerCase() || undefined;
  const loadedWorkspace = loaderData.workspace?.trim().toLowerCase() || undefined;
  const isWorkspaceSwitching = requestedWorkspace !== loadedWorkspace;
  const isRouterLoading = useRouterState({ select: (s) => s.isLoading });
  const pendingPage = useRouterState({
    select: (s) => {
      const activeSearch = (s.location.search ?? s.resolvedLocation?.search) as Record<string, unknown> | undefined;
      return parsePositivePageSearchValue(activeSearch?.page) ?? 1;
    },
  });

  const refreshSignal = useTagsStore((s) => s._refreshSignal);
  const tags = useTagsStore((s) => s.tags);
  const prevSignal = useRef(refreshSignal);
  const prevWorkspace = useRef(search.workspace);

  function buildProjectsSearch(next: {
    page?: number;
    workspace?: string;
    q?: string;
    type?: string;
    status?: string;
    environmentId?: string;
  }) {
    return {
      page: next.page,
      workspace: next.workspace,
      q: next.q,
      type: next.type,
      status: next.status,
      environmentId: next.environmentId,
    };
  }

  useEffect(() => {
    if (!requestedEnvironmentAccessDenied || !search.environmentId) {
      return;
    }

    toast.error("You do not have access to that environment. Showing projects from environments you can access.");
    navigate({
      to: "/projects",
      replace: true,
      search: buildProjectsSearch({
        workspace: search.workspace,
        q: search.q,
        type: search.type,
        status: search.status,
        environmentId: undefined,
        page: search.page,
      }),
    });
  }, [
    navigate,
    requestedEnvironmentAccessDenied,
    search.environmentId,
    search.page,
    search.q,
    search.status,
    search.type,
    search.workspace,
  ]);

  useEffect(() => {
    setProjects(loaderData.projects);
    setPagination(loaderData.pagination);
    setEnvironments(loaderData.environments);
    setIsFilterChanging(false);
    setIsStatusFilterChanging(false);
  }, [loaderData]);

  const visibleProjectIds = useMemo(() => projects.map((p) => p.id).filter((id): id is string => Boolean(id)), [projects]);
  const visibleProjectIdsKey = visibleProjectIds.join(",");
  useEffect(() => {
    if (visibleProjectIds.length === 0) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;
    let invalidateTimer: number | null = null;

    const scheduleInvalidate = () => {
      if (invalidateTimer !== null) return;
      invalidateTimer = window.setTimeout(() => {
        invalidateTimer = null;
        void invalidateActiveMatches(router);
      }, 750);
    };

    void (async () => {
      const { Realtime } = await import("ably");
      if (cancelled) return;

      const authOptions = await getProjectScopedAblyOptions(visibleProjectIds);
      if (!authOptions || cancelled) {
        return;
      }

      const ably = new Realtime(authOptions);

      const channels = visibleProjectIds.map((id) => {
        const channel = ably.channels.get(id);
        channel.subscribe((message) => {
          if ((message.name ?? "").startsWith("deployment:")) {
            scheduleInvalidate();
          }
        });
        return channel;
      });

      cleanup = () => {
        channels.forEach((channel) => channel.unsubscribe());
        ably.close();
      };
    })();

    return () => {
      cancelled = true;
      if (invalidateTimer !== null) {
        window.clearTimeout(invalidateTimer);
      }
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleProjectIdsKey, router]);

  useEffect(() => {
    if (!isWorkspaceSwitching) {
      return;
    }

    setProjects([]);
    setPagination((prev) => ({
      ...prev,
      currentPage: search.page ?? 1,
      total: 0,
      overallTotalProjects: 0,
    }));
    setIsFilterChanging(false);
    setIsStatusFilterChanging(false);
  }, [isWorkspaceSwitching, search.page]);

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
          status: search.status,
          environmentId: search.environmentId,
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
        const result = await (
          listProjectsPageServerFn as unknown as (input: {
            data: {
              page?: number;
              workspace?: string;
              q?: string;
              serviceType?: string;
              status?: string;
              environmentId?: string;
            };
          }) => Promise<PaginatedProjectsResponse>
        )({
          data: {
            page: search.page,
            workspace: search.workspace,
            q: search.q,
            serviceType: search.type && search.type !== "all" ? search.type : undefined,
            status: search.status && search.status !== "all" ? search.status : undefined,
            environmentId: effectiveEnvironmentId,
          },
        });
        const fwMap = new Map(Object.entries(loaderData.frameworkLogos ?? {}));
        setProjects(result.items.map((p) => mapBackendProject(p, fwMap)));
        setPagination({
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          total: result.total ?? 0,
          overallTotalProjects: result.overallTotalProjects,
        });
      } catch {
        // Keep previous project list if refresh fails.
      }
    })();
  }, [loaderData.frameworkLogos, refreshSignal, search.environmentId, effectiveEnvironmentId, search.page, search.q, search.status, search.type, search.workspace]);

  const filteredProjects = activeTagId ? projects.filter((p) => p.tags?.some((t) => t.id === activeTagId)) : projects;
  const hasSearchQuery = Boolean(search.q?.trim());
  const settledSearchQuery = search.q?.trim() ?? "";
  const pendingSearchQuery = searchQuery.trim();
  const isSearchSettling = pendingSearchQuery !== settledSearchQuery;
  const isEnvironmentSwitching = (search.environmentId ?? undefined) !== (loaderData.environmentId ?? undefined);
  const showSkeletons = isWorkspaceSwitching || isEnvironmentSwitching || isFilterChanging || isStatusFilterChanging;

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
        status: search.status,
        environmentId: search.environmentId,
        page: page === 1 ? undefined : page,
      }),
    });
  }

  function handleProjectTagsChange(projectId: string | undefined, nextTags: Project["tags"]) {
    if (!projectId) return;
    setProjects((prev) => prev.map((project) => (project.id === projectId ? { ...project, tags: nextTags } : project)));
  }

  return (
    <div className="max-w-[1000px]">
      <PageHeader title="Projects" image="/images/bee.svg">
        Manage your deployed projects from one place. Track recent updates, jump into configurations, and spin up new deployments quickly.
      </PageHeader>

      <hr className="border-dash-border-soft mb-8 -mx-4 md:-mx-10" />

      <TagFilterBar activeTagId={activeTagId} onFilterChange={setActiveTagId} projects={projects} workspace={search.workspace} />

      <div className="mb-4 mt-4">
        <SearchFilterBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search projects"
          loading={isSearchSettling}
          rightSlot={
            <>
              <FilterDropdown
                value={activeStatus}
                onChange={(value) => {
                  const nextStatus = value === "all" ? undefined : value;
                  if ((search.status ?? undefined) === nextStatus) {
                    return;
                  }
                  setIsStatusFilterChanging(true);
                  navigate({
                    to: "/projects",
                    search: buildProjectsSearch({
                      workspace: search.workspace,
                      q: search.q,
                      type: search.type,
                      status: nextStatus,
                      page: undefined,
                    }),
                  });
                }}
                loading={isStatusFilterChanging}
                options={PROJECT_STATUS_FILTER_OPTIONS}
                placeholder="All Statuses"
                dropdownWidth={180}
              />
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
                      status: search.status,
                      environmentId: search.environmentId,
                      page: undefined,
                    }),
                  });
                }}
                loading={isFilterChanging}
                options={PROJECT_TYPE_FILTER_OPTIONS}
                placeholder="All Projects"
              />
            </>
          }
        />
      </div>

      {canWrite && (
        <div className="mb-4">
          <CreateProjectCard className="col-span-full" />
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {showSkeletons ? (
          <motion.div
            key="skeletons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`${search.q ?? ""}:${activeTagId ?? "all"}:${activeStatus}:${activeEnvironmentId}:${pagination.currentPage}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project, i) => (
                <motion.div layout key={`${project.name}-${i}`}>
                  <ProjectCard project={project} onTagsChange={(nextTags) => handleProjectTagsChange(project.id, nextTags)} />
                </motion.div>
              ))}
            </div>

            {filteredProjects.length === 0 ? (
              <div className="mt-4 flex flex-col items-center justify-center py-10">
                <FolderOpen size={40} weight="fill" className="text-dash-text-faded/50 mb-2" />
                <span className="text-sm text-dash-text-faded">{emptyStateMessage}</span>
              </div>
            ) : null}
          </motion.div>
        )}
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

      <EnvironmentManagerModal
        open={environmentModalOpen}
        onOpenChange={setEnvironmentModalOpen}
        environments={environments}
        workspace={search.workspace}
        activeEnvironmentId={effectiveEnvironmentId}
        onEnvironmentListChange={setEnvironments}
        canWrite={canWrite}
        onActiveEnvironmentChange={(environmentId) => {
          navigate({
            to: "/projects",
            search: buildProjectsSearch({
              workspace: search.workspace,
              q: search.q,
              type: search.type,
              status: search.status,
              environmentId,
              page: undefined,
            }),
          });
        }}
      />
    </div>
  );
}
