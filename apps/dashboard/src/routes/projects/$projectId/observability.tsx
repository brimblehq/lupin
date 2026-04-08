import { useState, useRef, useEffect, useMemo } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown } from "lucide-react";
import { Archive } from "@phosphor-icons/react";
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

const visitorData = [
  { month: "JAN", value: 14 },
  { month: "FEB", value: 108 },
  { month: "MAR", value: 166 },
  { month: "APR", value: 55 },
  { month: "MAY", value: 137 },
  { month: "JUN", value: 14 },
  { month: "JUL", value: 76 },
  { month: "AUG", value: 55 },
  { month: "SEP", value: 183 },
  { month: "OCT", value: 89 },
  { month: "NOV", value: 154 },
  { month: "DEC", value: 13 },
];

const topPages = [
  { path: "/about", visitors: 148 },
  { path: "/blog", visitors: 148 },
  { path: "/home", visitors: 148 },
];

const funnelSources = [
  { name: "Asana", icon: "🔷", visitors: 148 },
  { name: "Confluence", icon: "🔵", visitors: 148 },
  { name: "LinkedIn", icon: "🔗", visitors: 148 },
  { name: "Google.com", icon: "🔍", visitors: 148 },
];

const countries = [
  { name: "Nigeria", flag: "🇳🇬", visitors: 148 },
  { name: "United States", flag: "🇺🇸", visitors: 148 },
  { name: "Canada", flag: "🇨🇦", visitors: 148 },
  { name: "Mexico", flag: "🇲🇽", visitors: 148 },
  { name: "Botswana", flag: "🇧🇼", visitors: 148 },
];

const browsers = [
  { name: "Chrome", visitors: 148 },
  { name: "Mozilla Firefox", visitors: 148 },
  { name: "Arc", visitors: 148 },
  { name: "Edge", visitors: 148 },
  { name: "Safari", visitors: 148 },
];

const devices = [
  { name: "Desktop", visitors: 3200 },
  { name: "Mobile", visitors: 1400 },
  { name: "Tablet", visitors: 300 },
];

