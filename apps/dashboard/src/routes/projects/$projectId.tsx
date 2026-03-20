import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProjectSubnav } from "../../components/project/project-subnav";
import { DeploymentLogsDrawer } from "../../components/shared/deployment-logs-drawer";
import { getProjectDetailsServerFn, listHomeProjectsServerFn } from "@/server/projects/actions";
import {
  getActiveEnvironmentPreferenceServerFn,
  listProjectEnvironmentsServerFn,
} from "@/server/environments/actions";
import { listDeploymentRunLogsServerFn } from "@/server/deployments/actions";
import type { Project as BackendProject } from "@/backend/projects";
import type { ApiListResponse } from "@/backend";
import type { DeploymentLog } from "@/backend/deployments";
import type { DeploymentDrawerLogEntry } from "@/utils/deployment-logs";
import {
  hasExplicitEnvironmentSelection,
  resolveEnvironmentId,
} from "@/utils/environment-selection";
import {
  ProjectDeploymentLogsDrawerContext,
  type ProjectDeploymentLogsDrawerContextValue,
} from "@/contexts/project-deployment-logs-drawer-context";
import { getSupabaseClient } from "@/lib/supabase";
import { mapDeploymentRunLogsToDrawerEntries } from "@/utils/deployment-logs";
import { usePushNotification } from "@/hooks/use-push-notification";
import config from "@/config";

const SUCCESS_LOG_PATTERN = /site (is )?(live|running)\b/i;
const FAILURE_LOG_PATTERN = /deployment failed|build failed|failed to deploy/i;

