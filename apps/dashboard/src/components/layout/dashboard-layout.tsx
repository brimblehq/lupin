import { type ReactNode, useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { Desktop } from "@phosphor-icons/react";
import { cn } from "@brimble/ui";
import { Sidebar } from "./sidebar";
import { mainNav, moreNav } from "./sidebar-nav";
import { Topbar } from "./topbar";
import { Footer } from "./footer";
import { RouterProgressBar } from "./router-progress-bar";
import { TooltipProvider } from "../shared/tooltip";
import { Snackbar } from "../shared/snackbar";
import { DashToaster } from "../shared/toaster";
import { ScoutBarProvider, useScoutBar } from "../../contexts/scoutbar-context";
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
import { canWorkspaceRoleWrite, resolveCurrentWorkspaceRole } from "@/utils/workspace-role";
import { ProfileDrawerProvider } from "@/contexts/profile-drawer-context";
import { StepUpTwoFactorProvider } from "@/contexts/step-up-two-factor-context";
import { isTeamTwoFactorSetupRequiredError } from "@/lib/auth/two-factor-step-up";
import { DEFAULT_PRICING } from "@/utils/default-pricing";
import { ProfileTab, Theme } from "../../types/enums";
import { listTooltipMessagesServerFn } from "@/server/messages/actions";
import { getSettingsSidebarSnapshotServerFn } from "@/server/settings/actions";
import { getWorkspaceTeamMembersServerFn } from "@/server/teams/actions";
import { getTwoFactorStatusServerFn } from "@/server/auth/actions";
import type { TwoFactorStatus } from "@/backend/auth/types";
import { identifyPostHog, isPostHogEnabled } from "@/lib/posthog";
import { useFeatureFlag, FeatureFlags } from "@/lib/feature-flags";

const CommandPalette = lazy(() => import("./command-palette").then((m) => ({ default: m.CommandPalette })));
const UserProfileDrawer = lazy(() => import("../shared/user-profile-drawer").then((m) => ({ default: m.UserProfileDrawer })));
const OnboardingChecklist = lazy(() => import("../shared/onboarding-checklist").then((m) => ({ default: m.OnboardingChecklist })));
const WelcomeModal = lazy(() => import("../shared/welcome-modal").then((m) => ({ default: m.WelcomeModal })));
const TeamTwoFactorRequiredModal = lazy(() =>
  import("../shared/team-two-factor-required-modal").then((m) => ({ default: m.TeamTwoFactorRequiredModal })),
);

const WELCOME_MODAL_STORAGE_KEY = "brimble:welcome-modal-dismissed";

function CommandPaletteSlot() {
  const { isOpen } = useScoutBar();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (isOpen) setMounted(true);
  }, [isOpen]);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <CommandPalette />
    </Suspense>
  );
}

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

const mobileNavItemBase = "flex w-full items-center gap-3 whitespace-nowrap px-5 py-4 text-sm tracking-[-0.09px] transition-colors";
const DISMISSED_SNACKBARS_STORAGE_PREFIX = "brimble:dismissed-snackbars:";

function mapSnackbarVariant(level: AppTooltipMessage["level"]): "info" | "warning" | "error" {
  if (level === "critical") return "error";
  if (level === "warn") return "warning";
  return "info";
}

function getSnackbarActionLabel(message: AppTooltipMessage): string | undefined {
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
    const raw = localStorage.getItem(getDismissedSnackbarsStorageKey(workspace));
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((item): item is string => typeof item === "string" && item.length > 0));
  } catch {
    return new Set();
  }
}

function writeDismissedSnackbars(workspace: string | undefined, keys: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(getDismissedSnackbarsStorageKey(workspace), JSON.stringify([...keys]));
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
          <div key={i} className="min-h-[168px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30" />
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
          <div key={i} className="min-h-[168px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30" />
        ))}
      </div>
    </div>
  );
}

function NewProjectTabSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[680px] animate-pulse">
      <div className="mb-8">
        <div className="mb-4 h-4 w-28 rounded bg-dash-border-soft/60" />
        <div className="mb-2 h-7 w-40 rounded bg-dash-border-soft/70" />
        <div className="h-3.5 w-full max-w-[420px] rounded bg-dash-border-soft/50" />
      </div>

      <div className="mb-4 h-4 w-56 rounded bg-dash-border-soft/60" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="min-h-[132px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30 p-5">
            <div className="mb-3 h-5 w-5 rounded bg-dash-border-soft/50" />
            <div className="h-3.5 w-36 rounded bg-dash-border-soft/60" />
            <div className="mt-1.5 h-3 w-full max-w-[230px] rounded bg-dash-border-soft/45" />
          </div>
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
          <div key={i} className="flex h-[68px] items-center gap-3 border-b-[0.5px] border-dash-border px-3.5 last:border-b-0">
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
          <div key={i} className="h-[200px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30" />
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
          <div key={i} className="flex h-[164px] flex-col rounded-[4px] border-[0.5px] border-dash-border">
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
            <div key={i} className="flex h-12 items-center justify-between border-b-[0.5px] border-dash-border px-3.5 last:border-b-0">
              <div className="h-3 w-20 rounded bg-dash-border-soft/50" />
              <div className="h-3 w-28 rounded bg-dash-border-soft/40" />
            </div>
          ))}
        </div>
        {/* Deployments card */}
        <div className="flex-1 overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
          <div className="h-10 bg-dash-bg-elevated/60" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex h-12 items-center justify-between border-b-[0.5px] border-dash-border px-3.5 last:border-b-0">
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
            <div key={i} className="flex h-[52px] items-center justify-between border-b-[0.5px] border-dash-border px-3.5 last:border-b-0">
              <div className="h-3 w-44 rounded bg-dash-border-soft/50" />
              <div className="h-3 w-20 rounded bg-dash-border-soft/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RouteTransitionSkeleton({ pathname, fullWidth }: { pathname: string; fullWidth?: boolean }) {
  if (/^\/projects\/new(?:\/|$)/.test(pathname)) {
    return <NewProjectTabSkeleton />;
  }

  if (/^\/projects\/[^/]+(?:\/|$)/.test(pathname) && !/^\/projects\/new(?:\/|$)/.test(pathname)) {
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
    <div className={cn("mx-auto w-full animate-pulse", fullWidth ? "max-w-screen-xl px-4 md:px-0" : "max-w-[1000px]")}>
      <div className="mb-6 h-10 w-56 rounded bg-dash-border-soft/70" />
      <div className="h-72 rounded bg-dash-border-soft/50" />
    </div>
  );
}

