import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { SUBSCRIPTION_PLAN_TYPE } from "@brimble/models/dist/enum";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import { useProfileDrawer } from "@/contexts/profile-drawer-context";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { ProfileTab } from "@/types/enums";
import { getGithubConnectUrlServerFn, listGithubAccountsServerFn } from "@/server/repositories/actions";
import { getWorkspaceTeamMembersServerFn } from "@/server/teams/actions";
import { updateSettingsFollowedXServerFn } from "@/server/settings/actions";
import type { Project } from "@/backend/projects";
import type { SettingsSidebarSnapshot } from "@/backend/settings";
import type { TeamDetails } from "@/backend/teams";
import { usePaymentMethods } from "@/hooks/use-payments";
import { hasCompletedTour, startProductTour } from "./product-tour";

const EASE = [0.16, 1, 0.3, 1] as const;

interface OnboardingTask {
  label: string;
  done: boolean;
  action?: string;
  external?: boolean;
  onClick?: () => void;
}

function buildTasks({
  hasGit,
  hasProject,
  isFreePlan,
  hasFollowed,
  hasPaymentCard,
  hasTakenTour,
  onAddPaymentCard,
  onConnectGit,
  isTeamWorkspace,
  hasTeamMembers,
  showInviteTeamMemberTask,
}: {
  hasGit: boolean;
  hasProject: boolean;
  isFreePlan: boolean;
  hasFollowed: boolean;
  hasPaymentCard: boolean;
  hasTakenTour: boolean;
  onAddPaymentCard?: () => void;
  onConnectGit?: () => void;
  isTeamWorkspace: boolean;
  hasTeamMembers: boolean;
  showInviteTeamMemberTask: boolean;
}): OnboardingTask[] {
  const tasks: OnboardingTask[] = [
    {
      label: "Take a quick tour",
      done: hasTakenTour,
      onClick: () => startProductTour(),
    },
    {
      label: "Connect Git",
      done: hasGit,
      onClick: onConnectGit,
    },
    { label: "Deploy a project", done: hasProject, action: "/projects/new" },
  ];

  if (!isTeamWorkspace) {
    tasks.push({
      label: "Add a payment card",
      done: hasPaymentCard,
      onClick: onAddPaymentCard,
    });
    tasks.push({ label: "Upgrade your plan", done: !isFreePlan, onClick: onAddPaymentCard });
  }

  tasks.push({
    label: "Follow on X",
    done: hasFollowed,
    action: "https://x.com/brimblehq",
    external: true,
  });

  // Only show "Invite a team member" on team workspaces
  if (isTeamWorkspace && showInviteTeamMemberTask) {
    tasks.push({ label: "Invite a team member", done: hasTeamMembers });
  }

  return tasks;
}

