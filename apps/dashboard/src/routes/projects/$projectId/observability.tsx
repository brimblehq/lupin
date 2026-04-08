import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown } from "lucide-react";
import {
  ArrowBendUpLeft,
  GlobeHemisphereWest,
  UsersThree,
} from "@phosphor-icons/react";
import { motion, useInView } from "motion/react";
import { TabHeader } from "../../../components/shared/tab-header";
import { TimeSeriesChart } from "@/components/observability/time-series-chart";
import { SemiGauge } from "@/components/observability/semi-gauge";
import { SegmentedToggle } from "@/components/observability/segmented-toggle";
import { formatTimeLabel, toKbps, hoursAgoForInterval } from "@/utils/observability";
import type { ResourceObservabilityMetrics } from "@/backend/observability";
import {
  getObservabilityGrafanaUrlServerFn,
  getProjectObservabilityMetricsServerFn,
} from "@/server/observability/actions";
import { normalizeMemoryGbValue } from "@/utils/project-configuration";
import { useHaptics } from "@/hooks/use-haptics";
import { isDatabaseProject, shouldShowProjectObservabilityTab } from "@/utils/project-capabilities";
import { InstallTrackingModal } from "@/components/analytics/install-tracking-modal";
import { VisitorsMap } from "@/components/analytics/visitors-map";
import { TrafficHeatmap } from "@/components/analytics/traffic-heatmap";
import type {
  AnalyticsPayload,
  AnalyticsPerformanceMetric,
  AnalyticsSummary,
} from "@/backend/analytics";
import { getAnalyticsServerFn, type AnalyticsLoadResult } from "@/server/analytics/actions";
import { friendlyAnalyticsError } from "@/lib/analytics-errors";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { usePlanGate } from "@/hooks/use-plan-gate";
import { PlanUpgradePrompt } from "@/components/shared/plan-upgrade-prompt";

const parentRoute = getRouteApi("/projects/$projectId");

export const Route = createFileRoute("/projects/$projectId/observability")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  loader: async ({ context }) => {
    const project = (context as any).project;
    const workspace = (context as any).workspace;

    const [metrics, grafanaUrl] = await Promise.all([
      (getProjectObservabilityMetricsServerFn as unknown as (input: {
        data: { projectId: string; workspace?: string; hrsAgo?: number };
      }) => Promise<ResourceObservabilityMetrics>)({
        data: { projectId: project?.id, workspace, hrsAgo: 1 },
      }),
      (getObservabilityGrafanaUrlServerFn as unknown as (input: {
        data: { workspace?: string };
      }) => Promise<string | null>)({
        data: { workspace },
      }).catch(() => null),
    ]);

    return { metrics, grafanaUrl };
  },
  component: ObservabilityPage,
});

import { MetricChart } from "../../../types/enums";

const timeIntervals = [
  "Last 1 Hour",
  "Last 6 Hours",
  "Last 24 Hours",
  "Last 7 Days",
  "Last 30 Days",
];

function TimeIntervalDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-[34px] items-center gap-1.5 rounded-[4px] border-[0.5px] border-dash-border px-3 text-xs font-medium text-dash-text-strong"
      >
        {value}
        <ChevronDown
          className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-lg">
          {timeIntervals.map((interval) => (
            <button
              key={interval}
              onClick={() => {
                onChange(interval);
                setOpen(false);
              }}
              className={`flex w-full px-3 py-2 text-left text-xs transition-colors ${
                interval === value
                  ? "font-medium text-[#4879f8]"
                  : "font-light text-dash-text-body hover:bg-dash-bg-elevated"
              }`}
            >
              {interval}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AppMetrics({
  project,
  initialMetrics,
  grafanaUrl,
  workspace,
}: {
  project: Project;
  initialMetrics: ResourceObservabilityMetrics;
  grafanaUrl: string | null;
  workspace?: string;
}) {
  const fetchMetrics = useServerFn(getProjectObservabilityMetricsServerFn as any) as (args: {
    data: { projectId: string; workspace?: string; hrsAgo?: number };
  }) => Promise<ResourceObservabilityMetrics>;
  const haptics = useHaptics();
  const [activeChart, setActiveChart] = useState<MetricChart>(MetricChart.MemoryUsage);
  const [responseMetric, setResponseMetric] = useState("P90");
  const [timeInterval, setTimeInterval] = useState("Last 1 Hour");
  const [metrics, setMetrics] = useState<ResourceObservabilityMetrics>(initialMetrics);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => {
    setMetrics(initialMetrics);
  }, [initialMetrics]);

  useEffect(() => {
    let cancelled = false;

    async function loadMetricsForRange() {
      const hrsAgo = hoursAgoForInterval(timeInterval);
      if (hrsAgo === 1) {
        setMetrics(initialMetrics);
        return;
      }

      try {
        setLoadingMetrics(true);
        const nextMetrics = await fetchMetrics({
          data: {
            projectId: project.id,
            workspace,
            hrsAgo,
          },
        });

        if (!cancelled) {
          setMetrics(nextMetrics);
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
  }, [timeInterval, fetchMetrics, project.id, workspace, initialMetrics]);

  const isDbProject = isDatabaseProject(project as any);
  const chartTabs: MetricChart[] = isDbProject
    ? [MetricChart.MemoryUsage, MetricChart.CpuUsage, MetricChart.NetworkEgress]
    : [MetricChart.MemoryUsage, MetricChart.CpuUsage, MetricChart.NetworkEgress, MetricChart.ResponseTimes];

  const aggregateSeries = useMemo(() => {
    const results = Array.isArray(metrics?.results) ? metrics.results : [];

    return results.map((item: any) => {
      let point = item;
      if (item && typeof item === "object" && "aggregate" in item) {
        point = item.aggregate;
      }

      return {
        time: formatTimeLabel(String(item?.date ?? "")),
        memory: Number(point?.memory ?? 0),
        cpu: Number(point?.cpu ?? 0),
        network: toKbps(point?.network?.bytesPerSecond ?? null),
      };
    });
  }, [metrics]);

  const responseSeries = useMemo(() => {
    const items = metrics?.responseTime?.results || [];

    return {
      P90: items.map((item) => ({
        time: formatTimeLabel(item.date),
        value: Number(item.p90 ?? 0),
      })),
      P95: items.map((item) => ({
        time: formatTimeLabel(item.date),
        value: Number(item.p95 ?? 0),
      })),
      P99: items.map((item) => ({
        time: formatTimeLabel(item.date),
        value: Number(item.p99 ?? 0),
      })),
      Average: items.map((item) => ({
        time: formatTimeLabel(item.date),
        value: Number(item.avg ?? 0),
      })),
    };
  }, [metrics]);

  let currentData: { time: string; value: number }[] = [];
  let currentUnit = "";

  if (activeChart === MetricChart.ResponseTimes) {
    currentData = responseSeries[responseMetric] || [];
    currentUnit = "ms";
  } else if (activeChart === MetricChart.MemoryUsage) {
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
  const cpuSize = Number(metrics?.average?.cpu?.size ?? 0);
  const memoryPercent = Number(metrics?.average?.memory?.totalInPercentage ?? 0);
  const memoryUsedGb = Number(metrics?.average?.memory?.size ?? 0);
  const memoryLimitGb = normalizeMemoryGbValue(project?.specs?.memory);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabHeader title="Metrics & Observability">
          Monitor your app's key metrics and health.
          {grafanaUrl ? (
            <>
              {" "}
              <a
                href={grafanaUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#4879f8] underline"
              >
                View in Grafana
              </a>
            </>
          ) : null}
        </TabHeader>
        <TimeIntervalDropdown value={timeInterval} onChange={setTimeInterval} />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <SemiGauge
          value={cpuPercent}
          max={100}
          label="CPU"
          valueLabel={`${cpuPercent.toFixed(1)}% - ${cpuSize.toFixed(1)} vCPU`}
          title="CPU Usage"
          subtitle="Current processor utilization"
        />
        <SemiGauge
          value={memoryPercent}
          max={100}
          label="Memory"
          valueLabel={`${memoryPercent.toFixed(2)} % / ${memoryLimitGb.toFixed(1)}GB`}
          title="Memory usage"
          subtitle="Current memory consumption"
        />
      </div>

      <div className="rounded-[4px] border-[0.5px] border-dash-border">
        <div className="flex flex-col gap-2 border-b-[0.5px] border-dash-border sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          <div className="scrollbar-hidden min-w-0 overflow-x-auto">
            <div className="flex min-w-max">
              {chartTabs.map((tab) => (
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
          {activeChart === MetricChart.ResponseTimes ? (
            <div className="px-4 pb-3 sm:pb-0 sm:pr-4">
              <SegmentedToggle
                options={["P90", "P95", "P99", "Average"]}
                value={responseMetric}
                onChange={setResponseMetric}
              />
            </div>
          ) : null}
        </div>
        <div className="min-w-0 overflow-hidden px-3 pb-4 pt-6 sm:px-5 sm:pb-5 sm:pt-8">
          {loadingMetrics ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-dash-text-faded">
              Loading metrics...
            </div>
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


function LiveIndicator({ lastUpdated }: { lastUpdated: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((now - lastUpdated) / 1000));
  const label =
    seconds < 5 ? "just now" : seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`;
  return (
    <div
      title={`Last updated ${label}`}
      className="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-dash-border bg-dash-bg-elevated px-2.5 py-1 text-[11px] font-medium text-dash-text-faded"
    >
      <span className="relative flex size-1.5">
        <motion.span
          className="absolute inset-0 rounded-full bg-[#22c55e]"
          animate={{ scale: [1, 2.4, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
        <span className="relative size-1.5 rounded-full bg-[#22c55e]" />
      </span>
      Live
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[1px] text-dash-text-faded">
        {label}
      </span>
      <span className="text-2xl font-light text-dash-text-strong">{value}</span>
    </div>
  );
}

function formatTickLabel(point: { x: string }, unit: string) {
  const dt = new Date(point.x.replace(" ", "T"));
  if (Number.isNaN(dt.getTime())) return point.x;
  if (unit === "hour") {
    return dt.toLocaleTimeString(undefined, { hour: "2-digit" });
  }
  if (unit === "month") {
    return dt.toLocaleDateString(undefined, { month: "short" });
  }
  if (unit === "year") {
    return dt.getFullYear().toString();
  }
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function VisitorBarChart({ points, unit }: { points: { x: string; y: number }[]; unit: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const safePoints = points.length > 0 ? points : [{ x: "—", y: 0 }];
  const values = safePoints.map((d) => d.y);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const barH = 320;
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, margin: "-80px" });
  const labelInterval = Math.max(1, Math.ceil(safePoints.length / 12));

  return (
    <div ref={containerRef} className="scrollbar-hidden mt-6 overflow-x-auto">
      <div className="flex min-w-[540px] gap-0 sm:min-w-0">
        {safePoints.map((d, i) => {
          const pct = (d.y - min) / range;
          const valH = pct * barH;
          const isActive = hovered === i;
          const showLabel = i % labelInterval === 0;

          return (
            <div
              key={`${d.x}-${i}`}
              className="flex flex-1 flex-col items-center gap-2"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className="relative w-full overflow-hidden rounded-[4px]"
                style={{ height: barH }}
              >
                <div
                  className="absolute inset-0 rounded-[4px]"
                  style={{
                    backgroundColor: "var(--color-dash-bg-elevated)",
                    backgroundImage:
                      "repeating-linear-gradient(-45deg, transparent, transparent 4px, var(--color-dash-border-soft) 4px, var(--color-dash-border-soft) 4.5px)",
                  }}
                />

                {valH > 0 && (
                  <motion.div
                    className="absolute inset-x-0 bottom-0 origin-bottom"
                    style={{ height: valH }}
                    initial={{ scaleY: 0 }}
                    animate={inView ? { scaleY: 1 } : { scaleY: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 130,
                      damping: 13,
                      mass: 1.1,
                    }}
                  >
                    <div
                      className="size-full transition-opacity duration-200 ease-out"
                      style={{
                        backgroundColor: "#ff7a00",
                        opacity: isActive ? 1 : 0.3,
                      }}
                    />
                    {isActive && (
                      <div
                        className="absolute inset-x-0 top-0 -translate-y-full"
                        style={{ height: 10, backgroundColor: "#ffa800" }}
                      />
                    )}
                  </motion.div>
                )}
              </div>

              <span
                className={`text-[10px] font-medium tracking-wide transition-colors ${
                  isActive
                    ? "text-dash-text-strong"
                    : "text-dash-text-extra-faded"
                }`}
              >
                {showLabel ? formatTickLabel(d, unit) : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListCard({ title, subtitle, items, showSeeAll, collapsedCount = 5 }: { title: string; subtitle?: string; items: { label: string; icon?: string; value: string }[]; showSeeAll?: boolean; collapsedCount?: number }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = showSeeAll && items.length > collapsedCount;
  const visible = expanded || !canExpand ? items : items.slice(0, collapsedCount);
  return (
    <div className="flex flex-1 flex-col rounded-[4px] border-[0.5px] border-dash-border">
      <div className="flex items-start justify-between gap-3 border-b-[0.5px] border-dash-border px-4 py-3">
        <div>
          <h3 className="text-sm font-medium text-dash-text-strong">{title}</h3>
          {subtitle && <p className="text-xs font-light text-dash-text-faded">{subtitle}</p>}
        </div>
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-xs text-[#4879f8] hover:underline"
          >
            {expanded ? "Show less" : "See all"}
          </button>
        )}
      </div>
      <div className="flex flex-col">
        {visible.map((item, i) => (
          <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${i < visible.length - 1 ? "border-b-[0.5px] border-dash-border-soft" : ""}`}>
            <div className="min-w-0 flex items-center gap-2">
              {item.icon && <span className="text-sm">{item.icon}</span>}
              <span className="truncate text-sm font-light text-dash-text-body">{item.label}</span>
            </div>
            <span className="shrink-0 pl-3 text-xs text-dash-text-faded">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type RangePreset = {
  label: string;
  durationMs: number;
  unit: "hour" | "day" | "month" | "year";
};

const RANGE_PRESETS: RangePreset[] = [
  { label: "Last 24 hours", durationMs: 24 * 60 * 60 * 1000, unit: "hour" },
  { label: "Last 7 days", durationMs: 7 * 24 * 60 * 60 * 1000, unit: "hour" },
  { label: "Last 30 days", durationMs: 30 * 24 * 60 * 60 * 1000, unit: "day" },
  { label: "Last 12 months", durationMs: 365 * 24 * 60 * 60 * 1000, unit: "month" },
];
const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat(undefined, {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});
const GROUPED_NUMBER_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);

  if (abs >= 10_000) {
    return COMPACT_NUMBER_FORMATTER.format(value);
  }

  return GROUPED_NUMBER_FORMATTER.format(value);
}

function formatPerf(metric: AnalyticsPerformanceMetric, kind: "ms" | "s" | "cls"): string {
  if (!metric || metric.samples === 0 || metric.p75 == null) return "—";
  const v = metric.p75;
  if (kind === "cls") return v.toFixed(2);
  if (kind === "s") return `${(v / 1000).toFixed(1)}s`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}s`;
  return `${Math.round(v)}ms`;
}

function bouncePercent(summary: AnalyticsSummary): string {
  const rate = summary.bounceRate?.value;
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function AppAnalytics({
  initial,
  projectId,
}: {
  initial: AnalyticsPayload;
  projectId: string;
}) {
  const haptics = useHaptics();
  const getAnalytics = useServerFn(getAnalyticsServerFn as any) as (args: {
    data: { projectId: string; startAt: number; endAt: number; unit?: string; timezone?: string };
  }) => Promise<AnalyticsLoadResult>;

  const [data, setData] = useState<AnalyticsPayload>(initial);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [preset, setPreset] = useState<RangePreset>(RANGE_PRESETS[1]);
  const [visitorTab, setVisitorTab] = useState<"Visitors" | "Page Views">("Visitors");
  const [browserTab, setBrowserTab] = useState<"Browsers" | "Devices">("Browsers");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) {
        setPeriodOpen(false);
      }
    }
    if (periodOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [periodOpen]);

  const refetch = useCallback(
    async (nextPreset?: RangePreset) => {
      const p = nextPreset ?? preset;
      const endAt = Date.now();
      const startAt = endAt - p.durationMs;
      try {
        const result = await getAnalytics({
          data: {
            projectId,
            startAt,
            endAt,
            unit: p.unit,
            timezone: browserTimezone(),
          },
        });
        if (result.state === "enabled") {
          setData(result.data);
          setLastUpdated(Date.now());
        } else if (result.state === "error") {
          toast.error(result.message);
        }
      } catch (error) {
        toast.error(friendlyAnalyticsError(error).message);
      }
    },
    [getAnalytics, preset, projectId],
  );

  async function handlePresetChange(next: RangePreset) {
    if (next.label === preset.label) {
      setPeriodOpen(false);
      return;
    }
    haptics.selection();
    setPreset(next);
    setPeriodOpen(false);
    setRefetching(true);
    try {
      await refetch(next);
    } finally {
      setRefetching(false);
    }
  }

  // Live poll every 60s while the tab is visible.
  useEffect(() => {
    let id: number | undefined;
    function start() {
      if (id !== undefined) return;
      id = window.setInterval(() => {
        if (!document.hidden) void refetch();
      }, 15_000);
    }
    function stop() {
      if (id !== undefined) {
        window.clearInterval(id);
        id = undefined;
      }
    }
    function onVisibility() {
      if (document.hidden) {
        stop();
      } else {
        void refetch();
        start();
      }
    }
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refetch]);

  const summary = data.summary;
  const visitorsRightNow = data.active?.visitors ?? 0;
  const hasAnyData =
    summary.pageviews.value > 0 ||
    summary.visitors.value > 0 ||
    summary.visits.value > 0 ||
    visitorsRightNow > 0 ||
    data.metrics.country.length > 0 ||
    data.metrics.path.length > 0;
  const bounce = bouncePercent(summary);
  const countriesCount = data.metrics.country.length;

  const chartPoints =
    visitorTab === "Page Views" ? data.pageviews.pageviews : data.pageviews.sessions;

  const browserOptions = data.metrics.browser;
  const deviceOptions = data.metrics.device;
  const activeBreakdown = browserTab === "Browsers" ? browserOptions : deviceOptions;

  const chartLabel =
    visitorTab === "Page Views" ? "Page views" : "Visitors";
  const chartTotal =
    visitorTab === "Page Views" ? summary.pageviews.value : summary.visitors.value;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <TabHeader title="Web analytics">
          Track visitor activity, top pages, and traffic sources.{" "}
          <a href="#" className="text-[#4879f8] underline">
            Learn more
          </a>
        </TabHeader>
        <div className="flex shrink-0 items-center gap-2">
          {!hasAnyData && (
            <button
              type="button"
              onClick={() => setInstallOpen(true)}
              title="Once you paste the tracking snippet into your site, data will appear here."
              className="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-dash-border bg-dash-bg-elevated px-2.5 py-1 text-[11px] font-medium text-dash-text-faded transition-colors hover:text-dash-text-strong"
            >
              <span className="relative flex size-1.5">
                <motion.span
                  className="absolute inset-0 rounded-full bg-[#4879f8]"
                  animate={{ scale: [1, 2.4, 1], opacity: [0.7, 0, 0.7] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                />
                <span className="relative size-1.5 rounded-full bg-[#4879f8]" />
              </span>
              Waiting for first pageview
            </button>
          )}
          <button
            type="button"
            onClick={() => setInstallOpen(true)}
            className="shrink-0 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg px-3 py-1.5 text-xs font-medium text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
          >
            Install snippet
          </button>
        </div>
      </div>

      <>
      <div className="flex flex-col gap-6 overflow-hidden rounded-[4px] bg-[#0a1430] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:pl-7 sm:pr-10 sm:py-7">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[1.5px] text-[#cfe0ff]/70">
            Analytics TLDR:
          </span>
          <p className="text-xs font-light leading-[1.4] text-[#cfe0ff]/50">
            Quick view summary for what&apos;s going on
            <br />
            with &lsquo;{data.domain}&rsquo;.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-6 sm:w-auto sm:flex-nowrap sm:gap-10">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2.5">
              <UsersThree className="size-6 shrink-0 text-[#cfe0ff]" weight="duotone" />
              <span className="text-[44px] font-light leading-none text-[#cfe0ff]">{formatNumber(summary.visitors.value)}</span>
            </div>
            <span className="pl-[34px] text-[9px] font-medium uppercase tracking-[1px] text-[#cfe0ff]/50">
              Unique Visitors
            </span>
          </div>
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2.5">
              <GlobeHemisphereWest className="size-6 shrink-0 text-[#cfe0ff]" weight="duotone" />
              <span className="text-[44px] font-light leading-none text-[#cfe0ff]">{formatNumber(countriesCount)}</span>
            </div>
            <span className="pl-[34px] text-[9px] font-medium uppercase tracking-[1px] text-[#cfe0ff]/50">
              Countries
            </span>
          </div>
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2.5">
              <ArrowBendUpLeft className="size-6 shrink-0 text-[#cfe0ff]" weight="duotone" />
              <span className="text-[44px] font-light leading-none text-[#cfe0ff]">{bounce}</span>
            </div>
            <span className="pl-[34px] text-[9px] font-medium uppercase tracking-[1px] text-[#cfe0ff]/50">
              Bounce rate
            </span>
          </div>
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2.5">
              <motion.span
                className="size-2.5 shrink-0 rounded-full bg-[#22c55e]"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className="text-[44px] font-light leading-none text-[#cfe0ff]">{formatNumber(visitorsRightNow)}</span>
            </div>
            <span className="pl-[22px] text-[9px] font-medium uppercase tracking-[1px] text-[#cfe0ff]/50">
              Visitors right now
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-[4px] border-[0.5px] border-dash-border p-5">
        <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-light text-dash-text-faded">{chartLabel}</p>
            <span className="text-[32px] font-medium leading-tight tracking-tight text-dash-text-strong">
              {formatNumber(chartTotal)}
            </span>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <LiveIndicator lastUpdated={lastUpdated} />
            <SegmentedToggle
              options={["Visitors", "Page Views"]}
              value={visitorTab}
              onChange={(v) => setVisitorTab(v as "Visitors" | "Page Views")}
            />
            <div ref={periodRef} className="relative">
              <button
                onClick={() => setPeriodOpen(!periodOpen)}
                disabled={refetching}
                className="flex w-full items-center justify-between gap-1.5 rounded-[4px] border-[0.5px] border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text-strong sm:w-auto sm:justify-start"
              >
                {refetching ? "Loading..." : preset.label}
                <ChevronDown
                  className={`size-3 transition-transform ${periodOpen ? "rotate-180" : ""}`}
                />
              </button>
              {periodOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-lg">
                  {RANGE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => void handlePresetChange(p)}
                      className={`flex w-full px-3 py-2 text-left text-xs transition-colors ${
                        p.label === preset.label
                          ? "font-medium text-[#4879f8]"
                          : "font-light text-dash-text-body hover:bg-dash-bg-elevated"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <VisitorBarChart points={chartPoints} unit={data.range.unit} />
      </div>

      <VisitorsMap
        countries={data.metrics.country.map((c) => ({ code: c.x, visitors: c.y }))}
      />

      <div className="flex flex-col rounded-[4px] border-[0.5px] border-dash-border">
        <div className="border-b-[0.5px] border-dash-border px-4 py-3">
          <h3 className="text-sm font-medium text-dash-text-strong">Page performance</h3>
          <p className="text-xs font-light text-dash-text-faded">Core Web Vitals (p75) over this window</p>
        </div>
        <div className="flex flex-col gap-6 px-5 py-5 sm:flex-row sm:items-stretch sm:gap-10">
          <StatTile label="LCP" value={formatPerf(data.performance.lcp, "ms")} />
          <StatTile label="CLS" value={formatPerf(data.performance.cls, "cls")} />
          <StatTile label="INP" value={formatPerf(data.performance.inp, "ms")} />
        </div>
        <div className="flex items-center justify-between border-t-[0.5px] border-dash-border-soft px-5 py-3 text-xs">
          <span className="text-dash-text-faded">Average load time</span>
          <span className="font-medium text-dash-text-strong">
            {data.performance.avgLoadTime != null
              ? `${(data.performance.avgLoadTime / 1000).toFixed(1)}s`
              : "—"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <ListCard
          title="Top pages"
          subtitle="Most visited pages"
          showSeeAll
          items={data.metrics.path.map((p) => ({ label: p.x, value: `${formatNumber(p.y)} views` }))}
        />
        <ListCard
          title="Referrers"
          subtitle="Where your visitors come from"
          showSeeAll
          items={data.metrics.referrer.map((r) => ({
            label: r.x || "Direct",
            value: formatNumber(r.y),
          }))}
        />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <ListCard
          title="Countries"
          subtitle="Visitors by country"
          showSeeAll
          items={data.metrics.country.map((c) => ({
            label: c.x,
            value: `${formatNumber(c.y)} visitors`,
          }))}
        />
        <div className="flex flex-1 flex-col rounded-[4px] border-[0.5px] border-dash-border">
          <div className="flex flex-col gap-2 border-b-[0.5px] border-dash-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-medium text-dash-text-strong">Browser &amp; Device Information</h3>
            <SegmentedToggle
              options={["Browsers", "Devices"]}
              value={browserTab}
              onChange={(v) => setBrowserTab(v as "Browsers" | "Devices")}
            />
          </div>
          <div className="flex flex-col">
            {activeBreakdown.length === 0 ? (
              <div className="px-4 py-6 text-xs text-dash-text-faded">No data yet.</div>
            ) : (
              activeBreakdown.map((item, i, arr) => (
                <div
                  key={item.x}
                  className={`flex items-center justify-between px-4 py-2.5 ${i < arr.length - 1 ? "border-b-[0.5px] border-dash-border-soft" : ""}`}
                >
                  <span className="text-sm font-light text-dash-text-body">{item.x}</span>
                  <span className="text-xs text-dash-text-faded">{formatNumber(item.y)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <ListCard
          title="Regions"
          subtitle="Visitors by region"
          showSeeAll
          items={data.metrics.region.map((r) => ({
            label: r.x,
            value: `${formatNumber(r.y)} visitors`,
          }))}
        />
        <ListCard
          title="Cities"
          subtitle="Visitors by city"
          showSeeAll
          items={data.metrics.city.map((c) => ({
            label: c.x,
            value: `${formatNumber(c.y)} visitors`,
          }))}
        />
      </div>

      <ListCard
        title="Custom events"
        subtitle="Tracked events on your site"
        showSeeAll
        items={data.metrics.event.map((e) => ({ label: e.x, value: formatNumber(e.y) }))}
      />

      <TrafficHeatmap grid={data.trafficByHour} />
      </>

      <InstallTrackingModal
        open={installOpen}
        onOpenChange={setInstallOpen}
        siteId={data.websiteId}
        serverSnippet={data.snippet}
      />
    </div>
  );
}

function ObservabilityPage() {
  const { project, workspace } = parentRoute.useLoaderData() as any;
  if (!shouldShowProjectObservabilityTab(project)) {
    return (
      <div className="mx-auto flex max-w-[1000px] flex-col gap-4 px-4 py-8 sm:px-0">
        <TabHeader title="Metrics & Observability">
          Observability is not available for static projects.
        </TabHeader>
      </div>
    );
  }
  const { metrics, grafanaUrl } = Route.useLoaderData();

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-0">
      <AppMetrics
        project={project}
        initialMetrics={metrics}
        grafanaUrl={grafanaUrl}
        workspace={workspace}
      />
    </div>
  );
}
