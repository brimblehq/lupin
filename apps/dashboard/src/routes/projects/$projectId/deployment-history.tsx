import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import type { Message as AblyMessage } from "ably";
import {
  Search,
  ChevronDown,
  MoreVertical,
  GitBranch,
  Calendar,
  RotateCw,
  ExternalLink,
  XCircle,
  Download,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { NumberPagination } from "../../../components/shared/pagination";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { type DateRange } from "react-day-picker";
import { format, differenceInSeconds } from "date-fns";
import { TabHeader } from "../../../components/shared/tab-header";
import { DeploymentHistoryPending } from "@/components/shared/route-pending";
import { Tooltip } from "../../../components/shared/tooltip";
import { DateRangePicker } from "../../../components/shared/date-range-picker";
import {
  listDeploymentsServerFn,
  redeployServerFn,
  cancelDeploymentServerFn,
  downloadDeploymentLogsServerFn,
} from "@/server/deployments/actions";
import type { PaginatedDeploymentsResponse, DeploymentLog } from "@/backend/deployments";
import {
  defaultDeploymentHistoryDateRange,
  deploymentStatusColor as statusColor,
  deploymentStatusLabel as statusLabel,
  formatDeploymentTimeAgo,
} from "@/utils/deployment-history";
import { consumeDeploymentHistoryRefresh } from "@/utils/deployment-history-refresh";
import { useProjectDeploymentLogsDrawer } from "@/contexts/project-deployment-logs-drawer-context";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { usePlanGate } from "@/hooks/use-plan-gate";
import { ChangePlanModal } from "@/components/shared/change-plan-modal";
import { PLAN_UPGRADE_REQUIRED_CODE } from "@/backend/errors";
import { usePushNotification } from "@/hooks/use-push-notification";
import { Route as RootRoute } from "@/routes/__root";
import type { TeamDetails, TeamMember } from "@/backend/teams";
import { getProjectScopedAblyOptions } from "@/lib/ably-auth";
import type { ListDeploymentsServerFnCaller } from "../project-detail.types";

const parentRoute = getRouteApi("/projects/$projectId");

function normalizeMemberRole(member: TeamMember): string {
  if (member.isCreator) return "Creator";
  const role = (member.role ?? "").toLowerCase();
  if (role.includes("admin")) return "Administrator";
  if (role.includes("creator") || role.includes("owner")) return "Creator";
  return "Member";
}

const PAGE_LIMIT = 10;
const PAGE_CACHE_TTL_MS = 15_000;
const DEPLOYMENTS_REQUEST_TIMEOUT_MS = 15_000;

type DeploymentsCacheEntry = {
  data: PaginatedDeploymentsResponse;
  fetchedAt: number;
};

type DeploymentHistoryLoaderData = {
  deployments: PaginatedDeploymentsResponse;
  workspace?: string;
  timedOut: boolean;
};

type AblyLogEventPayload = {
  id?: string;
  logId?: string;
  name?: string;
  status?: string;
  createdAt?: string;
  startTime?: string | null;
  endTime?: string | null;
  message?: string;
  branch?: string;
  username?: string;
  avatar?: string | null;
  commitLink?: string | null;
  pullRequestLink?: string | null;
  environment?: string;
  domain?: string | null;
};

function createEmptyDeployments(): PaginatedDeploymentsResponse {
  return {
    items: [],
    currentPage: 1,
    totalPages: 1,
    total: 0,
    environments: [],
    statuses: [],
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export const Route = createFileRoute("/projects/$projectId/deployment-history")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  loader: async ({ context }) => {
    const project = (context as any).project;
    const workspace = (context as any).workspace;

    const range = defaultDeploymentHistoryDateRange();

    try {
      const result = await withTimeout(
        (listDeploymentsServerFn as unknown as ListDeploymentsServerFnCaller)({
          data: {
            projectId: project?.id || project?.name,
            workspace,
            page: 1,
            limit: PAGE_LIMIT,
            start: format(range.from!, "yyyy-MM-dd"),
            end: format(range.to!, "yyyy-MM-dd"),
          },
        }),
        DEPLOYMENTS_REQUEST_TIMEOUT_MS,
        "Deployment history request timed out",
      );

      return { deployments: result, workspace, timedOut: false } satisfies DeploymentHistoryLoaderData;
    } catch {
      return { deployments: createEmptyDeployments(), workspace, timedOut: true } satisfies DeploymentHistoryLoaderData;
    }
  },
  component: DeploymentHistoryPage,
  pendingComponent: DeploymentHistoryPending,
});

/* ─── Filter dropdown (reusable) ─── */

function FilterSelect({
  label,
  options,
  value,
  onChange,
  icon,
  dotColors,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  dotColors?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const activeDot = value !== "All" && dotColors?.[value];

  return (
    <div className="relative w-full sm:w-auto" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between overflow-clip rounded-[4px] border border-dash-border bg-dash-bg text-sm text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated sm:w-auto sm:justify-start"
      >
        <span className="flex items-center gap-2 px-3 py-1.5">
          {activeDot ? <span className="size-[6px] shrink-0 rounded-full" style={{ backgroundColor: activeDot }} /> : icon}
          {value === "All" ? label : value}
        </span>
        <span className="flex h-full items-center border-l border-dash-border px-2 py-1.5">
          <ChevronDown className="size-4 text-dash-text-faded" />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full z-50 mt-1 min-w-[160px] origin-top-left overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)]"
          >
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className="mx-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-[2px] px-2 py-1.5 text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated dark:text-dash-text-strong"
              >
                {dotColors?.[option] && (
                  <span className="size-[6px] shrink-0 rounded-full" style={{ backgroundColor: dotColors[option] }} />
                )}
                {option}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Status dots icon for the Status filter ─── */

function StatusDotsIcon() {
  return (
    <div className="flex items-center gap-0.5">
      <span className="h-2 w-1 rounded-full bg-[#13d282]" />
      <span className="h-2 w-1 rounded-full bg-[#ff7a00]" />
      <span className="h-2 w-1 rounded-full bg-[#fc391e]" />
    </div>
  );
}

/* ─── Row action menu (portal-based dropdown, NOT a bottom sheet) ─── */

function DeploymentMenu({
  deployment,
  projectId,
  workspace,
  hasInProgressDeployment,
  onRedeployed,
}: {
  deployment: DeploymentLog;
  projectId: string;
  workspace?: string;
  hasInProgressDeployment?: boolean;
  onRedeployed: () => void;
}) {
  const { canWrite } = useWorkspaceRole();
  const { planKey } = usePlanGate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.right - 192 });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("scroll", updatePos, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", updatePos, { passive: true });
    return () => {
      window.removeEventListener("scroll", updatePos, { capture: true });
      window.removeEventListener("resize", updatePos);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const status = normalizeDeploymentStatus(deployment.status);
  const isInProgress = status === "inprogress";
  const isPending = status === "pending" || status === "queued";
  const isActive = status === "active" || status === "ready";
  const projectInProgress = Boolean(hasInProgressDeployment);

  const canRedeploy = canWrite && !isInProgress && !projectInProgress;
  const canCancel = canWrite && (isInProgress || isPending);
  const canViewApp = isActive && deployment.domain;
  const canViewCommit = !!deployment.commitLink;

  async function handleRedeploy() {
    setLoading(true);
    try {
      await (redeployServerFn as unknown as (input: { data: { projectId: string; logId: string; workspace?: string } }) => Promise<any>)({
        data: { projectId, logId: deployment.id, workspace },
      });
      onRedeployed();
    } catch (error) {
      if ((error as { code?: string })?.code === PLAN_UPGRADE_REQUIRED_CODE) {
        setUpgradeOpen(true);
      }
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  async function handleCancel() {
    setLoading(true);
    try {
      await (
        cancelDeploymentServerFn as unknown as (input: { data: { projectId: string; logId: string; workspace?: string } }) => Promise<any>
      )({
        data: { projectId, logId: deployment.id, workspace },
      });
      onRedeployed();
    } catch {
      // silently fail for now
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  const actions: {
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    visible: boolean;
  }[] = [
    {
      id: "redeploy",
      label: "Redeploy",
      icon: <RotateCw className="size-3.5" />,
      onClick: handleRedeploy,
      visible: canRedeploy,
    },
    {
      id: "download-logs",
      label: downloading ? "Downloading…" : "Download logs",
      icon: downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />,
      onClick: async () => {
        if (downloading) return;
        setDownloading(true);
        try {
          const result = await (
            downloadDeploymentLogsServerFn as unknown as (input: {
              data: { projectId: string; logId: string; workspace?: string };
            }) => Promise<{ content: string; filename: string }>
          )({
            data: { projectId, logId: deployment.id, workspace },
          });
          const blob = new Blob([result.content], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = result.filename.endsWith(".log") ? result.filename : `${result.filename.replace(/\.\w+$/, "")}.log`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "No log entries found for this deployment");
        } finally {
          setDownloading(false);
          setOpen(false);
        }
      },
      visible: true,
    },
    {
      id: "view-commit",
      label: "View commit",
      icon: <ExternalLink className="size-3.5" />,
      onClick: () => {
        if (deployment.commitLink) window.open(deployment.commitLink, "_blank");
        setOpen(false);
      },
      visible: canViewCommit,
    },
    {
      id: "view-app",
      label: "View application",
      icon: <ExternalLink className="size-3.5" />,
      onClick: () => {
        if (deployment.domain)
          window.open(deployment.domain.startsWith("http") ? deployment.domain : `https://${deployment.domain}`, "_blank");
        setOpen(false);
      },
      visible: !!canViewApp,
    },
    {
      id: "cancel",
      label: "Cancel deployment",
      icon: <XCircle className="size-3.5 text-[#fc391e]" />,
      onClick: handleCancel,
      visible: canCancel,
    },
  ];

  const visibleActions = actions.filter((a) => a.visible);
  if (visibleActions.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          if (!open) updatePos();
          setOpen((prev) => !prev);
        }}
        className="ml-4 shrink-0 rounded-[4px] p-1 text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
      >
        {loading ? <RotateCw className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: "fixed",
                  top: pos.top,
                  left: pos.left,
                  width: 192,
                  zIndex: 9999,
                  pointerEvents: "auto",
                }}
                className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_4px_12px_-4px_rgba(0,0,0,0.12)]"
              >
                {visibleActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      <ChangePlanModal open={upgradeOpen} onOpenChange={setUpgradeOpen} currentPlan={planKey} />
    </>
  );
}

/* ─── Deployment row ─── */

function normalizeDeploymentStatus(status?: string): string {
  return status?.trim().toLowerCase() ?? "";
}

function toAblyLogEventPayload(data: unknown): AblyLogEventPayload | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  return data as AblyLogEventPayload;
}

function mapAblyLogEventToDeployment(payload: AblyLogEventPayload): (Partial<DeploymentLog> & { id: string }) | null {
  const logId = payload.logId ? payload.logId.trim() : "";

  const eventId = payload.id ? payload.id.trim() : "";

  const id = logId || eventId;

  if (!id) {
    return null;
  }

  const next: Partial<DeploymentLog> & { id: string } = { id };

  if (payload.name && payload.name.trim()) {
    next.name = payload.name;
  }
  if (payload.status && payload.status.trim()) {
    next.status = payload.status;
  }
  if (payload.branch && payload.branch.trim()) {
    next.branch = payload.branch;
  }
  if (payload.message) {
    next.message = payload.message;
  }
  if (payload.commitLink && payload.commitLink.trim()) {
    next.commitLink = payload.commitLink;
  }
  if (payload.pullRequestLink && payload.pullRequestLink.trim()) {
    next.pullRequestLink = payload.pullRequestLink;
  }
  if (payload.environment && payload.environment.trim()) {
    next.environment = payload.environment;
  }
  if (payload.startTime && payload.startTime.trim()) {
    next.startTime = payload.startTime;
  }
  if (payload.endTime && payload.endTime.trim()) {
    next.endTime = payload.endTime;
  }
  if (payload.createdAt && payload.createdAt.trim()) {
    next.createdAt = payload.createdAt;
  }
  if (payload.username && payload.username.trim()) {
    next.username = payload.username;
  }
  if (payload.avatar && payload.avatar.trim()) {
    next.avatar = payload.avatar;
  }
  if (payload.domain && payload.domain.trim()) {
    next.domain = payload.domain;
  }

  return next;
}

const TERMINAL_STATUSES = new Set([
  "active",
  "ready",
  "successful",
  "succeeded",
  "completed",
  "complete",
  "failed",
  "error",
  "errored",
  "cancelled",
  "canceled",
]);

function useLiveDuration(startTime?: string, endTime?: string, status?: string) {
  const normalizedStatus = normalizeDeploymentStatus(status);
  const isLive = !!startTime && !endTime && !TERMINAL_STATUSES.has(normalizedStatus);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isLive]);

  if (!startTime) return "--";
  const start = new Date(startTime);
  if (isNaN(start.getTime())) return "--";
  const end = endTime ? new Date(endTime) : isLive ? new Date(now) : new Date();
  if (isNaN(end.getTime())) return "--";

  const secs = differenceInSeconds(end, start);
  if (secs < 0) return "--";
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function DeploymentRow({
  deployment,
  projectId,
  workspace,
  hasInProgressDeployment,
  memberRoleMap,
  onClick,
  onRedeployed,
}: {
  deployment: DeploymentLog;
  projectId: string;
  workspace?: string;
  hasInProgressDeployment?: boolean;
  memberRoleMap: Record<string, string>;
  onClick: () => void;
  onRedeployed: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const status = normalizeDeploymentStatus(deployment.status);
  const dot = statusColor[status] ?? "bg-dash-text-faded";
  const label = statusLabel[status] ?? deployment.status ?? "";
  const duration = useLiveDuration(deployment.startTime, deployment.endTime, deployment.status);
  const ago = formatDeploymentTimeAgo(deployment.createdAt);
  const deploymentName = deployment.name || deployment.id;

  const handleCopyName = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      void navigator.clipboard.writeText(deploymentName);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    },
    [deploymentName],
  );

  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-2 border-b-[0.5px] border-dash-border px-3.5 py-4 transition-colors last:border-b-0 hover:bg-dash-bg-elevated sm:gap-0"
    >
      {/* Col 1: Name + environment */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:w-[280px] sm:shrink-0 sm:flex-none">
        <div className="flex min-w-0 items-center gap-1">
          <span className="truncate text-sm tracking-[-0.084px] text-dash-text-strong">{deploymentName}</span>
          <button
            type="button"
            onClick={handleCopyName}
            aria-label={copied ? "Copied log name" : "Copy log name"}
            title={copied ? "Copied" : "Copy log name"}
            className="shrink-0 rounded p-0.5 text-dash-text-extra-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-body"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        </div>
        <span className="text-sm font-light leading-[1.3] text-dash-text-faded">{deployment.environment || "Production"}</span>
      </div>

      {/* Col 2: Status + duration */}
      <div className="flex w-[130px] shrink-0 flex-col gap-0.5 pr-2 sm:w-[180px] sm:px-5">
        <div className="flex items-center gap-1.5">
          <span className={`size-[6px] shrink-0 rounded-full ${dot}`} />
          <span className="text-sm font-light text-dash-text-body">{label}</span>
        </div>
        <span className="pl-[14px] text-sm font-light leading-[1.3] text-dash-text-faded">{duration}</span>
      </div>

      {/* Col 3: Commit + branch */}
      <div className="hidden min-w-0 flex-1 flex-col gap-0.5 pl-2 md:flex">
        <span className="truncate text-sm font-light leading-[1.4] tracking-[-0.28px] text-dash-text-strong">
          {deployment.message || "-"}
        </span>
        <div className="flex min-w-0 items-center gap-1">
          <GitBranch className="size-3.5 shrink-0 text-dash-text-faded" />
          <span className="truncate text-sm font-light leading-[1.3] text-dash-text-faded" title={deployment.branch || "main"}>
            {deployment.branch || "main"}
          </span>
        </div>
      </div>

      {/* Col 4: Time + user */}
      <div className="hidden w-[160px] shrink-0 flex-col gap-0.5 pl-4 md:flex">
        <span className="text-sm tracking-[-0.084px] text-dash-text-strong">{ago}</span>
        <Tooltip
          user={{
            name: deployment.username || "Unknown",
            role: (deployment.username && memberRoleMap[deployment.username]) || "",
            avatarUrl: deployment.avatar,
          }}
          side="bottom"
          sideOffset={4}
          delayDuration={200}
        >
          <span className="w-fit cursor-pointer truncate text-sm font-light leading-[1.3] text-dash-text-faded transition-colors hover:text-dash-text-body">
            {deployment.username || "Unknown"}
          </span>
        </Tooltip>
      </div>

      {/* Col 5: Menu */}
      <div className="pl-1 sm:pl-0" onClick={(e) => e.stopPropagation()}>
        <DeploymentMenu
          deployment={deployment}
          projectId={projectId}
          workspace={workspace}
          hasInProgressDeployment={hasInProgressDeployment}
          onRedeployed={onRedeployed}
        />
      </div>
    </div>
  );
}

