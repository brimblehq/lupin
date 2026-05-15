import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProjectSubnav } from "../../components/project/project-subnav";
import { DeploymentLogsDrawer } from "../../components/shared/deployment-logs-drawer";
import { getProjectDetailsServerFn, listHomeProjectsServerFn } from "@/server/projects/actions";
import { getActiveEnvironmentPreferenceServerFn, listProjectEnvironmentsServerFn } from "@/server/environments/actions";
import { listDeploymentRunLogsServerFn } from "@/server/deployments/actions";
import type { Project as BackendProject } from "@/backend/projects";
import type { ApiListResponse } from "@/backend";
import type { DeploymentLog } from "@/backend/deployments";
import type { DeploymentDrawerLogEntry } from "@/utils/deployment-logs";
import { hasExplicitEnvironmentSelection, resolveEnvironmentId } from "@/utils/environment-selection";
import {
  ProjectDeploymentLogsDrawerContext,
  type ProjectDeploymentLogsDrawerContextValue,
} from "@/contexts/project-deployment-logs-drawer-context";
import { sortDeploymentDrawerEntries } from "@/utils/deployment-logs";
import { usePushNotification } from "@/hooks/use-push-notification";
import config from "@/config";
import type { ProjectDetailRouteProject } from "./project-detail.types";
import { PROJECT_CACHE_TTL, markProjectCacheStale, projectCache } from "./project-route-cache";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

const SUCCESS_LOG_PATTERN = /site (is )?(live|running)\b/i;
const FAILURE_LOG_PATTERN = /deployment failed|build failed|failed to deploy/i;

const DEPLOYMENT_EVENT_NAMES: readonly string[] = ["deployment:started", "deployment:completed", "deployment:failed"];
const DATABASE_EVENT_NAMES: readonly string[] = ["database:provisioned", "database:updated"];

function toRouteProject(project: BackendProject): ProjectDetailRouteProject {
  return project as unknown as ProjectDetailRouteProject;
}

function toRouteProjectList(response: ApiListResponse<BackendProject>): ApiListResponse<ProjectDetailRouteProject> {
  return {
    ...response,
    items: response.items.map(toRouteProject),
  };
}

function getDrawerEntryKey(entry: DeploymentDrawerLogEntry): string {
  const rawId = entry.rawId?.trim();
  if (rawId) {
    return `id:${rawId}`;
  }

  return `${entry.type}|${entry.timestampRaw ?? entry.timestamp}|${entry.message}`;
}

function mergeDeploymentDrawerEntries(
  existing: DeploymentDrawerLogEntry[],
  incoming: DeploymentDrawerLogEntry[],
): DeploymentDrawerLogEntry[] {
  if (incoming.length === 0) {
    return existing;
  }

  const next = [...existing];
  const keyToIndex = new Map<string, number>();
  for (let index = 0; index < next.length; index++) {
    keyToIndex.set(getDrawerEntryKey(next[index]), index);
  }

  for (const entry of incoming) {
    const key = getDrawerEntryKey(entry);
    const existingIndex = keyToIndex.get(key);
    if (existingIndex !== undefined) {
      const previousEntry = next[existingIndex];
      const shouldUpgradeStatus = previousEntry.status !== entry.status && entry.status !== undefined;
      const shouldUpgradeRawId = !previousEntry.rawId && Boolean(entry.rawId);
      const shouldUpgradeTimestamp = previousEntry.timestampMs == null && entry.timestampMs != null;

      if (shouldUpgradeStatus || shouldUpgradeRawId || shouldUpgradeTimestamp) {
        next[existingIndex] = {
          ...previousEntry,
          ...entry,
        };
      }

      continue;
    }

    keyToIndex.set(key, next.length);
    next.push(entry);
  }

  return sortDeploymentDrawerEntries(next);
}

function getProjectIdentityCandidates(project: Pick<ProjectDetailRouteProject, "slug" | "id" | "name">): string[] {
  return [project.slug, project.id, project.name]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase());
}

