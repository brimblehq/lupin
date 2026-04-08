import { useMemo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartBar } from "@phosphor-icons/react";
import { formatYTick } from "@/utils/observability";

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
  );

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < breakpoint);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return isMobile;
}

export function TimeSeriesChart({
  data: rawData,
  yUnit = "",
  label = "",
}: {
  data: { time: string; value: number }[];
  yUnit?: string;
  label?: string;
}) {
  const chartData = useMemo(() => {
    return rawData
      .filter((d) => d.value != null && d.value > 0)
      .map((d) => ({
        date: d.time,
        value: d.value,
      }));
  }, [rawData]);

  const domain = useMemo((): [number, number] => {
    if (chartData.length === 0) {
      if (yUnit === "%") return [0, 100];
      return [0, 1000];
    }

    const values = chartData.map((d) => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const padding = (maxVal - minVal) * 0.1 || (yUnit === "%" ? 5 : 100);

    return [
      Math.max(0, minVal - padding),
      yUnit === "%" ? Math.min(maxVal + padding, 100) : maxVal + padding,
    ];
  }, [chartData, yUnit]);

  const mobile = useIsMobile();
  const maxTicks = mobile ? 5 : 12;

  const tickInterval = useMemo(() => {
    return Math.max(0, Math.floor((chartData.length || 0) / maxTicks) - 1);
  }, [chartData.length, maxTicks]);

  const formatTooltipValue = (value: number): string => {
    if (yUnit === "%") return `${value.toFixed(2)}%`;
    if (yUnit === "ms") {
      if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
      return `${value.toFixed(2)}ms`;
    }
    if (yUnit === "KB/s") {
      if (value >= 1024) return `${(value / 1024).toFixed(2)} MB/s`;
      return `${value.toFixed(2)} KB/s`;
    }
    return `${value.toFixed(2)}`;
  };

  if (chartData.length === 0) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-2 sm:h-[260px]">
        <ChartBar className="size-8 text-dash-text-extra-faded" weight="duotone" />
        <p className="text-sm text-dash-text-faded">No data for this time range</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={mobile ? 240 : 338} minWidth={0} minHeight={1}>
      <BarChart
        data={chartData}
        margin={mobile ? { top: 8, right: 4, left: 0, bottom: 0 } : { top: 10, right: 10, left: 10, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-dash-border-soft)"
          strokeOpacity={0.6}
          vertical={false}
          horizontal
        />
        <XAxis
          dataKey="date"
          stroke="var(--color-dash-text-extra-faded)"
          fontSize={mobile ? 10 : 11}
          tickLine={false}
          axisLine={false}
          dy={8}
          interval={tickInterval}
          tickFormatter={mobile ? (v: string) => {
            const parts = v.split(":");
            return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : v;
          } : undefined}
        />
        <YAxis
          stroke="var(--color-dash-text-extra-faded)"
          fontSize={mobile ? 10 : 11}
          tickLine={false}
          axisLine={false}
          dx={-4}
          domain={domain}
          tickFormatter={(v: number) => formatYTick(v, yUnit)}
          width={mobile ? 45 : undefined}
        />
        <Tooltip
          content={({ active, payload, label: tooltipLabel }) => {
            if (!active || !payload?.length) return null;
            const value = payload[0].value as number;
            return (
              <div className="rounded-md border border-[#141414] bg-gradient-to-b from-[#434343] to-[#232323] px-3 py-2 shadow-[0px_2px_4px_rgba(0,0,0,0.18),inset_0px_1px_0px_rgba(255,255,255,0.18)]">
                <p className="text-[10px] leading-4 text-white/60">
                  {tooltipLabel}
                </p>
                <p className="text-xs font-medium leading-4 text-white">
                  {formatTooltipValue(value)}{label ? ` ${label}` : ""}
                </p>
              </div>
            );
          }}
          cursor={{ fill: "var(--color-dash-border-soft)", opacity: 0.3 }}
        />
        <Bar
          dataKey="value"
          fill="#ff7a00"
          opacity={0.4}
          activeBar={{ opacity: 1 }}
          radius={[2, 2, 0, 0]}
          animationBegin={100}
          animationDuration={900}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
