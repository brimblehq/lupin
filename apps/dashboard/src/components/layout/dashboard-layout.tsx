import {
  type ReactNode,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@brimble/ui";
import { Sidebar, mainNav, moreNav } from "./sidebar";
import { Topbar } from "./topbar";
import { Footer } from "./footer";
import { CommandPalette } from "./command-palette";
import { TooltipProvider } from "../shared/tooltip";
import { Snackbar } from "../shared/snackbar";
import { OnboardingChecklist } from "../shared/onboarding-checklist";
import { WelcomeModal } from "../shared/welcome-modal";
import { DashToaster } from "../shared/toaster";
import { UserProfileDrawer } from "../shared/user-profile-drawer";
import { ScoutBarProvider } from "../../contexts/scoutbar-context";
import { useTheme } from "../../hooks/use-theme";
import { setHapticsEnabled } from "../../hooks/use-haptics";
import type { SettingsSidebarSnapshot } from "@/backend/settings";
import type { ApiListResponse } from "@/backend";
import type { Workspace } from "@/backend/workspaces";
import type { Project } from "@/backend/projects";
import type { TeamDetails } from "@/backend/teams";
import type { AppTooltipMessage } from "@/backend/messages";
import type { ActivityLogsResponse } from "@/backend/activity-logs";
import type { SubscriptionStats } from "@/backend/payments";
import type { PaymentMethod } from "@/backend/payments";
import type { Pricing } from "@/types/pricing";
import { PricingProvider } from "@/contexts/pricing-context";
import { PlanTypeProvider } from "@/contexts/plan-type-context";
import { WorkspaceRoleProvider } from "@/contexts/workspace-role-context";
import { resolveCurrentWorkspaceRole } from "@/utils/workspace-role";
import { ProfileDrawerProvider } from "@/contexts/profile-drawer-context";
import { DEFAULT_PRICING } from "@/utils/default-pricing";
import { ProfileTab, Theme } from "../../types/enums";
import { listTooltipMessagesServerFn } from "@/server/messages/actions";
import { getSettingsSidebarSnapshotServerFn } from "@/server/settings/actions";
import { getWorkspaceTeamMembersServerFn } from "@/server/teams/actions";

const dashboardQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const mobileNavItemBase =
  "flex w-full items-center gap-3 px-5 py-4 text-sm tracking-[-0.09px] transition-colors";
const DISMISSED_SNACKBARS_STORAGE_PREFIX = "brimble:dismissed-snackbars:";

function mapSnackbarVariant(
  level: AppTooltipMessage["level"],
): "info" | "warning" | "error" {
  if (level === "critical") return "error";
  if (level === "warn") return "warning";
  return "info";
}

function getSnackbarActionLabel(
  message: AppTooltipMessage,
): string | undefined {
  if (message.type === "payment") return "Update billing";
  if (!message.route) return undefined;
  if (message.type === "welcome") return "Create project";
  if (message.route === "/status") return "View status";
  return "Open";
}

function getSnackbarPriority(message: AppTooltipMessage): number {
  if (message.type === "payment") {
    if (message.level === "critical") return 0;
    if (message.level === "warn") return 1;
    return 2;
  }

  if (message.level === "critical") return 3;
  if (message.level === "warn") return 4;
  return 5;
}

function isSnackbarDismissible(message: AppTooltipMessage): boolean {
  return message.level !== "critical";
}

function getDismissedSnackbarsStorageKey(workspace?: string) {
  return `${DISMISSED_SNACKBARS_STORAGE_PREFIX}${workspace || "__personal__"}`;
}

function readDismissedSnackbars(workspace?: string): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = localStorage.getItem(
      getDismissedSnackbarsStorageKey(workspace),
    );
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(
      parsed.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      ),
    );
  } catch {
    return new Set();
  }
}

function writeDismissedSnackbars(
  workspace: string | undefined,
  keys: Set<string>,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      getDismissedSnackbarsStorageKey(workspace),
      JSON.stringify([...keys]),
    );
  } catch {
    // ignore storage write failures
  }
}

function PageHeaderSkeleton() {
  return (
    <div className="mb-8 flex items-center gap-4">
      <div className="hidden size-[80px] animate-pulse rounded bg-dash-border-soft/60 sm:block" />
      <div>
        <div className="mb-2 h-4 w-24 animate-pulse rounded bg-dash-border-soft/70" />
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-[400px] max-w-full animate-pulse rounded bg-dash-border-soft/50" />
          <div className="h-3 w-[300px] max-w-full animate-pulse rounded bg-dash-border-soft/50" />
        </div>
      </div>
    </div>
  );
}

