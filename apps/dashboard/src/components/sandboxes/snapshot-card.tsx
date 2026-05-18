import { StatusChip } from "@/components/shared/status-chip";
import type { Snapshot } from "@/lib/sandboxes/snapshots-mock-data";

interface SnapshotCardProps {
  snapshot: Snapshot;
}

export function SnapshotCard({ snapshot }: SnapshotCardProps) {
  return (
    <div className="flex items-center gap-2 border-b border-dashed border-dash-border-soft px-4 py-3 transition-colors last:border-b-0 hover:bg-dash-bg-elevated">
      <span className="flex size-5 shrink-0 items-center justify-center">
        <img src="/icons/clock.svg" alt="" className="size-[14px] opacity-60 invert dark:invert-0" />
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm tracking-[-0.02px]">
        <span className="min-w-0 truncate font-medium text-dash-text-strong">{snapshot.sandbox}</span>
        <span className="min-w-0 shrink truncate font-light text-dash-text-faded">· {snapshot.cadence}</span>
      </div>
      <span className="w-20 shrink-0 text-right text-sm font-light text-dash-text-faded">{snapshot.sizeGb} GB</span>
      <span className="w-20 shrink-0 text-right text-sm font-light text-dash-text-faded">{snapshot.createdAt}</span>
      <div className="flex w-24 shrink-0 justify-end">
        <StatusChip status={snapshot.status} className="origin-center scale-[0.92]" />
      </div>
    </div>
  );
}
