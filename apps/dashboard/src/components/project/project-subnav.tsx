import { useState, useRef, useEffect } from "react";
import { cn } from "@brimble/ui";
import { Link, getRouteApi, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Star, Share2, Check, Plug, Bolt, ArrowUp, ChevronDown, MoreHorizontal } from "lucide-react";
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
} from "@phosphor-icons/react";
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
import { DatabaseConnectionModal } from "./database-connection-modal";

const baseTabs = [
  { label: "Projects details", slug: "", Icon: GlobeSimple },
  { label: "Configuration", slug: "configuration", Icon: GearSix },
  { label: "Observability", slug: "observability", Icon: ChartBar },
  { label: "Web analytics", slug: "web-analytics", Icon: Pulse },
  { label: "Domains", slug: "domains", Icon: FileText },
  { label: "Environment", slug: "environment", Icon: LockKey },
  { label: "Deployment history", slug: "deployment-history", Icon: RocketLaunch },
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
    };
  }) => Promise<{ success: boolean }>;
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
  const [connectOpen, setConnectOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [copied, setCopied] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [redeployOpen, setRedeployOpen] = useState(false);
  const redeployRef = useRef<HTMLDivElement>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
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
  const databaseProject = isDatabaseProject(project as any);
  const databaseStatus = String(project?.status || "").toUpperCase();
  const canOpenDatabaseConnection = databaseProject && databaseStatus === "ACTIVE";
  const tabs = baseTabs.filter((tab) => {
    if (tab.slug === "observability" && !shouldShowProjectObservabilityTab(project as any)) {
      return false;
    }

    if (tab.slug === "web-analytics" && !shouldShowProjectWebAnalyticsTab(project as any)) {
      return false;
    }

    if (tab.slug === "domains" && !shouldShowProjectDomainsTab(project as any)) {
      return false;
    }

    if (tab.slug === "deployment-history" && !shouldShowDeploymentHistoryTab(project as any)) {
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
    const tabPath = tab.slug
      ? `/projects/${projectId}/${tab.slug}`
      : `/projects/${projectId}`;
    const isActive = tab.slug
      ? pathname === tabPath || pathname === `${tabPath}/`
      : pathname === `/projects/${projectId}` ||
        pathname === `/projects/${projectId}/`;

    return {
      ...tab,
      tabPath,
      isActive,
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

    try {
      setDeploying(true);
      setRedeployOpen(false);
      toast.loading("Redeploying project...", { id: "redeploy" });

      await redeployProject({
        data: {
          projectId: actualProjectId,
          workspace,
          logId: options?.logId,
        },
      });

      toast.success("Redeploy started", {
        id: "redeploy",
        description: `${projectName} is being redeployed to production.`,
      });

      markDeploymentHistoryForRefresh({
        projectId: actualProjectId,
        workspace,
      });
      router.invalidate();
    } catch (error: any) {
      toast.error("Failed to redeploy project", {
        id: "redeploy",
        description:
          typeof error?.message === "string" ? error.message : "Please try again.",
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

    try {
      setBackingUp(true);
      toast.loading("Starting database backup...", { id: "database-backup" });
      const result = await backupDatabase({
        data: {
          projectId: actualProjectId,
          workspace,
        },
      });
      toast.success("Database backup initiated", {
        id: "database-backup",
        description: result?.message || "Backup has been queued.",
      });
      router.invalidate();
    } catch (error: any) {
      toast.error("Failed to initiate backup", {
        id: "database-backup",
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

    try {
      setRefreshingDb(true);
      toast.loading("Applying database update...", { id: "database-refresh" });
      const result = await refreshDatabase({
        data: {
          projectId: actualProjectId,
          workspace,
        },
      });
      toast.success("Database update started", {
        id: "database-refresh",
        description: result?.message || "Updates should be visible shortly.",
      });
      router.invalidate();
    } catch (error: any) {
      toast.error("Failed to update database", {
        id: "database-refresh",
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
        <div className="scrollbar-hidden flex min-w-0 flex-1 items-start overflow-x-auto">
          {visibleTabs.map((tab) => {
            return (
              <Link
                key={tab.label}
                to={withWorkspaceQuery({ pathname: tab.tabPath, searchStr }) as any}
                preload="intent"
                onClick={() => haptics.selection()}
                className={cn(
                  "flex h-14 items-center gap-2 px-2 text-sm tracking-[-0.09px] transition-colors",
                  tab.isActive
                    ? "border-b border-[#3c6ce7] text-dash-text-strong"
                    : "text-dash-text-faded font-light hover:text-dash-text-body"
                )}
              >
                <tab.Icon className={cn("size-4 shrink-0", !tab.isActive && "dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80")} weight="fill" />
                <span className={cn("whitespace-nowrap md:inline", tab.isActive ? "inline" : "hidden")}>{tab.label}</span>
              </Link>
            );
          })}
          {overflowTabs.length > 0 && (
            <div className="relative" ref={overflowRef}>
              <button
                type="button"
                onClick={() => setOverflowOpen((prev) => !prev)}
                className={cn(
                  "flex h-14 items-center px-2 transition-colors",
                  overflowHasActive
                    ? "border-b border-[#3c6ce7] text-dash-text-strong"
                    : "text-dash-text-faded hover:text-dash-text-body",
                )}
                aria-label="More tabs"
              >
                <MoreHorizontal className="size-4" />
              </button>
              <AnimatePresence>
                {overflowOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute left-0 top-full z-50 mt-1 min-w-[220px] origin-top-left overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_4px_12px_-4px_rgba(0,0,0,0.12)]"
                  >
                    {overflowTabs.map((tab) => (
                      <Link
                        key={tab.label}
                        to={withWorkspaceQuery({ pathname: tab.tabPath, searchStr }) as any}
                        preload="intent"
                        onClick={() => {
                          haptics.selection();
                          setOverflowOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                          tab.isActive
                            ? "bg-dash-bg-elevated text-dash-text-strong"
                            : "text-dash-text-body hover:bg-dash-bg-elevated",
                        )}
                      >
                        <tab.Icon className="size-4 shrink-0" weight="fill" />
                        <span className="whitespace-nowrap">{tab.label}</span>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-5 px-3.5">
          {databaseProject && (
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
          {canRedeployProject(project as any) && (
            <div className="relative" ref={redeployRef}>
              <button
                disabled={deploying}
                onClick={() => setRedeployOpen((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-light text-dash-text-body transition-colors hover:text-dash-text-strong disabled:opacity-50"
              >
                {deploying ? (
                  <Spinner size="size-3.5" />
                ) : (
                  <RocketLaunch className="size-4 sm:hidden" />
                )}
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
            <button className="text-dash-text-faded hover:text-dash-text-strong transition-colors">
              <Star className="size-4" />
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
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

          try {
            setDeleting(true);
            toast.loading("Deleting project...", { id: "delete-project" });

            await deleteProject({
              data: {
                projectId: actualProjectId,
                workspace,
              },
            });

            toast.success(`${projectName} deleted successfully`, {
              id: "delete-project",
            });
            await router.invalidate();

            const nextUrl = withWorkspaceQuery({
              pathname: "/projects",
              searchStr,
            });

            await navigate({
              to: nextUrl as any,
              replace: true,
            });
          } catch (error: any) {
            toast.error("Failed to delete project", {
              id: "delete-project",
              description:
                typeof error?.message === "string" ? error.message : "Please try again.",
            });
            throw error;
          } finally {
            setDeleting(false);
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
    </>
  );
}
