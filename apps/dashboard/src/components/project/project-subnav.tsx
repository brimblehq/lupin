import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@brimble/ui";
import { Link, getRouteApi, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Share2, Check, Plug, Bolt, ArrowUp, ChevronDown, MoreHorizontal, ArrowLeftRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { Spinner } from "../shared/spinner";
import {
  GlobeSimple,
  GearSix,
  ChartBar,
  Pulse,
  FileText,
  LockKey,
  RocketLaunch,
  Scroll,
  GitBranch,
  ArrowsClockwise,
  Tag,
} from "@phosphor-icons/react";
import { SimpleTooltip } from "../shared/tooltip";
import { usePlanGate } from "@/hooks/use-plan-gate";
import { FolderTrashIcon } from "../shared/folder-trash-icon";
import { WarningModal } from "../shared/warning-modal";
import {
  backupDatabaseProjectServerFn,
  deleteProjectServerFn,
  redeployProjectServerFn,
  refreshDatabaseProjectServerFn,
} from "@/server/projects/actions";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import {
  canRedeployProject,
  isDatabaseProject,
  shouldShowDeploymentHistoryTab,
  shouldShowProjectDomainsTab,
  shouldShowProjectEnvironmentTab,
  shouldShowProjectLogsTab,
  shouldShowProjectObservabilityTab,
  shouldShowProjectWebAnalyticsTab,
  shouldShowProjectVisitSite,
} from "@/utils/project-capabilities";
import { markDeploymentHistoryForRefresh } from "@/utils/deployment-history-refresh";
import { useHasActiveDeployment } from "@/hooks/use-has-active-deployment";
import { DatabaseConnectionModal } from "./database-connection-modal";
import { TransferProjectModal } from "./transfer-project-modal";
import { useFeatureFlag, FeatureFlags } from "@/lib/feature-flags";
import { useStepUpTwoFactor } from "@/hooks/use-step-up-two-factor";
import { withStepUp } from "@/lib/auth/two-factor-step-up";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

const baseTabs = [
  { label: "Projects details", slug: "", Icon: GlobeSimple },
  { label: "Configuration", slug: "configuration", Icon: GearSix },
  { label: "Observability", slug: "observability", Icon: ChartBar },
  { label: "Web analytics", slug: "web-analytics", Icon: Pulse },
  { label: "Domains", slug: "domains", Icon: FileText },
  { label: "Secrets", slug: "environment", Icon: LockKey },
  {
    label: "Deployment history",
    slug: "deployment-history",
    Icon: RocketLaunch,
  },
  { label: "Logs", slug: "logs", Icon: Scroll },
];
const MAX_VISIBLE_SUBNAV_TABS = 5;

const projectRouteApi = getRouteApi("/projects/$projectId");

export function ProjectSubnav({ projectId }: { projectId: string }) {
  const parentLoaderData = projectRouteApi.useLoaderData() as {
    project?: {
      id?: string;
      name?: string;
      serviceType?: string;
      framework?: string;
      previewUrl?: string;
      domains?: Array<{ name?: string }>;
      repo?: { git?: string };
      hasUpdates?: boolean;
      status?: string;
      connectionUri?: string;
      log?: { id?: string; message?: string };
    };
  };
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const router = useRouter();
  const navigate = useNavigate();
  const redeployProject = useServerFn(redeployProjectServerFn as any) as (args: {
    data: {
      projectId: string;
      workspace?: string;
      logId?: string;
    };
  }) => Promise<{ id?: string; message?: string }>;
  const deleteProject = useServerFn(deleteProjectServerFn as any) as (args: {
    data: {
      projectId: string;
      workspace?: string;
      twoFactorToken?: string;
    };
  }) => Promise<{ success: boolean }>;
  const { requestStepUp } = useStepUpTwoFactor();
  const backupDatabase = useServerFn(backupDatabaseProjectServerFn as any) as (args: {
    data: {
      projectId: string;
      workspace?: string;
    };
  }) => Promise<{ message?: string }>;
  const refreshDatabase = useServerFn(refreshDatabaseProjectServerFn as any) as (args: {
    data: {
      projectId: string;
      workspace?: string;
    };
  }) => Promise<{ message?: string }>;
  const haptics = useHaptics();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [copied, setCopied] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [redeployOpen, setRedeployOpen] = useState(false);
  const redeployRef = useRef<HTMLDivElement>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowTriggerRef = useRef<HTMLButtonElement>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const [overflowMenuPos, setOverflowMenuPos] = useState({ top: 0, left: 0 });
  const [deleting, setDeleting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [refreshingDb, setRefreshingDb] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (redeployRef.current && !redeployRef.current.contains(e.target as Node)) {
        setRedeployOpen(false);
      }
    }
    if (redeployOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [redeployOpen]);

  const updateOverflowMenuPosition = useCallback(() => {
    if (!overflowTriggerRef.current) return;
    const rect = overflowTriggerRef.current.getBoundingClientRect();
    setOverflowMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
    });
  }, []);

  useLayoutEffect(() => {
    if (!overflowOpen) return;

    updateOverflowMenuPosition();
    window.addEventListener("resize", updateOverflowMenuPosition, {
      passive: true,
    });
    window.addEventListener("scroll", updateOverflowMenuPosition, {
      capture: true,
      passive: true,
    });

    return () => {
      window.removeEventListener("resize", updateOverflowMenuPosition);
      window.removeEventListener("scroll", updateOverflowMenuPosition, {
        capture: true,
      });
    };
  }, [overflowOpen, updateOverflowMenuPosition]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (overflowTriggerRef.current?.contains(e.target as Node) || overflowMenuRef.current?.contains(e.target as Node)) {
        return;
      }
      if (overflowOpen) {
        setOverflowOpen(false);
      }
    }

    if (overflowOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [overflowOpen]);

  useEffect(() => {
    setOverflowOpen(false);
  }, [pathname]);

  const actualProjectId = parentLoaderData?.project?.id || projectId;
  const projectName = parentLoaderData?.project?.name || projectId;
  const project = parentLoaderData?.project;
  const workspaceParam = new URLSearchParams(searchStr || "").get("workspace") || undefined;
  const hasActiveDeployment = useHasActiveDeployment(actualProjectId, workspaceParam);
  const databaseProject = isDatabaseProject(project as any);
  const databaseStatus = String(project?.status || "").toUpperCase();
  const canOpenDatabaseConnection = databaseProject && databaseStatus === "ACTIVE";

  const domainsEnabled = useFeatureFlag(FeatureFlags.ENABLE_DOMAINS);
  const deploymentsEnabled = useFeatureFlag(FeatureFlags.ENABLE_DEPLOYMENTS);
  const databasesEnabled = useFeatureFlag(FeatureFlags.ENABLE_DATABASES);
  const webAnalyticsEnabled = useFeatureFlag(FeatureFlags.ENABLE_WEB_ANALYTICS);
  const planSupportsAnalytics = usePlanGate().analytics !== false;

  const tabs = baseTabs.filter((tab) => {
    if (tab.slug === "observability" && !shouldShowProjectObservabilityTab(project as any)) {
      return false;
    }

    if (tab.slug === "web-analytics" && (!webAnalyticsEnabled || !shouldShowProjectWebAnalyticsTab(project as any))) {
      return false;
    }

    if (tab.slug === "domains" && (!domainsEnabled || !shouldShowProjectDomainsTab(project as any))) {
      return false;
    }

    if (tab.slug === "deployment-history" && (!deploymentsEnabled || !shouldShowDeploymentHistoryTab(project as any))) {
      return false;
    }

    if (tab.slug === "environment" && !shouldShowProjectEnvironmentTab(project as any)) {
      return false;
    }

    if (tab.slug === "logs" && !shouldShowProjectLogsTab(project as any)) {
      return false;
    }

    return true;
  });
  const tabsWithPath = tabs.map((tab) => {
    const tabPath = tab.slug ? `/projects/${projectId}/${tab.slug}` : `/projects/${projectId}`;
    const isActive = tab.slug
      ? pathname === tabPath || pathname === `${tabPath}/`
      : pathname === `/projects/${projectId}` || pathname === `/projects/${projectId}/`;
    const observabilityLocked = tab.slug === "observability" && !planSupportsAnalytics && !databaseProject;
    const webAnalyticsLocked = tab.slug === "web-analytics" && !planSupportsAnalytics;
    const locked = observabilityLocked || webAnalyticsLocked;

    return {
      ...tab,
      tabPath,
      isActive,
      locked,
    };
  });
  const visibleTabs = tabsWithPath.slice(0, MAX_VISIBLE_SUBNAV_TABS);
  const overflowTabs = tabsWithPath.slice(MAX_VISIBLE_SUBNAV_TABS);
  const overflowHasActive = overflowTabs.some((tab) => tab.isActive);

  let visitHref = "";
  if (shouldShowProjectVisitSite(project as any)) {
    const rawUrl = project?.previewUrl || project?.domains?.[0]?.name || "";
    if (rawUrl) {
      if (rawUrl.startsWith("http")) {
        visitHref = rawUrl;
      } else {
        visitHref = `https://${rawUrl}`;
      }
    }
  }

  async function handleRedeploy(options?: { logId?: string }) {
    if (deploying) {
      return;
    }

    const params = new URLSearchParams(searchStr || "");
    const workspace = params.get("workspace") || undefined;
    const toastId = `${actualProjectId}-redeploy-${Date.now()}`;

    try {
      setDeploying(true);
      setRedeployOpen(false);
      toast.loading("Redeploying project...", { id: toastId });

      await redeployProject({
        data: {
          projectId: actualProjectId,
          workspace,
          logId: options?.logId,
        },
      });

      toast.success("Redeploy started", {
        id: toastId,
        description: `${projectName} is being redeployed to production.`,
        action: {
          label: "View deployment",
          onClick: () => {
            void navigate({
              to: "/projects/$projectId/deployment-history",
              params: { projectId: actualProjectId },
              search: workspace ? ({ workspace } as any) : ({} as any),
            });
          },
        },
      });

      markDeploymentHistoryForRefresh({
        projectId: actualProjectId,
        workspace,
      });
      void invalidateActiveMatches(router);
    } catch (error: any) {
      toast.error("Failed to redeploy project", {
        id: toastId,
        description: typeof error?.message === "string" ? error.message : "Please try again.",
      });
    } finally {
      setDeploying(false);
    }
  }

  async function handleDatabaseBackup() {
    if (backingUp) {
      return;
    }

    const params = new URLSearchParams(searchStr || "");
    const workspace = params.get("workspace") || undefined;
    const toastId = `${actualProjectId}-database-backup-${Date.now()}`;

    try {
      setBackingUp(true);
      toast.loading("Starting database backup...", { id: toastId });
      const result = await backupDatabase({
        data: {
          projectId: actualProjectId,
          workspace,
        },
      });
      toast.success("Database backup initiated", {
        id: toastId,
        description: result?.message || "Backup has been queued.",
      });
      void invalidateActiveMatches(router);
    } catch (error: any) {
      toast.error("Failed to initiate backup", {
        id: toastId,
        description: typeof error?.message === "string" ? error.message : "Please try again.",
      });
    } finally {
      setBackingUp(false);
    }
  }

  async function handleDatabaseRefresh() {
    if (refreshingDb) {
      return;
    }

    const params = new URLSearchParams(searchStr || "");
    const workspace = params.get("workspace") || undefined;
    const toastId = `${actualProjectId}-database-refresh-${Date.now()}`;

    try {
      setRefreshingDb(true);
      toast.loading("Applying database update...", { id: toastId });
      const result = await refreshDatabase({
        data: {
          projectId: actualProjectId,
          workspace,
        },
      });
      toast.success("Database update started", {
        id: toastId,
        description: result?.message || "Updates should be visible shortly.",
      });
      void invalidateActiveMatches(router);
    } catch (error: any) {
      toast.error("Failed to update database", {
        id: toastId,
        description: typeof error?.message === "string" ? error.message : "Please try again.",
      });
    } finally {
      setRefreshingDb(false);
    }
  }

  return (
    <>
      <div data-subnav className="flex items-center justify-between border-b-[0.5px] border-dash-border">
        {/* Tabs */}
        <div className="scrollbar-hidden flex min-w-0 flex-1 items-start overflow-x-auto md:overflow-visible">
          {visibleTabs.map((tab) => {
            if (tab.locked) {
              return (
                <div
                  key={tab.label}
                  aria-disabled="true"
                  className="flex h-14 cursor-not-allowed items-center gap-2 px-2 text-sm font-light tracking-[-0.09px] text-dash-text-faded opacity-50"
                >
                  <tab.Icon
                    className="size-4 shrink-0 dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80"
                    weight="fill"
                  />
                  <span className="hidden whitespace-nowrap md:inline">{tab.label}</span>
                  <SimpleTooltip
                    content={
                      <>
                        <RocketLaunch className="size-3.5" weight="fill" />
                        Upgrade to a higher plan to access this feature
                      </>
                    }
                  >
                    <button type="button" aria-label="Upgrade required" className="flex shrink-0 items-center">
                      <Tag className="size-3.5 text-dash-text-faded" weight="fill" />
                    </button>
                  </SimpleTooltip>
                </div>
              );
            }

            return (
              <Link
                key={tab.label}
                to={
                  withWorkspaceQuery({
                    pathname: tab.tabPath,
                    searchStr,
                  }) as any
                }
                preload="intent"
                onClick={() => haptics.selection()}
                className={cn(
                  "flex h-14 items-center gap-2 px-2 text-sm tracking-[-0.09px] transition-colors duration-200 ease-out",
                  tab.isActive
                    ? "border-b border-[#3c6ce7] text-dash-text-strong"
                    : "text-dash-text-faded font-light hover:text-dash-text-strong",
                )}
              >
                <tab.Icon className="size-4 shrink-0" weight="fill" />
                <span className={cn("whitespace-nowrap md:inline", tab.isActive ? "inline" : "hidden")}>{tab.label}</span>
              </Link>
            );
          })}
          {overflowTabs.length > 0 && (
            <button
              ref={overflowTriggerRef}
              type="button"
              onClick={() => setOverflowOpen((prev) => !prev)}
              className={cn(
                "relative flex h-14 items-center px-2 transition-colors duration-200 ease-out",
                overflowHasActive ? "border-b border-[#3c6ce7] text-dash-text-strong" : "text-dash-text-faded hover:text-dash-text-strong",
              )}
              aria-label="More tabs"
            >
              <MoreHorizontal className="size-4" />
              {hasActiveDeployment && <span className="absolute right-1 top-3.5 size-2 rounded-full bg-[#fc391e]" />}
            </button>
          )}
        </div>

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-5 px-3.5">
          {databaseProject && databasesEnabled && (
            <>
              <button
                disabled={!canOpenDatabaseConnection}
                onClick={() => setConnectOpen(true)}
                className="hidden items-center gap-1.5 text-sm font-light text-dash-text-body transition-colors hover:text-dash-text-strong disabled:cursor-not-allowed disabled:opacity-40 md:flex"
              >
                <Plug className="size-4" />
                <span>Connect</span>
              </button>
              <button
                disabled={backingUp}
                onClick={() => {
                  void handleDatabaseBackup();
                }}
                className="hidden items-center gap-1.5 text-sm font-light text-dash-text-body transition-colors hover:text-dash-text-strong disabled:opacity-50 md:flex"
              >
                {backingUp ? <Spinner size="size-3.5" /> : <Bolt className="size-4" />}
                <span>{backingUp ? "Starting..." : "Initiate Backup"}</span>
              </button>
              {Boolean(project?.hasUpdates) && (
                <button
                  disabled={refreshingDb}
                  onClick={() => {
                    void handleDatabaseRefresh();
                  }}
                  className="hidden items-center gap-1.5 text-sm font-light text-dash-text-body transition-colors hover:text-dash-text-strong disabled:opacity-50 md:flex"
                >
                  {refreshingDb ? <Spinner size="size-3.5" /> : <ArrowUp className="size-4" />}
                  <span>{refreshingDb ? "Updating..." : "Click to Update"}</span>
                </button>
              )}
            </>
          )}
          {deploymentsEnabled && canRedeployProject(project as any) && (
            <div className="relative" ref={redeployRef}>
              <button
                disabled={deploying}
                onClick={() => setRedeployOpen((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-light text-dash-text-body transition-colors hover:text-dash-text-strong disabled:opacity-50"
              >
                {deploying ? <Spinner size="size-3.5" /> : <RocketLaunch className="size-4 sm:hidden" />}
                <span className="hidden sm:inline">{deploying ? "Redeploying..." : "Redeploy"}</span>
                <ChevronDown className="hidden size-3.5 sm:block" />
              </button>
              <AnimatePresence>
                {redeployOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-full z-50 mt-1 w-[220px] origin-top-right overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_4px_12px_-4px_rgba(0,0,0,0.12)]"
                  >
                    <button
                      onClick={() => void handleRedeploy()}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
                    >
                      <GitBranch className="size-4 shrink-0" />
                      Deploy latest commit
                    </button>
                    <button
                      onClick={() => void handleRedeploy({ logId: project?.log?.id })}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
                    >
                      <ArrowsClockwise className="size-4 shrink-0" />
                      Redeploy service
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {visitHref && (
            <a
              href={visitHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 text-sm font-light text-dash-text-body transition-colors hover:text-dash-text-strong md:flex"
            >
              <span>Visit site</span>
            </a>
          )}
          <div className="flex items-center gap-4">
            <SimpleTooltip content="Transfer project to workspace">
              <button
                onClick={() => {
                  haptics.selection();
                  setTransferOpen(true);
                }}
                className="text-dash-text-faded transition-colors hover:text-dash-text-strong"
                aria-label="Transfer project to workspace"
              >
                <ArrowLeftRight className="size-4" />
              </button>
            </SimpleTooltip>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href);
                haptics.light();
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-dash-text-faded hover:text-dash-text-strong transition-colors"
            >
              {copied ? <Check className="size-4 text-[#28c840]" /> : <Share2 className="size-4" />}
            </button>
            <button
              onClick={() => {
                setConfirmName("");
                setDeleteOpen(true);
              }}
              className="transition-opacity hover:opacity-70"
            >
              <FolderTrashIcon className="size-4" color="#ef2f1f" />
            </button>
          </div>
        </div>
      </div>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {overflowOpen && overflowTabs.length > 0 && (
              <motion.div
                ref={overflowMenuRef}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: "fixed",
                  top: overflowMenuPos.top,
                  left: overflowMenuPos.left,
                }}
                className="z-[120] min-w-[220px] origin-top-left overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_4px_12px_-4px_rgba(0,0,0,0.12)]"
              >
                {overflowTabs.map((tab) => {
                  if (tab.locked) {
                    return (
                      <SimpleTooltip
                        key={tab.label}
                        side="right"
                        content={
                          <>
                            <RocketLaunch className="size-3.5" weight="fill" />
                            Upgrade to a higher plan to access this feature
                          </>
                        }
                      >
                        <div
                          aria-disabled="true"
                          className="flex w-full cursor-not-allowed items-center gap-2.5 px-3 py-2 text-sm text-dash-text-faded opacity-50"
                        >
                          <tab.Icon className="size-4 shrink-0" weight="fill" />
                          <span className="whitespace-nowrap">{tab.label}</span>
                          <Tag className="ml-auto size-3.5 shrink-0 text-dash-text-faded" weight="fill" />
                        </div>
                      </SimpleTooltip>
                    );
                  }

                  return (
                    <Link
                      key={tab.label}
                      to={
                        withWorkspaceQuery({
                          pathname: tab.tabPath,
                          searchStr,
                        }) as any
                      }
                      preload="intent"
                      onClick={() => {
                        haptics.selection();
                        setOverflowOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                        tab.isActive ? "bg-dash-bg-elevated text-dash-text-strong" : "text-dash-text-body hover:bg-dash-bg-elevated",
                      )}
                    >
                      <tab.Icon className="size-4 shrink-0" weight="fill" />
                      <span className="whitespace-nowrap">{tab.label}</span>
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      <WarningModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this project?"
        description={`This action cannot be undone. All deployments, domains, and environment variables associated with this project will be permanently deleted.`}
        confirmLabel="Delete project"
        cancelLabel="Cancel"
        confirmDisabled={confirmName !== projectName}
        onConfirm={async () => {
          if (deleting) {
            return;
          }

          const params = new URLSearchParams(searchStr || "");
          const workspace = params.get("workspace") || undefined;
          const toastId = `${actualProjectId}-delete-project-${Date.now()}`;
          let deleted = false;

          try {
            setDeleting(true);
            toast.loading("Deleting project...", { id: toastId });

            await withStepUp(
              (twoFactorToken) =>
                deleteProject({
                  data: {
                    projectId: actualProjectId,
                    workspace,
                    twoFactorToken,
                  },
                }),
              requestStepUp,
            );

            toast.success(`${projectName} deleted successfully`, {
              id: toastId,
            });
            deleted = true;
          } catch (error: any) {
            toast.error("Failed to delete project", {
              id: toastId,
              description: typeof error?.message === "string" ? error.message : "Please try again.",
            });
          } finally {
            await invalidateActiveMatches(router);
            setDeleting(false);
          }

          if (deleted) {
            const nextUrl = withWorkspaceQuery({
              pathname: "/projects",
              searchStr,
            });

            await navigate({
              to: nextUrl as any,
              replace: true,
            });
          }
        }}
      >
        <div className="flex flex-col gap-2 text-left">
          <label className="text-sm leading-5 text-dash-text-faded">
            Type <span className="font-medium text-dash-text-strong">{projectName}</span> to confirm
          </label>
          <input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={projectName}
            className="input-base input-focus-red w-full px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]"
          />
        </div>
      </WarningModal>

      <DatabaseConnectionModal
        open={connectOpen}
        onOpenChange={setConnectOpen}
        connectionUri={project?.connectionUri}
        isActive={canOpenDatabaseConnection}
      />

      <TransferProjectModal
        open={transferOpen}
        onOpenChange={setTransferOpen}
        projectId={actualProjectId}
        projectName={projectName}
        currentWorkspaceSlug={workspaceParam}
      />
    </>
  );
}
