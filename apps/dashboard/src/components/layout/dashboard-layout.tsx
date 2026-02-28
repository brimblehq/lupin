import { type ReactNode, useState, useCallback, useEffect, useMemo } from "react";
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
import type { SettingsSidebarSnapshot } from "@/backend/settings";
import type { ApiListResponse } from "@/backend";
import type { Workspace } from "@/backend/workspaces";
import type { Project } from "@/backend/projects";
import type { TeamDetails } from "@/backend/teams";
import type { AppTooltipMessage } from "@/backend/messages";
import type { PaymentMethod } from "@/backend/payments";
import type { Pricing } from "@/types/pricing";
import { PricingProvider } from "@/contexts/pricing-context";
import { PlanTypeProvider } from "@/contexts/plan-type-context";
import { DEFAULT_PRICING } from "@/utils/default-pricing";
import { ProfileTab } from "../../types/enums";
import { listTooltipMessagesServerFn } from "@/server/messages/actions";

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

function isFullWidthLayoutPath(pathname: string) {
  const isProjectDetailsRoute =
    /^\/projects\/[^/]+(?:\/|$)/.test(pathname) &&
    !/^\/projects\/new(?:\/|$)/.test(pathname);

  return isProjectDetailsRoute;
}

function MobileNavMenu({ onSettingsClick }: { onSettingsClick: () => void }) {
  const { theme, toggleTheme } = useTheme();
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
                  "text-dash-text-faded hover:bg-dash-bg-elevated"
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
                    : "text-dash-text-faded hover:bg-dash-bg-elevated"
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
        className={cn(mobileNavItemBase, "text-dash-text-faded hover:bg-dash-bg-elevated")}
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
        onClick={toggleTheme}
        className={cn(mobileNavItemBase, "text-dash-text-faded hover:bg-dash-bg-elevated")}
      >
        {theme === "dark" ? (
          <Sun className="size-5 shrink-0" />
        ) : (
          <Moon className="size-5 shrink-0" />
        )}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
    </nav>
  );
}

