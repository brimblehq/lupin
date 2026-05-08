import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Spinner } from "@/components/shared/spinner";

export interface SharedVarOption {
  name: string;
  sourceEnvironment?: string;
}

export interface ProjectOption {
  id: string;
  slug: string;
  name: string;
}

export interface ProjectVarOption {
  name: string;
}

export type AutocompleteSelection = { kind: "shared"; name: string } | { kind: "project"; slug: string; name: string };

type Row = {
  kind: "shared-var" | "project" | "project-var";
  label: string;
  hint?: string;
  group: "shared" | "projects" | "project-vars";
  action: () => void;
};

interface Props {
  anchor: HTMLElement | null;
  open: boolean;
  query: string;
  sharedVars: SharedVarOption[];
  sharedDisabled?: boolean;
  siblingProjects: ProjectOption[];
  getProjectVars: (project: ProjectOption) => Promise<ProjectVarOption[]>;
  onSelect: (choice: AutocompleteSelection) => void;
  onClose: () => void;
  registerKeyHandler?: (handler: (event: KeyboardEvent) => boolean | void) => void;
}

const ease = [0.16, 1, 0.3, 1] as const;

export function EnvReferenceAutocomplete({
  anchor,
  open,
  query,
  sharedVars,
  sharedDisabled,
  siblingProjects,
  getProjectVars,
  onSelect,
  onClose,
  registerKeyHandler,
}: Props) {
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [projectVars, setProjectVars] = useState<ProjectVarOption[]>([]);
  const [loadingProjectVars, setLoadingProjectVars] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const [expanded, setExpanded] = useState(false);
  const projectVarsCache = useRef(new Map<string, ProjectVarOption[]>());

  const updatePos = useCallback(() => {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, [anchor]);

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    updatePos();
    window.addEventListener("scroll", updatePos, { capture: true, passive: true });
    window.addEventListener("resize", updatePos, { passive: true });
    return () => {
      window.removeEventListener("scroll", updatePos, { capture: true });
      window.removeEventListener("resize", updatePos);
    };
  }, [open, anchor, updatePos]);

  useEffect(() => {
    if (!open) {
      setSelectedProject(null);
      setProjectVars([]);
      setLoadingProjectVars(false);
      setExpanded(false);
    }
  }, [open]);

  useEffect(() => {
    setExpanded(false);
  }, [query, selectedProject]);

  useEffect(() => {
    if (!selectedProject) return;
    const key = selectedProject.id || selectedProject.slug;
    const cached = projectVarsCache.current.get(key);
    if (cached) {
      setProjectVars(cached);
      return;
    }
    let cancelled = false;
    setLoadingProjectVars(true);
    setProjectVars([]);
    void getProjectVars(selectedProject)
      .then((vars) => {
        if (cancelled) return;
        projectVarsCache.current.set(key, vars);
        setProjectVars(vars);
      })
      .catch(() => {
        if (!cancelled) setProjectVars([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProjectVars(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProject, getProjectVars]);

  const rows = useMemo<Row[]>(() => {
    const lower = query.toLowerCase();
    if (selectedProject) {
      return projectVars
        .filter((v) => v.name.toLowerCase().includes(lower))
        .map((v) => ({
          kind: "project-var",
          label: v.name,
          group: "project-vars",
          action: () => onSelect({ kind: "project", slug: selectedProject.slug, name: v.name }),
        }));
    }
    const out: Row[] = [];
    if (!sharedDisabled) {
      for (const v of sharedVars) {
        const composed = `shared.${v.name}`;
        if (composed.toLowerCase().includes(lower) || v.name.toLowerCase().includes(lower)) {
          out.push({
            kind: "shared-var",
            label: v.name,
            hint: v.sourceEnvironment ? `from ${v.sourceEnvironment}` : undefined,
            group: "shared",
            action: () => onSelect({ kind: "shared", name: v.name }),
          });
        }
      }
    }
    for (const p of siblingProjects) {
      const composed = `@${p.slug}`;
      if (composed.toLowerCase().includes(lower) || p.name.toLowerCase().includes(lower)) {
        out.push({
          kind: "project",
          label: p.slug,
          hint: p.name !== p.slug ? p.name : undefined,
          group: "projects",
          action: () => setSelectedProject(p),
        });
      }
    }
    return out;
  }, [query, selectedProject, projectVars, sharedVars, sharedDisabled, siblingProjects, onSelect]);

  useEffect(() => {
    setActiveIndex((prev) => (rows.length === 0 ? 0 : Math.min(prev, rows.length - 1)));
  }, [rows.length]);

  useEffect(() => {
    if (!registerKeyHandler) return;
    const handler = (event: KeyboardEvent): boolean | void => {
      if (!open) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => {
          const next = (prev + 1) % Math.max(rows.length, 1);
          if (!expanded && next >= COLLAPSED_LIMIT) setExpanded(true);
          return next;
        });
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => {
          const next = (prev - 1 + Math.max(rows.length, 1)) % Math.max(rows.length, 1);
          if (!expanded && next >= COLLAPSED_LIMIT) setExpanded(true);
          return next;
        });
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const active = rows[activeIndex];
        if (active) {
          event.preventDefault();
          active.action();
          return true;
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (selectedProject) {
          setSelectedProject(null);
          return true;
        }
        onClose();
        return true;
      }
      if (event.key === "Backspace" && selectedProject && query.length === 0) {
        event.preventDefault();
        setSelectedProject(null);
        return true;
      }
    };
    registerKeyHandler(handler);
    return () => registerKeyHandler(() => undefined);
  }, [registerKeyHandler, open, rows, activeIndex, selectedProject, query, expanded, onClose]);

  if (!anchor || typeof document === "undefined") return null;

  const menuWidth = pos.width > 0 ? pos.width : 240;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.2, ease }}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: menuWidth,
            zIndex: 9999,
            pointerEvents: "auto",
          }}
          className="max-h-[200px] overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)] [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.15)_transparent]"
          onWheelCapture={(event) => event.stopPropagation()}
          onTouchMoveCapture={(event) => event.stopPropagation()}
        >
          {selectedProject ? (
            <ProjectDrillDown
              project={selectedProject}
              loading={loadingProjectVars}
              rows={rows}
              hasAnyVars={projectVars.length > 0}
              activeIndex={activeIndex}
              onHover={setActiveIndex}
              onBack={() => setSelectedProject(null)}
              expanded={expanded}
              onExpand={() => setExpanded(true)}
            />
          ) : (
            <RootList
              rows={rows}
              activeIndex={activeIndex}
              onHover={setActiveIndex}
              emptyLabel={sharedDisabled && siblingProjects.length === 0 ? "No references available" : "No matches"}
              expanded={expanded}
              onExpand={() => setExpanded(true)}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function GroupHeader({ label }: { label: string }) {
  return <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-dash-text-extra-faded">{label}</div>;
}

const COLLAPSED_LIMIT = 9;

function RootList({
  rows,
  activeIndex,
  onHover,
  emptyLabel,
  expanded,
  onExpand,
}: {
  rows: Row[];
  activeIndex: number;
  onHover: (index: number) => void;
  emptyLabel: string;
  expanded: boolean;
  onExpand: () => void;
}) {
  if (rows.length === 0) {
    return <div className="px-3 py-2 text-sm text-dash-text-faded">{emptyLabel}</div>;
  }
  const visibleRows = expanded ? rows : rows.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = rows.length - visibleRows.length;
  let lastGroup: string | null = null;
  return (
    <>
      {visibleRows.map((row, index) => {
        const showHeader = row.group === "shared" && row.group !== lastGroup;
        lastGroup = row.group;
        return (
          <div key={`${row.kind}:${row.label}:${index}`}>
            {showHeader && <GroupHeader label="Shared" />}
            <RowButton row={row} isActive={index === activeIndex} onHover={() => onHover(index)} />
          </div>
        );
      })}
      {hiddenCount > 0 && <ViewMoreRow count={hiddenCount} onClick={onExpand} />}
    </>
  );
}

function ViewMoreRow({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="flex w-full items-center justify-center gap-1 border-t-[0.5px] border-dash-border px-3 py-1.5 text-xs text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
    >
      View {count} more
    </button>
  );
}

function ProjectDrillDown({
  project,
  loading,
  rows,
  hasAnyVars,
  activeIndex,
  onHover,
  onBack,
  expanded,
  onExpand,
}: {
  project: ProjectOption;
  loading: boolean;
  rows: Row[];
  hasAnyVars: boolean;
  activeIndex: number;
  onHover: (index: number) => void;
  onBack: () => void;
  expanded: boolean;
  onExpand: () => void;
}) {
  const visibleRows = expanded ? rows : rows.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = rows.length - visibleRows.length;
  return (
    <>
      <div className="flex items-center gap-2 border-b-[0.5px] border-dash-border px-3 py-1.5">
        <button type="button" onClick={onBack} className="text-[11px] text-dash-text-faded transition-colors hover:text-dash-text-strong">
          ← Back
        </button>
        <span className="font-mono text-xs font-medium text-dash-syntax">@{project.slug}</span>
      </div>
      {loading ? (
        <div className="flex items-center justify-center px-3 py-5 text-dash-text-faded">
          <Spinner className="size-3.5" />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-3 py-2 text-sm text-dash-text-faded">{hasAnyVars ? "No matches" : "No variables in this project"}</div>
      ) : (
        <>
          {visibleRows.map((row, index) => (
            <RowButton key={`${row.label}:${index}`} row={row} isActive={index === activeIndex} onHover={() => onHover(index)} />
          ))}
          {hiddenCount > 0 && <ViewMoreRow count={hiddenCount} onClick={onExpand} />}
        </>
      )}
    </>
  );
}

function RowButton({ row, isActive, onHover }: { row: Row; isActive: boolean; onHover: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prefix = row.kind === "shared-var" ? "shared." : row.kind === "project" ? "@" : "";
  const prefixColor = prefix ? "text-dash-syntax" : "text-dash-text-faded";

  useEffect(() => {
    if (isActive) {
      buttonRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isActive]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onMouseEnter={onHover}
      onMouseDown={(e) => {
        e.preventDefault();
        row.action();
      }}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
        isActive ? "bg-dash-bg-elevated" : "hover:bg-dash-bg-elevated"
      }`}
    >
      <span className="flex min-w-0 items-center truncate font-mono text-dash-text-strong">
        {prefix && <span className={prefixColor}>{prefix}</span>}
        {row.label}
      </span>
      {row.hint && <span className="ml-auto shrink-0 text-[11px] text-dash-text-faded">{row.hint}</span>}
    </button>
  );
}