function isProjectDetailsPath(path: string): boolean {
  const match = path.match(/^\/projects\/([^/]+)(?:\/|$)/);
  if (!match) return false;
  return match[1] !== "new";
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

  const domainsEnabled = useFeatureFlag(FeatureFlags.ENABLE_DOMAINS);
  const scalingEnabled = useFeatureFlag(FeatureFlags.ENABLE_AUTO_SCALING);
  const bucketsEnabled = useFeatureFlag(FeatureFlags.ENABLE_BUCKETS);
  const sandboxEnabled = useFeatureFlag(FeatureFlags.ENABLE_SANDBOX);

  const flagValues: Record<string, boolean> = useMemo(
    () => ({
      [FeatureFlags.ENABLE_DOMAINS]: domainsEnabled,
      [FeatureFlags.ENABLE_AUTO_SCALING]: scalingEnabled,
      [FeatureFlags.ENABLE_BUCKETS]: bucketsEnabled,
      [FeatureFlags.ENABLE_SANDBOX]: sandboxEnabled,
    }),
    [domainsEnabled, scalingEnabled, bucketsEnabled, sandboxEnabled],
  );

  const allNav = useMemo(
    () =>
      [...mainNav, ...moreNav]
        .filter((item) => {
          if ("flag" in item && item.flag && !("comingSoon" in item && item.comingSoon)) return flagValues[item.flag] !== false;
          return true;
        })
        .map((item) => {
          if ("comingSoon" in item && item.comingSoon && "flag" in item && item.flag && isPostHogEnabled && flagValues[item.flag]) {
            return { ...item, comingSoon: false };
          }
          return item;
        }),
    [flagValues],
  );

  return (
    <nav className="flex flex-col py-2">
      {allNav.map((item, i) => {
        const isActive =
          !("comingSoon" in item && item.comingSoon) &&
          !("external" in item && item.external) &&
          (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));

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
              <span className={cn(mobileNavItemBase, "cursor-not-allowed opacity-40")}>
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
                className={cn(mobileNavItemBase, "text-dash-text-faded hover:bg-dash-bg-elevated")}
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
                  isActive ? "bg-dash-bg-elevated font-medium text-dash-text-strong" : "text-dash-text-faded hover:bg-dash-bg-elevated",
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
      <button onClick={onSettingsClick} className={cn(mobileNavItemBase, "text-dash-text-faded hover:bg-dash-bg-elevated")}>
        <img
          src="/icons/settings.svg"
          alt=""
          className="size-5 shrink-0 dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80"
        />
        Settings
      </button>
      <hr className="mx-4 border-dash-border-soft" />
      <button onClick={cycleTheme} className={cn(mobileNavItemBase, "text-dash-text-faded hover:bg-dash-bg-elevated")}>
        {mode === Theme.System ? (
          <Desktop className="size-5 shrink-0" />
        ) : theme === "dark" ? (
          <Sun className="size-5 shrink-0" />
        ) : (
          <Moon className="size-5 shrink-0" />
        )}
        {mode === Theme.System ? "System mode" : theme === Theme.Dark ? "Dark mode" : "Light mode"}
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
  initialUserOverview,
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
  initialUserOverview?: import("@/backend/user-overview").UserOverview | null;
  initialProjectEnvironments?: import("@/backend/environments").ProjectEnvironment[] | null;
}) {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });
  const layoutPathname = useRouterState({
    select: (s) => s.resolvedLocation?.pathname ?? s.location.pathname,
  });
  const matchedProjectSwitcherProjects = useRouterState({
    select: (s) => {
      const projectMatch = s.matches.find((match) => match.routeId === "/projects/$projectId");
      const loaderData = projectMatch?.loaderData as { projectSwitcherProjects?: ApiListResponse<Project> | null } | undefined;

      return loaderData?.projectSwitcherProjects?.items ?? null;
    },
  });
  // Pull projects from any matched route for the onboarding checklist
  const matchedProjects = useRouterState({
    select: (s) => {
      // Try home route first
      const homeMatch = s.matches.find((m) => m.routeId === "/");
      const homeData = homeMatch?.loaderData as { projects?: Project[] | null } | undefined;
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
      if (listData?.projects?.length) return listData.projects as unknown as Project[];

      return null;
    },
  });
  const matchedOverviewProjectCount = useRouterState({
    select: (s) => {
      const homeMatch = s.matches.find((m) => m.routeId === "/");
      const homeData = homeMatch?.loaderData as { overview?: { total?: { project?: number } } | null } | undefined;
      const value = homeData?.overview?.total?.project;
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    },
  });
  const hasRenderedProjectDetailsMatch = useRouterState({
    select: (s) => s.matches.some((match) => match.routeId === "/projects/$projectId"),
  });
  const navigate = useNavigate();
  const isAuthRoute = /^\/(login|signup)$/.test(layoutPathname) || /^\/(login|signup)$/.test(pathname);
  const knownPrefixes = /^\/(login|signup|projects|domains|addons|scaling|workspace|teams|sandboxes|volumes)?(\/|$)/;
  const isCatchAll = layoutPathname !== "/" && !knownPrefixes.test(layoutPathname);
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const resolvedSearchStr = useRouterState({
    select: (s) => s.resolvedLocation?.searchStr ?? s.location.searchStr,
  });

  const isWorkspaceOrEnvironmentSwitching = useMemo(() => {
    const next = new URLSearchParams(searchStr || "");
    const current = new URLSearchParams(resolvedSearchStr || "");

    return next.get("workspace") !== current.get("workspace") || next.get("environmentId") !== current.get("environmentId");
  }, [searchStr, resolvedSearchStr]);
  const isIncomingProjectDetailsRoute = useMemo(() => isProjectDetailsPath(pathname), [pathname]);

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

  const shouldRenderDesktopSidebar = shouldShowRouteSkeleton ? !isIncomingProjectDetailsRoute : !hasRenderedProjectDetailsMatch;

  const currentWorkspace = useMemo(() => {
    const params = new URLSearchParams(searchStr || "");
    return params.get("workspace")?.trim() || undefined;
  }, [searchStr]);

  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const getTwoFactorStatus = useServerFn(getTwoFactorStatusServerFn as any) as () => Promise<TwoFactorStatus>;

  useEffect(() => {
    let cancelled = false;
    void getTwoFactorStatus()
      .then((status) => {
        if (!cancelled) setTwoFactorStatus(status ?? null);
      })
      .catch(() => {
        if (!cancelled) setTwoFactorStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [getTwoFactorStatus]);

  useEffect(() => {
    if (!currentWorkspace) return;
    const handle = (event: { type: string; query?: { state: { error: unknown } }; mutation?: { state: { error: unknown } } }) => {
      const err = event.query?.state.error ?? event.mutation?.state.error;
      if (isTeamTwoFactorSetupRequiredError(err)) {
        setTwoFactorStatus((prev) =>
          prev ? { ...prev, enabled: false } : { enabled: false, hasRecoveryCodes: false, recoveryCodesRemaining: 0 },
        );
      }
    };
    const unsubQ = dashboardQueryClient.getQueryCache().subscribe(handle as any);
    const unsubM = dashboardQueryClient.getMutationCache().subscribe(handle as any);
    return () => {
      unsubQ();
      unsubM();
    };
  }, [currentWorkspace]);
  const dashboardProjects =
    matchedProjects ?? matchedProjectSwitcherProjects ?? initialOnboardingProjects?.items ?? initialProjectSwitcherProjects?.items ?? [];
  const checklistProjects =
    matchedProjects ?? matchedProjectSwitcherProjects ?? initialOnboardingProjects?.items ?? initialProjectSwitcherProjects?.items ?? null;
  const accountProjectCount = Math.max(
    0,
    Math.floor(
      matchedOverviewProjectCount ?? initialOnboardingProjects?.total ?? initialProjectSwitcherProjects?.total ?? dashboardProjects.length,
    ),
  );
  const settingsScopeKey = currentWorkspace ?? "__personal__";
  const [stableWorkspaces, setStableWorkspaces] = useState<Workspace[]>(initialWorkspaces?.items ?? []);
  const [settingsSnapshotCache, setSettingsSnapshotCache] = useState<Record<string, SettingsSidebarSnapshot | null>>(() => ({
    ...(initialSettingsSnapshot ? { [initialWorkspaceSlug ?? "__personal__"]: initialSettingsSnapshot } : {}),
  }));
  const [workspaceTeamMembersCache, setWorkspaceTeamMembersCache] = useState<Record<string, TeamDetails | null>>(() =>
    initialWorkspaceSlug && initialWorkspaceTeamMembers ? { [initialWorkspaceSlug]: initialWorkspaceTeamMembers } : {},
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

  const effectiveWorkspaces = stableWorkspaces.length > 0 ? stableWorkspaces : (initialWorkspaces?.items ?? []);
  const isKnownWorkspace = Boolean(currentWorkspace && effectiveWorkspaces.some((workspace) => workspace.slug === currentWorkspace));

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
  const [profileRequestedTab, setProfileRequestedTab] = useState<ProfileTab | undefined>(undefined);
  const [profileEverOpened, setProfileEverOpened] = useState(false);

  useEffect(() => {
    if (profileOpen && !profileEverOpened) setProfileEverOpened(true);
  }, [profileOpen, profileEverOpened]);

  const prevProfileOpenRef = useRef(false);
  useEffect(() => {
    if (prevProfileOpenRef.current && !profileOpen) {
      void getTwoFactorStatus()
        .then((status) => setTwoFactorStatus(status ?? null))
        .catch(() => {});
    }
    prevProfileOpenRef.current = profileOpen;
  }, [profileOpen, getTwoFactorStatus]);

  const openProfileDrawer = useCallback((tab?: ProfileTab) => {
    setProfileRequestedTab(tab);
    setProfileOpen(true);
  }, []);

  const [shouldRenderWelcomeModal, setShouldRenderWelcomeModal] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(WELCOME_MODAL_STORAGE_KEY)) {
        setShouldRenderWelcomeModal(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const [shouldRenderOnboardingChecklist, setShouldRenderOnboardingChecklist] = useState(false);
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (w.requestIdleCallback) {
      const handle = w.requestIdleCallback(() => setShouldRenderOnboardingChecklist(true), { timeout: 1500 });
      return () => w.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(() => setShouldRenderOnboardingChecklist(true), 600);
    return () => window.clearTimeout(handle);
  }, []);

  const getTooltipMessages = useServerFn(listTooltipMessagesServerFn as any) as (args: {
    data?: {
      workspace?: string;
      type?: "notifications";
      limit?: number;
      page?: number;
    };
  }) => Promise<AppTooltipMessage[] | null>;
  const getSettingsSnapshot = useServerFn(getSettingsSidebarSnapshotServerFn as any) as (args?: {
    data?: { workspace?: string };
  }) => Promise<SettingsSidebarSnapshot>;
  const getWorkspaceTeamMembers = useServerFn(getWorkspaceTeamMembersServerFn as any) as (args: {
    data: { workspace: string };
  }) => Promise<TeamDetails>;
  const [tooltipMessages, setTooltipMessages] = useState<AppTooltipMessage[] | null>(initialTooltipMessages ?? null);
  // Keep initial render deterministic for SSR hydration; load localStorage after mount.
  const [dismissedSnackbarKeys, setDismissedSnackbarKeys] = useState<Set<string>>(() => new Set());
  const activeSettingsSnapshot = settingsSnapshotCache[settingsScopeKey] ?? null;

  // Profile is workspace-independent — extract once and keep stable across workspace switches
  const [userProfile, setUserProfile] = useState<SettingsSidebarSnapshot["profile"] | null>(initialSettingsSnapshot?.profile ?? null);

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
        if (!prev || (!prev.firstName && !prev.lastName && p.firstName)) return p;
        return prev;
      });
    }
    if (p) {
      setHapticsEnabled(p.haptics !== false);
    }
  }, [activeSettingsSnapshot?.profile]);

  const lastIdentifiedRef = useRef<{
    id: string;
    email: string;
    username: string;
    plan: string | undefined;
  } | null>(null);

  useEffect(() => {
    if (!isPostHogEnabled) return;
    if (!userProfile?.id) return;

    const plan = userProfile.subscription?.planType;
    const current = {
      id: userProfile.id,
      email: userProfile.email,
      username: userProfile.username,
      plan,
    };
    const prev = lastIdentifiedRef.current;

    if (
      prev &&
      prev.id === current.id &&
      prev.email === current.email &&
      prev.username === current.username &&
      prev.plan === current.plan
    ) {
      return;
    }

    identifyPostHog(userProfile.id, {
      email: userProfile.email,
      username: userProfile.username,
      name: [userProfile.firstName, userProfile.lastName].filter(Boolean).join(" "),
      plan,
    });

    lastIdentifiedRef.current = current;
  }, [
    userProfile?.id,
    userProfile?.email,
    userProfile?.username,
    userProfile?.firstName,
    userProfile?.lastName,
    userProfile?.subscription?.planType,
  ]);

  const activeWorkspaceTeamMembers = currentWorkspace && isKnownWorkspace ? (workspaceTeamMembersCache[currentWorkspace] ?? null) : null;

  useEffect(() => {
    if (!initialSettingsSnapshot) {
      return;
    }

    setSettingsSnapshotCache((prev) => ({
      ...prev,
      [initialWorkspaceSlug ?? "__personal__"]: initialSettingsSnapshot,
    }));
  }, [initialSettingsSnapshot, initialWorkspaceSlug]);

  useEffect(() => {
    if (!initialWorkspaceSlug || !initialWorkspaceTeamMembers) {
      return;
    }

    setWorkspaceTeamMembersCache((prev) => ({
      ...prev,
      [initialWorkspaceSlug]: initialWorkspaceTeamMembers,
    }));
  }, [initialWorkspaceSlug, initialWorkspaceTeamMembers]);

  useEffect(() => {
    let cancelled = false;

    const fetchSnapshot = async () => {
      try {
        const result = await getSettingsSnapshot({
          data: { workspace: currentWorkspace },
        });
        if (cancelled) {
          return;
        }

        setSettingsSnapshotCache((prev) => ({
          ...prev,
          [settingsScopeKey]: result ?? null,
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setSettingsSnapshotCache((prev) => ({
          ...prev,
          [settingsScopeKey]: null,
        }));
      }
    };

    if (!Object.prototype.hasOwnProperty.call(settingsSnapshotCache, settingsScopeKey)) {
      void fetchSnapshot();
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (settingsSnapshotCache[settingsScopeKey] === null) {
        void fetchSnapshot();
      }
    };

    const onFocus = () => {
      if (settingsSnapshotCache[settingsScopeKey] === null) {
        void fetchSnapshot();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [currentWorkspace, getSettingsSnapshot, settingsScopeKey, settingsSnapshotCache]);

  useEffect(() => {
    if (!currentWorkspace || !isKnownWorkspace) {
      return;
    }

    const cachedTeamMembers = workspaceTeamMembersCache[currentWorkspace];
    if (cachedTeamMembers) {
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

        if (!result) {
          return;
        }

        setWorkspaceTeamMembersCache((prev) => ({
          ...prev,
          [currentWorkspace]: result,
        }));
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [currentWorkspace, getWorkspaceTeamMembers, isKnownWorkspace, workspaceTeamMembersCache]);

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
      .filter(({ key, msg }) => !isSnackbarDismissible(msg) || !dismissedSnackbarKeys.has(key))
      .sort((a, b) => {
        const priorityDiff = getSnackbarPriority(a.msg) - getSnackbarPriority(b.msg);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        return a.originalIndex - b.originalIndex;
      })
      .slice(0, 2);
  }, [dismissedSnackbarKeys, tooltipMessages]);

  const pricing = initialPricing ?? DEFAULT_PRICING;
  const planType = activeSettingsSnapshot?.profile?.subscription?.planType ?? userProfile?.subscription?.planType;

  const workspaceRoleValue = useMemo(() => {
    const inWorkspace = Boolean(currentWorkspace && isKnownWorkspace);
    const role = inWorkspace ? resolveCurrentWorkspaceRole(activeWorkspaceTeamMembers, userProfile?.id, userProfile?.email) : null;
    const isViewer = inWorkspace && role === "Viewer";
    const canWrite = !inWorkspace || canWorkspaceRoleWrite(role);
    return {
      role,
      isViewer,
      canWrite,
      canManageMembers: !inWorkspace || role === "Creator" || role === "Administrator",
      canEditWorkspace: !inWorkspace || role === "Creator" || role === "Administrator",
      canSeeBilling: !inWorkspace || role === "Creator" || role === "Administrator",
    };
  }, [currentWorkspace, isKnownWorkspace, activeWorkspaceTeamMembers, userProfile?.id, userProfile?.email]);

  if (isAuthRoute || isCatchAll) {
    return (
      <QueryClientProvider client={dashboardQueryClient}>
        <PricingProvider value={pricing}>
          <PlanTypeProvider value={planType}>
            <WorkspaceRoleProvider value={workspaceRoleValue}>
              <TooltipProvider>
                <RouterProgressBar />
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
                  <StepUpTwoFactorProvider>
                    <RouterProgressBar />
                    <DashToaster />
                    <CommandPaletteSlot />
                    <div className="flex h-dvh flex-col bg-dash-bg">
                      <Topbar
                        onSettingsClick={() => setProfileOpen(true)}
                        onMobileNavToggle={() => setMobileNavOpen((v) => !v)}
                        mobileNavOpen={mobileNavOpen}
                        userProfile={userProfile}
                        workspaces={effectiveWorkspaces}
                        workspaceTeamMembers={activeWorkspaceTeamMembers}
                        projectSwitcherProjects={matchedProjectSwitcherProjects ?? initialProjectSwitcherProjects?.items ?? []}
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
                                          setProfileRequestedTab(ProfileTab.Billing);
                                          setProfileOpen(true);
                                          return;
                                        }

                                        if (!msg.route) {
                                          return;
                                        }

                                        if (/^https?:\/\//.test(msg.route!)) {
                                          window.open(msg.route!, "_blank", "noopener,noreferrer");
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
                                        writeDismissedSnackbars(currentWorkspace, next);
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
                                <RouteTransitionSkeleton pathname={pathname} fullWidth />
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
                            <Sidebar onProfileOpenChange={setProfileOpen} />
                          </div>
                          <main className="scrollbar-hidden flex min-h-0 flex-1 flex-col overflow-y-auto">
                            <div className="flex-1 px-4 py-6 md:py-8 md:pl-10 md:pr-0">
                              {shouldShowRouteSkeleton ? <RouteTransitionSkeleton pathname={pathname} /> : children}
                            </div>
                            <Footer />
                          </main>
                        </div>
                      )}
                      {shouldRenderWelcomeModal && (
                        <Suspense fallback={null}>
                          <WelcomeModal />
                        </Suspense>
                      )}
                      {(() => {
                        const viewerNeeds2FA =
                          isKnownWorkspace && Boolean(activeWorkspaceTeamMembers?.enforce2FA) && twoFactorStatus?.enabled === false;
                        if (!viewerNeeds2FA) return null;
                        const team = effectiveWorkspaces.find((w) => w.slug === currentWorkspace);
                        const workspaceName = team?.name || activeWorkspaceTeamMembers?.name || currentWorkspace || "this workspace";
                        return (
                          <Suspense fallback={null}>
                            <TeamTwoFactorRequiredModal
                              open
                              onOpenChange={() => {
                                /* non-dismissible — auto-closes when 2FA becomes enabled */
                              }}
                              workspaceName={workspaceName}
                              workspaceAvatarUrl={team?.avatarUrl}
                              userFirstName={userProfile?.firstName || undefined}
                              userAvatarUrl={userProfile?.avatarUrl || undefined}
                            />
                          </Suspense>
                        );
                      })()}
                      {shouldRenderOnboardingChecklist && (
                        <Suspense fallback={null}>
                          <OnboardingChecklist
                            projects={checklistProjects}
                            settingsSnapshot={activeSettingsSnapshot}
                            isTeamWorkspace={isTeamWorkspace}
                            teamDetails={activeWorkspaceTeamMembers}
                          />
                        </Suspense>
                      )}
                      {profileEverOpened && (
                        <Suspense fallback={null}>
                          <UserProfileDrawer
                            initialWorkspaceTeamMembers={activeWorkspaceTeamMembers}
                            open={profileOpen}
                            onOpenChange={setProfileOpen}
                            requestedTab={profileRequestedTab}
                            initialSnapshot={activeSettingsSnapshot}
                            initialPaymentMethods={initialPaymentMethods ?? null}
                            initialInvoices={initialInvoices ?? null}
                            initialActivityLogs={initialActivityLogs ?? null}
                            initialSubscriptionStats={initialSubscriptionStats ?? null}
                            initialUserOverview={initialUserOverview ?? null}
                            initialProjectEnvironments={initialProjectEnvironments ?? null}
                            projectCount={accountProjectCount}
                          />
                        </Suspense>
                      )}
                    </div>
                  </StepUpTwoFactorProvider>
                </ProfileDrawerProvider>
              </TooltipProvider>
            </ScoutBarProvider>
          </WorkspaceRoleProvider>
        </PlanTypeProvider>
      </PricingProvider>
    </QueryClientProvider>
  );
}
