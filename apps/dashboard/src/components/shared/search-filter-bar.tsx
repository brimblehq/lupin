import type { ReactNode } from "react";
import { LoaderCircle, Search } from "lucide-react";

interface SearchFilterBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  rightSlot?: ReactNode;
  className?: string;
}

export function SearchFilterBar({
  value,
  onChange,
  placeholder = "Search...",
  loading = false,
  rightSlot,
  className,
}: SearchFilterBarProps) {
  return (
    <div
      className={`flex items-center rounded-[4px] border-[0.5px] border-dash-border ${className ?? ""}`}
    >
      <div className="flex flex-1 items-center gap-2 px-4 py-3">
        {loading ? (
          <LoaderCircle className="size-5 shrink-0 animate-spin text-dash-text-extra-faded" />
        ) : (
          <Search className="size-5 shrink-0 text-dash-text-extra-faded" />
        )}
        <input
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-sm text-dash-text-strong outline-none placeholder:text-dash-text-faded placeholder:opacity-50"
        />
      </div>

      {rightSlot ? (
        <>
          <div className="h-full w-px self-stretch bg-dash-border" />
          <div className="shrink-0">{rightSlot}</div>
        </>
      ) : null}
    </div>
  );
}
