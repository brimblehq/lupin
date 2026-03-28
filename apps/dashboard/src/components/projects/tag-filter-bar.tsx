import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { Reorder } from "motion/react";
import { useTags } from "@/contexts/tags-context";
import { useHaptics } from "@/hooks/use-haptics";
import { TagManagementModal } from "./tag-management-modal";
import type { Tag } from "@/types/tags";

const TAG_ORDER_STORAGE_KEY = "brimble:tag-order";

function readStoredOrder(workspace: string | undefined): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${TAG_ORDER_STORAGE_KEY}:${workspace ?? "__personal__"}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStoredOrder(workspace: string | undefined, ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${TAG_ORDER_STORAGE_KEY}:${workspace ?? "__personal__"}`, JSON.stringify(ids));
  } catch {}
}

function sortTagsByOrder(tags: Tag[], order: string[]): Tag[] {
  if (order.length === 0) return tags;
  const indexMap = new Map(order.map((id, i) => [id, i]));
  return [...tags].sort((a, b) => {
    const ai = indexMap.get(a.id) ?? Infinity;
    const bi = indexMap.get(b.id) ?? Infinity;
    return ai - bi;
  });
}

interface TagFilterBarProps {
  activeTagId: string | null;
  onFilterChange: (tagId: string | null) => void;
  projects: Array<{ tags?: Array<{ id: string }> }>;
  workspace?: string;
}

export function TagFilterBar({ activeTagId, onFilterChange, projects, workspace }: TagFilterBarProps) {
  const { tags, getProjectCountForTag } = useTags();
  const [managementOpen, setManagementOpen] = useState(false);
  const haptics = useHaptics();
  const [orderedTags, setOrderedTags] = useState<Tag[]>([]);

  useEffect(() => {
    const stored = readStoredOrder(workspace);
    setOrderedTags(sortTagsByOrder(tags, stored));
  }, [tags, workspace]);

  const handleReorder = useCallback(
    (newOrder: Tag[]) => {
      setOrderedTags(newOrder);
      writeStoredOrder(workspace, newOrder.map((t) => t.id));
      haptics.selection();
    },
    [workspace, haptics],
  );

  return (
    <>
      <div className="mb-6 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => { haptics.selection(); onFilterChange(null); }}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            activeTagId === null
              ? "border-dash-text-strong bg-dash-text-strong text-dash-bg"
              : "border-dash-border text-dash-text-faded hover:bg-dash-bg-elevated"
          }`}
        >
          All
        </button>

        <Reorder.Group
          axis="x"
          values={orderedTags}
          onReorder={handleReorder}
          className="flex list-none items-center gap-2"
          as="ul"
        >
          {orderedTags.map((tag) => {
            const count = getProjectCountForTag(tag.id, projects);
            const isActive = activeTagId === tag.id;

            return (
              <Reorder.Item
                key={tag.id}
                value={tag}
                whileDrag={{ scale: 1.05, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="shrink-0 list-none"
              >
                <button
                  onClick={() => { haptics.selection(); onFilterChange(isActive ? null : tag.id); }}
                  className={`flex shrink-0 cursor-grab items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors active:cursor-grabbing ${
                    isActive
                      ? ""
                      : "border-dash-border text-dash-text-faded hover:bg-dash-bg-elevated"
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: tag.color,
                          borderColor: tag.color,
                          color: "#fff",
                        }
                      : undefined
                  }
                >
                  {!isActive && (
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                  )}
                  {tag.name}
                  <span className={isActive ? "opacity-75" : "opacity-50"}>({count})</span>
                </button>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>

        <button
          onClick={() => setManagementOpen(true)}
          className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-dash-border px-3 py-1 text-xs text-dash-text-faded transition-colors hover:border-dash-text-faded hover:text-dash-text-strong"
        >
          <Plus className="size-3" />
          {tags.length === 0 && "Add tag"}
        </button>
      </div>

      <TagManagementModal open={managementOpen} onOpenChange={setManagementOpen} />
    </>
  );
}
