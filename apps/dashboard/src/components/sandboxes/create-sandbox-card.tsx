import { Link, useRouterState } from "@tanstack/react-router";
import { Lock, Plus } from "lucide-react";
import { useHaptics } from "@/hooks/use-haptics";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";

interface CreateSandboxCardProps {
  className?: string;
  disabled?: boolean;
  disabledMessage?: string;
}

export function CreateSandboxCard({ className, disabled = false, disabledMessage }: CreateSandboxCardProps) {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const haptics = useHaptics();

  return (
    <div
      className={`flex h-full min-h-[120px] flex-col items-center justify-center gap-2 overflow-clip rounded-[4px] border-[0.5px] border-dash-border p-4 text-center ${className ?? ""}`}
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(140,143,150,0.2) 10px, rgba(140,143,150,0.2) 11px)",
      }}
    >
      {disabled ? (
        <>
          <span
            aria-disabled
            className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-bg px-4 py-2 text-sm font-medium text-dash-text-faded"
          >
            <Lock className="size-4" />
            Create new sandbox
          </span>
          {disabledMessage ? <p className="max-w-[420px] text-xs leading-[1.4] text-dash-text-body">{disabledMessage}</p> : null}
        </>
      ) : (
        <Link
          to={withWorkspaceQuery({ pathname: "/sandboxes/new", searchStr }) as any}
          onClick={() => haptics.light()}
          className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-bg px-4 py-2 text-sm font-medium text-dash-text-body shadow-sm transition-colors hover:bg-dash-bg-elevated"
        >
          <Plus className="size-4" />
          Create new sandbox
        </Link>
      )}
    </div>
  );
}