function HomeTabSkeleton() {
  return (
    <div className="max-w-[1000px] animate-pulse">
      {/* WelcomeSection */}
      <div className="mb-2 h-8 w-64 rounded bg-dash-border-soft/70" />
      <div className="mb-6 h-4 w-80 rounded bg-dash-border-soft/50" />
      {/* StatsRow */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="h-[88px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/40" />
        <div className="h-[88px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/40" />
        <div className="h-[88px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/40" />
      </div>
      <hr className="-mx-4 mb-10 border-dash-border-soft md:-ml-10 md:mr-0" />
      {/* DeployedProjects */}
      <div className="mb-4 h-5 w-40 rounded bg-dash-border-soft/60" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[168px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30"
          />
        ))}
      </div>
      <hr className="-mx-4 mb-10 border-dash-border-soft md:-ml-10 md:mr-0" />
      {/* ConnectedDomains */}
      <div className="mb-3 h-5 w-48 rounded bg-dash-border-soft/60" />
      <div className="mb-6 h-4 w-20 rounded bg-dash-border-soft/40" />
      <hr className="-mx-4 mb-10 border-dash-border-soft md:-ml-10 md:mr-0" />
      {/* FeaturedIntegrations */}
      <div className="mb-4 h-5 w-48 rounded bg-dash-border-soft/60" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-[200px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30" />
        <div className="h-[200px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30" />
        <div className="h-[200px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30" />
      </div>
    </div>
  );
}

function ProjectsTabSkeleton() {
  return (
    <div className="max-w-[1000px] animate-pulse">
      <PageHeaderSkeleton />
      <hr className="-mx-4 mb-8 border-dash-border-soft md:-mx-10" />
      {/* TagFilterBar */}
      <div className="mb-4 flex gap-2">
        <div className="h-7 w-16 rounded-full bg-dash-border-soft/50" />
        <div className="h-7 w-20 rounded-full bg-dash-border-soft/50" />
        <div className="h-7 w-14 rounded-full bg-dash-border-soft/50" />
      </div>
      {/* SearchFilterBar */}
      <div className="mb-4 mt-4 flex items-center gap-2">
        <div className="h-10 min-w-0 flex-1 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30" />
        <div className="h-10 w-[120px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30" />
        <div className="h-10 w-[120px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30" />
      </div>
      {/* CreateProjectCard placeholder */}
      <div className="mb-4 h-12 rounded-[4px] border-[0.5px] border-dashed border-dash-border bg-dash-bg-elevated/20" />
      {/* Project cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[168px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30"
          />
        ))}
      </div>
    </div>
  );
}

function DomainsTabSkeleton() {
  return (
    <div className="max-w-[1000px] animate-pulse">
      <PageHeaderSkeleton />
      {/* SearchFilterBar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-10 min-w-0 flex-1 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30" />
        <div className="h-10 w-[120px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30" />
      </div>
      {/* Table */}
      <div className="rounded-[4px] border-[0.5px] border-dash-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex h-[68px] items-center gap-3 border-b-[0.5px] border-dash-border px-3.5 last:border-b-0"
          >
            <div className="size-[14px] rounded-[3px] bg-dash-border-soft/50" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="h-3.5 w-40 rounded bg-dash-border-soft/60" />
              <div className="h-3 w-24 rounded bg-dash-border-soft/40" />
            </div>
            <div className="flex w-[140px] items-center gap-1.5">
              <div className="size-[6px] rounded-full bg-dash-border-soft/60" />
              <div className="h-3.5 w-12 rounded bg-dash-border-soft/50" />
            </div>
            <div className="hidden w-[180px] flex-col items-end gap-1 sm:flex">
              <div className="h-3.5 w-20 rounded bg-dash-border-soft/50" />
              <div className="h-3 w-16 rounded bg-dash-border-soft/40" />
            </div>
            <div className="w-10 text-right">
              <div className="ml-auto size-4 rounded bg-dash-border-soft/40" />
            </div>
          </div>
        ))}
      </div>
      {/* Pagination */}
      <div className="mt-6 flex justify-end">
        <div className="h-8 w-28 rounded bg-dash-border-soft/50" />
      </div>
    </div>
  );
}

function DiscoverTabSkeleton() {
  return (
    <div className="animate-pulse px-4 py-8 md:px-10">
      {/* Banner */}
      <div className="mb-6 rounded-[4px] border-[0.5px] border-dash-border-soft px-8 py-8">
        <div className="mb-2 h-5 w-56 rounded bg-dash-border-soft/60" />
        <div className="mb-4 h-4 w-80 max-w-full rounded bg-dash-border-soft/40" />
        <div className="h-8 w-28 rounded-[6px] bg-dash-border-soft/50" />
      </div>
      {/* Search */}
      <div className="mb-6 h-10 w-[320px] max-w-full rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30" />
      {/* Section title */}
      <div className="mb-4 h-5 w-32 rounded bg-dash-border-soft/60" />
      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[200px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30"
          />
        ))}
      </div>
    </div>
  );
}

