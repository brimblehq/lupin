import { Plus } from "lucide-react";

interface CreateBucketCardProps {
  className?: string;
  onClick: () => void;
}

export function CreateBucketCard({ className, onClick }: CreateBucketCardProps) {
  return (
    <div
      className={`create-new-project-card flex h-[136px] items-center justify-center overflow-clip rounded-[8px] border-[0.8px] border-dash-border ${className ?? ""}`}
    >
      <button
        onClick={onClick}
        className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-bg px-4 py-2 text-sm font-medium text-dash-text-body shadow-sm transition-colors hover:bg-dash-bg-elevated"
      >
        <Plus className="size-4" />
        Create new bucket
      </button>
    </div>
  );
}