/* ─── Loading skeleton ─── */

function DeploymentSkeleton() {
  return (
    <div className="flex items-center gap-2 border-b-[0.5px] border-dash-border px-3.5 py-4 last:border-b-0 sm:gap-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-[280px] sm:shrink-0 sm:flex-none">
        <div className="h-4 w-48 animate-pulse rounded bg-dash-border-soft" />
        <div className="h-3.5 w-20 animate-pulse rounded bg-dash-border-soft" />
      </div>
      <div className="flex w-[130px] shrink-0 flex-col gap-1.5 pr-2 sm:w-[180px] sm:px-5">
        <div className="h-4 w-16 animate-pulse rounded bg-dash-border-soft" />
        <div className="h-3.5 w-10 animate-pulse rounded bg-dash-border-soft" />
      </div>
      <div className="hidden min-w-0 flex-1 flex-col gap-1.5 md:flex">
        <div className="h-4 w-56 animate-pulse rounded bg-dash-border-soft" />
        <div className="h-3.5 w-16 animate-pulse rounded bg-dash-border-soft" />
      </div>
      <div className="hidden w-[160px] shrink-0 flex-col gap-1.5 pl-4 md:flex">
        <div className="h-4 w-14 animate-pulse rounded bg-dash-border-soft" />
        <div className="h-3.5 w-24 animate-pulse rounded bg-dash-border-soft" />
      </div>
      <div className="ml-1 size-4 animate-pulse rounded bg-dash-border-soft sm:ml-4" />
    </div>
  );
}

