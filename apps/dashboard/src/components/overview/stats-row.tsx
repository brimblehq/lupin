import { AreaChart, Area, YAxis, ResponsiveContainer } from "recharts";
import { DashButton } from "../shared/dash-button";

const bandwidthData = [
  { value: 30 },
  { value: 35 },
  { value: 28 },
  { value: 32 },
  { value: 40 },
  { value: 35 },
  { value: 38 },
  { value: 30 },
  { value: 42 },
  { value: 36 },
  { value: 33 },
  { value: 38 },
  { value: 35 },
  { value: 40 },
  { value: 32 },
  { value: 36 },
  { value: 34 },
  { value: 38 },
  { value: 33 },
  { value: 35 },
];

const deploymentRows = [
  { label: "Recent deployment", value: "45 Seconds" },
  { label: "Fastest deployment", value: "15 Seconds" },
  { label: "Slowest deployment", value: "235 Seconds" },
];

export function StatsRow() {
  return (
    <div className="mb-8 flex flex-col overflow-hidden rounded border-[0.5px] border-dash-border md:h-[160px] md:flex-row">
      {/* Bandwidth */}
      <div className="flex w-full shrink-0 flex-col border-b-[0.5px] border-dash-border md:w-[36%] md:border-b-0 md:border-r-[0.5px]">
        <div className="flex h-[30px] items-center border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-2">
          <span className="text-xs tracking-[-0.02px] text-dash-text-strong">
            Bandwidth
          </span>
        </div>
        <p className="px-2 pt-2 text-xs uppercase tracking-[-0.02px] text-[#ff9b01]">
          23GB used / 25GB
        </p>
        <div className="mt-auto h-[65px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={bandwidthData}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
              <YAxis domain={[0, 'dataMax']} hide />
              <Area
                type="linear"
                dataKey="value"
                stroke="#ff9b00"
                strokeWidth={1}
                fill="rgba(255,155,0,0.30)"
                baseValue={0}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Deployment minutes */}
      <div className="flex w-full shrink-0 flex-col md:w-[34%]">
        <div className="flex h-[30px] items-center border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-2">
          <span className="text-xs tracking-[-0.02px] text-dash-text-strong">
            Deployment minutes
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-between px-2 pt-3.5 pb-3.5">
          {deploymentRows.map((row, i) => (
            <div key={row.label}>
              <div className="flex items-center justify-between text-sm leading-[1.3] text-dash-text-faded">
                <span>{row.label}</span>
                <span className="text-right">{row.value}</span>
              </div>
              {i < deploymentRows.length - 1 && (
                <hr className="mt-1.5 border-dash-border" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Total deployments */}
      <div className="flex flex-1 flex-col border-l-[0.5px] border-dash-border">
        <div className="flex h-[30px] items-center border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-2.5">
          <span className="text-xs tracking-[-0.02px] text-dash-text-strong">
            Total deployments
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2.5">
            <p className="text-xl tracking-[-0.03px] text-dash-text-strong">
              4<span className="text-dash-text-extra-faded">/10</span>
            </p>
            <span className="flex h-5 items-center rounded bg-[#00c7eb] px-2 text-[8px] tracking-[-0.01px] text-white">
              REGULAR PASS
            </span>
          </div>
          <DashButton>
            Get Brimble Pro
            <img src="/icons/medal.svg" alt="" className="size-4" />
          </DashButton>
        </div>
      </div>
    </div>
  );
}