function ScalingTabSkeleton() {
  return (
    <div className="max-w-[1000px] animate-pulse">
      <PageHeaderSkeleton />
      <hr className="-ml-4 mb-6 border-dash-border-soft md:-ml-10" />
      {/* Search + button row */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 min-w-0 flex-1 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30" />
        <div className="h-10 w-[180px] rounded-[6px] bg-dash-border-soft/50" />
      </div>
      {/* 2-col grid of scaling cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex h-[164px] flex-col rounded-[4px] border-[0.5px] border-dash-border"
          >
            <div className="flex items-center justify-between px-3.5 pb-1 pt-3">
              <div className="h-4 w-28 rounded bg-dash-border-soft/50" />
              <div className="h-4 w-20 rounded bg-dash-border-soft/40" />
            </div>
            <div className="px-3.5 pb-3">
              <div className="h-3 w-32 rounded bg-dash-border-soft/40" />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 px-3.5 pb-3">
              <div className="space-y-2">
                <div className="h-3 w-16 rounded bg-dash-border-soft/40" />
                <div className="h-4 w-20 rounded bg-dash-border-soft/50" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-16 rounded bg-dash-border-soft/40" />
                <div className="h-3 w-20 rounded bg-dash-border-soft/50" />
              </div>
            </div>
            <div className="mt-auto h-10 border-t-[0.5px] border-dash-border" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectDetailTabSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] animate-pulse flex-col gap-6 py-8">
      {/* Preview banner */}
      <div className="h-[232px] overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-gradient-to-b from-dash-border-soft/40 to-dash-border-soft/20">
        <div className="flex h-full items-end justify-center pb-4">
          <div className="h-[180px] w-[92%] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/50" />
        </div>
      </div>
      {/* 2-col cards */}
      <div className="flex flex-col gap-4 md:flex-row">
        {/* Meta card */}
        <div className="flex-1 overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
          <div className="h-10 bg-dash-bg-elevated/60" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex h-12 items-center justify-between border-b-[0.5px] border-dash-border px-3.5 last:border-b-0"
            >
              <div className="h-3 w-20 rounded bg-dash-border-soft/50" />
              <div className="h-3 w-28 rounded bg-dash-border-soft/40" />
            </div>
          ))}
        </div>
        {/* Deployments card */}
        <div className="flex-1 overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
          <div className="h-10 bg-dash-bg-elevated/60" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex h-12 items-center justify-between border-b-[0.5px] border-dash-border px-3.5 last:border-b-0"
            >
              <div className="h-3 w-36 rounded bg-dash-border-soft/50" />
              <div className="h-3 w-16 rounded bg-dash-border-soft/40" />
            </div>
          ))}
        </div>
      </div>
      {/* Domains section */}
      <div>
        <div className="mb-3 h-5 w-40 rounded bg-dash-border-soft/60" />
        <div className="rounded-[4px] border-[0.5px] border-dash-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex h-[52px] items-center justify-between border-b-[0.5px] border-dash-border px-3.5 last:border-b-0"
            >
              <div className="h-3 w-44 rounded bg-dash-border-soft/50" />
              <div className="h-3 w-20 rounded bg-dash-border-soft/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RouteTransitionSkeleton({
  pathname,
  fullWidth,
}: {
  pathname: string;
  fullWidth?: boolean;
}) {
  if (
    /^\/projects\/[^/]+(?:\/|$)/.test(pathname) &&
    !/^\/projects\/new(?:\/|$)/.test(pathname)
  ) {
    return <ProjectDetailTabSkeleton />;
  }

  if (pathname === "/" || pathname.startsWith("/workspace")) {
    return <HomeTabSkeleton />;
  }

  if (pathname.startsWith("/projects")) {
    return <ProjectsTabSkeleton />;
  }

  if (pathname.startsWith("/domains")) {
    return <DomainsTabSkeleton />;
  }

  if (pathname.startsWith("/scaling")) {
    return <ScalingTabSkeleton />;
  }

  if (pathname.startsWith("/addons")) {
    return <DiscoverTabSkeleton />;
  }

  return (
    <div
      className={cn(
        "mx-auto w-full animate-pulse",
        fullWidth ? "max-w-screen-xl px-4 md:px-0" : "max-w-[1000px]",
      )}
    >
      <div className="mb-6 h-10 w-56 rounded bg-dash-border-soft/70" />
      <div className="h-72 rounded bg-dash-border-soft/50" />
    </div>
  );
}

