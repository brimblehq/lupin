import { ChevronDown } from "lucide-react";
import { FolderOpen } from "@phosphor-icons/react";

export function RootDirectoryTrigger({
  value,
  onClick,
  disabled = false,
  fullWidth = true,
}: {
  value: string;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const isDefault = value === "./" || value === ".";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[46px] items-center justify-between input-base input-focus px-3 py-2.5 text-left ${
        fullWidth ? "w-full" : ""
      } ${disabled ? "cursor-not-allowed opacity-60" : "transition-colors"}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <FolderOpen
          size={18}
          weight="duotone"
          className="shrink-0 text-dash-text-faded"
        />
        <span
          className={`truncate text-sm leading-6 ${
            isDefault
              ? "text-dash-text-faded"
              : "font-family-mono text-dash-text-strong"
          }`}
        >
          {value || "./"}
        </span>
      </span>
      <ChevronDown className="size-3.5 shrink-0 text-dash-text-faded" />
    </button>
  );
}
