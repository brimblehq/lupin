import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createFileRoute, getRouteApi, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, ChevronDown, Monitor, Smartphone, Tablet, Tv } from "lucide-react";
import { BrowserIcon } from "@/components/analytics/browser-icons";
import { SimpleTooltip } from "@/components/shared/tooltip";
import { ArrowBendUpLeft, GlobeHemisphereWest, UsersThree } from "@phosphor-icons/react";
import { motion, useInView } from "motion/react";
import { TabHeader } from "../../../components/shared/tab-header";
import { ObservabilityPending } from "@/components/shared/route-pending";
import { TimeSeriesChart } from "@/components/observability/time-series-chart";
import { SemiGauge } from "@/components/observability/semi-gauge";
import { SegmentedToggle } from "@/components/observability/segmented-toggle";
import { formatTimeLabel, toKbps, hoursAgoForInterval } from "@/utils/observability";
import type { ResourceObservabilityMetrics } from "@/backend/observability";
import { getProjectObservabilityMetricsServerFn } from "@/server/observability/actions";
import { normalizeMemoryGbValue } from "@/utils/project-configuration";
import { useHaptics } from "@/hooks/use-haptics";
import { isDatabaseProject, shouldShowProjectObservabilityTab } from "@/utils/project-capabilities";
import { InstallTrackingModal } from "@/components/analytics/install-tracking-modal";
import { VisitorsMap } from "@/components/analytics/visitors-map";
import { TrafficHeatmap } from "@/components/analytics/traffic-heatmap";
import type { AnalyticsPayload, AnalyticsPerformanceMetric, AnalyticsSummary } from "@/backend/analytics";
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

    const metrics = await (
      getProjectObservabilityMetricsServerFn as unknown as (input: {
        data: { projectId: string; workspace?: string; hrsAgo?: number };
      }) => Promise<ResourceObservabilityMetrics>
    )({
      data: { projectId: project?.id, workspace, hrsAgo: 1 },
    }).catch(() => ({}) as ResourceObservabilityMetrics);

    return { metrics };
  },
  component: ObservabilityPage,
  pendingComponent: ObservabilityPending,
});

import { MetricChart } from "../../../types/enums";

const timeIntervals = ["Last 1 Hour", "Last 6 Hours", "Last 24 Hours", "Last 7 Days", "Last 30 Days"];

function TimeIntervalDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
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
                interval === value ? "font-medium text-[#4879f8]" : "font-light text-dash-text-body hover:bg-dash-bg-elevated"
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
  workspace,
}: {
  project: Project;
  initialMetrics: ResourceObservabilityMetrics;
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
    currentData = aggregateSeries.map((item) => ({
      time: item.time,
      value: item.memory,
    }));
    currentUnit = "%";
  } else if (activeChart === MetricChart.CpuUsage) {
    currentData = aggregateSeries.map((item) => ({
      time: item.time,
      value: item.cpu,
    }));
    currentUnit = "%";
  } else {
    currentData = aggregateSeries.map((item) => ({
      time: item.time,
      value: item.network,
    }));
    currentUnit = "KB/s";
  }

  const cpuPercent = Number(metrics?.average?.cpu?.totalInPercentage ?? 0);
  const cpuSize = Number(metrics?.average?.cpu?.size ?? 0);
  const memoryPercent = Number(metrics?.average?.memory?.totalInPercentage ?? 0);
  const memoryLimitGb = normalizeMemoryGbValue(project?.specs?.memory);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabHeader title="Metrics & Observability">Monitor your app's key metrics and health.</TabHeader>
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
              <SegmentedToggle options={["P90", "P95", "P99", "Average"]} value={responseMetric} onChange={setResponseMetric} />
            </div>
          ) : null}
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

type AnimatedStatValue = {
  value: number | null;
  unit: "s" | "ms" | "";
  decimals: number;
};

const PERF_COUNTER_DURATION_MS = 900;

