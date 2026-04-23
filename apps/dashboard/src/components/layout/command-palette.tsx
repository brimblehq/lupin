import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getRouteApi, useNavigate, useRouterState } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "motion/react";
import { Command } from "cmdk";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Moon, Sun, ArrowsClockwise, TreeStructure, Check, SignOut, Compass } from "@phosphor-icons/react";
import { startProductTour } from "../shared/product-tour";
import { PaletteView, Theme } from "../../types/enums";
import { useScoutBar } from "../../contexts/scoutbar-context";
import { useTheme } from "../../hooks/use-theme";
import { useHaptics } from "@/hooks/use-haptics";
import { getWorkspaceFromSearch, withWorkspaceQuery } from "@/utils/topbar-navigation";
import { listDomainsPageServerFn } from "@/server/domains/actions";
import { listProjectEnvironmentsServerFn } from "@/server/environments/actions";
import type { DomainRecord } from "@/backend/domains";
import type { ProjectEnvironment } from "@/backend/environments";
import type { Project } from "@/backend/projects";
import type { Workspace } from "@/backend/workspaces";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import type { SettingsSidebarSnapshot } from "@/backend/settings";
import { logoutServerFn } from "@/server/auth/actions";
import { invalidateSessionCache } from "@/lib/auth-guards";
import { posthog } from "@/lib/posthog";

const rootRoute = getRouteApi("__root__");

type CommandDomain = {
  name: string;
  project?: string;
};

