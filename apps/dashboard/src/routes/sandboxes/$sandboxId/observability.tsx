import { useEffect, useMemo, useState } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { TabHeader } from "@/components/shared/tab-header";
import { TimeSeriesChart } from "@/components/observability/time-series-chart";
import { SemiGauge } from "@/components/observability/semi-gauge";
import { TimeIntervalDropdown } from "@/components/observability/time-interval-dropdown";
import { ObservabilityPending } from "@/components/shared/route-pending";
import { useHaptics } from "@/hooks/use-haptics";
import { formatTimeLabel, hoursAgoForInterval, toKbps } from "@/utils/observability";
import { MetricChart } from "@/types/enums";
import { getSandboxObservabilityMetricsServerFn } from "@/server/sandboxes/observability-actions";
import type { ResourceObservabilityMetrics } from "@/backend/observability";
import { SandboxStatus, type SandboxResponse } from "@/backend/sandboxes";

const ZERO_METRICS: ResourceObservabilityMetrics = {
  average: {
    memory: { totalInPercentage: 0, size: 0 },
    cpu: { totalInPercentage: 0, size: 0 },
    network: { value: 0, bytesPerSecond: 0 },
  },
  results: [],
};

export const Route = createFileRoute("/sandboxes/$sandboxId/observability")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  loader: async ({ params }) => {
    try {
      const metrics = await (
        getSandboxObservabilityMetricsServerFn as unknown as (input: {
          data: { sandboxId: string; hrsAgo?: number };
        }) => Promise<ResourceObservabilityMetrics>
      )({
        data: { sandboxId: params.sandboxId, hrsAgo: 1 },
      });
      return { metrics };
    } catch {
      // Sandbox may be destroyed — fall back to zeroed metrics instead of crashing the route.
      return { metrics: ZERO_METRICS };
    }
  },
  component: SandboxObservabilityPanel,
  pendingComponent: ObservabilityPending,
});

const parentRouteApi = getRouteApi("/sandboxes/$sandboxId");
const CHART_TABS: MetricChart[] = [MetricChart.MemoryUsage, MetricChart.CpuUsage, MetricChart.NetworkEgress];

