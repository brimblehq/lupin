import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Bell,
  LoaderCircle,
  HelpCircle,
  ChevronDown,
  Plus,
  Globe,
  Users,
  Menu,
  X,
  ArrowRightLeft,
  Copy,
  Check,
  Newspaper,
} from "lucide-react";
import { House, ShoppingBag, Desktop } from "@phosphor-icons/react";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/use-theme";
import { useHaptics } from "../../hooks/use-haptics";
import { DashButton } from "../shared/dash-button";
import { Spinner } from "../shared/spinner";
import { Avatar } from "../shared/avatar";
import { useScoutBar } from "../../contexts/scoutbar-context";
import config from "@/config";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import type { SettingsSidebarSnapshot } from "@/backend/settings";
import type { Workspace } from "@/backend/workspaces";
import type { Project } from "@/backend/projects";
import type { TeamDetails } from "@/backend/teams";
import type { NotificationItem, NotificationLevel } from "@/backend/notifications";
import { useNotifications, useMarkNotificationSeen, useMarkAllNotificationsSeen } from "@/hooks/use-notifications";
import { formatRelativeTime } from "@/utils/dashboard";
import {
  listProjectEnvironmentsServerFn,
  createProjectEnvironmentServerFn,
  deleteProjectEnvironmentServerFn,
  getActiveEnvironmentPreferenceServerFn,
  setActiveEnvironmentPreferenceServerFn,
} from "@/server/environments/actions";
import type { ProjectEnvironment } from "@/backend/environments";
import { WarningModal } from "../shared/warning-modal";
import { Dropdown } from "../shared/dropdown";
import { toTitleCase } from "@/utils/dashboard";
import { Theme } from "@/types/enums";
import { buildProjectSwitchUrl, buildWorkspaceSwitchUrl, setPendingDomainsAction, withWorkspaceQuery } from "@/utils/topbar-navigation";

function getWorkspaceSearch(searchStr?: string) {
  const params = new URLSearchParams(searchStr || "");
  const workspace = params.get("workspace")?.trim();
  return workspace ? ({ workspace } as const) : undefined;
}

