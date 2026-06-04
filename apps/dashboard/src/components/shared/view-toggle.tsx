import { LayoutGrid, List } from "lucide-react";
import type { ViewMode } from "@/hooks/use-view-mode";

/**
 * Segmented card/list view toggle. Designed to sit inside a SearchFilterBar `rightSlot`.
 */
export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-0.5 px-2">
      <button
        type="button"
        onClick={() => onChange("card")}
        aria-label="Card view"
        aria-pressed={value === "card"}
        className={`flex size-7 items-center justify-center rounded-[4px] transition-colors ${
          value === "card" ? "bg-dash-bg-elevated text-dash-text-strong" : "text-dash-text-faded hover:text-dash-text-strong"
        }`}
      >
        <LayoutGrid className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-label="List view"
        aria-pressed={value === "list"}
        className={`flex size-7 items-center justify-center rounded-[4px] transition-colors ${
          value === "list" ? "bg-dash-bg-elevated text-dash-text-strong" : "text-dash-text-faded hover:text-dash-text-strong"
        }`}
      >
        <List className="size-4" />
      </button>
    </div>
  );
}
