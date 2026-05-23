import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { MoreVertical, Trash2 } from "lucide-react";
import { StatusChip } from "@/components/shared/status-chip";
import { SimpleTooltip } from "@/components/shared/tooltip";
import { formatRelativeTime } from "@/utils/dashboard";
import { formatBytes } from "@/lib/format";
import { SnapshotStatus, type SnapshotResponse } from "@/backend/sandboxes";

interface SnapshotRowProps {
  snapshot: SnapshotResponse;
  sourceSandboxName?: string;
  onDeleteRequest: (snapshot: SnapshotResponse) => void;
}

export function SnapshotRow({ snapshot, sourceSandboxName, onDeleteRequest }: SnapshotRowProps) {
  const isReady = snapshot.status === SnapshotStatus.Ready;
  const isFailed = snapshot.status === SnapshotStatus.Failed;
  const canDelete = snapshot.status !== SnapshotStatus.Creating;

  const chipLabel = isFailed ? "FAILED" : isReady ? "READY" : "CREATING";
  const chipNode = <StatusChip status={chipLabel} className="origin-center scale-[0.92]" />;

  return (
    <div className="flex items-center gap-1.5 px-3 py-3 transition-colors hover:bg-dash-bg-elevated">
      <img src="/icons/disk.svg" alt="" className="size-5 shrink-0 opacity-60 invert dark:invert-0" />
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm tracking-[-0.02px]">
        <span className="min-w-0 truncate font-medium text-dash-text-strong">{snapshot.name}</span>
        <SourceLabel
          sandboxId={snapshot.sandboxId}
          sandboxName={sourceSandboxName}
          sourceTemplate={snapshot.sourceTemplate}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-sm font-light text-dash-text-faded">
        {snapshot.sizeBytes !== null ? formatBytes(snapshot.sizeBytes) : "—"}
      </span>
      <span className="hidden w-20 shrink-0 text-right text-xs font-light text-dash-text-faded md:inline">
        {snapshot.createdAt ? formatRelativeTime(snapshot.createdAt) : "—"}
      </span>
      <div className="flex w-24 shrink-0 justify-end">
        {isFailed && snapshot.failureReason ? (
          <SimpleTooltip content={snapshot.failureReason}>{chipNode}</SimpleTooltip>
        ) : (
          chipNode
        )}
      </div>
      <SnapshotActionsMenu snapshot={snapshot} canDelete={canDelete} onDeleteRequest={onDeleteRequest} />
    </div>
  );
}

function SourceLabel({
  sandboxId,
  sandboxName,
  sourceTemplate,
}: {
  sandboxId: string;
  sandboxName?: string;
  sourceTemplate: string;
}) {
  return (
    <span className="min-w-0 shrink truncate font-light text-dash-text-faded">
      ·{" "}
      <Link
        to="/sandboxes/$sandboxId"
        params={{ sandboxId }}
        className="underline-offset-2 transition-colors hover:text-dash-text-strong hover:underline"
      >
        {sandboxName ? `from ${sandboxName}` : `from ${sourceTemplate}`}
      </Link>
    </span>
  );
}

function SnapshotActionsMenu({
  snapshot,
  canDelete,
  onDeleteRequest,
}: {
  snapshot: SnapshotResponse;
  canDelete: boolean;
  onDeleteRequest: (snapshot: SnapshotResponse) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Snapshot actions"
        className="flex size-6 items-center justify-center rounded-[2px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              style={{ position: "fixed", top: position.top, right: position.right }}
              className="z-50 w-[180px] overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_4px_12px_rgba(0,0,0,0.08)]"
            >
              <button
                type="button"
                disabled={!canDelete}
                title={!canDelete ? "Wait for the snapshot to finish before deleting." : undefined}
                onClick={() => {
                  setOpen(false);
                  onDeleteRequest(snapshot);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-500 transition-colors hover:bg-dash-bg-elevated disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Trash2 className="size-3.5" />
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
