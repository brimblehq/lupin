import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Search, Plus, Check } from "lucide-react";
import { Spinner } from "../shared/spinner";
import { useTags } from "@/contexts/tags-context";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { normalizeTagName } from "@/types/tags";

const ease = [0.16, 1, 0.3, 1] as const;
const TAG_DEBUG_STORAGE_KEY = "brimble:debug:tags";

function isTagDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TAG_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function tagDebug(message: string, payload?: Record<string, unknown>) {
  if (!isTagDebugEnabled()) return;
  if (payload) {
    return;
  }
}

interface TagAssignmentPopoverProps {
  projectId: string;
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedTagIds?: string[];
  onAssignedTagIdsChange?: (tagIds: string[]) => void;
}

export function TagAssignmentPopover({
  projectId,
  anchorRef,
  open,
  onOpenChange,
  assignedTagIds = [],
  onAssignedTagIdsChange,
}: TagAssignmentPopoverProps) {
  const { canWrite } = useWorkspaceRole();
  const { tags, toggleTagAssignment, createTag } = useTags();
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());
  const [localAssigned, setLocalAssigned] = useState<Set<string>>(new Set(assignedTagIds));
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    setLocalAssigned(new Set(assignedTagIds));
  }, [assignedTagIds]);

  const publishAssigned = useCallback(
    (next: Set<string>) => {
      onAssignedTagIdsChange?.(Array.from(next));
    },
    [onAssignedTagIdsChange],
  );

  const updatePos = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.right - 220 });
  }, [anchorRef]);

  useLayoutEffect(() => {
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
    if (!open) {
      setQuery("");
      return;
    }
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (anchorRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return;
      onOpenChange(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, anchorRef, onOpenChange]);

  const trimmed = query.trim().toLowerCase();
  const filtered = tags.filter((t) => (trimmed ? t.name.includes(trimmed) : true));
  const exactMatch = tags.some((t) => t.name === trimmed);

  async function handleToggle(tagId: string) {
    if (!canWrite || pendingToggles.has(tagId)) return;

    const wasAssigned = localAssigned.has(tagId);
    tagDebug("toggle:start", {
      projectId,
      tagId,
      wasAssigned,
      assignedTagIds: Array.from(localAssigned),
    });
    const optimistic = new Set(localAssigned);
    if (wasAssigned) {
      optimistic.delete(tagId);
    } else {
      optimistic.add(tagId);
    }
    setLocalAssigned(optimistic);
    publishAssigned(optimistic);

    setPendingToggles((prev) => new Set(prev).add(tagId));
    try {
      const result = await toggleTagAssignment(projectId, tagId);
      tagDebug("toggle:server-result", {
        projectId,
        tagId,
        assigned: result.assigned,
      });
      setLocalAssigned((prev) => {
        const next = new Set(prev);
        if (result.assigned) {
          next.add(tagId);
        } else {
          next.delete(tagId);
        }
        publishAssigned(next);
        return next;
      });
    } catch (err) {
      tagDebug("toggle:error", {
        projectId,
        tagId,
        error: err instanceof Error ? err.message : String(err),
      });
      const rollback = new Set(localAssigned);
      setLocalAssigned(rollback);
      publishAssigned(rollback);
    } finally {
      setPendingToggles((prev) => {
        const next = new Set(prev);
        next.delete(tagId);
        return next;
      });
    }
  }

  async function handleCreate() {
    if (!canWrite || !trimmed || exactMatch || creatingTag) return;
    setCreatingTag(true);
    const beforeCreate = new Set(localAssigned);
    tagDebug("create:start", {
      projectId,
      query: trimmed,
    });
    try {
      const tag = await createTag(trimmed);
      tagDebug("create:created", {
        projectId,
        tagId: tag.id,
        tagName: tag.name,
      });
      setLocalAssigned((prev) => {
        const next = new Set(prev).add(tag.id);
        publishAssigned(next);
        return next;
      });
      await toggleTagAssignment(projectId, tag.id);
      tagDebug("create:assigned", {
        projectId,
        tagId: tag.id,
      });
      setQuery("");
    } catch (err) {
      tagDebug("create:error", {
        projectId,
        error: err instanceof Error ? err.message : String(err),
      });
      setLocalAssigned(beforeCreate);
      publishAssigned(beforeCreate);
    } finally {
      setCreatingTag(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          data-dropdown-menu
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.2, ease }}
          style={{
            position: "fixed",
            top: pos.top,
            left: Math.max(8, pos.left),
            width: 220,
            zIndex: 9999,
          }}
          className="max-h-[260px] overflow-y-auto overflow-x-hidden overscroll-contain rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-dash-border-soft px-3 py-2">
            <Search className="size-3.5 shrink-0 text-dash-text-faded" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") onOpenChange(false);
                if (e.key === "Enter") void handleCreate();
              }}
              placeholder={canWrite ? "Search or create..." : "Search tags..."}
              className="w-full bg-transparent text-sm text-dash-text-strong outline-none placeholder:text-[#9ca3af]"
            />
          </div>

          {/* Tag list */}
          {filtered.map((tag) => {
            const isAssigned = localAssigned.has(tag.id);
            const isPending = pendingToggles.has(tag.id);
            return (
              <button
                key={tag.id}
                disabled={!canWrite || isPending}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleToggle(tag.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-dash-bg-elevated disabled:opacity-70"
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="flex-1 truncate text-dash-text-faded">{tag.name}</span>
                {isPending ? (
                  <Spinner size="size-3.5" className="shrink-0 text-dash-text-extra-faded" />
                ) : (
                  isAssigned && <Check className="size-3.5 shrink-0 text-dash-text-strong" />
                )}
              </button>
            );
          })}

          {/* Create row — hidden for Viewers */}
          {canWrite && trimmed && !exactMatch && (
            <button
              disabled={creatingTag}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleCreate();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-dash-text-faded transition-colors hover:bg-dash-bg-elevated disabled:opacity-70"
            >
              {creatingTag ? <Spinner size="size-3.5" className="shrink-0" /> : <Plus className="size-3.5 shrink-0" />}
              <span>Create &ldquo;{normalizeTagName(trimmed)}&rdquo;</span>
            </button>
          )}

          {filtered.length === 0 && !trimmed && <div className="px-3 py-2 text-sm text-dash-text-faded">No tags yet</div>}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