function formatAnimatedNumber(value: number, decimals: number): string {
  if (decimals === 0) {
    return String(Math.round(value));
  }

  return value.toFixed(decimals);
}

function CounterValue({ stat }: { stat: AnimatedStatValue }) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(valueRef, { once: true, margin: "-80px" });
  const [animatedValue, setAnimatedValue] = useState<number | null>(stat.value == null ? null : 0);

  useEffect(() => {
    if (stat.value == null || !Number.isFinite(stat.value)) {
      setAnimatedValue(null);
      return;
    }

    const reducedMotionQuery =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    if (reducedMotionQuery?.matches) {
      setAnimatedValue(stat.value);
      return;
    }

    if (!isInView) {
      setAnimatedValue(0);
      return;
    }

    let frame = 0;
    const animationStart = performance.now();
    const target = stat.value;

    setAnimatedValue(0);

    const tick = (now: number) => {
      const progress = Math.min((now - animationStart) / PERF_COUNTER_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = target * eased;

      setAnimatedValue(nextValue);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }

      setAnimatedValue(target);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [isInView, stat.value]);

  if (animatedValue == null) {
    return <span ref={valueRef}>—</span>;
  }

  return (
    <span ref={valueRef}>
      {formatAnimatedNumber(animatedValue, stat.decimals)}
      {stat.unit}
    </span>
  );
}

function StatTile({ label, stat }: { label: string; stat: AnimatedStatValue }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[1px] text-dash-text-faded">{label}</span>
      <span className="text-2xl font-light text-dash-text-strong">
        <CounterValue stat={stat} />
      </span>
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

function formatBucketLabel(point: { x: string }, unit: string): string {
  const dt = new Date(point.x.replace(" ", "T"));
  if (Number.isNaN(dt.getTime())) return point.x;
  if (unit === "hour") {
    return dt.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
    });
  }
  if (unit === "month") {
    return dt.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  if (unit === "year") {
    return dt.getFullYear().toString();
  }
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function VisitorBarChart({ points, unit, seriesLabel }: { points: { x: string; y: number }[]; unit: string; seriesLabel: string }) {
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
      <div className="flex min-w-[320px] gap-0 sm:min-w-[540px] lg:min-w-0">
        {safePoints.map((d, i) => {
          const pct = (d.y - min) / range;
          const valH = pct * barH;
          const isActive = hovered === i;
          const showLabel = i % labelInterval === 0;

          const tooltipContent = (
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">
                {d.y.toLocaleString()} {seriesLabel.toLowerCase()}
              </span>
              <span className="text-[10px] text-white/60">{formatBucketLabel(d, unit)}</span>
            </div>
          );

          return (
            <div
              key={`${d.x}-${i}`}
              className="flex flex-1 flex-col items-center gap-2"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="relative w-full overflow-hidden rounded-[4px]" style={{ height: barH }}>
                <div
                  className="absolute inset-0 rounded-[4px]"
                  style={{
                    backgroundColor: "var(--color-dash-bg-elevated)",
                    backgroundImage:
                      "repeating-linear-gradient(-45deg, transparent, transparent 4px, var(--color-dash-border-soft) 4px, var(--color-dash-border-soft) 4.5px)",
                  }}
                />

                {valH > 0 && (
                  <SimpleTooltip content={tooltipContent}>
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
                        <div className="absolute inset-x-0 top-0 -translate-y-full" style={{ height: 10, backgroundColor: "#ffa800" }} />
                      )}
                    </motion.div>
                  </SimpleTooltip>
                )}
              </div>

              <span
                className={`text-[10px] font-medium tracking-wide transition-colors ${
                  isActive ? "text-dash-text-strong" : "text-dash-text-extra-faded"
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

function ListCard({
  title,
  subtitle,
  items,
  showSeeAll,
  collapsedCount = 5,
}: {
  title: string;
  subtitle?: string;
  items: { label: string; icon?: string; value: string }[];
  showSeeAll?: boolean;
  collapsedCount?: number;
}) {
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
          <button type="button" onClick={() => setExpanded((v) => !v)} className="shrink-0 text-xs text-[#4879f8] hover:underline">
            {expanded ? "Show less" : "See all"}
          </button>
        )}
      </div>
      <div className="flex flex-col">
        {visible.map((item, i) => (
          <div
            key={i}
            className={`flex items-center justify-between px-4 py-2.5 ${i < visible.length - 1 ? "border-b-[0.5px] border-dash-border-soft" : ""}`}
          >
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
  { label: "Last 7 days", durationMs: 7 * 24 * 60 * 60 * 1000, unit: "day" },
  { label: "Last 30 days", durationMs: 30 * 24 * 60 * 60 * 1000, unit: "day" },
  {
    label: "Last 12 months",
    durationMs: 365 * 24 * 60 * 60 * 1000,
    unit: "month",
  },
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

function parseHostFromSearch(searchStr?: string): string | undefined {
  const host = new URLSearchParams(searchStr || "").get("host")?.trim();
  return host || undefined;
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  const upper = code.toUpperCase();
  const A = 0x41;
  const REGIONAL_BASE = 0x1f1e6;
  return String.fromCodePoint(REGIONAL_BASE + (upper.charCodeAt(0) - A), REGIONAL_BASE + (upper.charCodeAt(1) - A));
}

let _regionDisplay: Intl.DisplayNames | null = null;
function getRegionDisplay(): Intl.DisplayNames | null {
  if (_regionDisplay) return _regionDisplay;
  if (typeof Intl === "undefined" || !("DisplayNames" in Intl)) return null;
  try {
    _regionDisplay = new Intl.DisplayNames(["en"], { type: "region" });
    return _regionDisplay;
  } catch {
    return null;
  }
}

function countryName(code: string): string {
  if (!code) return "Unknown";
  const upper = code.toUpperCase();
  try {
    const display = getRegionDisplay();
    return display?.of(upper) ?? upper;
  } catch {
    return upper;
  }
}

function DeviceIcon({ name, className }: { name: string; className?: string }) {
  const n = (name || "").toLowerCase();
  if (n.includes("mobile") || n.includes("phone")) return <Smartphone className={className} />;
  if (n.includes("tablet")) return <Tablet className={className} />;
  if (n.includes("tv")) return <Tv className={className} />;
  return <Monitor className={className} />;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);

  if (abs >= 10_000) {
    return COMPACT_NUMBER_FORMATTER.format(value);
  }

  return GROUPED_NUMBER_FORMATTER.format(value);
}

type PerfKind = "lcp" | "fcp" | "inp" | "ttfb" | "cls";

function formatPerf(metric: AnalyticsPerformanceMetric, kind: PerfKind): AnimatedStatValue {
  if (!metric || metric.samples === 0 || metric.p75 == null) {
    return { value: null, unit: "", decimals: 0 };
  }

  const v = metric.p75;

  switch (kind) {
    case "lcp":
    case "fcp":
      return { value: v / 1000, unit: "s", decimals: 1 };
    case "inp":
    case "ttfb":
      return { value: v, unit: "ms", decimals: 0 };
    case "cls":
      return { value: v, unit: "", decimals: 2 };
  }
}

function bouncePercent(summary: AnalyticsSummary): string {
  const rate = summary.bounceRate?.value;
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function AppAnalytics({ initial, projectId }: { initial: AnalyticsPayload; projectId: string }) {
  const navigate = useNavigate({ from: "/projects/$projectId/web-analytics" });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const hostFromSearch = useMemo(() => parseHostFromSearch(searchStr), [searchStr]);
  const haptics = useHaptics();
  const getAnalytics = useServerFn(getAnalyticsServerFn as any) as (args: {
    data: {
      projectId: string;
      startAt: number;
      endAt: number;
      unit?: string;
      timezone?: string;
      host?: string;
    };
  }) => Promise<AnalyticsLoadResult>;

  const [data, setData] = useState<AnalyticsPayload>(initial);
  const [preset, setPreset] = useState<RangePreset>(RANGE_PRESETS[1]);
  const [visitorTab, setVisitorTab] = useState<"Visitors" | "Page Views">("Visitors");
  const [browserTab, setBrowserTab] = useState<"Browsers" | "Devices">("Browsers");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [hostOpen, setHostOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const autoHostAppliedRef = useRef(false);
  const taggedDomains = useMemo(
    () =>
      (Array.isArray(data.domains) ? data.domains : [])
        .filter((entry) => typeof entry?.host === "string" && entry.host.trim().length > 0)
        .map((entry) => ({
          host: entry.host.trim(),
          pageviews: Number(entry.pageviews ?? 0),
        })),
    [data.domains],
  );
  const domainOptions = useMemo(() => {
    if (taggedDomains.length > 0) {
      return taggedDomains;
    }

    const fallbackHost = data.domain?.trim();
    if (!fallbackHost) {
      return [];
    }

    return [
      {
        host: fallbackHost,
        pageviews: Number(data.summary?.pageviews?.value ?? 0),
      },
    ];
  }, [data.domain, data.summary?.pageviews?.value, taggedDomains]);

  useEffect(() => {
    setData(initial);
  }, [initial]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) {
        setPeriodOpen(false);
      }
      if (hostRef.current && !hostRef.current.contains(e.target as Node)) {
        setHostOpen(false);
      }
    }
    if (periodOpen || hostOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [hostOpen, periodOpen]);

  const updateHostSearchParam = useCallback(
    (nextHost?: string) => {
      void navigate({
        search: (prev: Record<string, unknown>) => {
          const next: Record<string, unknown> = { ...(prev || {}) };
          if (nextHost) {
            next.host = nextHost;
          } else {
            delete next.host;
          }
          return next;
        },
        replace: true,
      });
    },
    [navigate],
  );

  const refetch = useCallback(
    async (options?: { preset?: RangePreset; host?: string }) => {
      const p = options?.preset ?? preset;
      const host = options?.host ?? hostFromSearch;
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
            host,
          },
        });
        if (result.state === "enabled") {
          setData(result.data);
        } else if (result.state === "error") {
          toast.error(result.message);
        }
      } catch (error) {
        toast.error(friendlyAnalyticsError(error).message);
      }
    },
    [getAnalytics, hostFromSearch, preset, projectId],
  );

  useEffect(() => {
    let cancelled = false;

    async function syncHostFromUrl() {
      if (hostFromSearch === data.filteredHost) {
        return;
      }

      setRefetching(true);
      try {
        await refetch({ host: hostFromSearch });
      } finally {
        if (!cancelled) {
          setRefetching(false);
        }
      }
    }

    void syncHostFromUrl();

    return () => {
      cancelled = true;
    };
  }, [data.filteredHost, hostFromSearch, refetch]);

  useEffect(() => {
    if (autoHostAppliedRef.current) {
      return;
    }
    if (hostFromSearch) {
      autoHostAppliedRef.current = true;
      return;
    }
    if (taggedDomains.length !== 1) {
      return;
    }
    const onlyHost = taggedDomains[0]?.host?.trim();
    if (!onlyHost) {
      return;
    }
    if (data.filteredHost === onlyHost) {
      autoHostAppliedRef.current = true;
      return;
    }
    autoHostAppliedRef.current = true;
    updateHostSearchParam(onlyHost);
  }, [data.filteredHost, hostFromSearch, taggedDomains, updateHostSearchParam]);

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
      await refetch({
        preset: next,
        host: hostFromSearch,
      });
    } finally {
      setRefetching(false);
    }
  }

  function handleHostChange(nextHost?: string) {
    const normalizedCurrent = hostFromSearch?.trim() || undefined;
    const normalizedNext = nextHost?.trim() || undefined;

    if (normalizedCurrent === normalizedNext) {
      setHostOpen(false);
      return;
    }

    haptics.selection();
    setHostOpen(false);
    setRefetching(true);
    updateHostSearchParam(normalizedNext);
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

  const chartPoints = visitorTab === "Page Views" ? data.pageviews.pageviews : data.pageviews.sessions;

  const browserOptions = data.metrics.browser;
  const deviceOptions = data.metrics.device;
  const activeBreakdown = browserTab === "Browsers" ? browserOptions : deviceOptions;

  const chartLabel = visitorTab === "Page Views" ? "Page views" : "Visitors";
  const chartTotal = visitorTab === "Page Views" ? summary.pageviews.value : summary.visitors.value;
  const allDomainsCount = useMemo(() => {
    const summed = domainOptions.reduce((total, domain) => {
      const next = Number(domain.pageviews ?? 0);
      return total + (Number.isFinite(next) ? next : 0);
    }, 0);

    return summed > 0 ? summed : Number(summary.pageviews.value ?? 0);
  }, [domainOptions, summary.pageviews.value]);
  const selectedHost =
    data.filteredHost ?? (hostFromSearch && domainOptions.some((item) => item.host === hostFromSearch) ? hostFromSearch : undefined);
  const selectedDomain = domainOptions.find((item) => item.host === selectedHost);
  const pageSpeedHost = (selectedDomain?.host || data.domain || "").trim();
  const pageSpeedTarget = pageSpeedHost.length > 0 ? `https://${pageSpeedHost.replace(/^https?:\/\//i, "")}` : "";
  const pageSpeedUrl = pageSpeedTarget ? `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(pageSpeedTarget)}` : null;
  const hasFilteredEmptyState = Boolean(data.filteredHost) && summary.pageviews.value === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <TabHeader title="Web analytics | Live">
            Track visitor activity, top pages, and traffic sources.
            {pageSpeedUrl ? (
              <>
                {" "}
                <a
                  href={pageSpeedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-1 text-[#4879f8] no-underline hover:underline"
                >
                  Open in PageSpeed Insights
                  <span className="inline-flex w-0 overflow-hidden opacity-0 transition-all duration-150 group-hover:w-3.5 group-hover:opacity-100">
                    <ArrowUpRight className="size-3.5" />
                  </span>
                </a>
              </>
            ) : null}
          </TabHeader>
        </div>
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
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
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

      <div className="flex flex-col gap-6 overflow-hidden rounded-[4px] bg-[#0a1430] px-5 py-6 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:pl-7 sm:pr-10 sm:py-7">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[1.5px] text-[#cfe0ff]/70">Analytics:</span>
          <p className="text-xs font-light leading-[1.4] text-[#cfe0ff]/50">
            Quick view summary for what&apos;s going on
            <br />
            with &lsquo;{data.domain}&rsquo;.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-4 sm:flex sm:w-auto sm:flex-nowrap sm:gap-10">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2.5">
              <UsersThree className="size-6 shrink-0 text-[#cfe0ff]" weight="duotone" />
              <span className="text-[32px] font-light leading-none text-[#cfe0ff] sm:text-[44px]">
                {formatNumber(summary.visitors.value)}
              </span>
            </div>
            <span className="pl-[34px] text-[9px] font-medium uppercase tracking-[1px] text-[#cfe0ff]/50">Unique Visitors</span>
          </div>
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2.5">
              <GlobeHemisphereWest className="size-6 shrink-0 text-[#cfe0ff]" weight="duotone" />
              <span className="text-[32px] font-light leading-none text-[#cfe0ff] sm:text-[44px]">{formatNumber(countriesCount)}</span>
            </div>
            <span className="pl-[34px] text-[9px] font-medium uppercase tracking-[1px] text-[#cfe0ff]/50">Countries</span>
          </div>
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2.5">
              <ArrowBendUpLeft className="size-6 shrink-0 text-[#cfe0ff]" weight="duotone" />
              <span className="text-[32px] font-light leading-none text-[#cfe0ff] sm:text-[44px]">{bounce}</span>
            </div>
            <span className="pl-[34px] text-[9px] font-medium uppercase tracking-[1px] text-[#cfe0ff]/50">Bounce rate</span>
          </div>
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2.5">
              <motion.span
                className="size-2.5 shrink-0 rounded-full bg-[#22c55e]"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <span className="text-[32px] font-light leading-none text-[#cfe0ff] sm:text-[44px]">{formatNumber(visitorsRightNow)}</span>
            </div>
            <span className="pl-[22px] text-[9px] font-medium uppercase tracking-[1px] text-[#cfe0ff]/50">Visitors right now</span>
          </div>
        </div>
      </div>

      <div className="rounded-[4px] border-[0.5px] border-dash-border p-5">
        <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-light text-dash-text-faded">{chartLabel}</p>
            <span className="text-[32px] font-medium leading-tight tracking-tight text-dash-text-strong">{formatNumber(chartTotal)}</span>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <SegmentedToggle
              options={["Visitors", "Page Views"]}
              value={visitorTab}
              onChange={(v) => setVisitorTab(v as "Visitors" | "Page Views")}
            />
            {domainOptions.length > 0 ? (
              <div ref={hostRef} className="relative">
                <button
                  type="button"
                  onClick={() => setHostOpen((open) => !open)}
                  disabled={refetching}
                  className="flex w-full items-center justify-between gap-1.5 rounded-[4px] border-[0.5px] border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text-strong sm:w-auto sm:justify-start"
                >
                  {selectedDomain
                    ? `${selectedDomain.host} · ${formatNumber(selectedDomain.pageviews)}`
                    : `All domains · ${formatNumber(allDomainsCount)}`}
                  <ChevronDown className={`size-3 transition-transform ${hostOpen ? "rotate-180" : ""}`} />
                </button>
                {hostOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => void handleHostChange(undefined)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors ${
                        !selectedHost ? "font-medium text-[#4879f8]" : "font-light text-dash-text-body hover:bg-dash-bg-elevated"
                      }`}
                    >
                      <span>All domains</span>
                      <span className="shrink-0 text-dash-text-extra-faded">· {formatNumber(allDomainsCount)}</span>
                    </button>
                    {domainOptions.map((domain) => (
                      <button
                        type="button"
                        key={domain.host}
                        onClick={() => void handleHostChange(domain.host)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors ${
                          selectedHost === domain.host
                            ? "font-medium text-[#4879f8]"
                            : "font-light text-dash-text-body hover:bg-dash-bg-elevated"
                        }`}
                      >
                        <span className="truncate">{domain.host}</span>
                        <span className="shrink-0 text-dash-text-extra-faded">· {formatNumber(domain.pageviews)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            <div ref={periodRef} className="relative">
              <button
                onClick={() => setPeriodOpen(!periodOpen)}
                disabled={refetching}
                className="flex w-full items-center justify-between gap-1.5 rounded-[4px] border-[0.5px] border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text-strong sm:w-auto sm:justify-start"
              >
                {refetching ? "Loading..." : preset.label}
                <ChevronDown className={`size-3 transition-transform ${periodOpen ? "rotate-180" : ""}`} />
              </button>
              {periodOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-lg">
                  {RANGE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => void handlePresetChange(p)}
                      className={`flex w-full px-3 py-2 text-left text-xs transition-colors ${
                        p.label === preset.label ? "font-medium text-[#4879f8]" : "font-light text-dash-text-body hover:bg-dash-bg-elevated"
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
        <VisitorBarChart points={chartPoints} unit={data.range.unit} seriesLabel={chartLabel} />
      </div>

      {hasFilteredEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-[4px] border-[0.5px] border-dash-border px-6 py-16 text-center">
          <img src="/icons/traffic.svg" alt="" className="size-12 opacity-70 dark:opacity-60 dark:invert" />
          <div className="flex max-w-[420px] flex-col gap-1">
            <p className="text-sm font-medium text-dash-text-strong">No traffic from {data.filteredHost} in this date range</p>
            <p className="text-xs font-light text-dash-text-faded">Try a wider window, or look at every domain on this project.</p>
          </div>
          <button
            type="button"
            onClick={() => void handleHostChange(undefined)}
            className="rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg px-3 py-1.5 text-xs font-medium text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
          >
            View all domains
          </button>
        </div>
      ) : (
        <>
          <VisitorsMap
            countries={data.metrics.country.map((c) => ({
              code: c.x,
              visitors: c.y,
            }))}
          />

          <div className="flex flex-col rounded-[4px] border-[0.5px] border-dash-border">
            <div className="border-b-[0.5px] border-dash-border px-4 py-3">
              <h3 className="text-sm font-medium text-dash-text-strong">Page performance</h3>
              <p className="text-xs font-light text-dash-text-faded">Core Web Vitals (p75) over this window</p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-3 md:grid-cols-5">
              <StatTile label="LCP" stat={formatPerf(data.performance.lcp, "lcp")} />
              <StatTile label="FCP" stat={formatPerf(data.performance.fcp, "fcp")} />
              <StatTile label="INP" stat={formatPerf(data.performance.inp, "inp")} />
              <StatTile label="TTFB" stat={formatPerf(data.performance.ttfb, "ttfb")} />
              <StatTile label="CLS" stat={formatPerf(data.performance.cls, "cls")} />
            </div>
            <div className="flex items-center justify-between border-t-[0.5px] border-dash-border-soft px-5 py-3 text-xs">
              <span className="text-dash-text-faded">Average load time</span>
              <span className="font-medium text-dash-text-strong">
                <CounterValue
                  stat={{
                    value: data.performance.avgLoadTime != null ? data.performance.avgLoadTime / 1000 : null,
                    unit: "s",
                    decimals: 1,
                  }}
                />
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row">
            <ListCard
              title="Top pages"
              subtitle="Most visited pages"
              showSeeAll
              items={data.metrics.path.map((p) => ({
                label: p.x,
                value: `${formatNumber(p.y)} views`,
              }))}
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
                label: countryName(c.x),
                icon: countryFlag(c.x),
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
                      <div className="flex min-w-0 items-center gap-2">
                        {browserTab === "Browsers" ? (
                          <BrowserIcon name={item.x} className="size-4 shrink-0" />
                        ) : (
                          <DeviceIcon name={item.x} className="size-4 shrink-0 text-dash-text-faded" />
                        )}
                        <span className="truncate text-sm font-light text-dash-text-body">{item.x}</span>
                      </div>
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
            items={data.metrics.event.map((e) => ({
              label: e.x,
              value: formatNumber(e.y),
            }))}
          />

          <TrafficHeatmap grid={data.trafficByHour} />
        </>
      )}

      <InstallTrackingModal
        open={installOpen}
        onOpenChange={setInstallOpen}
        siteId={data.websiteId}
        snippets={data.snippets}
        serverSnippet={data.snippet}
      />
    </div>
  );
}

function ObservabilityPage() {
  const { project, workspace } = parentRoute.useLoaderData() as any;
  const { metrics } = Route.useLoaderData();
  const plan = usePlanGate();
  if (!shouldShowProjectObservabilityTab(project)) {
    return (
      <div className="mx-auto flex max-w-[1000px] flex-col gap-4 px-4 py-8 sm:px-0">
        <TabHeader title="Metrics & Observability">Observability is not available for static projects.</TabHeader>
      </div>
    );
  }
  if (plan.analytics === false) {
    return (
      <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-0">
        <TabHeader title="Metrics & Observability">Monitor your app's key metrics and health.</TabHeader>
        <PlanUpgradePrompt feature="Observability" description="Upgrade to a higher plan to monitor your app's metrics." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-0">
      <AppMetrics project={project} initialMetrics={metrics} workspace={workspace} />
    </div>
  );
}
