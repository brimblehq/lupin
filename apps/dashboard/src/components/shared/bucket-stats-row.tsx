import { AreaChart, Area, YAxis, ResponsiveContainer } from "recharts";
import type { StorageGraphPoint } from "@/backend/storage";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
}

export function BucketStatsRow({
  totalBuckets,
  totalFiles,
  totalStorageUsed,
  usageGraph,
}: {
  totalBuckets: number;
  totalFiles: number;
  totalStorageUsed: number;
  usageGraph: StorageGraphPoint[];
}) {
  const storageUsedText = `${formatBytes(totalStorageUsed)} used`;
  const yMax = Math.max(...usageGraph.map((point) => point.storageUsed), 1);

  return (
    <div className="flex flex-col gap-3 lg:h-[160px] lg:flex-row">
      {/* Storage Used */}
      <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-[4px] border-[0.5px] border-dash-border lg:w-[36%]">
        <div className="flex h-[30px] items-center border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-2">
          <span className="text-xs tracking-[-0.02px] text-dash-text-strong">Storage Used</span>
        </div>
        <p className="px-2 pt-2 pb-3 text-xs uppercase tracking-[-0.02px] text-[#ff9b01]">{storageUsedText}</p>
        <div className="mt-auto h-[65px] min-w-0">
          <ResponsiveContainer width="100%" height={65} minWidth={0} minHeight={1}>
            <AreaChart data={usageGraph} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <YAxis domain={[0, yMax]} hide />
              <Area
                type="linear"
                dataKey="storageUsed"
                stroke="#ff9b00"
                strokeWidth={1}
                fill="rgba(255,155,0,0.30)"
                baseValue={0}
                isAnimationActive
                animationDuration={1100}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Buckets */}
      <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-[4px] border-[0.5px] border-dash-border lg:w-[34%]">
        <div className="flex h-[30px] items-center justify-between border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-2">
          <span className="text-xs tracking-[-0.02px] text-dash-text-strong">Buckets</span>
        </div>
        <div className="flex flex-1 flex-col items-start justify-center gap-1 px-4 py-3.5 lg:gap-0">
          <span className="text-[40px] font-medium leading-none text-dash-text-strong">{totalBuckets}</span>
          <span className="text-dash-text-faded">{totalBuckets === 1 ? "Active bucket" : "Active buckets"}</span>
        </div>
      </div>

      {/* Files */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-[4px] border-[0.5px] border-dash-border">
        <div className="flex h-[30px] items-center border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-2.5">
          <span className="text-xs tracking-[-0.02px] text-dash-text-strong">Files</span>
        </div>
        <div className="flex flex-1 flex-col items-start justify-center gap-1 px-4 py-4 lg:py-0">
          <span className="text-[40px] font-medium leading-none text-dash-text-strong">{totalFiles}</span>
          <span className="text-dash-text-faded">{totalFiles === 1 ? "Total file stored" : "Total files stored"}</span>
        </div>
      </div>
    </div>
  );
}
