import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Bell,
  HelpCircle,
  ChevronDown,
  Plus,
  Globe,
  Users,
} from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/use-theme";
import { DashButton } from "../shared/dash-button";

const allProjects = [
  "Kemdirimdesign",
  "Audioly",
  "Cool-Projects",
];

function ProjectSwitcher({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm font-medium text-dash-text-faded hover:text-dash-text-strong transition-colors"
      >
        {projectId}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <ChevronDown className="size-4" />
        </motion.span>
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
            {/* Project list */}
            <div className="flex flex-col gap-2 border-b-[0.5px] border-dash-border px-3.5 py-2">
              {allProjects.map((name) => (
                <Link
                  key={name}
                  to={`/projects/${name.toLowerCase()}`}
                  onClick={() => setOpen(false)}
                  className="flex h-8 items-center pl-px pr-2 text-sm text-dash-text-strong hover:text-dash-text-body transition-colors"
                >
                  {name}
                </Link>
              ))}
            </div>
            {/* Create project */}
            <Link
              to="/projects/new"
              onClick={() => setOpen(false)}
              className="flex h-10 items-center gap-2 bg-dash-bg-elevated px-3.5 text-sm text-dash-text-faded hover:text-dash-text-body transition-colors"
            >
              <Plus className="size-4" />
              Create project
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-dash-text-strong"
      >
        <img
          src="/icons/workspace.svg"
          alt=""
          className="size-6 rounded-full"
        />
        Brimble Workspace
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
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
                className="w-full bg-transparent text-sm text-dash-text-strong outline-none placeholder:text-dash-text-extra-faded"
              />
            </div>

            {/* Personal Accounts */}
            <div className="border-b-[0.5px] border-dash-border px-2 pb-4 pt-2">
              <div className="py-2">
                <span className="text-xs text-dash-text-extra-faded dark:text-dash-text-faded">Personal Accounts</span>
              </div>
              <button className="flex w-full items-center gap-2 rounded px-px py-1 transition-colors hover:bg-dash-bg-elevated">
                <div
                  className="size-6 shrink-0 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 62% 30%, #b8fce8, #91f2d5 25%, #6ae8c3 50%, #43deb0 75%, #1bd49d)",
                  }}
                />
                <span className="text-sm text-dash-text-body dark:text-dash-text-strong">Kemdirimakujuobi</span>
              </button>
            </div>

            {/* Teams */}
            <div className="border-b-[0.5px] border-dash-border px-2 pb-4 pt-2">
              <div className="py-2">
                <span className="text-xs text-dash-text-extra-faded dark:text-dash-text-faded">Teams</span>
              </div>
              <button className="flex w-full items-center gap-2 rounded px-px py-1 transition-colors hover:bg-dash-bg-elevated">
                <div
                  className="size-6 shrink-0 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 62% 30%, #b8cffc, #94b6f8 25%, #6f9cf3 50%, #4b82ee 75%, #2769e9)",
                  }}
                />
                <span className="text-sm text-dash-text-body dark:text-dash-text-strong">Brimble Team</span>
              </button>
            </div>
            {/* Create workspace */}
            <button
              onClick={() => {
                setOpen(false);
                navigate({ to: "/workspace/new" });
              }}
              className="flex h-10 w-full items-center gap-2 bg-dash-bg-elevated px-3.5 text-sm text-dash-text-faded transition-colors hover:text-dash-text-body"
            >
              <Plus className="size-4" />
              Create workspace
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const environments = ["Production", "Preview", "Development", "Staging"];

function EnvironmentDropdown() {
  const [selected, setSelected] = useState("Production");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={ref}>
      <DashButton onClick={() => setOpen(!open)}>
        {selected}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
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
            className="absolute right-0 top-full z-50 mt-2 w-[180px] origin-top-right overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)]"
          >
            {environments.map((env) => (
              <button
                key={env}
                onClick={() => {
                  setSelected(env);
                  setOpen(false);
                }}
                className={`mx-1 flex w-[calc(100%-8px)] items-center rounded-[2px] px-2 py-1.5 text-sm transition-colors hover:bg-dash-bg-elevated ${
                  env === selected
                    ? "font-medium text-dash-text-strong"
                    : "font-light text-dash-text-faded"
                }`}
              >
                {env}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const createMenuItems = [
  { label: "Create project", icon: Plus },
  { label: "Register domain", icon: Globe },
  { label: "Create team", icon: Users },
];

function CreateDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-stretch">
        <button className="flex items-center gap-1 rounded-l border border-[#3964d5] bg-[#4879f8] py-[5px] pl-3 pr-2 text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)]">
          <img src="/icons/plus-white.svg" alt="" className="size-4" />
          Create
        </button>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center rounded-r border border-l-0 border-[#3964d5] bg-[#4879f8] px-1.5 shadow-[0px_1px_2px_rgba(18,18,23,0.05)]"
        >
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
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
            {createMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    setOpen(false);
                    if (item.label === "Create project") navigate({ to: "/projects/new" });
                    if (item.label === "Create team") navigate({ to: "/workspace/new" });
                  }}
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

export function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch ? projectMatch[1] : null;
  const isWorkspaceNew = /^\/workspace\/new/.test(pathname);
  return (
    <div data-topbar className="flex shrink-0 flex-col bg-dash-bg">
      {/* Top row: search + notifications */}
      <div className="border-b border-dash-border-soft">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between py-3">
          <div className="flex items-center gap-2 text-dash-text-extra-faded">
            <Search className="size-4" />
            <input
              type="text"
              placeholder="Search workspace"
              className="bg-transparent text-sm outline-none placeholder:text-dash-text-extra-faded"
            />
          </div>
          <div className="flex items-center gap-4 text-dash-text-faded">
            <button className="flex items-center gap-1.5 text-sm hover:text-dash-text-strong">
              <Bell className="size-4 fill-current" />
              <span>Notifications</span>
            </button>
            <button className="flex items-center gap-1.5 text-sm hover:text-dash-text-strong">
              <HelpCircle className="size-4" />
              <span>Help</span>
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 text-sm hover:text-dash-text-strong"
            >
              {theme === "dark" ? (
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
        <div className="mx-auto flex max-w-screen-xl items-center justify-between py-3">
          <div className="flex items-center">
            <WorkspaceSwitcher />
            <span className="mx-2 text-sm text-dash-text-faded">/</span>
            {isWorkspaceNew ? (
              <span className="text-sm font-medium text-dash-text-faded">New Workspace</span>
            ) : projectId ? (
              projectId === "new" ? (
                <span className="text-sm font-medium text-dash-text-faded">New Project</span>
              ) : (
                <ProjectSwitcher projectId={projectId} />
              )
            ) : (
              <span className="text-sm font-medium text-dash-text-faded">Home</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Environment selector */}
            <EnvironmentDropdown />
            {/* Import button */}
            <DashButton>
              <img src="/icons/import.svg" alt="" className="size-4 dark:invert dark:opacity-70" />
              Import
            </DashButton>
            {/* Create split button */}
            <CreateDropdown />
          </div>
        </div>
      </div>
    </div>
  );
}
