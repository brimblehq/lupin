import { useState } from "react";
import { Plus } from "lucide-react";
import { useTags } from "@/contexts/tags-context";
import { TagManagementModal } from "./tag-management-modal";

interface TagFilterBarProps {
  activeTagId: string | null;
  onFilterChange: (tagId: string | null) => void;
  projects: Array<{ tags?: Array<{ id: string }> }>;
}

export function TagFilterBar({ activeTagId, onFilterChange, projects }: TagFilterBarProps) {
  const { tags, getProjectCountForTag } = useTags();
  const [managementOpen, setManagementOpen] = useState(false);

  return (
    <>
      <div className="mb-6 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* All pill */}
        <button
          onClick={() => onFilterChange(null)}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            activeTagId === null
              ? "border-dash-text-strong bg-dash-text-strong text-dash-bg"
              : "border-dash-border text-dash-text-faded hover:bg-dash-bg-elevated"
          }`}
        >
          All
        </button>

        {tags.map((tag) => {
          const count = getProjectCountForTag(tag.id, projects);
          const isActive = activeTagId === tag.id;

          return (
            <button
              key={tag.id}
              onClick={() => onFilterChange(isActive ? null : tag.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
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
          );
        })}

        {/* Add tag button */}
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