function SandboxObservabilityPanel() {
  const { sandbox } = parentRouteApi.useLoaderData() as { sandbox: SandboxResponse };
  const { metrics: initialMetrics } = Route.useLoaderData();
  const fetchMetrics = useServerFn(getSandboxObservabilityMetricsServerFn as any) as (args: {
    data: { sandboxId: string; hrsAgo?: number };
  }) => Promise<ResourceObservabilityMetrics>;
  const haptics = useHaptics();

  const isDestroyed = sandbox.status === SandboxStatus.Destroyed;

  const [activeChart, setActiveChart] = useState<MetricChart>(MetricChart.MemoryUsage);
  const [timeInterval, setTimeInterval] = useState("Last 1 Hour");
  const [metrics, setMetrics] = useState<ResourceObservabilityMetrics>(isDestroyed ? ZERO_METRICS : initialMetrics);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => {
    setMetrics(isDestroyed ? ZERO_METRICS : initialMetrics);
  }, [initialMetrics, isDestroyed]);

  useEffect(() => {
    if (isDestroyed) return;

    let cancelled = false;

    async function loadMetricsForRange() {
      const hrsAgo = hoursAgoForInterval(timeInterval);
      try {
        setLoadingMetrics(true);
        const next = await fetchMetrics({ data: { sandboxId: sandbox.id, hrsAgo } });
        if (!cancelled) {
          setMetrics(next);
        }
      } catch {
        if (!cancelled) {
          setMetrics(ZERO_METRICS);
        }
      } finally {
        if (!cancelled) {
          setLoadingMetrics(false);
        }
      }
    }

    void loadMetricsForRange();

    return () => {
      cancelled = true;
    };
  }, [timeInterval, fetchMetrics, sandbox.id, isDestroyed]);

  useEffect(() => {
    if (isDestroyed) return;

    let intervalId: number | undefined;

    const refetch = async () => {
      try {
        const hrsAgo = hoursAgoForInterval(timeInterval);
        const next = await fetchMetrics({ data: { sandboxId: sandbox.id, hrsAgo } });
        setMetrics(next);
      } catch {
        // keep last-good metrics on transient failures
      }
    };

    const start = () => {
      if (intervalId !== undefined) return;
      intervalId = window.setInterval(() => {
        if (!document.hidden) void refetch();
      }, 15_000);
    };

    const stop = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        void refetch();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchMetrics, sandbox.id, timeInterval, isDestroyed]);

  const aggregateSeries = useMemo(() => {
    const results = Array.isArray(metrics?.results) ? metrics.results : [];
    return results.map((item) => ({
      time: formatTimeLabel(String(item?.date ?? "")),
      memory: Number(item?.memory ?? 0),
      cpu: Number(item?.cpu ?? 0),
      network: toKbps(item?.network?.bytesPerSecond ?? null),
    }));
  }, [metrics]);

  let currentData: { time: string; value: number }[] = [];
  let currentUnit = "";

  if (activeChart === MetricChart.MemoryUsage) {
    currentData = aggregateSeries.map((item) => ({ time: item.time, value: item.memory }));
    currentUnit = "%";
  } else if (activeChart === MetricChart.CpuUsage) {
    currentData = aggregateSeries.map((item) => ({ time: item.time, value: item.cpu }));
    currentUnit = "%";
  } else {
    currentData = aggregateSeries.map((item) => ({ time: item.time, value: item.network }));
    currentUnit = "KB/s";
  }

  const cpuPercent = Number(metrics?.average?.cpu?.totalInPercentage ?? 0);
  const cpuMhz = Number(sandbox.specs?.cpu ?? 0);
  const memoryPercent = Number(metrics?.average?.memory?.totalInPercentage ?? 0);
  const memoryMb = Number(sandbox.specs?.memory ?? 0);
  const memoryGb = memoryMb / 1024;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabHeader title="Metrics & Observability">Monitor this sandbox's resource usage over time.</TabHeader>
        <TimeIntervalDropdown value={timeInterval} onChange={setTimeInterval} />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <SemiGauge
          value={cpuPercent}
          max={100}
          label="CPU"
          valueLabel={`${cpuPercent.toFixed(1)}% - ${cpuMhz} MHz`}
          title="CPU Usage"
          subtitle="Current processor utilization"
        />
        <SemiGauge
          value={memoryPercent}
          max={100}
          label="Memory"
          valueLabel={`${memoryPercent.toFixed(2)} % / ${memoryGb.toFixed(1)}GB`}
          title="Memory usage"
          subtitle="Current memory consumption"
        />
      </div>

      <div className="rounded-[4px] border-[0.5px] border-dash-border">
        <div className="flex flex-col gap-2 border-b-[0.5px] border-dash-border sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          <div className="scrollbar-hidden min-w-0 overflow-x-auto">
            <div className="flex min-w-max">
              {CHART_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    haptics.selection();
                    setActiveChart(tab);
                  }}
                  className={`whitespace-nowrap px-4 py-3 text-sm transition-colors ${
                    activeChart === tab
                      ? "border-b-2 border-[#f5a623] font-medium text-[#f5a623]"
                      : "font-light text-dash-text-faded hover:text-dash-text-body"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="min-w-0 overflow-hidden px-3 pb-4 pt-6 sm:px-5 sm:pb-5 sm:pt-8">
          {loadingMetrics ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-dash-text-faded">Loading metrics...</div>
          ) : currentData.length > 0 ? (
            <TimeSeriesChart data={currentData} yUnit={currentUnit} label={activeChart} />
          ) : (
            <div className="flex h-[260px] items-center justify-center text-sm text-dash-text-faded">
              No metrics available for this time range.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
