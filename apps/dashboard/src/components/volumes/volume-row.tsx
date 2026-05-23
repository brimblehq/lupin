import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Link2Off, MoreVertical, Trash2 } from "lucide-react";
import { StatusChip } from "@/components/shared/status-chip";
import { formatRelativeTime } from "@/utils/dashboard";
import { VolumeType, type VolumeResponse } from "@/backend/volumes";

const TYPE_BADGE: Record<VolumeType, { label: string; className: string }> = {
  [VolumeType.Web]: { label: "Web", className: "bg-[#4879f8]/15 text-[#4879f8] dark:bg-[#4879f8]/20" },
  [VolumeType.Database]: { label: "Database", className: "bg-[#a855f7]/15 text-[#a855f7] dark:bg-[#a855f7]/20" },
  [VolumeType.Sandbox]: { label: "Sandbox", className: "bg-[#13d282]/15 text-[#13d282] dark:bg-[#13d282]/20" },
};

interface VolumeRowProps {
  volume: VolumeResponse;
  onDeleteRequest: (volume: VolumeResponse) => void;
}

export function VolumeRow({ volume, onDeleteRequest }: VolumeRowProps) {
  const isAttached = Boolean(volume.attachedSandboxId || volume.attachedProjectId);
  const regionName = volume.region?.name ?? "—";

  return (
    <div className="flex items-center gap-1.5 px-3 py-3 transition-colors hover:bg-dash-bg-elevated">
      <img src="/icons/storage.svg" alt="" className="size-5 shrink-0 opacity-60 invert dark:invert-0" />
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm tracking-[-0.02px]">
        <span className="min-w-0 truncate font-medium text-dash-text-strong">{volume.name}</span>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] ${TYPE_BADGE[volume.type].className}`}
        >
          {TYPE_BADGE[volume.type].label}
        </span>
        <AttachedToLabel volume={volume} />
      </div>
      <span className="hidden w-24 shrink-0 truncate text-right text-xs font-light text-dash-text-faded sm:inline">{regionName}</span>
      <span className="w-16 shrink-0 text-right text-sm font-light text-dash-text-faded">{volume.sizeGB} GB</span>
      <span className="hidden w-20 shrink-0 text-right text-xs font-light text-dash-text-faded md:inline">
        {volume.createdAt ? formatRelativeTime(volume.createdAt) : "—"}
      </span>
      <div className="flex w-24 shrink-0 justify-end">
        <StatusChip status={isAttached ? "ATTACHED" : "DETACHED"} className="origin-center scale-[0.92]" />
      </div>
      <VolumeActionsMenu volume={volume} isAttached={isAttached} onDeleteRequest={onDeleteRequest} />
    </div>
  );
}

function AttachedToLabel({ volume }: { volume: VolumeResponse }) {
  if (volume.attachedSandboxId) {
    return (
      <span className="min-w-0 shrink truncate font-light text-dash-text-faded">
        ·{" "}
        <Link
          to="/sandboxes/$sandboxId"
          params={{ sandboxId: volume.attachedSandboxId }}
          className="underline-offset-2 transition-colors hover:text-dash-text-strong hover:underline"
        >
          attached to sandbox
        </Link>
      </span>
    );
  }

  if (volume.attachedProjectId) {
    return (
      <span className="min-w-0 shrink truncate font-light text-dash-text-faded">
        ·{" "}
        <Link
          to="/projects/$projectId"
          params={{ projectId: volume.attachedProjectId }}
          className="underline-offset-2 transition-colors hover:text-dash-text-strong hover:underline"
        >
          attached to project
        </Link>
      </span>
    );
  }

  return null;
}

function VolumeActionsMenu({
  volume,
  isAttached,
  onDeleteRequest,
}: {
  volume: VolumeResponse;
  isAttached: boolean;
  onDeleteRequest: (volume: VolumeResponse) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Volume actions"
        className="flex size-6 items-center justify-center rounded-[2px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
      >
        <MoreVertical className="size-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1 w-[200px] overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_4px_12px_rgba(0,0,0,0.08)]">
          <button
            type="button"
            disabled
            title="Detach by destroying the attached sandbox."
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-dash-text-body transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Link2Off className="size-3.5" />
            Detach
          </button>
          <hr className="my-1 border-dash-border-soft" />
          <button
            type="button"
            disabled={isAttached}
            title={isAttached ? "Detach by destroying the attached sandbox first." : undefined}
            onClick={() => {
              setOpen(false);
              onDeleteRequest(volume);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-500 transition-colors hover:bg-dash-bg-elevated disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
