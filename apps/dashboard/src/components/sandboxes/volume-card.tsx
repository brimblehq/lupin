import { StatusChip } from "@/components/shared/status-chip";
import type { Volume } from "@/lib/sandboxes/volumes-mock-data";

interface VolumeCardProps {
  volume: Volume;
}

export function VolumeCard({ volume }: VolumeCardProps) {
  return (
    <div className="flex items-center gap-2 border-b border-dashed border-dash-border-soft px-4 py-3 transition-colors last:border-b-0 hover:bg-dash-bg-elevated">
      <span className="flex size-5 shrink-0 items-center justify-center">
        <img src="/icons/storage.svg" alt="" className="size-[14px] opacity-60 invert dark:invert-0" />
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm tracking-[-0.02px]">
        <span className="min-w-0 truncate font-medium text-dash-text-strong">{volume.name}</span>
        {volume.attachedTo ? (
          <span className="min-w-0 shrink truncate font-light text-dash-text-faded">· attached to {volume.attachedTo}</span>
        ) : null}
      </div>
      <span className="w-20 shrink-0 text-right text-sm font-light text-dash-text-faded">{volume.sizeGb} GB</span>
      <div className="flex w-24 shrink-0 justify-end">
        <StatusChip status={volume.status} className="origin-center scale-[0.92]" />
      </div>
    </div>
  );
}