export function DashboardLayout({
  children,
  initialSettingsSnapshot,
  initialWorkspaces,
  initialProjectSwitcherProjects,
  initialOnboardingProjects,
  initialWorkspaceTeamMembers,
  initialTooltipMessages,
  initialPaymentMethods,
  initialInvoices,
  initialPricing,
}: {
  children: ReactNode;
  initialSettingsSnapshot?: SettingsSidebarSnapshot | null;
  initialWorkspaces?: ApiListResponse<Workspace>;
  initialProjectSwitcherProjects?: ApiListResponse<Project> | null;
  initialOnboardingProjects?: ApiListResponse<Project> | null;
  initialWorkspaceTeamMembers?: TeamDetails | null;
  initialTooltipMessages?: AppTooltipMessage[] | null;
  initialPaymentMethods?: PaymentMethod[] | null;
  initialInvoices?: any;
  initialPricing?: Pricing;
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
        | { projects?: Array<{ name: string; slug: string; [key: string]: unknown }> | null }
        | undefined;
      if (listData?.projects?.length) return listData.projects as unknown as Project[];

      return null;
    },
  });
  const navigate = useNavigate();
  const isAuthRoute = /^\/(login|signup)$/.test(layoutPathname) || /^\/(login|signup)$/.test(pathname);
  const knownPrefixes = /^\/(login|signup|projects|domains|addons|scaling|workspace)?(\/|$)/;
  const isCatchAll = layoutPathname !== "/" && !knownPrefixes.test(layoutPathname);
  const resolvedIsFullWidth = isFullWidthLayoutPath(layoutPathname);
  const targetIsFullWidth = isFullWidthLayoutPath(pathname);
  const shouldRenderDesktopSidebar = !(resolvedIsFullWidth && targetIsFullWidth);
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const [stableWorkspaces, setStableWorkspaces] = useState<Workspace[]>(
    initialWorkspaces?.items ?? [],
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
    stableWorkspaces.length > 0 ? stableWorkspaces : (initialWorkspaces?.items ?? []);

  const isTeamWorkspace = (() => {
    const params = new URLSearchParams(searchStr || "");
    const ws = params.get("workspace");
    return Boolean(
      ws && effectiveWorkspaces.some((w) => w.slug === ws),
    );
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

  const currentWorkspace = useMemo(() => {
    const params = new URLSearchParams(searchStr || "");
    return params.get("workspace")?.trim() || undefined;
  }, [searchStr]);
  const getTooltipMessages = useServerFn(listTooltipMessagesServerFn as any) as (args: {
    data?: { workspace?: string; type?: "notifications"; limit?: number; page?: number };
  }) => Promise<AppTooltipMessage[] | null>;
  const [tooltipMessages, setTooltipMessages] = useState<AppTooltipMessage[] | null>(
    initialTooltipMessages ?? null,
  );
  // Keep initial render deterministic for SSR hydration; load localStorage after mount.
  const [dismissedSnackbarKeys, setDismissedSnackbarKeys] = useState<Set<string>>(
    () => new Set(),
  );

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
  const planType = initialSettingsSnapshot?.profile?.subscription?.planType;

  if (isAuthRoute || isCatchAll) {
    return (
      <QueryClientProvider client={dashboardQueryClient}>
      <PricingProvider value={pricing}>
      <PlanTypeProvider value={planType}>
      <TooltipProvider>
        <DashToaster />
        {children}
      </TooltipProvider>
      </PlanTypeProvider>
      </PricingProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={dashboardQueryClient}>
    <PricingProvider value={pricing}>
    <PlanTypeProvider value={planType}>
    <ScoutBarProvider>
    <TooltipProvider>
      <DashToaster />
      <CommandPalette />
      <div className="flex h-dvh flex-col bg-dash-bg">
        <Topbar
          onSettingsClick={() => setProfileOpen(true)}
          onMobileNavToggle={() => setMobileNavOpen((v) => !v)}
          mobileNavOpen={mobileNavOpen}
          settingsSnapshot={initialSettingsSnapshot ?? null}
          workspaces={effectiveWorkspaces}
          projectSwitcherProjects={
            matchedProjectSwitcherProjects ?? initialProjectSwitcherProjects?.items ?? []
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
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
                              window.location.href = msg.route!;
                              return;
                            }

                            void navigate({
                              to: msg.route as any,
                              search: currentWorkspace ? ({ workspace: currentWorkspace } as any) : undefined,
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

        {!shouldRenderDesktopSidebar && resolvedIsFullWidth ? (
          <main className="scrollbar-hidden flex flex-1 flex-col overflow-y-auto">
            <div className="mx-auto w-full max-w-screen-xl flex-1 px-4 md:px-0">
              {children}
            </div>
            <Footer />
          </main>
        ) : (
          <div className="mx-auto flex w-full max-w-screen-xl flex-1 overflow-hidden">
            <div className="hidden md:flex">
              <Sidebar profileOpen={profileOpen} onProfileOpenChange={setProfileOpen} />
            </div>
            <main className="scrollbar-hidden flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="flex-1 px-4 py-6 md:py-8 md:pl-10 md:pr-0">
                {children}
              </div>
              <Footer />
            </main>
          </div>
        )}
        <WelcomeModal />
        <OnboardingChecklist
          projects={
            matchedProjects ??
            matchedProjectSwitcherProjects ??
            initialOnboardingProjects?.items ??
            initialProjectSwitcherProjects?.items ??
            []
          }
          settingsSnapshot={initialSettingsSnapshot}
          isTeamWorkspace={isTeamWorkspace}
          teamDetails={initialWorkspaceTeamMembers}
        />
        <UserProfileDrawer
          initialWorkspaceTeamMembers={initialWorkspaceTeamMembers ?? null}
          open={profileOpen}
          onOpenChange={setProfileOpen}
          requestedTab={profileRequestedTab}
          initialSnapshot={initialSettingsSnapshot ?? null}
          initialPaymentMethods={initialPaymentMethods ?? null}
          initialInvoices={initialInvoices ?? null}
        />
      </div>
    </TooltipProvider>
    </ScoutBarProvider>
    </PlanTypeProvider>
    </PricingProvider>
    </QueryClientProvider>
  );
}
