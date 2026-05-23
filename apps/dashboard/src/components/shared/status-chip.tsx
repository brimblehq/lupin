import { cn } from "@brimble/ui";
import { ChipVariant } from "../../types/enums";

interface StatusChipProps {
  status: string;
  className?: string;
}

const chipVariants: Record<ChipVariant, { bg: string; border: string }> = {
  [ChipVariant.Green]: {
    bg: "linear-gradient(180deg, #34e89e 0%, #13d282 30%, #0fba72 100%)",
    border: "border-[#0fba72]",
  },
  [ChipVariant.Red]: {
    bg: "linear-gradient(180deg, #f07070 0%, #ef4444 30%, #d63031 100%)",
    border: "border-[#d63031]",
  },
  [ChipVariant.Orange]: {
    bg: "linear-gradient(180deg, #ffa040 0%, #ff7a00 30%, #e06800 100%)",
    border: "border-[#e06800]",
  },
  [ChipVariant.Gray]: {
    bg: "linear-gradient(180deg, #a0a2a7 0%, #7a7c81 30%, #65676c 100%)",
    border: "border-[#65676c]",
  },
};

enum ChipStatus {
  Ready = "READY",
  Active = "ACTIVE",
  Attached = "ATTACHED",
  Succeeded = "SUCCEEDED",
  Failed = "FAILED",
  Destroyed = "DESTROYED",
  Paused = "PAUSED",
  Pausing = "PAUSING",
  Resuming = "RESUMING",
  Starting = "STARTING",
  Building = "BUILDING",
  InProgress = "INPROGRESS",
  Pending = "PENDING",
  Queued = "QUEUED",
  Creating = "CREATING",
  Running = "RUNNING",
}

function getVariant(status: string): ChipVariant {
  switch (status.toUpperCase() as ChipStatus) {
    case ChipStatus.Ready:
    case ChipStatus.Active:
    case ChipStatus.Attached:
    case ChipStatus.Succeeded:
      return ChipVariant.Green;
    case ChipStatus.Failed:
    case ChipStatus.Destroyed:
      return ChipVariant.Red;
    case ChipStatus.Paused:
    case ChipStatus.Pausing:
    case ChipStatus.Resuming:
    case ChipStatus.Starting:
    case ChipStatus.Building:
    case ChipStatus.InProgress:
    case ChipStatus.Pending:
    case ChipStatus.Queued:
    case ChipStatus.Creating:
    case ChipStatus.Running:
      return ChipVariant.Orange;
    default:
      return ChipVariant.Gray;
  }
}

export function StatusChip({ status, className }: StatusChipProps) {
  const normalized = (status || "UNKNOWN").toUpperCase();
  const v = chipVariants[getVariant(normalized)];

  return (
    <div
      style={{ background: v.bg }}
      className={cn(
        "flex h-5 items-center gap-2 rounded-[4px] border px-2 shadow-[0px_1px_2px_rgba(16,24,40,0.1),inset_0px_1px_0px_rgba(255,255,255,0.25)]",
        v.border,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-white" />
      <span className="text-[8px] font-medium tracking-[-0.01px] text-white">{normalized}</span>
    </div>
  );
}