export function OnboardingChecklist({
  projects,
  settingsSnapshot,
  isTeamWorkspace,
  teamDetails,
}: {
  projects?: Project[] | null;
  settingsSnapshot?: SettingsSidebarSnapshot | null;
  isTeamWorkspace?: boolean;
  teamDetails?: TeamDetails | null;
}) {
  const { canWrite } = useWorkspaceRole();
  const profileDrawer = useProfileDrawer();
  const haptics = useHaptics();
  const [expanded, setExpanded] = useState(false);
  const [hasFollowed, setHasFollowed] = useState(Boolean(settingsSnapshot?.profile?.followedX));
  const [hasTakenTour, setHasTakenTour] = useState(() => hasCompletedTour());

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === "brimble:product-tour-completed") {
        setHasTakenTour(hasCompletedTour());
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const navigate = useNavigate();
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const updateFollowedX = useServerFn(updateSettingsFollowedXServerFn as any) as (args: {
    data: { followed_x: boolean };
  }) => Promise<{ ok: true }>;
  const getGithubConnectUrl = useServerFn(getGithubConnectUrlServerFn as any) as (args: {
    data?: { device?: string };
  }) => Promise<{ url: string }>;
  const getTeamMembers = useServerFn(getWorkspaceTeamMembersServerFn as any) as (args: {
    data: { workspace: string };
  }) => Promise<TeamDetails>;
  const listGithubAccounts = useServerFn(listGithubAccountsServerFn as any) as () => Promise<unknown[] | { accounts?: unknown[] }>;
  const activeWorkspaceSlug = (() => {
    const params = new URLSearchParams(searchStr || "");
    const workspace = params.get("workspace")?.trim();
    return workspace || null;
  })();
  const [teamDetailsByWorkspace, setTeamDetailsByWorkspace] = useState<Record<string, TeamDetails>>({});
  const [teamMembersFetchFailedByWorkspace, setTeamMembersFetchFailedByWorkspace] = useState<Record<string, true>>({});
  const [hasConnectedGit, setHasConnectedGit] = useState<boolean | null>(null);
  const [gitRefreshKey, setGitRefreshKey] = useState(0);
  const projectList = Array.isArray(projects) ? projects : [];
  const deployableProjects = projectList.filter((project) => {
    const serviceType = String(project.serviceType ?? "").toLowerCase();
    return serviceType !== "database" && serviceType !== "database-service";
  });
  const hasGitFromProjects = deployableProjects.some((p) => p.gitLink || p.repo?.git || p.repo?.fullName || p.repo?.name);

  useEffect(() => {
    function handleGitChange() {
      setGitRefreshKey((k) => k + 1);
    }

    window.addEventListener("brimble:git-connection-changed", handleGitChange);
    return () => {
      window.removeEventListener("brimble:git-connection-changed", handleGitChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    async function fetchGitStatus(attempt = 0) {
      try {
        const result = await listGithubAccounts();
        if (cancelled) return;
        const accounts = Array.isArray(result) ? result : (result?.accounts ?? []);
        setHasConnectedGit(accounts.length > 0);
      } catch {
        if (cancelled) return;
        // Retry up to 2 times with a delay — the initial call can fail
        // if auth cookies haven't settled yet on page load.
        if (attempt < 2) {
          retryTimeout = setTimeout(() => {
            void fetchGitStatus(attempt + 1);
          }, 1500);
        }
      }
    }

    void fetchGitStatus();

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listGithubAccounts is stable in behavior but unstable in reference (useServerFn)
  }, [gitRefreshKey]);

  useEffect(() => {
    if (!isTeamWorkspace || !activeWorkspaceSlug) {
      return;
    }

    if (teamDetails && !teamDetailsByWorkspace[activeWorkspaceSlug]) {
      setTeamDetailsByWorkspace((prev) => ({
        ...prev,
        [activeWorkspaceSlug]: teamDetails,
      }));
      return;
    }

    if (teamDetailsByWorkspace[activeWorkspaceSlug]) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const nextTeam = await getTeamMembers({ data: { workspace: activeWorkspaceSlug } });
        if (cancelled) {
          return;
        }

        setTeamDetailsByWorkspace((prev) => ({
          ...prev,
          [activeWorkspaceSlug]: nextTeam,
        }));
      } catch {
        if (!cancelled) {
          setTeamMembersFetchFailedByWorkspace((prev) => ({
            ...prev,
            [activeWorkspaceSlug]: true,
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getTeamMembers is stable in behavior but unstable in reference (useServerFn)
  }, [activeWorkspaceSlug, isTeamWorkspace, teamDetails, teamDetailsByWorkspace]);

  useEffect(() => {
    setHasFollowed(Boolean(settingsSnapshot?.profile?.followedX));
  }, [settingsSnapshot?.profile?.followedX]);

  const hasGit = hasConnectedGit ?? hasGitFromProjects;
  const hasProject = deployableProjects.length > 0;
  const planType = (settingsSnapshot?.profile?.subscription?.planType ?? "").toUpperCase();
  const isFreePlan = !planType || planType === SUBSCRIPTION_PLAN_TYPE.FreePlan;
  const { data: fetchedPaymentMethods, isFetched: paymentMethodsFetched, isError: paymentMethodsFailed } = usePaymentMethods();
  const hasPaymentCard = Array.isArray(fetchedPaymentMethods) && fetchedPaymentMethods.length > 0;
  const resolvedTeamDetails = (activeWorkspaceSlug ? teamDetailsByWorkspace[activeWorkspaceSlug] : null) ?? teamDetails ?? null;
  const acceptedTeamMembersCount = resolvedTeamDetails?.members?.filter((member) => member.accepted !== false).length ?? 0;
  const hasTeamMembers = acceptedTeamMembersCount > 1;
  const currentUserId = settingsSnapshot?.profile?.id?.trim().toLowerCase() ?? "";
  const currentUserEmail = settingsSnapshot?.profile?.email?.trim().toLowerCase() ?? "";
  const currentTeamMember = resolvedTeamDetails?.members?.find((member) => {
    const memberUserId = member.userId?.trim().toLowerCase() ?? "";
    const memberEmail = member.email.trim().toLowerCase();
    return (currentUserId && memberUserId === currentUserId) || (currentUserEmail && memberEmail === currentUserEmail);
  });
  const currentUserIsTeamOwner =
    Boolean(resolvedTeamDetails?.isCreator) ||
    Boolean(currentTeamMember?.isCreator) ||
    currentTeamMember?.role?.trim().toLowerCase() === "creator";
  const showInviteTeamMemberTask = Boolean(isTeamWorkspace) && currentUserIsTeamOwner && acceptedTeamMembersCount <= 1;

  const tasks = useMemo(
    () =>
      buildTasks({
        hasGit,
        hasProject,
        isFreePlan,
        hasFollowed,
        hasPaymentCard,
        hasTakenTour,
        onAddPaymentCard: () => profileDrawer.open(ProfileTab.Billing),
        onConnectGit: () => {
          void (async () => {
            try {
              const connect = await getGithubConnectUrl({
                data: {
                  device: window.sessionStorage.getItem("brimble.oauth.device_id") ?? undefined,
                },
              });
              const connectUrl = connect?.url?.trim();
              if (!connectUrl) {
                throw new Error("Unable to get GitHub connection link.");
              }

              const popup = window.open(connectUrl, "_blank", "width=900,height=760");

              if (!popup) {
                throw new Error("Popup blocked. Please allow popups and try again.");
              }
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to open GitHub connection page");
            }
          })();
        },
        isTeamWorkspace: isTeamWorkspace ?? false,
        hasTeamMembers,
        showInviteTeamMemberTask,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      hasGit,
      hasProject,
      isFreePlan,
      hasFollowed,
      hasPaymentCard,
      hasTakenTour,
      getGithubConnectUrl,
      isTeamWorkspace,
      hasTeamMembers,
      showInviteTeamMemberTask,
    ],
  );

  const completedCount = tasks.filter((t) => t.done).length;
  const progress = completedCount / tasks.length;

  const settingsResolved = Boolean(settingsSnapshot?.profile);
  const projectsResolved = Array.isArray(projects);
  const paymentMethodsResolved = paymentMethodsFetched && !paymentMethodsFailed;
  const teamMembersResolved = !isTeamWorkspace || Boolean(resolvedTeamDetails);
  const teamMembersFetchFailed =
    Boolean(isTeamWorkspace) && Boolean(activeWorkspaceSlug) && Boolean(activeWorkspaceSlug in teamMembersFetchFailedByWorkspace);
  const checklistSignalsReady =
    settingsResolved &&
    projectsResolved &&
    paymentMethodsResolved &&
    hasConnectedGit !== null &&
    teamMembersResolved &&
    !teamMembersFetchFailed;

  const handleTaskClick = useCallback(
    (task: OnboardingTask) => {
      haptics.selection();
      if (task.onClick) {
        task.onClick();
        return;
      }
      if (task.external && task.action) {
        // Mark as followed when clicking the X link
        if (task.action.includes("x.com")) {
          setHasFollowed(true);
          void updateFollowedX({ data: { followed_x: true } }).catch(() => {});
        }
        window.open(task.action, "_blank", "noopener,noreferrer");
      } else if (task.action) {
        void navigate({
          to: withWorkspaceQuery({ pathname: task.action, searchStr }) as any,
        });
      }
    },
    [navigate, searchStr, haptics, updateFollowedX],
  );

  // Avoid flash-then-disappear while workspace-specific checks are still resolving.
  if (!checklistSignalsReady) return null;

  // Hide if all tasks are done or if user is a Viewer
  if (!canWrite || completedCount === tasks.length) return null;

  return (
    <motion.div
      className="fixed bottom-5 right-5 z-50 w-[320px]"
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      style={{ transformOrigin: "bottom right" }}
    >
      {/* Collapsed pill */}
      {!expanded && (
        <motion.button
          key="pill"
          onClick={() => {
            haptics.soft();
            setExpanded(true);
          }}
          className="ml-auto flex items-center gap-2 rounded-full border-[0.5px] border-dash-border bg-dash-bg px-4 py-2.5 text-sm font-medium text-dash-text-strong shadow-[0px_2px_3px_rgba(0,0,0,0.06),inset_0px_-3px_2px_rgba(245,245,245,0.3)] transition-colors hover:bg-dash-bg-elevated dark:shadow-[0px_2px_3px_rgba(0,0,0,0.2)]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{
            opacity: 1,
            scale: 1,
            rotate: [0, 0, -2, 2, -2, 2, 0, 0],
          }}
          transition={{
            duration: 0.2,
            ease: EASE,
            rotate: {
              duration: 0.5,
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: 8,
              delay: 5,
            },
          }}
        >
          {/* Progress ring */}
          <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0">
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-dash-border" />
            <circle
              cx="10"
              cy="10"
              r="8"
              fill="none"
              stroke="#3c6ce7"
              strokeWidth="2"
              strokeDasharray={`${progress * 50.27} 50.27`}
              strokeLinecap="round"
              transform="rotate(-90 10 10)"
            />
          </svg>
          <span>
            {completedCount}/{tasks.length} completed
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-dash-text-faded">
            <path d="M4 10L8 6L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>
      )}

      {/* Expanded card */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="card"
            className="overflow-hidden rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg shadow-[0px_2px_3px_rgba(0,0,0,0.06),inset_0px_-3px_2px_rgba(245,245,245,0.3)] dark:shadow-[0px_2px_3px_rgba(0,0,0,0.2)]"
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: "auto", scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: EASE }}
            style={{ transformOrigin: "bottom right" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-4 py-3">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-dash-text-strong">Getting started</h3>
                <p className="mt-0.5 text-xs text-dash-text-faded">
                  {completedCount}/{tasks.length} completed
                </p>
              </div>
              <button
                onClick={() => {
                  haptics.selection();
                  setExpanded(false);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-dash-text-faded transition-colors hover:bg-dash-bg hover:text-dash-text-strong"
              >
                <motion.svg width="16" height="16" viewBox="0 0 16 16" fill="none" animate={{ rotate: 180 }} transition={{ duration: 0.2 }}>
                  <path d="M4 10L8 6L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 w-full bg-dash-border">
              <motion.div
                className="h-full rounded-r-full bg-[#3c6ce7]"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.35, ease: EASE }}
              />
            </div>

            {/* Task list */}
            <ul className="px-4 py-2">
              {tasks.map((task, i) => (
                <li key={i}>
                  <div className="flex items-center gap-3 px-1 py-2">
                    {/* Checkbox (read-only) */}
                    <span
                      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
                        task.done ? "border-[#3c6ce7] bg-[#3c6ce7]" : "border-dash-border"
                      }`}
                    >
                      {task.done && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {(task.action || task.onClick) && !task.done ? (
                      <button
                        onClick={() => handleTaskClick(task)}
                        className="text-left text-sm text-dash-text-strong transition-colors hover:text-[#3c6ce7]"
                      >
                        {task.label}
                      </button>
                    ) : (
                      <span
                        className={`text-sm transition-colors ${task.done ? "text-dash-text-faded line-through" : "text-dash-text-strong"}`}
                      >
                        {task.label}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