function MobileNavMenu({ onSettingsClick }: { onSettingsClick: () => void }) {
  const { theme, mode, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const workspace = (() => {
    const params = new URLSearchParams(searchStr || "");
    const value = params.get("workspace")?.trim();
    return value || undefined;
  })();

  const allNav = [...mainNav, ...moreNav];

  return (
    <nav className="flex flex-col py-2">
      {allNav.map((item, i) => {
        const isActive =
          !("comingSoon" in item && item.comingSoon) &&
          !("external" in item && item.external) &&
          (item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href));

        if (i > 0) {
          // divider before each item
        }

        const icon = (
          <img
            src={item.icon}
            alt=""
            className="size-5 shrink-0 dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80"
          />
        );

        const content = (
          <>
            {i > 0 && <hr className="mx-4 border-dash-border-soft" />}
            {"comingSoon" in item && item.comingSoon ? (
              <span
                className={cn(mobileNavItemBase, "cursor-default opacity-40")}
              >
                {icon}
                {item.label}
                <span className="ml-auto rounded-full bg-dash-bg-elevated px-2 py-0.5 text-[10px] font-medium text-dash-text-extra-faded">
                  Soon
                </span>
              </span>
            ) : "external" in item && item.external ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  mobileNavItemBase,
                  "text-dash-text-faded hover:bg-dash-bg-elevated",
                )}
              >
                {icon}
                {item.label}
              </a>
            ) : (
              <button
                type="button"
                onClick={() =>
                  void navigate({
                    to: item.href as any,
                    search: workspace ? ({ workspace } as any) : undefined,
                  })
                }
                className={cn(
                  mobileNavItemBase,
                  "w-full text-left",
                  isActive
                    ? "bg-dash-bg-elevated font-medium text-dash-text-strong"
                    : "text-dash-text-faded hover:bg-dash-bg-elevated",
                )}
              >
                {icon}
                {item.label}
              </button>
            )}
          </>
        );

        return <div key={item.label}>{content}</div>;
      })}

      {/* Settings & theme toggle */}
      <hr className="mx-4 border-dash-border-soft" />
      <button
        onClick={onSettingsClick}
        className={cn(
          mobileNavItemBase,
          "text-dash-text-faded hover:bg-dash-bg-elevated",
        )}
      >
        <img
          src="/icons/settings.svg"
          alt=""
          className="size-5 shrink-0 dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80"
        />
        Settings
      </button>
      <hr className="mx-4 border-dash-border-soft" />
      <button
        onClick={cycleTheme}
        className={cn(
          mobileNavItemBase,
          "text-dash-text-faded hover:bg-dash-bg-elevated",
        )}
      >
        {theme === "dark" ? (
          <Sun className="size-5 shrink-0" />
        ) : (
          <Moon className="size-5 shrink-0" />
        )}
        {mode === Theme.System
          ? "System mode"
          : theme === Theme.Dark
            ? "Dark mode"
            : "Light mode"}
      </button>
    </nav>
  );
}