export const Route = createFileRoute("/projects/$projectId")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  loaderDeps: ({ search }) => {
    const rawSearch = search as Record<string, unknown>;
    const workspace =
      typeof rawSearch.workspace === "string" && rawSearch.workspace.trim().length > 0 ? rawSearch.workspace.trim() : undefined;
    const environmentId =
      typeof rawSearch.environmentId === "string" && rawSearch.environmentId.trim().length > 0 ? rawSearch.environmentId.trim() : undefined;

    return {
      workspace,
      environmentId,
    };
  },
  beforeLoad: async ({ params, search }) => {
    const rawSearch = search as Record<string, unknown>;
    const workspace =
      typeof rawSearch.workspace === "string" && rawSearch.workspace.trim().length > 0 ? rawSearch.workspace.trim() : undefined;

    const cacheKey = `${params.projectId}:${workspace ?? ""}`;
    const cached = projectCache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < PROJECT_CACHE_TTL) {
      return { project: cached.data, workspace };
    }

    try {
      const projectResponse = await (
        getProjectDetailsServerFn as unknown as (input: { data: { projectId: string; workspace?: string } }) => Promise<BackendProject>
      )({
        data: {
          projectId: params.projectId,
          workspace,
        },
      });
      const project = toRouteProject(projectResponse);

      projectCache.set(cacheKey, { data: project, fetchedAt: Date.now() });

      return { project, workspace };
    } catch (error) {
      if (cached) {
        console.warn("[project-route] using cached project after details fetch failed", {
          projectId: params.projectId,
          workspace,
        });
        return { project: cached.data, workspace };
      }

      try {
        const projects = await (
          listHomeProjectsServerFn as unknown as (input: {
            data: { workspace?: string; environmentId?: string };
          }) => Promise<ApiListResponse<BackendProject>>
        )({
          data: { workspace },
        });
        const routeProjects = toRouteProjectList(projects);

        const requestedProjectId = params.projectId.trim().toLowerCase();
        const recoveredProject = routeProjects.items.find((item) => getProjectIdentityCandidates(item).includes(requestedProjectId));

        if (recoveredProject) {
          console.warn("[project-route] recovered project from list after details fetch failed", {
            projectId: params.projectId,
            workspace,
          });
          projectCache.set(cacheKey, { data: recoveredProject, fetchedAt: Date.now() });
          return { project: recoveredProject, workspace };
        }
      } catch (fallbackError) {
        console.warn("[project-route] fallback project list lookup failed", {
          projectId: params.projectId,
          workspace,
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
      }

      throw error;
    }
  },
  loader: async ({ params, deps, context }) => {
    const requestedProjectId = params.projectId.trim().toLowerCase();
    const workspace = deps.workspace;

    const searchEnvironmentId = deps.environmentId;
    const hasExplicitEnvironment = hasExplicitEnvironmentSelection(searchEnvironmentId);

    const project = (context as any).project as ProjectDetailRouteProject;
    const fallbackSwitcherProjects: ApiListResponse<ProjectDetailRouteProject> = {
      items: [project],
      total: 1,
    };

    const [environmentsResult, persistedEnvironmentResult, allProjectsResult] = await Promise.allSettled([
      (
        listProjectEnvironmentsServerFn as unknown as (input: {
          data: { workspace?: string };
        }) => Promise<Array<{ _id: string; isDefault?: boolean }>>
      )({
        data: { workspace },
      }).catch(() => []),
      (getActiveEnvironmentPreferenceServerFn as unknown as (input: { data?: { workspace?: string } }) => Promise<string | null>)({
        data: { workspace },
      }).catch(() => null),
      (
        listHomeProjectsServerFn as unknown as (input: {
          data: { workspace?: string; environmentId?: string };
        }) => Promise<ApiListResponse<BackendProject>>
      )({
        data: { workspace, environmentId: searchEnvironmentId },
      }),
    ]);

    const environments = environmentsResult.status === "fulfilled" ? environmentsResult.value : [];
    const persistedEnvironmentId = persistedEnvironmentResult.status === "fulfilled" ? persistedEnvironmentResult.value : null;

    let projectSwitcherProjects: ApiListResponse<ProjectDetailRouteProject> = fallbackSwitcherProjects;
    if (allProjectsResult.status === "fulfilled") {
      projectSwitcherProjects = toRouteProjectList(allProjectsResult.value);
    } else {
      console.warn("[project-route] listHomeProjects failed; falling back to current project", {
        projectId: params.projectId,
        workspace,
        environmentId: searchEnvironmentId,
      });
    }

    const environmentId = resolveEnvironmentId({
      requestedEnvironmentId: searchEnvironmentId,
      preferredEnvironmentId: persistedEnvironmentId,
      environments,
    });

    if (environmentId && environmentId !== searchEnvironmentId) {
      try {
        const resolvedProjects = await (
          listHomeProjectsServerFn as unknown as (input: {
            data: { workspace?: string; environmentId?: string };
          }) => Promise<ApiListResponse<BackendProject>>
        )({
          data: { workspace, environmentId },
        });
        projectSwitcherProjects = toRouteProjectList(resolvedProjects);
      } catch {
        console.warn("[project-route] listHomeProjects for resolved environment failed; keeping fallback data", {
          projectId: params.projectId,
          workspace,
          environmentId,
        });
      }
    }

    const projectVisibleInActiveEnvironment = projectSwitcherProjects.items.some((item) =>
      getProjectIdentityCandidates(item).includes(requestedProjectId),
    );

    if (!projectVisibleInActiveEnvironment) {
      throw redirect({
        to: "/projects",
        search: {
          ...(workspace ? { workspace } : {}),
          ...(hasExplicitEnvironment && environmentId ? { environmentId } : {}),
        } as any,
      });
    }

    return {
      project,
      workspace,
      projectSwitcherProjects,
    };
  },
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const { project, workspace } = Route.useLoaderData();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const getDeploymentRunLogs = useServerFn(listDeploymentRunLogsServerFn as any) as (args: {
    data: {
      logId: string;
      workspace?: string;
    };
  }) => Promise<{ entries: DeploymentDrawerLogEntry[] }>;

  const router = useRouter();
  const { sendNotification } = usePushNotification(workspace);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentLog | null>(null);
  const [drawerLogsByDeploymentId, setDrawerLogsByDeploymentId] = useState<Record<string, DeploymentDrawerLogEntry[]>>({});
  const drawerLogsByDeploymentIdRef = useRef<Record<string, DeploymentDrawerLogEntry[]>>({});
  const [drawerLogsLoading, setDrawerLogsLoading] = useState(false);
  const [drawerLogsError, setDrawerLogsError] = useState<string | null>(null);

  const isDomainSettings = new RegExp(`^/projects/[^/]+/domains/[^/]+`).test(pathname);

  const selectedDeploymentLogs = selectedDeployment ? (drawerLogsByDeploymentId[selectedDeployment.id] ?? []) : [];

  useEffect(() => {
    drawerLogsByDeploymentIdRef.current = drawerLogsByDeploymentId;
  }, [drawerLogsByDeploymentId]);

  let drawerStatus: "Successful" | "Failed" | "Pending" = "Pending";
  const selectedStatus = selectedDeployment?.status?.toLowerCase();
  if (selectedStatus === "active" || selectedStatus === "ready") {
    drawerStatus = "Successful";
  } else if (selectedStatus === "failed") {
    drawerStatus = "Failed";
  }

  const fetchLogsForDeployment = useCallback(
    async (
      deployment: DeploymentLog,
      options?: {
        revalidate?: boolean;
        silent?: boolean;
        merge?: boolean;
      },
    ) => {
      if (!deployment.id) {
        setDrawerLogsError("Missing deployment log ID.");
        setDrawerLogsLoading(false);
        return;
      }

      const cached = drawerLogsByDeploymentIdRef.current[deployment.id];
      if (cached && !options?.revalidate) {
        setDrawerLogsError(null);
        setDrawerLogsLoading(false);
        return;
      }

      const shouldShowLoader = !options?.silent && !cached;
      if (shouldShowLoader) {
        setDrawerLogsLoading(true);
      }
      setDrawerLogsError(null);

      try {
        const result = await getDeploymentRunLogs({
          data: {
            logId: deployment.id,
            workspace,
          },
        });

        const incomingEntries = Array.isArray(result?.entries) ? result.entries : [];

        setDrawerLogsByDeploymentId((prev) => {
          const existingEntries = prev[deployment.id] ?? [];
          let nextEntries = sortDeploymentDrawerEntries(incomingEntries);
          if (options?.merge === true) {
            nextEntries = mergeDeploymentDrawerEntries(existingEntries, incomingEntries);
          }

          if (
            existingEntries.length === nextEntries.length &&
            existingEntries.every((entry, index) => getDrawerEntryKey(entry) === getDrawerEntryKey(nextEntries[index]))
          ) {
            return prev;
          }

          return {
            ...prev,
            [deployment.id]: nextEntries,
          };
        });
      } catch {
        setDrawerLogsError("Failed to load deployment logs.");
      } finally {
        if (shouldShowLoader) {
          setDrawerLogsLoading(false);
        }
      }
    },
    [getDeploymentRunLogs, workspace],
  );

  useEffect(() => {
    if (!drawerOpen || !selectedDeployment) return;

    const logId = selectedDeployment.id;
    let cancelled = false;
    const lastSeenKeys = new Set<string>();

    const tick = async () => {
      if (cancelled) return;
      await fetchLogsForDeployment(selectedDeployment, {
        revalidate: true,
        silent: true,
        merge: true,
      });
      if (cancelled) return;

      const list = drawerLogsByDeploymentIdRef.current[logId] ?? [];
      const env = selectedDeployment.environment || "Production";
      const name = (project as BackendProject)?.name || projectId;

      for (const entry of list) {
        const key = getDrawerEntryKey(entry);
        if (lastSeenKeys.has(key)) continue;
        lastSeenKeys.add(key);

        const msg = entry.message;
        if (SUCCESS_LOG_PATTERN.test(msg)) {
          sendNotification({
            title: "Deployment Successful",
            body: `${name} (${env}) deployed successfully.`,
            onClick: () => window.focus(),
          });
        } else if (FAILURE_LOG_PATTERN.test(msg)) {
          sendNotification({
            title: "Deployment Failed",
            body: `${name} (${env}) deployment failed.`,
            onClick: () => window.focus(),
          });
        }
      }
    };

    void tick();
    const id = setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [drawerOpen, selectedDeployment, sendNotification, project, projectId, fetchLogsForDeployment]);

  useEffect(() => {
    if (!drawerOpen || !selectedDeployment?.id) {
      return;
    }

    const refreshInterval = window.setInterval(() => {
      void fetchLogsForDeployment(selectedDeployment, {
        revalidate: true,
        silent: true,
        merge: true,
      });
    }, 3_000);

    return () => {
      window.clearInterval(refreshInterval);
    };
  }, [drawerOpen, selectedDeployment, fetchLogsForDeployment]);

  const backendProjectId = (project as BackendProject)?.id;

  useEffect(() => {
    if (!backendProjectId) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const { Realtime } = await import("ably");
      if (cancelled) return;

      const ably = new Realtime({
        authUrl: `${config.apiUrl}/v1/ably/token?clientId=${backendProjectId}`,
        clientId: backendProjectId,
      });

      const channel = ably.channels.get(backendProjectId);

      channel.subscribe((message) => {
        const eventName = message.name ?? "";

        if (DEPLOYMENT_EVENT_NAMES.includes(eventName)) {
          window.dispatchEvent(
            new CustomEvent("brimble:deployment-updated", {
              detail: { projectId: backendProjectId, ...(message.data ?? {}) },
            }),
          );
        }

        if (DATABASE_EVENT_NAMES.includes(eventName)) {
          markProjectCacheStale();
          void invalidateActiveMatches(router);
        }
      });

      cleanup = () => {
        try {
          ably.close();
        } catch {
          // ignore
        }
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [backendProjectId, router]);

  const openDeploymentDrawer = useCallback(
    (deployment: DeploymentLog) => {
      const hasCachedLogs = Boolean(drawerLogsByDeploymentIdRef.current[deployment.id]);
      setSelectedDeployment(deployment);
      setDrawerOpen(true);
      void fetchLogsForDeployment(deployment, {
        revalidate: true,
        silent: hasCachedLogs,
        merge: true,
      });
    },
    [fetchLogsForDeployment],
  );

  const closeDeploymentDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const syncDeploymentInDrawer = useCallback((update: Partial<DeploymentLog> & { id: string }) => {
    setSelectedDeployment((previous) => {
      if (!previous || previous.id !== update.id) {
        return previous;
      }

      return {
        ...previous,
        ...update,
      };
    });
  }, []);

  const drawerContextValue = useMemo<ProjectDeploymentLogsDrawerContextValue>(
    () => ({
      drawerOpen,
      selectedDeployment,
      openDeploymentDrawer,
      closeDeploymentDrawer,
      syncDeploymentInDrawer,
    }),
    [closeDeploymentDrawer, drawerOpen, openDeploymentDrawer, selectedDeployment, syncDeploymentInDrawer],
  );

  return (
    <ProjectDeploymentLogsDrawerContext.Provider value={drawerContextValue}>
      <div>
        {!isDomainSettings && <ProjectSubnav projectId={projectId} />}
        <Outlet />
        {selectedDeployment ? (
          <DeploymentLogsDrawer
            open={drawerOpen}
            onOpenChange={(open) => {
              if (!open) {
                closeDeploymentDrawer();
              }
            }}
            environment={selectedDeployment.environment || "Production"}
            status={drawerStatus}
            deploymentStatus={selectedDeployment.status}
            logs={selectedDeploymentLogs}
            loading={drawerLogsLoading}
            emptyMessage={drawerLogsError || "No logs available for this deployment yet."}
            projectId={project?.id || projectId}
            deploymentId={selectedDeployment.id}
            workspace={workspace}
          />
        ) : null}
      </div>
    </ProjectDeploymentLogsDrawerContext.Provider>
  );
}