function mapDomainItems(items: DomainRecord[]): CommandDomain[] {
  return items.map((domain) => ({
    name: domain.name,
    project: domain.projectName,
  }));
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { isOpen, setIsOpen } = useScoutBar();
  const { theme, mode, setTheme, toggleTheme } = useTheme();
  const { canWrite } = useWorkspaceRole();
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const currentPathname = useRouterState({ select: (s) => s.location.pathname });
  const { onboardingProjects, workspaces, settingsSnapshot } = (rootRoute.useLoaderData() ?? {}) as {
    onboardingProjects: { items: Project[] } | null;
    workspaces: { items: Workspace[] };
    settingsSnapshot: SettingsSidebarSnapshot | null;
  };
  const haptics = useHaptics();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<PaletteView>(PaletteView.Root);
  const [pastViews, setPastViews] = useState<PaletteView[]>([]);
  const [futureViews, setFutureViews] = useState<PaletteView[]>([]);
  const [domains, setDomains] = useState<CommandDomain[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [domainsLoadedForKey, setDomainsLoadedForKey] = useState<string | null>(null);
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([]);
  const [environmentsLoading, setEnvironmentsLoading] = useState(false);
  const [environmentsLoadedForKey, setEnvironmentsLoadedForKey] = useState<string | null>(null);
  const workspace = getWorkspaceFromSearch({ searchStr });
  const listDomains = useServerFn(listDomainsPageServerFn as any) as (args: {
    data: { workspace?: string; page?: number; q?: string };
  }) => Promise<{ items: DomainRecord[] }>;
  const listDomainsRef = useRef(listDomains);
  const listEnvironments = useServerFn(listProjectEnvironmentsServerFn as any) as (args: {
    data: { workspace?: string };
  }) => Promise<ProjectEnvironment[]>;
  const listEnvironmentsRef = useRef(listEnvironments);

  useEffect(() => {
    listDomainsRef.current = listDomains;
  }, [listDomains]);

  useEffect(() => {
    listEnvironmentsRef.current = listEnvironments;
  }, [listEnvironments]);

  const projects = useMemo(
    () =>
      (onboardingProjects?.items ?? []).map((project) => ({
        name: project.name,
        slug: project.slug || project.name,
      })),
    [onboardingProjects?.items],
  );

  const personalName =
    settingsSnapshot?.profile?.username || settingsSnapshot?.profile?.firstName || settingsSnapshot?.profile?.email || "Personal Account";

  const teams = useMemo(
    () => [
      {
        name: `${personalName}'s Workspace`,
        type: "personal" as const,
        slug: undefined as string | undefined,
      },
      ...(workspaces?.items ?? []).map((team) => ({
        name: `${team.name}'s Workspace`,
        type: "team" as const,
        slug: team.slug,
      })),
    ],
    [personalName, workspaces?.items],
  );

  const go = (pathname: string) => navigate({ to: withWorkspaceQuery({ pathname, searchStr }) as any });

  // ⌘K / Ctrl+K to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);

  const prevIsOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) haptics.soft();
    prevIsOpen.current = isOpen;
  }, [isOpen, haptics]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setView(PaletteView.Root);
      setPastViews([]);
      setFutureViews([]);
      return;
    }

    if (view !== PaletteView.DomainSearch) {
      return;
    }

    const trimmed = query.trim();
    const fetchKey = `${workspace ?? "__personal__"}:${trimmed.toLowerCase()}`;
    if (domainsLoadedForKey === fetchKey) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setDomainsLoading(true);
      try {
        const result = await listDomainsRef.current({
          data: {
            ...(workspace ? { workspace } : {}),
            page: 1,
            ...(trimmed ? { q: trimmed } : {}),
          },
        });

        if (cancelled) {
          return;
        }

        setDomains(mapDomainItems(result.items ?? []));
        setDomainsLoadedForKey(fetchKey);
      } catch {
        if (!cancelled) {
          setDomains([]);
          setDomainsLoadedForKey(fetchKey);
        }
      } finally {
        if (!cancelled) {
          setDomainsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [domainsLoadedForKey, isOpen, query, view, workspace]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const fetchKey = workspace ?? "__personal__";
    if (environmentsLoadedForKey === fetchKey) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setEnvironmentsLoading(true);
      try {
        const result = await listEnvironmentsRef.current({
          data: { workspace },
        });

        if (!cancelled && Array.isArray(result)) {
          setEnvironments(result);
          setEnvironmentsLoadedForKey(fetchKey);
        }
      } catch {
        if (!cancelled) {
          setEnvironments([]);
          setEnvironmentsLoadedForKey(fetchKey);
        }
      } finally {
        if (!cancelled) {
          setEnvironmentsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [environmentsLoadedForKey, isOpen, workspace]);

  const runAction = useCallback(
    (fn: () => void) => {
      haptics.selection();
      setIsOpen(false);
      fn();
    },
    [haptics, setIsOpen],
  );

  const openNewProject = () => {
    runAction(() => go("/projects/new"));
  };

  const openNewDomain = () => {
    runAction(() => go("/domains"));
  };

  const openBuyDomain = () => {
    runAction(() => go("/domains/buy"));
  };

  const openNewDatabase = () => {
    runAction(() => go("/projects/new"));
  };

  const openNewTeam = () => {
    runAction(() => navigate({ to: "/workspace/new" }));
  };

  const openProjectSearch = () => {
    haptics.selection();
    setPastViews((prev) => [...prev, view]);
    setFutureViews([]);
    setView(PaletteView.ProjectSearch);
    setQuery("");
  };

  const openDomainSearch = () => {
    haptics.selection();
    setPastViews((prev) => [...prev, view]);
    setFutureViews([]);
    setView(PaletteView.DomainSearch);
    setQuery("");
  };

  const openWorkspaceSearch = () => {
    haptics.selection();
    setPastViews((prev) => [...prev, view]);
    setFutureViews([]);
    setView(PaletteView.WorkspaceSearch);
    setQuery("");
  };

  const openEnvironmentSearch = () => {
    haptics.selection();
    setPastViews((prev) => [...prev, view]);
    setFutureViews([]);
    setView(PaletteView.EnvironmentSearch);
    setQuery("");
  };

  const goBackView = () => {
    if (pastViews.length === 0) return;
    const previous = pastViews[pastViews.length - 1];
    setPastViews(pastViews.slice(0, -1));
    setFutureViews([view, ...futureViews]);
    setView(previous);
    setQuery("");
  };

  const goForwardView = () => {
    if (futureViews.length === 0) return;
    const [next, ...rest] = futureViews;
    setFutureViews(rest);
    setPastViews([...pastViews, view]);
    setView(next);
    setQuery("");
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleArrowNavigation = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowLeft") {
        if (pastViews.length === 0) return;
        event.preventDefault();
        goBackView();
      }
      if (event.key === "ArrowRight") {
        if (futureViews.length === 0) return;
        event.preventDefault();
        goForwardView();
      }
    };

    document.addEventListener("keydown", handleArrowNavigation);
    return () => document.removeEventListener("keydown", handleArrowNavigation);
  }, [isOpen, pastViews, futureViews, view]);

  const shortcutBufferRef = useRef<{
    value: string;
    timeoutId: number | null;
  }>({ value: "", timeoutId: null });

  useEffect(() => {
    if (!isOpen || view !== PaletteView.Root) {
      if (shortcutBufferRef.current.timeoutId !== null) {
        window.clearTimeout(shortcutBufferRef.current.timeoutId);
      }
      shortcutBufferRef.current = { value: "", timeoutId: null };
      return;
    }

    const shortcutActions: Record<string, () => void> = {
      ...(canWrite
        ? {
            n: openNewProject,
            d: openNewDomain,
            b: openBuyDomain,
            db: openNewDatabase,
          }
        : {}),
      t: openNewTeam,
    };
    const shortcutPrefixes = new Set(["d"]);

    const resetShortcutBuffer = () => {
      if (shortcutBufferRef.current.timeoutId !== null) {
        window.clearTimeout(shortcutBufferRef.current.timeoutId);
      }
      shortcutBufferRef.current = { value: "", timeoutId: null };
    };

    const commitShortcut = (key: string) => {
      resetShortcutBuffer();
      shortcutActions[key]?.();
    };

    const handleBadgeShortcuts = (event: KeyboardEvent) => {
      if (!isOpen || view !== PaletteView.Root) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;

      const key = event.key.toLowerCase();
      if (!["n", "d", "b", "t"].includes(key)) {
        resetShortcutBuffer();
        return;
      }

      // If the user has started typing a query, keep text input behavior intact.
      if (query.trim().length > 0) {
        resetShortcutBuffer();
        return;
      }

      event.preventDefault();

      const buffered = shortcutBufferRef.current.value;
      let next = `${buffered}${key}`;

      if (!(next in shortcutActions) && !shortcutPrefixes.has(next)) {
        next = key;
      }

      if (!(next in shortcutActions) && !shortcutPrefixes.has(next)) {
        resetShortcutBuffer();
        return;
      }

      const hasExactAction = next in shortcutActions;
      const isPrefix = shortcutPrefixes.has(next);

      if (hasExactAction && !isPrefix) {
        commitShortcut(next);
        return;
      }

      shortcutBufferRef.current.value = next;
      if (shortcutBufferRef.current.timeoutId !== null) {
        window.clearTimeout(shortcutBufferRef.current.timeoutId);
      }

      if (hasExactAction && isPrefix) {
        shortcutBufferRef.current.timeoutId = window.setTimeout(() => {
          if (shortcutBufferRef.current.value === next) {
            commitShortcut(next);
          }
        }, 280);
      }
    };

    document.addEventListener("keydown", handleBadgeShortcuts);
    return () => {
      document.removeEventListener("keydown", handleBadgeShortcuts);
      resetShortcutBuffer();
    };
  }, [isOpen, openBuyDomain, openNewDatabase, openNewDomain, openNewProject, openNewTeam, query, view]);

  const inputPlaceholder = (() => {
    if (view === PaletteView.ProjectSearch) return "Search projects...";
    if (view === PaletteView.DomainSearch) return "Search domains...";
    if (view === PaletteView.WorkspaceSearch) return "Search workspaces...";
    if (view === PaletteView.EnvironmentSearch) return "Search environments...";
    return "Search or jump to";
  })();

  const emptyStateLabel = (() => {
    if (view === PaletteView.ProjectSearch) return "No projects found.";
    if (view === PaletteView.DomainSearch) return "No domains found.";
    if (view === PaletteView.WorkspaceSearch) return "No workspaces found.";
    if (view === PaletteView.EnvironmentSearch) return "No environments found.";
    return "No results found.";
  })();

  const subviewHeading = (() => {
    if (view === PaletteView.ProjectSearch) return "PROJECTS";
    if (view === PaletteView.DomainSearch) return "DOMAINS";
    if (view === PaletteView.EnvironmentSearch) return "ENVIRONMENTS";
    return "WORKSPACES";
  })();

  const setLightTheme = () => {
    runAction(() => setTheme(Theme.Light));
  };

  const setDarkTheme = () => {
    runAction(() => setTheme(Theme.Dark));
  };

  const setSystemTheme = () => {
    runAction(() => setTheme(Theme.System));
  };

  const toggleAppTheme = () => {
    runAction(() => toggleTheme());
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="cmdk-overlay"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild aria-label="Command palette">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="cmdk-dialog"
              >
                <Command loop>
                  <Command.Input placeholder={inputPlaceholder} value={query} onValueChange={setQuery} />
                  <Command.List>
                    <Command.Empty>{emptyStateLabel}</Command.Empty>

                    <AnimatePresence mode="wait" initial={false}>
                      {view === PaletteView.Root ? (
                        <motion.div
                          key="cmdk-root"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={{ duration: 0.16 }}
                        >
                          <Command.Group heading="PROJECTS">
                            <Command.Item value="search projects find project" onSelect={openProjectSearch}>
                              <img src="/icons/scoutbar/search-alt.svg" width="16" height="16" alt="" />
                              <span>Search projects</span>
                            </Command.Item>
                            {canWrite && (
                              <Command.Item value="new project create" onSelect={openNewProject}>
                                <img src="/icons/scoutbar/add.svg" width="16" height="16" alt="" />
                                <span>New project</span>
                                <span className="cmdk-shortcut cmdk-shortcut-blue">N</span>
                              </Command.Item>
                            )}
                          </Command.Group>

                          <Command.Group heading="DOMAINS">
                            <Command.Item value="search domains find domain" onSelect={openDomainSearch}>
                              <img src="/icons/scoutbar/search-alt.svg" width="16" height="16" alt="" />
                              <span>Search domains</span>
                            </Command.Item>
                            {canWrite && (
                              <>
                                <Command.Item value="new domain add" onSelect={openNewDomain}>
                                  <img src="/icons/scoutbar/add.svg" width="16" height="16" alt="" />
                                  <span>New domain</span>
                                  <span className="cmdk-shortcut cmdk-shortcut-red">D</span>
                                </Command.Item>
                                <Command.Item value="buy domain register" onSelect={openBuyDomain}>
                                  <img src="/icons/scoutbar/earth.svg" width="16" height="16" alt="" />
                                  <span>Buy domain</span>
                                  <span className="cmdk-shortcut cmdk-shortcut-red">B</span>
                                </Command.Item>
                              </>
                            )}
                          </Command.Group>

                          {canWrite && (
                            <Command.Group heading="DATABASES">
                              <Command.Item value="new database create" onSelect={openNewDatabase}>
                                <img src="/icons/scoutbar/add.svg" width="16" height="16" alt="" />
                                <span>New database</span>
                                <span className="cmdk-shortcut cmdk-shortcut-green">D</span>
                                <span className="cmdk-shortcut cmdk-shortcut-green">B</span>
                              </Command.Item>
                            </Command.Group>
                          )}

                          <Command.Group heading="TEAM">
                            <Command.Item value="switch environment staging production development" onSelect={openEnvironmentSearch}>
                              <TreeStructure className="size-4" />
                              <span>Switch environment</span>
                            </Command.Item>
                            <Command.Item value="switch workspace team personal" onSelect={openWorkspaceSearch}>
                              <img src="/icons/scoutbar/People.svg" width="16" height="16" alt="" />
                              <span>Switch workspace</span>
                            </Command.Item>
                            <Command.Item value="new team create workspace" onSelect={openNewTeam}>
                              <img src="/icons/scoutbar/add.svg" width="16" height="16" alt="" />
                              <span>New workspace</span>
                              <span className="cmdk-shortcut cmdk-shortcut-orange">T</span>
                            </Command.Item>
                          </Command.Group>

                          <Command.Group heading="THEME">
                            <Command.Item value="theme toggle switch" onSelect={toggleAppTheme}>
                              <ArrowsClockwise className="size-4" />
                              <span>Toggle theme</span>
                              <span className="cmdk-shortcut">{mode === Theme.System ? "S" : theme === Theme.Dark ? "D" : "L"}</span>
                            </Command.Item>
                            <Command.Item value="theme light mode" onSelect={setLightTheme}>
                              <Sun className="size-4" />
                              <span>Light mode</span>
                              {mode === Theme.Light && <Check className="ml-auto size-4 text-[#34d399]" weight="bold" />}
                            </Command.Item>
                            <Command.Item value="theme dark mode" onSelect={setDarkTheme}>
                              <Moon className="size-4" />
                              <span>Dark mode</span>
                              {mode === Theme.Dark && <Check className="ml-auto size-4 text-[#34d399]" weight="bold" />}
                            </Command.Item>
                            <Command.Item value="theme system mode follow os" onSelect={setSystemTheme}>
                              <ArrowsClockwise className="size-4" />
                              <span>System mode</span>
                              {mode === Theme.System && <Check className="ml-auto size-4 text-[#34d399]" weight="bold" />}
                            </Command.Item>
                          </Command.Group>

                          <Command.Group heading="HELP &amp; ACCOUNT">
                            <Command.Item
                              value="start onboarding tour walkthrough intro guide"
                              onSelect={() => runAction(() => window.setTimeout(() => startProductTour(), 200))}
                            >
                              <Compass className="size-4" />
                              <span>Start onboarding tour</span>
                            </Command.Item>
                            <Command.Item
                              value="cli docs documentation"
                              onSelect={() => runAction(() => window.open("https://docs.brimble.io", "_blank"))}
                            >
                              <img src="/icons/scoutbar/desktop.svg" width="16" height="16" alt="" />
                              <span>CLI docs</span>
                            </Command.Item>
                            <Command.Item
                              value="contact support email help"
                              onSelect={() => runAction(() => (window.location.href = "mailto:hello@brimble.app"))}
                            >
                              <img src="/icons/scoutbar/mail.svg" width="16" height="16" alt="" />
                              <span>Contact support</span>
                            </Command.Item>
                            <Command.Item
                              value="logout sign out"
                              onSelect={() =>
                                runAction(() => {
                                  logoutServerFn()
                                    .catch(() => {})
                                    .then(() => {
                                      posthog.reset();
                                      invalidateSessionCache();
                                      window.location.href = "/login";
                                    });
                                })
                              }
                            >
                              <SignOut className="size-4" />
                              <span>Log out</span>
                            </Command.Item>
                          </Command.Group>
                        </motion.div>
                      ) : (
                        <motion.div
                          key={view}
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          transition={{ duration: 0.16 }}
                        >
                          <Command.Group heading={subviewHeading}>
                            <Command.Item value="back to commands" onSelect={goBackView}>
                              <ArrowLeft className="size-4" />
                              <span>Back to {pastViews.length > 0 ? "previous" : "commands"}</span>
                            </Command.Item>
                            {view === PaletteView.ProjectSearch &&
                              projects.map((p) => (
                                <Command.Item
                                  key={p.slug}
                                  value={`project ${p.name} ${p.slug}`}
                                  onSelect={() => runAction(() => go(`/projects/${p.slug}`))}
                                >
                                  <img src="/icons/scoutbar/search-alt.svg" width="16" height="16" alt="" />
                                  <span>{p.name}</span>
                                </Command.Item>
                              ))}
                            {view === PaletteView.DomainSearch &&
                              domains.map((d) => (
                                <Command.Item
                                  key={d.name}
                                  value={`domain ${d.name} ${d.project ?? ""}`}
                                  onSelect={() => runAction(() => go(`/domains/${encodeURIComponent(d.name)}`))}
                                >
                                  <img src="/icons/scoutbar/earth.svg" width="16" height="16" alt="" />
                                  <span>{d.name}</span>
                                </Command.Item>
                              ))}
                            {view === PaletteView.WorkspaceSearch &&
                              teams.map((t) => (
                                <Command.Item
                                  key={`${t.type}:${t.slug ?? "personal"}`}
                                  value={`workspace ${t.name} ${t.type}`}
                                  onSelect={() =>
                                    runAction(() =>
                                      navigate({
                                        to: "/projects",
                                        search: t.slug ? ({ workspace: t.slug } as any) : ({} as any),
                                      }),
                                    )
                                  }
                                >
                                  <img src="/icons/scoutbar/People.svg" width="16" height="16" alt="" />
                                  <span className="capitalize">{t.name}</span>
                                </Command.Item>
                              ))}
                            {view === PaletteView.EnvironmentSearch &&
                              environments.map((env) => {
                                const params = new URLSearchParams(searchStr || "");
                                const currentEnvId = params.get("environmentId");
                                const isActive = env.isDefault ? !currentEnvId : currentEnvId === env._id;
                                const parentEnv = env.inherit_from ? environments.find((e) => e._id === env.inherit_from) : null;

                                return (
                                  <Command.Item
                                    key={env._id}
                                    value={`environment ${env.name} ${env.slug} ${parentEnv ? `inherits ${parentEnv.name}` : ""}`}
                                    onSelect={() =>
                                      runAction(() => {
                                        const nextParams = new URLSearchParams(searchStr || "");
                                        if (env.isDefault) {
                                          nextParams.delete("environmentId");
                                        } else {
                                          nextParams.set("environmentId", env._id);
                                        }
                                        const search = Object.fromEntries(nextParams.entries());
                                        navigate({
                                          to: currentPathname as any,
                                          search: Object.keys(search).length > 0 ? (search as any) : undefined,
                                        });
                                      })
                                    }
                                  >
                                    <TreeStructure className="size-4" />
                                    <div className="flex flex-col">
                                      <span>
                                        {env.name}
                                        {env.isDefault ? " (default)" : ""}
                                      </span>
                                      {parentEnv ? (
                                        <span className="text-[11px] leading-tight text-dash-text-extra-faded">
                                          inherits from {parentEnv.name}
                                        </span>
                                      ) : null}
                                    </div>
                                    {isActive ? <div className="ml-auto size-1.5 shrink-0 rounded-full bg-[#34d399]" /> : null}
                                  </Command.Item>
                                );
                              })}
                            {view === PaletteView.DomainSearch && domainsLoading ? (
                              <Command.Item value="domains loading" disabled>
                                <img src="/icons/scoutbar/earth.svg" width="16" height="16" alt="" />
                                <span>Loading domains...</span>
                              </Command.Item>
                            ) : null}
                            {view === PaletteView.EnvironmentSearch && environmentsLoading ? (
                              <Command.Item value="environments loading" disabled>
                                <TreeStructure className="size-4" />
                                <span>Loading environments...</span>
                              </Command.Item>
                            ) : null}
                          </Command.Group>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Command.List>
                </Command>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