export function DashboardLayout({
  children,
  initialWorkspaceSlug,
  initialSettingsSnapshot,
  initialWorkspaces,
  initialProjectSwitcherProjects,
  initialOnboardingProjects,
  initialWorkspaceTeamMembers,
  initialTooltipMessages,
  initialPaymentMethods,
  initialInvoices,
  initialPricing,
  initialActivityLogs,
  initialSubscriptionStats,
  initialProjectEnvironments,
}: {
  children: ReactNode;
  initialWorkspaceSlug?: string | null;
  initialSettingsSnapshot?: SettingsSidebarSnapshot | null;
  initialWorkspaces?: ApiListResponse<Workspace>;
  initialProjectSwitcherProjects?: ApiListResponse<Project> | null;
  initialOnboardingProjects?: ApiListResponse<Project> | null;
  initialWorkspaceTeamMembers?: TeamDetails | null;
  initialTooltipMessages?: AppTooltipMessage[] | null;
  initialPaymentMethods?: PaymentMethod[] | null;
  initialInvoices?: any;
  initialPricing?: Pricing;
  initialActivityLogs?: ActivityLogsResponse | null;
  initialSubscriptionStats?: SubscriptionStats | null;
  initialProjectEnvironments?:
    | import("@/backend/environments").ProjectEnvironment[]
    | null;
}) {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });
  const layoutPathname = useRouterState({
    select: (s) => s.resolvedLocation?.pathname ?? s.location.pathname,
  });
  const matchedProjectSwitcherProjects = useRouterState({
    select: (s) => {
      const projectMatch = s.matches.find(
        (match) => match.routeId === "/projects/$projectId",
      );
      const loaderData = projectMatch?.loaderData as
        | { projectSwitcherProjects?: ApiListResponse<Project> | null }
        | undefined;

      return loaderData?.projectSwitcherProjects?.items ?? null;
    },
  });
  // Pull projects from any matched route for the onboarding checklist
  const matchedProjects = useRouterState({
    select: (s) => {
      // Try home route first
      const homeMatch = s.matches.find((m) => m.routeId === "/");
      const homeData = homeMatch?.loaderData as
        | { projects?: Project[] | null }
        | undefined;
      if (homeData?.projects?.length) return homeData.projects;

      // Try projects list route
      const listMatch = s.matches.find((m) => m.routeId === "/projects/");
      const listData = listMatch?.loaderData as
        | {
            projects?: Array<{
              name: string;
              slug: string;
              [key: string]: unknown;
            }> | null;
          }
        | undefined;
      if (listData?.projects?.length)
        return listData.projects as unknown as Project[];

      return null;
    },
  });
  const matchedOverviewProjectCount = useRouterState({
    select: (s) => {
      const homeMatch = s.matches.find((m) => m.routeId === "/");
      const homeData = homeMatch?.loaderData as
        | { overview?: { total?: { project?: number } } | null }
        | undefined;
      const value = homeData?.overview?.total?.project;
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    },
  });
  const navigate = useNavigate();
  const isAuthRoute =
    /^\/(login|signup)$/.test(layoutPathname) ||
    /^\/(login|signup)$/.test(pathname);
  const knownPrefixes =
    /^\/(login|signup|projects|domains|addons|scaling|workspace)?(\/|$)/;
  const isCatchAll =
    layoutPathname !== "/" && !knownPrefixes.test(layoutPathname);
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const resolvedSearchStr = useRouterState({
    select: (s) => s.resolvedLocation?.searchStr ?? s.location.searchStr,
  });
  // Only show skeleton when switching workspaces or environments — never for
  // normal tab navigation. TanStack Router keeps the previous page visible
  // until the new route resolves, so a skeleton on every tab switch is redundant.
  const isWorkspaceOrEnvironmentSwitching = useMemo(() => {
    const next = new URLSearchParams(searchStr || "");
    const current = new URLSearchParams(resolvedSearchStr || "");

    return (
      next.get("workspace") !== current.get("workspace") ||
      next.get("environmentId") !== current.get("environmentId")
    );
  }, [searchStr, resolvedSearchStr]);
  const sidebarRoutePathname = isWorkspaceOrEnvironmentSwitching
    ? pathname
    : layoutPathname;
  const isRenderedProjectDetailsRoute = useMemo(
    () => /^\/projects\/[^/]+(?:\/|$)/.test(sidebarRoutePathname),
    [sidebarRoutePathname],
  );
  const shouldRenderDesktopSidebar = !isRenderedProjectDetailsRoute;

  // Delay skeleton by 150ms so very fast workspace switches don't flash it
  const [shouldShowRouteSkeleton, setShouldShowRouteSkeleton] = useState(false);

  useEffect(() => {
    if (!isWorkspaceOrEnvironmentSwitching) {
      setShouldShowRouteSkeleton(false);
      return;
    }

    const timer = setTimeout(() => {
      setShouldShowRouteSkeleton(true);
    }, 150);

    return () => clearTimeout(timer);
  }, [isWorkspaceOrEnvironmentSwitching]);

  const currentWorkspace = useMemo(() => {
    const params = new URLSearchParams(searchStr || "");
    return params.get("workspace")?.trim() || undefined;
  }, [searchStr]);
  const dashboardProjects =
    matchedProjects ??
    matchedProjectSwitcherProjects ??
    initialOnboardingProjects?.items ??
    initialProjectSwitcherProjects?.items ??
    [];
  const checklistProjects =
    matchedProjects ??
    matchedProjectSwitcherProjects ??
    initialOnboardingProjects?.items ??
    initialProjectSwitcherProjects?.items ??
    null;
  const accountProjectCount = Math.max(
    0,
    Math.floor(
      matchedOverviewProjectCount ??
        initialOnboardingProjects?.total ??
        initialProjectSwitcherProjects?.total ??
        dashboardProjects.length,
    ),
  );
  const settingsScopeKey = currentWorkspace ?? "__personal__";
  const [stableWorkspaces, setStableWorkspaces] = useState<Workspace[]>(
    initialWorkspaces?.items ?? [],
  );
  const [settingsSnapshotCache, setSettingsSnapshotCache] = useState<
    Record<string, SettingsSidebarSnapshot | null>
  >(() => ({
    [initialWorkspaceSlug ?? "__personal__"]: initialSettingsSnapshot ?? null,
  }));
  const [workspaceTeamMembersCache, setWorkspaceTeamMembersCache] = useState<
    Record<string, TeamDetails | null>
  >(() =>
    initialWorkspaceSlug
      ? { [initialWorkspaceSlug]: initialWorkspaceTeamMembers ?? null }
      : {},
  );

  useEffect(() => {
    const nextItems = initialWorkspaces?.items ?? [];

    if (nextItems.length > 0) {
      setStableWorkspaces(nextItems);
      return;
    }

    if (stableWorkspaces.length === 0) {
      setStableWorkspaces([]);
    }
  }, [initialWorkspaces?.items, stableWorkspaces.length]);

  const effectiveWorkspaces =
    stableWorkspaces.length > 0
      ? stableWorkspaces
      : (initialWorkspaces?.items ?? []);
  const isKnownWorkspace = Boolean(
    currentWorkspace &&
    effectiveWorkspaces.some(
      (workspace) => workspace.slug === currentWorkspace,
    ),
  );

  const isTeamWorkspace = (() => {
    return isKnownWorkspace;
  })();

  // Mobile navigation drawer
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Settings drawer — shared between sidebar & topbar
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileRequestedTab, setProfileRequestedTab] = useState<
    ProfileTab | undefined
  >(undefined);

  const openProfileDrawer = useCallback((tab?: ProfileTab) => {
    setProfileRequestedTab(tab);
    setProfileOpen(true);
  }, []);

  const getTooltipMessages = useServerFn(
    listTooltipMessagesServerFn as any,
  ) as (args: {
    data?: {
      workspace?: string;
      type?: "notifications";
      limit?: number;
      page?: number;
    };
  }) => Promise<AppTooltipMessage[] | null>;
  const getSettingsSnapshot = useServerFn(
    getSettingsSidebarSnapshotServerFn as any,
  ) as (args?: {
    data?: { workspace?: string };
  }) => Promise<SettingsSidebarSnapshot>;
  const getWorkspaceTeamMembers = useServerFn(
    getWorkspaceTeamMembersServerFn as any,
  ) as (args: { data: { workspace: string } }) => Promise<TeamDetails>;
  const [tooltipMessages, setTooltipMessages] = useState<
    AppTooltipMessage[] | null
  >(initialTooltipMessages ?? null);
  // Keep initial render deterministic for SSR hydration; load localStorage after mount.
  const [dismissedSnackbarKeys, setDismissedSnackbarKeys] = useState<
    Set<string>
  >(() => new Set());
  const activeSettingsSnapshot =
    settingsSnapshotCache[settingsScopeKey] ?? null;

  // Profile is workspace-independent — extract once and keep stable across workspace switches
  const [userProfile, setUserProfile] = useState<
    SettingsSidebarSnapshot["profile"] | null
  >(initialSettingsSnapshot?.profile ?? null);

  useEffect(() => {
    const p = initialSettingsSnapshot?.profile;
    if (p && (p.firstName || p.lastName || p.username || p.email)) {
      setUserProfile(p);
    }
  }, [initialSettingsSnapshot?.profile]);

  // Also update from cache if a newer snapshot has richer profile data
  useEffect(() => {
    const p = activeSettingsSnapshot?.profile;
    if (p && (p.firstName || p.lastName || p.username || p.email)) {
      setUserProfile((prev) => {
        if (!prev || (!prev.firstName && !prev.lastName && p.firstName))
          return p;
        return prev;
      });
    }
    if (p) {
      setHapticsEnabled(p.haptics !== false);
    }
  }, [activeSettingsSnapshot?.profile]);
  const activeWorkspaceTeamMembers =
    currentWorkspace && isKnownWorkspace
      ? (workspaceTeamMembersCache[currentWorkspace] ?? null)
      : null;

  useEffect(() => {
    setSettingsSnapshotCache((prev) => ({
      ...prev,
      [initialWorkspaceSlug ?? "__personal__"]: initialSettingsSnapshot ?? null,
    }));
  }, [initialSettingsSnapshot, initialWorkspaceSlug]);

  useEffect(() => {
    if (!initialWorkspaceSlug) {
      return;
    }

    setWorkspaceTeamMembersCache((prev) => ({
      ...prev,
      [initialWorkspaceSlug]: initialWorkspaceTeamMembers ?? null,
    }));
  }, [initialWorkspaceSlug, initialWorkspaceTeamMembers]);

  useEffect(() => {
    if (
      Object.prototype.hasOwnProperty.call(
        settingsSnapshotCache,
        settingsScopeKey,
      )
    ) {
      return;
    }

    let cancelled = false;

    void getSettingsSnapshot({
      data: { workspace: currentWorkspace },
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        setSettingsSnapshotCache((prev) => ({
          ...prev,
          [settingsScopeKey]: result ?? null,
        }));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setSettingsSnapshotCache((prev) => ({
          ...prev,
          [settingsScopeKey]: null,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentWorkspace,
    getSettingsSnapshot,
    settingsScopeKey,
    settingsSnapshotCache,
  ]);

  useEffect(() => {
    if (!currentWorkspace || !isKnownWorkspace) {
      return;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        workspaceTeamMembersCache,
        currentWorkspace,
      )
    ) {
      return;
    }

    let cancelled = false;

    void getWorkspaceTeamMembers({
      data: { workspace: currentWorkspace },
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        setWorkspaceTeamMembersCache((prev) => ({
          ...prev,
          [currentWorkspace]: result ?? null,
        }));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setWorkspaceTeamMembersCache((prev) => ({
          ...prev,
          [currentWorkspace]: null,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentWorkspace,
    getWorkspaceTeamMembers,
    isKnownWorkspace,
    workspaceTeamMembersCache,
  ]);

  useEffect(() => {
    let cancelled = false;

    // Clear immediately to avoid showing messages from the previous workspace while fetching.
    setTooltipMessages(null);

    void getTooltipMessages({
      data: { workspace: currentWorkspace },
    })
      .then((result) => {
        if (!cancelled) {
          setTooltipMessages(result ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTooltipMessages(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentWorkspace, getTooltipMessages]);

  useEffect(() => {
    setDismissedSnackbarKeys(readDismissedSnackbars(currentWorkspace));
  }, [currentWorkspace]);

  const visibleSnackbars = useMemo(() => {
    return (tooltipMessages ?? [])
      .map((msg, index) => {
        const key = `${msg.type ?? "general"}:${msg.level}:${msg.route ?? ""}:${msg.message}:${index}`;
        return { key, msg, originalIndex: index };
      })
      .filter(
        ({ key, msg }) =>
          !isSnackbarDismissible(msg) || !dismissedSnackbarKeys.has(key),
      )
      .sort((a, b) => {
        const priorityDiff =
          getSnackbarPriority(a.msg) - getSnackbarPriority(b.msg);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        return a.originalIndex - b.originalIndex;
      })
      .slice(0, 2);
  }, [dismissedSnackbarKeys, tooltipMessages]);

  const pricing = initialPricing ?? DEFAULT_PRICING;
  const planType = activeSettingsSnapshot?.profile?.subscription?.planType;

  const workspaceRoleValue = useMemo(() => {
    const inWorkspace = Boolean(currentWorkspace && isKnownWorkspace);
    const role = inWorkspace
      ? resolveCurrentWorkspaceRole(
          activeWorkspaceTeamMembers,
          userProfile?.id,
          userProfile?.email,
        )
      : null;
    const isViewer = role === "Viewer";
    return {
      role,
      isViewer,
      canWrite: !isViewer,
      canManageMembers:
        !inWorkspace || role === "Creator" || role === "Administrator",
      canEditWorkspace:
        !inWorkspace || role === "Creator" || role === "Administrator",
      canSeeBilling:
        !inWorkspace || role === "Creator" || role === "Administrator",
    };
  }, [
    currentWorkspace,
    isKnownWorkspace,
    activeWorkspaceTeamMembers,
    userProfile?.id,
    userProfile?.email,
  ]);

  if (isAuthRoute || isCatchAll) {
    return (
      <QueryClientProvider client={dashboardQueryClient}>
        <PricingProvider value={pricing}>
          <PlanTypeProvider value={planType}>
            <WorkspaceRoleProvider value={workspaceRoleValue}>
              <TooltipProvider>
                <DashToaster />
                {children}
              </TooltipProvider>
            </WorkspaceRoleProvider>
          </PlanTypeProvider>
        </PricingProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={dashboardQueryClient}>
      <PricingProvider value={pricing}>
        <PlanTypeProvider value={planType}>
          <WorkspaceRoleProvider value={workspaceRoleValue}>
            <ScoutBarProvider>
              <TooltipProvider>
                <ProfileDrawerProvider onOpen={openProfileDrawer}>
                  <DashToaster />
                  <CommandPalette />
                  <div className="flex h-dvh flex-col bg-dash-bg">
                    <Topbar
                      onSettingsClick={() => setProfileOpen(true)}
                      onMobileNavToggle={() => setMobileNavOpen((v) => !v)}
                      mobileNavOpen={mobileNavOpen}
                      settingsSnapshot={activeSettingsSnapshot}
                      userProfile={userProfile}
                      workspaces={effectiveWorkspaces}
                      workspaceTeamMembers={activeWorkspaceTeamMembers}
                      projectSwitcherProjects={
                        matchedProjectSwitcherProjects ??
                        initialProjectSwitcherProjects?.items ??
                        []
                      }
                    />
                    {/* Mobile navigation dropdown */}
                    <AnimatePresence>
                      {mobileNavOpen && (
                        <>
                          <motion.div
                            key="mobile-nav-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-40 bg-black/40 md:hidden"
                            onClick={closeMobileNav}
                          />
                          <motion.div
                            key="mobile-nav-dropdown"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              duration: 0.25,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            className="relative z-50 overflow-hidden border-b border-dash-border-soft bg-dash-bg md:hidden"
                          >
                            <MobileNavMenu
                              onSettingsClick={() => {
                                setProfileOpen(true);
                                closeMobileNav();
                              }}
                            />
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {visibleSnackbars.map(({ key, msg }) => {
                        const variant = mapSnackbarVariant(msg.level);
                        const actionLabel = getSnackbarActionLabel(msg);
                        const isPaymentMessage = msg.type === "payment";
                        const dismissible = isSnackbarDismissible(msg);

                        return (
                          <Snackbar
                            key={key}
                            variant={variant}
                            message={msg.message}
                            action={
                              actionLabel
                                ? {
                                    label: actionLabel,
                                    onClick: () => {
                                      if (isPaymentMessage) {
                                        setProfileRequestedTab(
                                          ProfileTab.Billing,
                                        );
                                        setProfileOpen(true);
                                        return;
                                      }

                                      if (!msg.route) {
                                        return;
                                      }

                                      if (/^https?:\/\//.test(msg.route!)) {
                                        window.location.href = msg.route!;
                                        return;
                                      }

                                      void navigate({
                                        to: msg.route as any,
                                        search: currentWorkspace
                                          ? ({
                                              workspace: currentWorkspace,
                                            } as any)
                                          : undefined,
                                      });
                                    },
                                  }
                                : undefined
                            }
                            onDismiss={
                              dismissible
                                ? () => {
                                    setDismissedSnackbarKeys((prev) => {
                                      const next = new Set(prev);
                                      next.add(key);
                                      writeDismissedSnackbars(
                                        currentWorkspace,
                                        next,
                                      );
                                      return next;
                                    });
                                  }
                                : undefined
                            }
                          />
                        );
                      })}
                    </AnimatePresence>

                    {!shouldRenderDesktopSidebar ? (
                      <main className="scrollbar-hidden flex flex-1 flex-col overflow-y-auto">
                        <div className="mx-auto w-full max-w-screen-xl flex-1 px-4 md:px-0">
                          {shouldShowRouteSkeleton ? (
                            <div className="py-8">
                              <RouteTransitionSkeleton
                                pathname={pathname}
                                fullWidth
                              />
                            </div>
                          ) : (
                            children
                          )}
                        </div>
                        <Footer />
                      </main>
                    ) : (
                      <div className="mx-auto flex w-full max-w-screen-xl flex-1 overflow-hidden">
                        <div className="hidden md:flex">
                          <Sidebar
                            profileOpen={profileOpen}
                            onProfileOpenChange={setProfileOpen}
                          />
                        </div>
                        <main className="scrollbar-hidden flex min-h-0 flex-1 flex-col overflow-y-auto">
                          <div className="flex-1 px-4 py-6 md:py-8 md:pl-10 md:pr-0">
                            {shouldShowRouteSkeleton ? (
                              <RouteTransitionSkeleton pathname={pathname} />
                            ) : (
                              children
                            )}
                          </div>
                          <Footer />
                        </main>
                      </div>
                    )}
                    <WelcomeModal />
                    <OnboardingChecklist
                      projects={checklistProjects}
                      settingsSnapshot={activeSettingsSnapshot}
                      isTeamWorkspace={isTeamWorkspace}
                      teamDetails={activeWorkspaceTeamMembers}
                    />
                    <UserProfileDrawer
                      initialWorkspaceTeamMembers={activeWorkspaceTeamMembers}
                      open={profileOpen}
                      onOpenChange={setProfileOpen}
                      requestedTab={profileRequestedTab}
                      initialSnapshot={activeSettingsSnapshot}
                      initialPaymentMethods={initialPaymentMethods ?? null}
                      initialInvoices={initialInvoices ?? null}
                      initialActivityLogs={initialActivityLogs ?? null}
                      initialSubscriptionStats={
                        initialSubscriptionStats ?? null
                      }
                      initialProjectEnvironments={
                        initialProjectEnvironments ?? null
                      }
                      projectCount={accountProjectCount}
                    />
                  </div>
                </ProfileDrawerProvider>
              </TooltipProvider>
            </ScoutBarProvider>
          </WorkspaceRoleProvider>
        </PlanTypeProvider>
      </PricingProvider>
    </QueryClientProvider>
  );
}