function MiniSparkline({ className, color = "#fff" }: { className?: string; color?: string }) {
  const points = [2, 8, 5, 12, 7, 18, 14, 22, 16, 28, 20, 35];
  const max = Math.max(...points);
  const h = 40;
  const w = 120;
  const d = points
    .map((v, i) => `${(i / (points.length - 1)) * w},${h - (v / max) * (h - 4)}`)
    .join(" L ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} fill="none">
      <polyline points={d} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function MiniSkyline({ className }: { className?: string }) {
  const bars = [
    6, 8, 10, 14, 18, 22, 26, 30, 32, 34, 32, 30, 33, 31, 34, 32, 30, 28, 30,
    32, 30, 28, 26, 28, 26, 24, 22, 24, 26, 22, 20, 22, 24, 22, 20, 18, 16, 14,
    12, 10,
  ];
  const max = Math.max(...bars);
  const h = 40;
  const w = 200;
  const barW = w / bars.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none">
      {bars.map((v, i) => {
        const barH = (v / max) * h;
        return (
          <rect
            key={i}
            x={i * barW}
            y={h - barH}
            width={barW - 0.5}
            height={barH}
            fill="#9cc1ff"
          />
        );
      })}
    </svg>
  );
}

function VisitorBarChart() {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...visitorData.map((d) => d.value), 1);
  const barH = 320;
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, margin: "-80px" });

  return (
    <div ref={containerRef} className="scrollbar-hidden mt-6 overflow-x-auto">
      <div className="flex min-w-[540px] gap-0 sm:min-w-0">
        {visitorData.map((d, i) => {
          const pct = d.value / max;
          const valH = Math.max(pct * barH, 6);
          const isActive = hovered === i;

          return (
            <div
              key={d.month}
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
                    delay: 0.08 * i,
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
              </div>

              <span
                className={`text-[11px] font-medium tracking-wide transition-colors ${
                  isActive
                    ? "text-dash-text-strong"
                    : "text-dash-text-extra-faded"
                }`}
              >
                {d.month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListCard({ title, subtitle, items, showSeeAll }: { title: string; subtitle?: string; items: { label: string; icon?: string; value: string }[]; showSeeAll?: boolean }) {
  return (
    <div className="flex flex-1 flex-col rounded-[4px] border-[0.5px] border-dash-border">
      <div className="flex items-start justify-between gap-3 border-b-[0.5px] border-dash-border px-4 py-3">
        <div>
          <h3 className="text-sm font-medium text-dash-text-strong">{title}</h3>
          {subtitle && <p className="text-xs font-light text-dash-text-faded">{subtitle}</p>}
        </div>
        {showSeeAll && <button className="shrink-0 text-xs text-[#4879f8] hover:underline">See all</button>}
      </div>
      <div className="flex flex-col">
        {items.map((item, i) => (
          <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${i < items.length - 1 ? "border-b-[0.5px] border-dash-border-soft" : ""}`}>
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

const analyticsPeriods = [
  "Last 7 days",
  "Last 14 days",
  "Last 30 days",
  "Last 90 days",
];

export function AppAnalytics() {
  const [visitorTab, setVisitorTab] = useState("Visitors");
  const [browserTab, setBrowserTab] = useState("Browsers");
  const [analyticsPeriod, setAnalyticsPeriod] = useState("Last 7 days");
  const [periodOpen, setPeriodOpen] = useState(false);
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

  return (
    <div className="flex flex-col gap-6">
      <TabHeader title="Web analytics">
        Track visitor activity, top pages, and traffic sources.{" "}
        <a href="#" className="text-[#4879f8] underline">
          Learn more
        </a>
      </TabHeader>

      <div className="flex flex-col gap-6 overflow-hidden rounded-[4px] bg-[#0a1430] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:pl-7 sm:pr-10 sm:py-7">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[1.5px] text-[#cfe0ff]/70">
            Analytics TLDR:
          </span>
          <p className="text-xs font-light leading-[1.4] text-[#cfe0ff]/50">
            Quick view summary for what's going on
            <br />
            with &lsquo;kemdrim.brimble.app&rsquo;.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-6 sm:w-auto sm:flex-nowrap sm:gap-10">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2.5">
              <Archive className="size-6 shrink-0 text-[#cfe0ff]" weight="fill" />
              <span className="text-[44px] font-light leading-none text-[#cfe0ff]">322</span>
            </div>
            <span className="pl-[34px] text-[9px] font-medium uppercase tracking-[1px] text-[#cfe0ff]/50">
              Unique Visitors
            </span>
          </div>
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2.5">
              <Archive className="size-6 shrink-0 text-[#cfe0ff]" weight="fill" />
              <span className="text-[44px] font-light leading-none text-[#cfe0ff]">21</span>
            </div>
            <span className="pl-[34px] text-[9px] font-medium uppercase tracking-[1px] text-[#cfe0ff]/50">
              Countries
            </span>
          </div>
          <div className="flex flex-col items-stretch gap-1">
            <MiniSkyline className="h-10 w-[180px] sm:w-[260px]" />
            <div className="flex items-center justify-between text-[9px] font-medium uppercase tracking-[0.5px] text-[#cfe0ff]/40">
              <span>31 Jul 2024</span>
              <span>31 Jul 2024</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[4px] border-[0.5px] border-dash-border p-5">
        <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-light text-dash-text-faded">Site Visitors</p>
            <span className="text-[32px] font-medium leading-tight tracking-tight text-dash-text-strong">4,900,442</span>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <SegmentedToggle options={["Visitors", "Page Views"]} value={visitorTab} onChange={setVisitorTab} />
            <div ref={periodRef} className="relative">
              <button
                onClick={() => setPeriodOpen(!periodOpen)}
                className="flex w-full items-center justify-between gap-1.5 rounded-[4px] border-[0.5px] border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text-strong sm:w-auto sm:justify-start"
              >
                {analyticsPeriod}
                <ChevronDown
                  className={`size-3 transition-transform ${periodOpen ? "rotate-180" : ""}`}
                />
              </button>
              {periodOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-lg">
                  {analyticsPeriods.map((period) => (
                    <button
                      key={period}
                      onClick={() => {
                        setAnalyticsPeriod(period);
                        setPeriodOpen(false);
                      }}
                      className={`flex w-full px-3 py-2 text-left text-xs transition-colors ${
                        period === analyticsPeriod
                          ? "font-medium text-[#4879f8]"
                          : "font-light text-dash-text-body hover:bg-dash-bg-elevated"
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <VisitorBarChart />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <ListCard title="Top pages" subtitle="Most visited pages" showSeeAll items={topPages.map((p) => ({ label: p.path, value: `${p.visitors} Visitors` }))} />
        <ListCard title="Funnel" subtitle="Where your visitors have come from" items={funnelSources.map((s) => ({ label: s.name, icon: s.icon, value: String(s.visitors) }))} />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <ListCard title="Countries" subtitle="Pages with the highest amount of visitors" showSeeAll items={countries.map((c) => ({ label: c.name, icon: c.flag, value: `${c.visitors} Visitors` }))} />
        <div className="flex flex-1 flex-col rounded-[4px] border-[0.5px] border-dash-border">
          <div className="flex flex-col gap-2 border-b-[0.5px] border-dash-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-medium text-dash-text-strong">Browser & Device Information</h3>
            <SegmentedToggle options={["Browsers", "Devices"]} value={browserTab} onChange={setBrowserTab} />
          </div>
          <div className="flex flex-col">
            {(browserTab === "Browsers" ? browsers : devices).map((item, i, arr) => (
              <div key={item.name} className={`flex items-center justify-between px-4 py-2.5 ${i < arr.length - 1 ? "border-b-[0.5px] border-dash-border-soft" : ""}`}>
                <span className="text-sm font-light text-dash-text-body">{item.name}</span>
                <span className="text-xs text-dash-text-faded">{item.visitors}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
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