/* ─── Page ─── */

function DeploymentHistoryPage() {
  const { project, workspace } = parentRoute.useLoaderData() as any;
  const loaderData = Route.useLoaderData() as DeploymentHistoryLoaderData;
  const initialData = loaderData.deployments as PaginatedDeploymentsResponse;
  const initialTimedOut = loaderData.timedOut;
  const { workspaceTeamMembers } = (RootRoute.useLoaderData() ?? {}) as {
    workspaceTeamMembers?: TeamDetails | null;
  };

  const memberRoleMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (workspaceTeamMembers?.members) {
      for (const m of workspaceTeamMembers.members) {
        const role = normalizeMemberRole(m);
        // Index by every field the deployment username could match
        const keys = [m.username, m.firstName, m.email, m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : undefined];
        for (const k of keys) {
          if (k) map[k] = role;
        }
      }
    }
    return map;
  }, [workspaceTeamMembers]);

  const [deployments, setDeployments] = useState<PaginatedDeploymentsResponse>(initialData);
  const [currentPage, setCurrentPage] = useState(initialData?.currentPage ?? 1);
  const [fetching, setFetching] = useState(false);

  // Seed status map from initial data so first poll doesn't fire false notifications
  useEffect(() => {
    if (initialData?.items && Object.keys(prevStatusMapRef.current).length === 0) {
      const map: Record<string, string> = {};
      for (const item of initialData.items) {
        map[item.id] = normalizeDeploymentStatus(item.status);
      }
      prevStatusMapRef.current = map;
    }
  }, [initialData]);

  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultDeploymentHistoryDateRange);
  const [environment, setEnvironment] = useState("All");
  const [status, setStatus] = useState("All");
  const [isPageVisible, setIsPageVisible] = useState(() => {
    if (typeof document === "undefined") {
      return true;
    }

    return document.visibilityState === "visible";
  });
  const { openDeploymentDrawer, syncDeploymentInDrawer } = useProjectDeploymentLogsDrawer();
  const { sendNotification } = usePushNotification(workspace);
  const prevStatusMapRef = useRef<Record<string, string>>({});
  const failureToastDedupeRef = useRef<Set<string>>(new Set());
  const latestRequestRef = useRef(0);
  const loadingRequestRef = useRef(0);
  const previousProjectScopeRef = useRef<string | null>(null);
  const deploymentsCacheRef = useRef<Map<string, DeploymentsCacheEntry>>(new Map());

  const projectId = project?.id || project?.name;
  const projectName = project?.name || projectId;
  const projectScope = `${projectId ?? ""}::${workspace ?? ""}`;

  const statusFilterMap: Record<string, string> = {
    Successful: "ACTIVE",
    Failed: "FAILED",
    "In Progress": "INPROGRESS",
    Pending: "PENDING",
    Cancelled: "CANCELLED",
  };

  const statusesParam = status !== "All" ? statusFilterMap[status] : undefined;
  const environmentParam = environment !== "All" ? environment.toUpperCase() : undefined;
  const startParam = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
  const endParam = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
  const searchParam = search.trim() || undefined;

  const buildCacheKey = useCallback(
    (page: number) =>
      [projectScope, page, statusesParam ?? "", environmentParam ?? "", startParam ?? "", endParam ?? "", searchParam ?? ""].join("|"),
    [projectScope, statusesParam, environmentParam, startParam, endParam, searchParam],
  );

  useEffect(() => {
    if (!projectId || initialTimedOut) {
      return;
    }

    deploymentsCacheRef.current.set(buildCacheKey(initialData?.currentPage ?? 1), {
      data: initialData,
      fetchedAt: Date.now(),
    });
  }, [projectId, initialData, buildCacheKey, initialTimedOut]);

  const fetchDeployments = useCallback(
    async (page: number, options?: { silent?: boolean; useCache?: boolean; force?: boolean }) => {
      const silent = options?.silent === true;
      const useCache = options?.useCache === true;
      const force = options?.force === true;
      const requestId = ++latestRequestRef.current;
      const cacheKey = buildCacheKey(page);
      const cacheEntry = deploymentsCacheRef.current.get(cacheKey);
      const hasCachedData = Boolean(cacheEntry);
      const isCacheFresh = hasCachedData && Date.now() - (cacheEntry?.fetchedAt ?? 0) <= PAGE_CACHE_TTL_MS;
      const backgroundRefreshFromStaleCache = !silent && useCache && !force && hasCachedData && !isCacheFresh;

      if (!silent && useCache && !force && hasCachedData) {
        setDeployments(cacheEntry!.data);
        setCurrentPage(cacheEntry!.data.currentPage);
        if (isCacheFresh) {
          return;
        }
      }

      if (!silent && !backgroundRefreshFromStaleCache) {
        loadingRequestRef.current = requestId;
        setFetching(true);
      }

      try {
        const result = await withTimeout(
          (listDeploymentsServerFn as unknown as ListDeploymentsServerFnCaller)({
            data: {
              projectId,
              workspace,
              page,
              limit: PAGE_LIMIT,
              statuses: statusesParam,
              environment: environmentParam,
              start: startParam,
              end: endParam,
              search: searchParam,
            },
          }),
          DEPLOYMENTS_REQUEST_TIMEOUT_MS,
          "Deployment history request timed out",
        );

        if (requestId !== latestRequestRef.current) {
          return;
        }

        // Detect status transitions on silent polls for push notifications
        if (silent && result?.items) {
          const SUCCESS_STATUSES = new Set(["active", "ready", "successful", "succeeded", "completed", "complete"]);
          const FAIL_STATUSES = new Set(["failed", "error", "errored", "cancelled", "canceled"]);

          for (const item of result.items) {
            const newStatus = normalizeDeploymentStatus(item.status);
            const prevStatus = prevStatusMapRef.current[item.id];

            if (prevStatus && !TERMINAL_STATUSES.has(prevStatus) && TERMINAL_STATUSES.has(newStatus)) {
              const env = item.environment || "Production";
              if (SUCCESS_STATUSES.has(newStatus)) {
                sendNotification({
                  title: "Deployment Successful",
                  body: `${projectName} (${env}) deployed successfully.`,
                  onClick: () => window.focus(),
                });
              } else if (FAIL_STATUSES.has(newStatus)) {
                const label = newStatus.startsWith("cancel") ? "cancelled" : "failed";
                sendNotification({
                  title: "Deployment Failed",
                  body: `${projectName} (${env}) deployment ${label}.`,
                  onClick: () => window.focus(),
                });
              }
            }
          }
        }

        // Update the previous status map
        if (result?.items) {
          const nextMap: Record<string, string> = {};
          for (const item of result.items) {
            nextMap[item.id] = normalizeDeploymentStatus(item.status);
          }
          prevStatusMapRef.current = nextMap;
        }

        setDeployments(result);
        setCurrentPage(result.currentPage);
        deploymentsCacheRef.current.set(cacheKey, {
          data: result,
          fetchedAt: Date.now(),
        });
      } catch {
        // keep existing data
      } finally {
        if (!silent && !backgroundRefreshFromStaleCache && requestId === loadingRequestRef.current) {
          setFetching(false);
        }
      }
    },
    [
      projectId,
      workspace,
      statusesParam,
      environmentParam,
      startParam,
      endParam,
      searchParam,
      projectName,
      sendNotification,
      buildCacheKey,
    ],
  );

  useEffect(() => {
    if (!projectId) {
      return;
    }

    if (previousProjectScopeRef.current === null) {
      previousProjectScopeRef.current = projectScope;
      return;
    }

    if (previousProjectScopeRef.current === projectScope) {
      return;
    }

    previousProjectScopeRef.current = projectScope;
    latestRequestRef.current += 1;
    loadingRequestRef.current = latestRequestRef.current;
    deploymentsCacheRef.current.clear();
    prevStatusMapRef.current = {};
    setCurrentPage(1);
    setDeployments(createEmptyDeployments());
    setFetching(true);
    void fetchDeployments(1, { force: true });
  }, [projectId, projectScope, fetchDeployments]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    if (!consumeDeploymentHistoryRefresh({ projectId, workspace })) {
      return;
    }

    void fetchDeployments(1, { force: true });
  }, [fetchDeployments, projectId, workspace]);

  useEffect(() => {
    if (!projectId || !initialTimedOut) {
      return;
    }

    setFetching(true);
    void fetchDeployments(1, { force: true });
  }, [fetchDeployments, initialTimedOut, projectId]);

  // Re-fetch when filters change
  useEffect(() => {
    void fetchDeployments(1, { useCache: true });
  }, [environment, status, dateRange, search, fetchDeployments]);

  useEffect(() => {
    function handleDeploymentUpdated() {
      void fetchDeployments(currentPage, { silent: true, force: true });
    }
    window.addEventListener("brimble:deployment-updated", handleDeploymentUpdated);
    return () => window.removeEventListener("brimble:deployment-updated", handleDeploymentUpdated);
  }, [fetchDeployments, currentPage]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    function handleVisibilityChange() {
      setIsPageVisible(document.visibilityState === "visible");
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!isPageVisible) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchDeployments(currentPage, { silent: true, force: true });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [currentPage, fetchDeployments, isPageVisible]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const handleLogEvent = (message: AblyMessage) => {
      const payload = toAblyLogEventPayload(message.data);
      if (!payload) {
        return;
      }

      const incoming = mapAblyLogEventToDeployment(payload);
      if (!incoming) {
        return;
      }

      const payloadLogId = payload?.logId ? payload.logId.trim() : "";
      const payloadId = payload.id ? payload.id.trim() : "";
      const previousStatus = prevStatusMapRef.current[incoming.id] ?? "";
      const nextStatus = normalizeDeploymentStatus(incoming.status);

      setDeployments((previous) => {
        const items = [...(previous.items ?? [])];
        let existingIndex = -1;
        if (payloadLogId) {
          existingIndex = items.findIndex((item) => item.id === payloadLogId);
        }
        if (existingIndex < 0 && payloadId) {
          existingIndex = items.findIndex((item) => item.id === payloadId);
        }
        if (existingIndex < 0) {
          existingIndex = items.findIndex((item) => item.id === incoming.id);
        }

        if (existingIndex >= 0) {
          items[existingIndex] = {
            ...items[existingIndex],
            ...incoming,
          };
        } else {
          items.unshift({
            ...incoming,
            name: incoming.name || incoming.id,
            status: incoming.status || "pending",
          });
        }

        return {
          ...previous,
          items,
        };
      });

      syncDeploymentInDrawer(incoming);
      if (payloadId && payloadId !== incoming.id) {
        const incomingWithoutId: Partial<DeploymentLog> = { ...incoming };
        delete incomingWithoutId.id;
        syncDeploymentInDrawer({
          id: payloadId,
          ...incomingWithoutId,
        });
      }
      if (nextStatus) {
        prevStatusMapRef.current[incoming.id] = nextStatus;
        if (payloadId && payloadId !== incoming.id) {
          prevStatusMapRef.current[payloadId] = nextStatus;
        }
      }

      if (nextStatus === "failed") {
        const dedupeKey = `${payloadLogId || payloadId || incoming.id}:${String(payload.status ?? "")}:${payload.endTime || ""}`;
        if (!failureToastDedupeRef.current.has(dedupeKey)) {
          failureToastDedupeRef.current.add(dedupeKey);
          const commitLink = incoming.commitLink?.trim();
          const pullRequestLink = incoming.pullRequestLink?.trim();
          let action:
            | {
                label: string;
                onClick: () => void;
              }
            | undefined;
          if (commitLink) {
            action = {
              label: "Open commit",
              onClick: () => window.open(commitLink, "_blank", "noopener,noreferrer"),
            };
          } else if (pullRequestLink) {
            action = {
              label: "Open PR/MR",
              onClick: () => window.open(pullRequestLink, "_blank", "noopener,noreferrer"),
            };
          }

          toast.error("Deployment failed.", action ? { action } : undefined);
        }
      }

      if (previousStatus !== "failed" && nextStatus === "failed") {
        const env = incoming.environment || "Production";
        sendNotification({
          title: "Deployment Failed",
          body: `${projectName} (${env}) deployment failed.`,
          onClick: () => window.focus(),
        });
      }
    };

    void (async () => {
      const { Realtime } = await import("ably");
      if (cancelled) return;

      const authOptions = await getProjectScopedAblyOptions([projectId]);
      if (!authOptions || cancelled) {
        return;
      }

      const ably = new Realtime(authOptions);
      const channel = ably.channels.get(projectId);
      channel.subscribe("log", handleLogEvent);

      cleanup = () => {
        try {
          channel.unsubscribe("log", handleLogEvent);
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
  }, [projectId, projectName, sendNotification, syncDeploymentInDrawer]);

  function handlePageChange(page: number) {
    void fetchDeployments(page, { useCache: true });
  }

  const filtered = deployments?.items ?? [];

  const hasInProgressDeployment = useMemo(
    () =>
      (deployments?.items ?? []).some((item) => {
        const status = normalizeDeploymentStatus(item.status);
        return status === "inprogress";
      }),
    [deployments?.items],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.sessionStorage.getItem("brimble:open-deployment-drawer");
    if (!raw) {
      return;
    }

    let parsed: {
      projectId?: string | null;
      workspace?: string | null;
      logId?: string | null;
      createdAt?: number;
    } | null = null;

    try {
      parsed = JSON.parse(raw);
    } catch {
      window.sessionStorage.removeItem("brimble:open-deployment-drawer");
      return;
    }

    if (!parsed) {
      return;
    }

    const currentProjectKey = String(projectId ?? "");
    if (!currentProjectKey || parsed.projectId !== currentProjectKey) {
      return;
    }

    if ((parsed.workspace ?? null) !== (workspace ?? null)) {
      return;
    }

    // Expire stale handoff triggers.
    if (typeof parsed.createdAt === "number" && Date.now() - parsed.createdAt > 2 * 60_000) {
      window.sessionStorage.removeItem("brimble:open-deployment-drawer");
      return;
    }

    const list = deployments?.items ?? [];
    if (!list.length) {
      return;
    }

    const target = (parsed.logId ? list.find((item) => item.id === parsed?.logId) : undefined) ?? list[0];

    if (!target) {
      return;
    }

    window.sessionStorage.removeItem("brimble:open-deployment-drawer");
    openDeploymentDrawer(target);
  }, [deployments?.items, openDeploymentDrawer, projectId, workspace]);

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 py-8">
      <TabHeader title="Deployment history">
        View the deployment history for this project including status, duration and commit details.
      </TabHeader>

      {/* Filter bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        {/* Search */}
        <div className="flex w-full flex-1 items-center gap-2 rounded-[4px] border border-dash-border bg-dash-bg px-3 py-1.5 shadow-[0px_1px_2px_rgba(18,18,23,0.05)] sm:min-w-[280px]">
          <Search className="size-4 shrink-0 text-dash-text-extra-faded" />
          <input
            type="text"
            placeholder="Search by branch or commit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm text-dash-text-strong outline-none placeholder:text-dash-text-faded placeholder:opacity-50"
          />
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-3">
          <div className="col-span-2 sm:col-span-1">
            <DateRangePicker value={dateRange} onChange={setDateRange}>
              <button className="flex w-full items-center justify-between overflow-clip rounded-[4px] border border-dash-border bg-dash-bg text-sm text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated sm:w-auto sm:justify-start">
                <span className="flex min-w-0 items-center gap-2 px-3 py-1.5">
                  <Calendar className="size-3.5 shrink-0 text-dash-text-faded" />
                  <span className="truncate">
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
                      : "Last 30 days"}
                  </span>
                </span>
                <span className="flex h-full items-center border-l border-dash-border px-2 py-1.5">
                  <ChevronDown className="size-4 text-dash-text-faded" />
                </span>
              </button>
            </DateRangePicker>
          </div>

          <FilterSelect
            label="All Environments"
            options={["All", "Production", "Preview", "Development"]}
            value={environment}
            onChange={setEnvironment}
          />
          <FilterSelect
            label="Status"
            options={["All", "Successful", "Failed", "In Progress", "Pending", "Cancelled"]}
            value={status}
            onChange={setStatus}
            icon={<StatusDotsIcon />}
            dotColors={{
              Successful: "#13d282",
              Failed: "#fc391e",
              "In Progress": "#ff7a00",
              Pending: "#ff7a00",
              Cancelled: "#888",
            }}
          />
        </div>
      </div>

      {/* Deployment list */}
      <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
        {fetching ? (
          Array.from({ length: 6 }).map((_, i) => <DeploymentSkeleton key={i} />)
        ) : filtered.length > 0 ? (
          filtered.map((deployment) => (
            <DeploymentRow
              key={deployment.id}
              deployment={deployment}
              projectId={projectId}
              workspace={workspace}
              hasInProgressDeployment={hasInProgressDeployment}
              memberRoleMap={memberRoleMap}
              onClick={() => {
                openDeploymentDrawer(deployment);
              }}
              onRedeployed={() => fetchDeployments(currentPage)}
            />
          ))
        ) : (
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-dash-text-faded">
              {deployments?.items?.length === 0 ? "No deployments yet" : "No deployments found"}
            </span>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!fetching && (
        <div className="flex justify-end pt-4">
          <NumberPagination currentPage={currentPage} totalPages={deployments?.totalPages ?? 1} onPageChange={handlePageChange} />
        </div>
      )}
    </div>
  );
}