export const Route = createFileRoute("/projects/$projectId")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  loaderDeps: ({ search }) => {
    const rawSearch = search as Record<string, unknown>;
    const workspace =
      typeof rawSearch.workspace === "string" && rawSearch.workspace.trim().length > 0
        ? rawSearch.workspace.trim()
        : undefined;
    const environmentId =
      typeof rawSearch.environmentId === "string" &&
      rawSearch.environmentId.trim().length > 0
        ? rawSearch.environmentId.trim()
        : undefined;

    return {
      workspace,
      environmentId,
    };
  },
  beforeLoad: async ({ params, search }) => {
    const rawSearch = search as Record<string, unknown>;
    const workspace =
      typeof rawSearch.workspace === "string" && rawSearch.workspace.trim().length > 0
        ? rawSearch.workspace.trim()
        : undefined;

    const project = await (getProjectDetailsServerFn as unknown as (input: {
      data: { projectId: string; workspace?: string };
    }) => Promise<BackendProject>)({
      data: {
        projectId: params.projectId,
        workspace,
      },
    });

    return { project, workspace };
  },
  loader: async ({ params, deps, context }) => {
    const requestedProjectId = params.projectId.trim().toLowerCase();
    const workspace = deps.workspace;
    const searchEnvironmentId = deps.environmentId;
    const hasExplicitEnvironment = hasExplicitEnvironmentSelection(searchEnvironmentId);
    const [environments, persistedEnvironmentId] = await Promise.all([
      (listProjectEnvironmentsServerFn as unknown as (input: {
        data: { workspace?: string };
      }) => Promise<Array<{ _id: string; isDefault?: boolean }>>)({
        data: { workspace },
      }).catch(() => []),
      (getActiveEnvironmentPreferenceServerFn as unknown as (input: {
        data?: { workspace?: string };
      }) => Promise<string | null>)({
        data: { workspace },
      }).catch(() => null),
    ]);
    const environmentId = resolveEnvironmentId({
      requestedEnvironmentId: searchEnvironmentId,
      preferredEnvironmentId: persistedEnvironmentId,
      environments,
    });
    const projectSwitcherProjects = await (listHomeProjectsServerFn as unknown as (input: {
      data: { workspace?: string; environmentId?: string };
    }) => Promise<ApiListResponse<BackendProject>>)({
      data: { workspace, environmentId },
    });

    const projectVisibleInActiveEnvironment = projectSwitcherProjects.items.some((item) => {
      const candidates = [item.slug, item.id, item.name]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim().toLowerCase());
      return candidates.includes(requestedProjectId);
    });

    if (!projectVisibleInActiveEnvironment) {
      throw redirect({
        to: "/projects",
        search: {
          ...(workspace ? { workspace } : {}),
          ...(hasExplicitEnvironment && environmentId
            ? { environmentId }
            : {}),
        } as any,
      });
    }

    const project = (context as any).project as BackendProject;

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
  const getDeploymentRunLogs = useServerFn(
    listDeploymentRunLogsServerFn as any,
  ) as (args: {
    data: {
      logId: string;
      workspace?: string;
    };
  }) => Promise<{ entries: DeploymentDrawerLogEntry[] }>;

  const { sendNotification } = usePushNotification(workspace);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDeployment, setSelectedDeployment] =
    useState<DeploymentLog | null>(null);
  const [drawerLogsByDeploymentId, setDrawerLogsByDeploymentId] = useState<
    Record<string, DeploymentDrawerLogEntry[]>
  >({});
  const [drawerLogsLoading, setDrawerLogsLoading] = useState(false);
  const [drawerLogsError, setDrawerLogsError] = useState<string | null>(null);

  const isDomainSettings = new RegExp(
    `^/projects/[^/]+/domains/[^/]+`,
  ).test(pathname);

  const selectedDeploymentLogs = selectedDeployment
    ? drawerLogsByDeploymentId[selectedDeployment.id] ?? []
    : [];

  let drawerStatus: "Successful" | "Failed" | "Pending" = "Pending";
  const selectedStatus = selectedDeployment?.status?.toLowerCase();
  if (selectedStatus === "active" || selectedStatus === "ready") {
    drawerStatus = "Successful";
  } else if (selectedStatus === "failed") {
    drawerStatus = "Failed";
  }

  const fetchLogsForDeployment = useCallback(
    async (deployment: DeploymentLog) => {
      if (!deployment.id) {
        setDrawerLogsError("Missing deployment log ID.");
        setDrawerLogsLoading(false);
        return;
      }

      const cached = drawerLogsByDeploymentId[deployment.id];
      if (cached) {
        setDrawerLogsError(null);
        setDrawerLogsLoading(false);
        return;
      }

      setDrawerLogsLoading(true);
      setDrawerLogsError(null);

      try {
        const result = await getDeploymentRunLogs({
          data: {
            logId: deployment.id,
            workspace,
          },
        });

        setDrawerLogsByDeploymentId((prev) => ({
          ...prev,
          [deployment.id]: Array.isArray(result?.entries) ? result.entries : [],
        }));
      } catch {
        setDrawerLogsError("Failed to load deployment logs.");
      } finally {
        setDrawerLogsLoading(false);
      }
    },
    [drawerLogsByDeploymentId, getDeploymentRunLogs, workspace],
  );

  useEffect(() => {
    if (!drawerOpen || !selectedDeployment) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const logId = selectedDeployment.id;
    const channel = supabase
      .channel(`deployment-logs-${logId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: config.supabaseTableName,
        },
        (payload) => {
          const row = payload.new as any;
          if (row.logId !== logId) return;

          const [entry] = mapDeploymentRunLogsToDrawerEntries([row]);
          if (!entry) return;

          // Fire push notification on terminal log messages
          const msg = entry.message;
          const env = selectedDeployment.environment || "Production";
          const name = (project as BackendProject)?.name || projectId;
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

          setDrawerLogsByDeploymentId((prev) => ({
            ...prev,
            [logId]: [...(prev[logId] ?? []), entry],
          }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [drawerOpen, selectedDeployment, sendNotification, project, projectId]);

  const openDeploymentDrawer = useCallback(
    (deployment: DeploymentLog) => {
      setSelectedDeployment(deployment);
      setDrawerOpen(true);
      void fetchLogsForDeployment(deployment);
    },
    [fetchLogsForDeployment],
  );

  const closeDeploymentDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const drawerContextValue = useMemo<ProjectDeploymentLogsDrawerContextValue>(
    () => ({
      drawerOpen,
      selectedDeployment,
      openDeploymentDrawer,
      closeDeploymentDrawer,
    }),
    [closeDeploymentDrawer, drawerOpen, openDeploymentDrawer, selectedDeployment],
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
            logs={selectedDeploymentLogs}
            loading={drawerLogsLoading}
            emptyMessage={drawerLogsError || "No logs available for this deployment yet."}
          />
        ) : null}
      </div>
    </ProjectDeploymentLogsDrawerContext.Provider>
  );
}