function splitInternalUrl(url: string) {
  const [to, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  const search = Object.fromEntries(params.entries());
  return {
    to: (to || "/") as string,
    search: Object.keys(search).length > 0 ? (search as Record<string, string>) : undefined,
  };
}

function ProjectSwitcher({
  projectId,
  currentProjectName,
  pathname,
  searchStr,
  projects,
}: {
  projectId: string;
  currentProjectName?: string;
  pathname: string;
  searchStr: string;
  projects: Project[];
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      filterRef.current?.focus();
      return () => document.removeEventListener("mousedown", handleClick);
    } else {
      setFilter("");
    }
  }, [open]);

  const displayProjectId = decodeURIComponent(projectId);
  const currentProject = projects.find(
    (project) => project.id === displayProjectId || project.slug === displayProjectId || project.name === displayProjectId,
  );
  const activeProjectLabel = currentProjectName?.trim() || currentProject?.name || displayProjectId;

  async function handleCopyProjectName(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(activeProjectLabel);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — silently ignore */
    }
  }

  return (
    <div className="relative flex min-w-0 items-center gap-1" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex min-w-0 max-w-[136px] items-center gap-1 text-sm font-medium text-dash-text-faded transition-colors hover:text-dash-text-strong sm:max-w-[260px]"
      >
        <span className="truncate whitespace-nowrap">{activeProjectLabel}</span>
        <motion.span className="shrink-0" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
          <ChevronDown className="size-4" />
        </motion.span>
      </button>
      <button
        type="button"
        onClick={handleCopyProjectName}
        aria-label={copied ? "Project name copied" : "Copy project name"}
        title={copied ? "Copied" : "Copy project name"}
        className="flex size-6 shrink-0 items-center justify-center rounded-[4px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
      >
        {copied ? <Check className="size-3.5 text-[#4879f8]" /> : <Copy className="size-3.5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full z-50 mt-2 w-[200px] origin-top-left overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg shadow-[0px_2px_3px_rgba(0,0,0,0.06)]"
          >
            {/* Search filter */}
            <div className="border-b-[0.5px] border-dash-border px-3 py-2">
              <input
                ref={filterRef}
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search projects…"
                className="w-full bg-transparent text-sm text-dash-text-body placeholder:text-dash-text-extra-faded outline-none"
              />
            </div>
            {/* Project list */}
            <div className="scrollbar-hidden flex max-h-[240px] flex-col gap-2 overflow-y-auto border-b-[0.5px] border-dash-border px-3.5 py-2">
              {projects.length > 0 ? (
                projects
                  .filter((p) => !filter || (p.name || p.slug || "").toLowerCase().includes(filter.toLowerCase()))
                  .map((project) => {
                    const nextProjectId = project.slug || project.id || project.name;
                    if (!nextProjectId) {
                      return null;
                    }

                    const isActive = nextProjectId === displayProjectId || project.name === activeProjectLabel;
                    const nextUrl = buildProjectSwitchUrl({
                      pathname,
                      searchStr,
                      targetProjectId: nextProjectId,
                    });
                    const nextNav = splitInternalUrl(nextUrl);

                    return (
                      <button
                        key={project.id || nextProjectId}
                        onClick={() => {
                          setOpen(false);
                          navigate({
                            to: nextNav.to as any,
                            search: nextNav.search as any,
                          });
                        }}
                        className={`flex h-8 items-center px-3.5 text-left text-sm transition-colors ${
                          isActive ? "text-dash-text-strong" : "text-dash-text-faded hover:text-dash-text-body"
                        }`}
                      >
                        {project.name || nextProjectId}
                      </button>
                    );
                  })
              ) : (
                <div className="py-1 text-sm text-dash-text-extra-faded">No projects found</div>
              )}
            </div>
            {/* Create project — hidden for Viewers */}
            <CreateProjectButton searchStr={searchStr} onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateProjectButton({ searchStr, onClose }: { searchStr: string; onClose: () => void }) {
  const { canWrite } = useWorkspaceRole();
  const navigate = useNavigate();
  if (!canWrite) return null;
  return (
    <button
      type="button"
      onClick={() => {
        onClose();
        navigate({
          to: "/projects/new",
          search: getWorkspaceSearch(searchStr) as any,
        });
      }}
      className="flex h-10 w-full items-center gap-2 bg-dash-bg-elevated px-3.5 text-left text-sm text-dash-text-faded transition-colors hover:text-dash-text-body"
    >
      <Plus className="size-4" />
      Create project
    </button>
  );
}

function WorkspaceSwitcher({
  profile,
  workspaces,
  pathname,
  searchStr,
}: {
  profile: SettingsSidebarSnapshot["profile"] | null;
  workspaces: Workspace[];
  pathname: string;
  searchStr: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const personalAvatarSeed = profile?.username || profile?.firstName || profile?.email || "user";

  const personalName = profile?.firstName || profile?.username || profile?.email;
  const personalWorkspaceLabel = personalName ? `${toTitleCase(personalName)}'s Workspace` : "";
  const params = new URLSearchParams(searchStr || "");
  const activeWorkspaceSlug = params.get("workspace");
  const activeTeam = workspaces.find((team) => team.slug === activeWorkspaceSlug) ?? null;

  const activeAvatarSrc = activeTeam?.avatarUrl || profile?.avatarUrl;
  const activeAvatarSeed = activeTeam ? activeTeam.name : personalAvatarSeed;

  const activeWorkspaceLabel = activeTeam ? `${toTitleCase(activeTeam.name)}'s Workspace` : personalWorkspaceLabel;

  const navigateWithWorkspace = (workspaceSlug?: string) => {
    const nextUrl = buildWorkspaceSwitchUrl({
      pathname,
      searchStr,
      workspaceSlug,
    });
    const nextNav = splitInternalUrl(nextUrl);

    navigate({
      to: nextNav.to as any,
      search: nextNav.search as any,
    });
  };

  const filteredTeams = workspaces.filter((team) => {
    const text = query.trim().toLowerCase();
    if (!text) {
      return true;
    }

    return team.name.toLowerCase().includes(text);
  });

  const homeSearch = activeTeam?.slug ? { workspace: activeTeam.slug } : {};

  return (
    <div className="relative flex items-center gap-1" ref={ref}>
      <Link
        to="/"
        search={homeSearch as any}
        className="flex items-center gap-2 rounded-[4px] py-0.5 text-sm font-medium text-dash-text-strong transition-colors hover:text-dash-text-body"
      >
        <Avatar src={activeAvatarSrc} fallbackSeed={activeAvatarSeed} alt="" className="size-6 rounded-full object-cover" />
        <span className="truncate max-w-[90px] sm:max-w-[180px]">{activeWorkspaceLabel}</span>
      </Link>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Switch workspace"
        className="flex items-center rounded-[4px] p-0.5 text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
      >
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
          <ChevronDown className="size-4 text-dash-text-strong" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full z-50 mt-2 w-[243px] origin-top-left overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)]"
          >
            {/* Search */}
            <div className="flex items-center gap-2 border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-2 py-2">
              <Search className="size-4 text-dash-text-extra-faded" />
              <input
                type="text"
                placeholder="Find team"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-sm text-dash-text-strong outline-none placeholder:text-dash-text-extra-faded"
              />
            </div>

            {/* Personal Accounts */}
            {personalWorkspaceLabel ? (
              <div className="border-b-[0.5px] border-dash-border px-2 pb-4 pt-2">
                <div className="py-2">
                  <span className="text-xs text-dash-text-extra-faded dark:text-dash-text-faded">Personal Accounts</span>
                </div>
                <button
                  onClick={() => {
                    setOpen(false);
                    navigateWithWorkspace();
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[4px] px-2 py-2 transition-colors hover:bg-dash-bg-elevated ${
                    !activeTeam ? "bg-dash-bg-elevated" : ""
                  }`}
                >
                  <Avatar
                    src={profile?.avatarUrl}
                    fallbackSeed={personalAvatarSeed}
                    alt=""
                    className="size-6 shrink-0 rounded-full object-cover"
                  />
                  <span className="text-left text-sm text-dash-text-body dark:text-dash-text-strong">{personalWorkspaceLabel}</span>
                </button>
              </div>
            ) : null}

            {/* Teams */}
            <div className="border-b-[0.5px] border-dash-border px-2 pb-4 pt-2">
              <div className="py-2">
                <span className="text-xs text-dash-text-extra-faded dark:text-dash-text-faded">Teams</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {filteredTeams.length > 0 ? (
                  filteredTeams.map((team) => {
                    return (
                      <button
                        key={team.id || team.name}
                        onClick={() => {
                          setOpen(false);
                          if (team.slug) {
                            navigateWithWorkspace(team.slug);
                          }
                        }}
                        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[4px] px-2 py-2 transition-colors hover:bg-dash-bg-elevated ${
                          activeTeam?.slug === team.slug ? "bg-dash-bg-elevated" : ""
                        }`}
                      >
                        <Avatar
                          src={team.avatarUrl}
                          fallbackSeed={team.name}
                          alt=""
                          className="size-6 shrink-0 rounded-full object-cover"
                        />
                        <span className="text-left text-sm text-dash-text-body dark:text-dash-text-strong">
                          {`${toTitleCase(team.name)}'s Workspace`}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-2 py-2 text-sm text-dash-text-extra-faded">No teams found</div>
                )}
              </div>
            </div>
            {/* Home + Create workspace */}
            <div className="flex flex-col border-t-[0.5px] border-dash-border bg-dash-bg-elevated">
              <button
                onClick={() => {
                  setOpen(false);
                  navigate({
                    to: "/projects",
                    search: getWorkspaceSearch(searchStr) as any,
                  });
                }}
                className="flex h-10 w-full items-center gap-2 px-3.5 text-sm text-dash-text-faded transition-colors hover:text-dash-text-body"
              >
                <House className="size-4" weight="fill" />
                Home
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  navigate({ to: "/workspace/new" });
                }}
                className="flex h-10 w-full items-center gap-2 px-3.5 text-sm text-dash-text-faded transition-colors hover:text-dash-text-body"
              >
                <Plus className="size-4" />
                Create workspace
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EnvironmentDropdown({
  workspace,
  teamDetails,
  userProfile,
}: {
  workspace?: string;
  teamDetails?: TeamDetails | null;
  userProfile?: SettingsSidebarSnapshot["profile"] | null;
}) {
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingSubmitting, setCreatingSubmitting] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvNameError, setNewEnvNameError] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectEnvironment | null>(null);
  const [migrateTarget, setMigrateTarget] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });

  const listEnvironments = useServerFn(listProjectEnvironmentsServerFn as any) as (args: {
    data: { workspace?: string };
  }) => Promise<ProjectEnvironment[]>;
  const createEnvironment = useServerFn(createProjectEnvironmentServerFn as any) as (args: {
    data: { name: string; workspace?: string };
  }) => Promise<ProjectEnvironment>;
  const deleteEnvironment = useServerFn(deleteProjectEnvironmentServerFn as any) as (args: {
    data: { environmentId: string; moveTo: string; workspace?: string };
  }) => Promise<{ success: boolean }>;
  const getActiveEnvironmentPreference = useServerFn(getActiveEnvironmentPreferenceServerFn as any) as (args: {
    data: { workspace?: string };
  }) => Promise<string | null>;
  const setActiveEnvironmentPreference = useServerFn(setActiveEnvironmentPreferenceServerFn as any) as (args: {
    data: { workspace?: string; environmentId?: string };
  }) => Promise<{ success: boolean }>;

  const listEnvironmentsRef = useRef(listEnvironments);
  const createEnvironmentRef = useRef(createEnvironment);
  const deleteEnvironmentRef = useRef(deleteEnvironment);
  const getActiveEnvironmentPreferenceRef = useRef(getActiveEnvironmentPreference);
  const setActiveEnvironmentPreferenceRef = useRef(setActiveEnvironmentPreference);

  useEffect(() => {
    listEnvironmentsRef.current = listEnvironments;
  }, [listEnvironments]);
  useEffect(() => {
    createEnvironmentRef.current = createEnvironment;
  }, [createEnvironment]);
  useEffect(() => {
    deleteEnvironmentRef.current = deleteEnvironment;
  }, [deleteEnvironment]);
  useEffect(() => {
    getActiveEnvironmentPreferenceRef.current = getActiveEnvironmentPreference;
  }, [getActiveEnvironmentPreference]);
  useEffect(() => {
    setActiveEnvironmentPreferenceRef.current = setActiveEnvironmentPreference;
  }, [setActiveEnvironmentPreference]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [envs, preferredEnvironmentId] = await Promise.all([
          listEnvironmentsRef.current({
            data: { workspace },
          }),
          getActiveEnvironmentPreferenceRef
            .current({
              data: { workspace },
            })
            .catch(() => null),
        ]);
        if (!cancelled && Array.isArray(envs) && envs.length > 0) {
          setEnvironments(envs);

          const defaultEnv = envs.find((e) => e.isDefault) ?? envs[0];
          const preferredExists = typeof preferredEnvironmentId === "string" && envs.some((env) => env._id === preferredEnvironmentId);
          const resolvedId = preferredExists ? preferredEnvironmentId! : defaultEnv._id;

          setSelectedId((prev) => {
            if (prev && envs.some((e) => e._id === prev)) return prev;
            return resolvedId;
          });
        }
      } catch {
        if (!cancelled) {
          setEnvironments([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewEnvName("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  useEffect(() => {
    if (creating) {
      createInputRef.current?.focus();
    }
  }, [creating]);

  const selectedEnv = environments.find((e) => e._id === selectedId);
  const defaultEnv = environments.find((e) => e.isDefault);
  const currentUserId = userProfile?.id?.trim().toLowerCase() ?? "";
  const currentUserEmail = userProfile?.email?.trim().toLowerCase() ?? "";
  const currentTeamMember = teamDetails?.members?.find((member) => {
    const memberUserId = member.userId?.trim().toLowerCase() ?? "";
    const memberEmail = member.email.trim().toLowerCase();
    return (currentUserId && memberUserId === currentUserId) || (currentUserEmail && memberEmail === currentUserEmail);
  });
  const normalizedRole = (currentTeamMember?.role ?? "").trim().toLowerCase();
  const { isViewer } = useWorkspaceRole();
  const canManageEnvironments =
    !isViewer &&
    (!workspace ||
      Boolean(teamDetails?.isCreator) ||
      Boolean(currentTeamMember?.isCreator) ||
      normalizedRole.includes("creator") ||
      normalizedRole.includes("owner") ||
      normalizedRole.includes("admin"));

  async function selectEnvironment(envId: string) {
    setSelectedId(envId);
    const isDefault = environments.find((e) => e._id === envId)?.isDefault;
    const persistedEnvironmentId = isDefault ? null : envId;

    try {
      await setActiveEnvironmentPreferenceRef.current({
        data: persistedEnvironmentId ? { workspace, environmentId: persistedEnvironmentId } : { workspace },
      });
    } catch {
      // silently fail; in-memory selection still updates
    }

    const params = new URLSearchParams(searchStr || "");
    params.delete("environmentId");
    const search = Object.fromEntries(params.entries());

    await navigate({
      to: pathname as any,
      search: Object.keys(search).length > 0 ? (search as any) : undefined,
      replace: true,
    });
    await router.invalidate();
  }

  async function handleCreateSubmit() {
    if (!canManageEnvironments) {
      return;
    }

    if (creatingSubmitting) {
      return;
    }

    const name = newEnvName.trim();
    if (!name || name.length < 3 || !/^[a-zA-Z][a-zA-Z _-]*$/.test(name)) {
      setNewEnvNameError(true);
      return;
    }
    setNewEnvNameError(false);
    // If an environment with the same name already exists, just select it
    const existing = environments.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      void selectEnvironment(existing._id);
      setCreating(false);
      setNewEnvName("");
      setOpen(false);
      return;
    }

    setCreatingSubmitting(true);
    try {
      const created = await createEnvironmentRef.current({
        data: { name, workspace },
      });
      setEnvironments((prev) => [...prev, created]);
      void selectEnvironment(created._id);
    } catch {
      // silently fail
    } finally {
      setCreatingSubmitting(false);
    }
    setCreating(false);
    setNewEnvName("");
    setOpen(false);
  }

  async function handleDeleteConfirm() {
    if (!canManageEnvironments) {
      setDeleteTarget(null);
      setMigrateTarget(null);
      return;
    }

    if (!deleteTarget || !migrateTarget) return;
    try {
      await deleteEnvironmentRef.current({
        data: {
          environmentId: deleteTarget._id,
          moveTo: migrateTarget,
          workspace,
        },
      });
      setEnvironments((prev) => prev.filter((e) => e._id !== deleteTarget._id));
      if (selectedId === deleteTarget._id) {
        void selectEnvironment(migrateTarget);
      }
    } catch {
      // silently fail
    }
    setDeleteTarget(null);
    setMigrateTarget(null);
  }

  return (
    <div className="relative" ref={ref}>
      <DashButton onClick={() => setOpen(!open)}>
        {selectedEnv?.name ?? "Production"}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
          <ChevronDown className="size-3.5" />
        </motion.span>
      </DashButton>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-[180px] origin-top-right overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)]"
          >
            <div className="py-1">
              {environments.map((env) => {
                const isSelected = env._id === selectedId;
                const isDeletable = canManageEnvironments && !env.isDefault;
                return (
                  <div
                    key={env._id}
                    className={`group mx-1 flex w-[calc(100%-8px)] items-center justify-between rounded-[2px] px-2 py-1.5 transition-colors hover:bg-dash-bg-elevated ${
                      isSelected ? "font-medium text-dash-text-strong" : "font-light text-dash-text-faded"
                    }`}
                  >
                    <button
                      className="min-w-0 flex-1 text-left text-sm"
                      onClick={() => {
                        void selectEnvironment(env._id);
                        setOpen(false);
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{env.name}</span>
                        {env.isDefault ? (
                          <span className="rounded-[3px] border border-dash-border-soft px-1 py-0 text-[10px] font-medium uppercase tracking-[0.02em] text-dash-text-extra-faded">
                            default
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {isDeletable && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(env);
                          setMigrateTarget(defaultEnv?._id ?? null);
                          setOpen(false);
                        }}
                        className="ml-2 hidden shrink-0 text-dash-text-extra-faded transition-colors hover:text-red-400 group-hover:block"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Create environment */}
            {canManageEnvironments ? (
              creating ? (
                <div className={`border-t-[0.5px] px-3 py-2 ${newEnvNameError ? "border-[#f05252] bg-[#f05252]/5" : "border-dash-border"}`}>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleCreateSubmit();
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        ref={createInputRef}
                        type="text"
                        value={newEnvName}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNewEnvName(v);
                          if (newEnvNameError) {
                            const t = v.trim();
                            if (t.length >= 3 && /^[a-zA-Z][a-zA-Z _-]*$/.test(t)) {
                              setNewEnvNameError(false);
                            }
                          }
                        }}
                        placeholder="Environment name"
                        className={`w-full bg-transparent text-sm text-dash-text-body placeholder:text-dash-text-extra-faded outline-none ${newEnvNameError ? "text-[#f05252]" : ""}`}
                        onKeyDown={(e) => {
                          if (e.key === "Escape" && !creatingSubmitting) {
                            setCreating(false);
                            setNewEnvName("");
                            setNewEnvNameError(false);
                          }
                        }}
                        disabled={creatingSubmitting}
                      />
                      {creatingSubmitting ? <Spinner size="size-3.5" className="shrink-0 text-dash-text-faded" /> : null}
                    </div>
                  </form>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex h-9 w-full items-center gap-2 border-t-[0.5px] border-dash-border bg-dash-bg-elevated px-3 text-left text-sm text-dash-text-faded transition-colors hover:text-dash-text-body"
                >
                  <Plus className="size-3.5" />
                  Create environment
                </button>
              )
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      <WarningModal
        open={deleteTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setDeleteTarget(null);
            setMigrateTarget(null);
          }
        }}
        title={`Delete ${deleteTarget?.name ?? ""} environment?`}
        description="Projects attached to this environment will be moved to the environment you select below. This action cannot be undone."
        confirmLabel="Delete environment"
        confirmLoadingLabel="Deleting..."
        onConfirm={handleDeleteConfirm}
      >
        <div className="flex flex-col gap-1.5 text-left">
          <label className="text-xs font-medium text-dash-text-faded">Move projects to</label>
          <Dropdown
            value={migrateTarget ?? ""}
            options={environments.filter((e) => e._id !== deleteTarget?._id).map((e) => ({ id: e._id, label: e.name }))}
            onChange={(id) => setMigrateTarget(id)}
          />
        </div>
      </WarningModal>
    </div>
  );
}

/* ─── Notifications ─── */

function levelIcon(level: NotificationLevel): { src: string; className?: string; style?: React.CSSProperties } {
  if (level === "error")
    return {
      src: "/icons/error.svg",
      style: {
        filter: "brightness(0) saturate(100%) invert(33%) sepia(98%) saturate(2700%) hue-rotate(347deg) brightness(95%) contrast(95%)",
      },
    };
  if (level === "warning")
    return {
      src: "/icons/icons8-warning-shield.svg",
      style: { filter: "hue-rotate(-28deg) saturate(1.4)" },
    };
  if (level === "success")
    return {
      src: "/icons/success.svg",
      style: {
        filter: "brightness(0) saturate(100%) invert(57%) sepia(94%) saturate(420%) hue-rotate(101deg) brightness(95%) contrast(89%)",
      },
    };
  return { src: "/icons/info.svg", className: "invert dark:invert-0" };
}

function NotificationsDropdown({ haptics }: { haptics?: ReturnType<typeof useHaptics> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const workspaceSearch = getWorkspaceSearch(searchStr);
  const workspace = workspaceSearch?.workspace;

  const { data, isLoading, refetch } = useNotifications({ workspace, limit: 8 });
  const items = data?.items ?? [];
  const unreadCount = data?.unseenCount ?? 0;
  const markSeen = useMarkNotificationSeen(workspace);
  const markAllSeen = useMarkAllNotificationsSeen(workspace);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);

  function handleMarkAllRead() {
    if (unreadCount === 0) return;
    markAllSeen.mutate();
  }

  function handleNotificationClick(notification: NotificationItem) {
    if (!notification.seen) {
      markSeen.mutate(notification.id);
    }
    setOpen(false);

    if (!notification.route) {
      return;
    }

    if (/^https?:\/\//i.test(notification.route)) {
      window.open(notification.route, "_blank", "noopener,noreferrer");
      return;
    }

    navigate({
      to: notification.route as any,
      search: workspaceSearch as any,
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          haptics?.selection();
          setOpen(!open);
        }}
        className="flex items-center gap-1.5 text-sm text-dash-text-faded hover:text-dash-text-strong transition-colors"
      >
        <span className="relative">
          <Bell className="size-4 fill-current" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-[#ef2f1f] text-[8px] font-medium text-white">
              {unreadCount}
            </span>
          )}
        </span>
        <span className="hidden md:inline">Notifications</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-[340px] max-w-[calc(100vw-32px)] origin-top-right overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg shadow-[0px_2px_8px_rgba(0,0,0,0.08)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-[0.5px] border-dash-border px-4 py-3">
              <span className="text-sm font-medium text-dash-text-strong">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markAllSeen.isPending}
                  className="text-xs text-[#4879f8] transition-colors hover:text-[#3a6ae6] disabled:opacity-50"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* List */}
            <div className="scrollbar-subtle max-h-[320px] overflow-y-auto">
              {isLoading && items.length === 0 ? (
                <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-dash-text-faded">
                  <LoaderCircle className="size-4 animate-spin" />
                  <span>Loading notifications...</span>
                </div>
              ) : items.length === 0 ? (
                <div className="px-4 py-6 text-sm text-dash-text-faded">No notifications</div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-dash-bg-elevated ${
                      n.seen ? "" : "bg-[#4879f8]/[0.04] dark:bg-[#4879f8]/[0.06]"
                    }`}
                  >
                    {(() => {
                      const icon = levelIcon(n.level);
                      return (
                        <img
                          src={icon.src}
                          alt=""
                          style={icon.style}
                          className={`mt-0.5 size-4 shrink-0 ${icon.className ?? ""} ${n.seen ? "opacity-60" : ""}`}
                        />
                      );
                    })()}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={`text-sm leading-[1.4] ${
                          n.seen ? "font-light text-dash-text-faded" : "font-medium text-dash-text-strong"
                        }`}
                      >
                        {n.message}
                      </span>
                      <span className="text-xs text-dash-text-extra-faded">{formatRelativeTime(n.createdAt)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const defaultCreateMenuItems = [
  { label: "Create project", icon: Plus },
  { label: "Register domain", icon: Globe },
  { label: "New workspace", icon: Users },
];

const domainsCreateMenuItems = [
  { label: "Buy domain", icon: ShoppingBag },
  { label: "Transfer in", icon: ArrowRightLeft },
];

function CreateDropdown() {
  const { canWrite } = useWorkspaceRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const haptics = useHaptics();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });

  const isDomainsPage = /^\/domains(\/|$)/.test(pathname);
  const isDomainsListPage = pathname === "/domains" || pathname === "/domains/";
  const menuItems = isDomainsPage ? domainsCreateMenuItems : defaultCreateMenuItems;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  function handlePrimaryClick() {
    haptics.light();
    if (isDomainsListPage) {
      window.dispatchEvent(new CustomEvent("brimble:add-domain"));
    } else if (isDomainsPage) {
      setPendingDomainsAction("add-domain");
      navigate({
        to: withWorkspaceQuery({
          pathname: "/domains",
          searchStr,
        }) as any,
      });
    } else {
      navigate({
        to: withWorkspaceQuery({
          pathname: "/projects/new",
          searchStr,
        }) as any,
      });
    }
  }

  function handleMenuItemClick(label: string) {
    haptics.light();
    setOpen(false);
    if (label === "Buy domain") {
      navigate({
        to: withWorkspaceQuery({
          pathname: "/domains/buy",
          searchStr,
        }) as any,
      });
    } else if (label === "Transfer in") {
      if (isDomainsListPage) {
        window.dispatchEvent(new CustomEvent("brimble:transfer-in"));
      } else {
        setPendingDomainsAction("transfer-in");
        navigate({
          to: withWorkspaceQuery({
            pathname: "/domains",
            searchStr,
          }) as any,
        });
      }
    } else if (label === "Create project") {
      navigate({
        to: withWorkspaceQuery({
          pathname: "/projects/new",
          searchStr,
        }) as any,
      });
    } else if (label === "Register domain") {
      navigate({
        to: withWorkspaceQuery({
          pathname: "/domains/buy",
          searchStr,
        }) as any,
      });
    } else if (label === "New workspace") {
      navigate({ to: "/workspace/new" });
    }
  }

  if (!canWrite) return null;

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={handlePrimaryClick}
          className="flex items-center gap-1 whitespace-nowrap rounded-l border border-[#3964d5] bg-[#4879f8] py-[5px] pl-3 pr-2 text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)]"
        >
          <img src="/icons/plus-white.svg" alt="" className="size-4" />
          <span className="hidden sm:inline">{isDomainsPage ? "Add Domain" : "Create"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            haptics.selection();
            setOpen(!open);
          }}
          className="flex items-center rounded-r border border-l-0 border-[#3964d5] bg-[#4879f8] px-1.5 shadow-[0px_1px_2px_rgba(18,18,23,0.05)]"
        >
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
            <ChevronDown className="size-4 text-white" />
          </motion.span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-[200px] origin-top-right overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)]"
          >
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => handleMenuItemClick(item.label)}
                  className="mx-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-[2px] px-2 py-1.5 text-sm font-light text-dash-text-body dark:text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Topbar({
  onSettingsClick,
  onMobileNavToggle,
  mobileNavOpen,
  settingsSnapshot,
  userProfile,
  workspaces,
  projectSwitcherProjects,
  workspaceTeamMembers,
}: {
  onSettingsClick: () => void;
  onMobileNavToggle?: () => void;
  mobileNavOpen?: boolean;
  settingsSnapshot?: SettingsSidebarSnapshot | null;
  userProfile?: SettingsSidebarSnapshot["profile"] | null;
  workspaces?: Workspace[];
  projectSwitcherProjects?: Project[];
  workspaceTeamMembers?: TeamDetails | null;
}) {
  const { theme, mode, cycleTheme } = useTheme();
  const haptics = useHaptics();
  const { open: openScoutBar } = useScoutBar();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const currentProject = useRouterState({
    select: (s) => {
      const projectMatch = s.matches.find((match) => match.routeId === "/projects/$projectId");
      const loaderData = projectMatch?.loaderData as { project?: Project | null } | undefined;
      return loaderData?.project ?? null;
    },
  });
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch ? projectMatch[1] : null;
  const isWorkspaceNew = /^\/workspace\/new/.test(pathname);
  return (
    <div data-topbar className="flex shrink-0 flex-col bg-dash-bg">
      {/* Top row: search + notifications */}
      <div className="border-b border-dash-border-soft">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-3 md:px-0">
          <div className="flex items-center gap-3">
            {onMobileNavToggle && (
              <button
                onClick={() => {
                  haptics.selection();
                  onMobileNavToggle!();
                }}
                className="text-dash-text-faded hover:text-dash-text-strong md:hidden"
                aria-label="Toggle navigation"
              >
                {mobileNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            )}
            <div
              onClick={openScoutBar}
              className="flex cursor-pointer items-center gap-2 text-dash-text-extra-faded transition-colors hover:text-dash-text-faded"
            >
              <Search className="size-4" />
              <span className="hidden text-sm md:inline">Search workspace or use cmd + k</span>
              <kbd className="ml-1 hidden rounded border border-dash-border-soft px-1.5 py-0.5 text-[10px] font-medium leading-none text-dash-text-extra-faded md:inline">
                ⌘K
              </kbd>
            </div>
          </div>
          <div className="flex items-center gap-2 text-dash-text-faded md:gap-4">
            <NotificationsDropdown haptics={haptics} />
            <a
              href="https://www.brimble.io/changelog"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm transition-colors hover:text-dash-text-strong"
            >
              <Newspaper className="size-4" />
              <span className="hidden md:inline">What's new ?</span>
            </a>
            <a href="mailto:hello@brimble.app" className="flex items-center gap-1.5 text-sm hover:text-dash-text-strong transition-colors">
              <HelpCircle className="size-4" />
              <span className="hidden md:inline">Help</span>
            </a>
            <button
              onClick={() => {
                haptics.selection();
                onSettingsClick();
              }}
              className="flex items-center gap-1.5 text-sm transition-colors hover:text-dash-text-strong"
            >
              <img
                src="/icons/settings.svg"
                alt=""
                className="size-4 shrink-0 dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80"
              />
            </button>
            <button
              onClick={() => {
                haptics.selection();
                cycleTheme();
              }}
              className="flex items-center gap-1.5 text-sm hover:text-dash-text-strong"
              title={mode === Theme.System ? "System theme" : theme === Theme.Dark ? "Dark theme" : "Light theme"}
            >
              {mode === Theme.System ? (
                <Desktop className="size-4" />
              ) : theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumb row */}
      <div className="border-b border-dash-border-soft">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-3 md:px-0">
          <div className="flex min-w-0 items-center">
            <WorkspaceSwitcher profile={userProfile ?? null} workspaces={workspaces ?? []} pathname={pathname} searchStr={searchStr} />
            <span className="mx-2 text-sm text-dash-text-faded">/</span>
            {isWorkspaceNew ? (
              <span className="text-sm font-medium text-dash-text-faded">New Workspace</span>
            ) : projectId ? (
              projectId === "new" ? (
                <span className="text-sm font-medium text-dash-text-faded">New Project</span>
              ) : (
                <ProjectSwitcher
                  projectId={projectId}
                  currentProjectName={currentProject?.name}
                  pathname={pathname}
                  searchStr={searchStr}
                  projects={projectSwitcherProjects ?? []}
                />
              )
            ) : (
              <span className="text-sm font-medium text-dash-text-faded">Home</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Environment selector */}
            <div className="hidden md:block">
              <EnvironmentDropdown
                workspace={new URLSearchParams(searchStr || "").get("workspace") ?? undefined}
                teamDetails={workspaceTeamMembers}
                userProfile={userProfile}
              />
            </div>
            {/* Create split button */}
            <CreateDropdown />
          </div>
        </div>
      </div>
    </div>
  );
}
