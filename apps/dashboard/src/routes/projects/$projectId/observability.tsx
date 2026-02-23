import { useState, useRef, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { TabHeader } from "../../../components/shared/tab-header";

export const Route = createFileRoute("/projects/$projectId/observability")({
  component: ObservabilityPage,
});

/* ─────────────────────────────────────────────
   Shared components
   ───────────────────────────────────────────── */

function SegmentedToggle({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center rounded-[4px] border-[0.5px] border-dash-border p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`rounded-[3px] px-3 py-1 text-xs font-medium transition-colors ${
            opt === value
              ? "bg-dash-bg-elevated text-dash-text-strong"
              : "text-dash-text-faded hover:text-dash-text-body"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/** Hatched bar chart — diagonal-line background + solid orange value bars */
function TimeSeriesChart({
  data,
  yUnit = "",
}: {
  data: { time: string; value: number }[];
  yUnit?: string;
  color?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1) * 1.15;
  const barH = 260;

  return (
    <div>
      <div className="flex items-end gap-[2px]">
        {data.map((d, i) => {
          const pct = d.value / max;
          const valH = Math.max(pct * barH, 4);
          const isActive = hovered === i;

          return (
            <div
              key={i}
              className="group flex flex-1 flex-col items-center"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip on hover */}
              <div className="relative mb-1.5 flex h-5 items-center justify-center">
                {isActive && (
                  <span className="whitespace-nowrap rounded bg-dash-text-strong px-1.5 py-0.5 font-logs text-[10px] font-medium text-dash-bg">
                    {d.value.toFixed(1)} {yUnit}
                  </span>
                )}
              </div>

              {/* Bar */}
              <div
                className="relative w-full overflow-hidden rounded-[3px]"
                style={{ height: barH }}
              >
                {/* Hatched background */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: "var(--color-dash-bg-elevated)",
                    backgroundImage:
                      "repeating-linear-gradient(-45deg, transparent, transparent 3.5px, var(--color-dash-border-soft) 3.5px, var(--color-dash-border-soft) 4px)",
                  }}
                />

                {/* Value bar */}
                <div
                  className="absolute inset-x-0 bottom-0 transition-all duration-150"
                  style={{ height: valH }}
                >
                  <div
                    className="size-full"
                    style={{
                      backgroundColor: "#ff7a00",
                      opacity: isActive ? 1 : 0.3,
                    }}
                  />
                  {isActive && (
                    <div
                      className="absolute inset-x-0 top-0 -translate-y-full"
                      style={{ height: 8, backgroundColor: "#ffa800" }}
                    />
                  )}
                </div>
              </div>

              {/* Time label */}
              <span
                className={`mt-2 text-[10px] transition-colors ${
                  isActive
                    ? "font-medium text-dash-text-strong"
                    : "text-dash-text-extra-faded"
                }`}
              >
                {d.time}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Semi-circular tick gauge (green→red, radial lines clipped to arc band) */

const TICK_COUNT = 24;
const G = 118; // center of the 236×236 coordinate space
const OUTER_R = 108; // outer edge of the arc band
const INNER_R = 78; // inner edge of the arc band
const LINE_W = 3.5; // stroke width of each radial line

/* 24 colors: green (left) → yellow → orange → red (right) */
const TICK_COLORS = [
  "#22c55e", "#2dd46b", "#3ee377", "#5bea8a", "#78f29e",
  "#9ae53b", "#b5e840", "#cdec44", "#e5d030", "#f0c020",
  "#f5b020", "#f5a623", "#f09418", "#eb7d15", "#e86b11",
  "#e5590e", "#e04a0c", "#dc3c0a", "#d63027", "#d02824",
  "#cc2222", "#c41e1e", "#bb1a1a", "#b01616",
];

function SemiGauge({
  value,
  max,
  label,
  valueLabel,
  title,
  subtitle,
}: {
  value: number;
  max: number;
  label: string;
  valueLabel: string;
  title: string;
  subtitle: string;
}) {
  const activeTicks = Math.round((Math.min(value, max) / max) * TICK_COUNT);

  /* Build radial lines: each is a line from well beyond center to well beyond outer edge,
     clipped by a semicircular ring (donut top half). Angles go from 180° (left) to 0° (right). */
  const lines = Array.from({ length: TICK_COUNT }, (_, i) => {
    const angleDeg = 180 - (i / (TICK_COUNT - 1)) * 180;
    const angleRad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    // Extend line well beyond center and outer edge so clip handles it
    const len = OUTER_R + 30;
    return {
      x1: G - len * cos,
      y1: G + len * sin,
      x2: G + len * cos,
      y2: G - len * sin,
      index: i,
    };
  });

  return (
    <div className="flex flex-1 flex-col rounded-[4px] border-[0.5px] border-dash-border-soft bg-dash-bg">
      {/* Header */}
      <div className="flex h-[72px] items-center border-b-[0.5px] border-dash-border-soft px-5">
        <div>
          <h3 className="text-sm text-dash-text-body">{title}</h3>
          <p className="text-sm font-light text-dash-text-faded">{subtitle}</p>
        </div>
      </div>

      {/* Body: gauge + info */}
      <div className="flex items-center px-5 py-6">
        <div className="shrink-0">
          <svg
            width="200"
            height="110"
            viewBox="0 0 236 130"
            fill="none"
          >
            <defs>
              {/* Semicircular ring mask — only the top-half donut band is visible */}
              <clipPath id={`gauge-clip-${label}`}>
                {/* Outer semicircle (top half) */}
                <path
                  d={`M ${G - OUTER_R},${G} A ${OUTER_R},${OUTER_R} 0 0,1 ${G + OUTER_R},${G} L ${G + INNER_R},${G} A ${INNER_R},${INNER_R} 0 0,0 ${G - INNER_R},${G} Z`}
                />
              </clipPath>
            </defs>

            <g clipPath={`url(#gauge-clip-${label})`}>
              {lines.map((line) => {
                const isActive = line.index < activeTicks;
                return (
                  <line
                    key={line.index}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke={isActive ? TICK_COLORS[line.index] : "var(--color-dash-border-soft)"}
                    strokeWidth={LINE_W}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          </svg>
        </div>

        <div className="ml-5 border-l border-[#ebebeb] pl-5 dark:border-dash-border">
          <span className="block text-base text-dash-text-strong">{label}</span>
          <span className="block font-logs text-sm text-dash-text-faded">{valueLabel}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   App Metrics mock data
   ───────────────────────────────────────────── */

function generateTimeSeries(
  count: number,
  minV: number,
  maxV: number,
  startHour = 16,
  startMin = 26,
  spike?: { at: number; multiplier: number }
) {
  const result: { time: string; value: number }[] = [];
  for (let i = 0; i < count; i++) {
    const totalMin = startHour * 60 + startMin + i * 5;
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    let val = minV + Math.random() * (maxV - minV);
    if (spike && Math.abs(i - spike.at) < 4) {
      val *= spike.multiplier * (1 - Math.abs(i - spike.at) * 0.2);
    }
    result.push({
      time: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
      value: val,
    });
  }
  return result;
}

const memoryData = generateTimeSeries(24, 0.3, 1.8, 16, 26, { at: 8, multiplier: 3 });
const cpuData = generateTimeSeries(24, 5, 35, 16, 26, { at: 10, multiplier: 4 });
const networkData = generateTimeSeries(24, 0.4, 3.5, 16, 26, { at: 7, multiplier: 8 });

const responseP90 = generateTimeSeries(24, 80, 200, 16, 26, { at: 12, multiplier: 2.5 });
const responseP95 = generateTimeSeries(24, 100, 280, 16, 26, { at: 12, multiplier: 2.5 });
const responseP99 = generateTimeSeries(24, 150, 400, 16, 26, { at: 12, multiplier: 2 });
const responseAvg = generateTimeSeries(24, 40, 120, 16, 26, { at: 12, multiplier: 2 });

const metricCharts = {
  "Memory Usage": { data: memoryData, unit: "GB" },
  "CPU Usage": { data: cpuData, unit: "%" },
  "Network Egress": { data: networkData, unit: "KB/s" },
  "Response Times": { data: responseP90, unit: "ms" },
} as const;

type MetricChart = keyof typeof metricCharts;

const responseTimeSeries: Record<string, { time: string; value: number }[]> = {
  P90: responseP90,
  P95: responseP95,
  P99: responseP99,
  Average: responseAvg,
};

/* ─────────────────────────────────────────────
   App Analytics mock data
   ───────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────
   Analytics sub-components
   ───────────────────────────────────────────── */

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

function VisitorBarChart() {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...visitorData.map((d) => d.value), 1);
  const barH = 240; // max bar height in px

  return (
    <div className="mt-6">
      <div className="flex gap-0">
        {visitorData.map((d, i) => {
          const pct = d.value / max;
          const valH = Math.max(pct * barH, 6); // min 6px so tiny values are visible
          const isActive = hovered === i;

          return (
            <div
              key={d.month}
              className="flex flex-1 flex-col items-center gap-2"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Bar container */}
              <div
                className="relative w-full overflow-hidden rounded-[4px]"
                style={{ height: barH }}
              >
                {/* Hatched background (full height) */}
                <div
                  className="absolute inset-0 rounded-[4px]"
                  style={{
                    backgroundColor: "var(--color-dash-bg-elevated)",
                    backgroundImage:
                      "repeating-linear-gradient(-45deg, transparent, transparent 4px, var(--color-dash-border-soft) 4px, var(--color-dash-border-soft) 4.5px)",
                  }}
                />

                {/* Value bar (solid, anchored to bottom) */}
                <div
                  className="absolute inset-x-0 bottom-0 transition-all duration-150"
                  style={{ height: valH }}
                >
                  <div
                    className="size-full"
                    style={{
                      backgroundColor: "#ff7a00",
                      opacity: isActive ? 1 : 0.3,
                    }}
                  />
                  {/* Active cap */}
                  {isActive && (
                    <div
                      className="absolute inset-x-0 top-0 -translate-y-full"
                      style={{ height: 10, backgroundColor: "#ffa800" }}
                    />
                  )}
                </div>
              </div>

              {/* Month label */}
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
      <div className="flex items-center justify-between border-b-[0.5px] border-dash-border px-4 py-3">
        <div>
          <h3 className="text-sm font-medium text-dash-text-strong">{title}</h3>
          {subtitle && <p className="text-xs font-light text-dash-text-faded">{subtitle}</p>}
        </div>
        {showSeeAll && <button className="text-xs text-[#4879f8] hover:underline">See all</button>}
      </div>
      <div className="flex flex-col">
        {items.map((item, i) => (
          <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${i < items.length - 1 ? "border-b-[0.5px] border-dash-border-soft" : ""}`}>
            <div className="flex items-center gap-2">
              {item.icon && <span className="text-sm">{item.icon}</span>}
              <span className="text-sm font-light text-dash-text-body">{item.label}</span>
            </div>
            <span className="text-xs text-dash-text-faded">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Section: App Metrics
   ───────────────────────────────────────────── */

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

function AppMetrics() {
  const [activeChart, setActiveChart] = useState<MetricChart>("Memory Usage");
  const [responseMetric, setResponseMetric] = useState("P90");
  const [timeInterval, setTimeInterval] = useState("Last 1 Hour");

  const chartTabs: MetricChart[] = ["Memory Usage", "CPU Usage", "Network Egress", "Response Times"];

  const currentData =
    activeChart === "Response Times"
      ? responseTimeSeries[responseMetric]
      : metricCharts[activeChart].data;
  const currentUnit =
    activeChart === "Response Times" ? "ms" : metricCharts[activeChart].unit;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <TabHeader title="Metrics & Observability">
          Monitor your app's key metrics and health.
        </TabHeader>
        <TimeIntervalDropdown value={timeInterval} onChange={setTimeInterval} />
      </div>

      {/* CPU + Memory semi-circular gauges */}
      <div className="flex gap-4">
        <SemiGauge
          value={8}
          max={100}
          label="CPU"
          valueLabel="8%-4vCPU"
          title="CPU Usage"
          subtitle="Current processor utilization"
        />
        <SemiGauge
          value={10}
          max={100}
          label="Memory"
          valueLabel="1.6GB of 16GB"
          title="Memory usage"
          subtitle="Current memory consumption"
        />
      </div>

      {/* Chart tabs */}
      <div className="rounded-[4px] border-[0.5px] border-dash-border">
        <div className="flex items-center justify-between border-b-[0.5px] border-dash-border">
          <div className="flex">
            {chartTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveChart(tab)}
                className={`px-4 py-3 text-sm transition-colors ${
                  activeChart === tab
                    ? "border-b-2 border-[#f5a623] font-medium text-[#f5a623]"
                    : "font-light text-dash-text-faded hover:text-dash-text-body"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {activeChart === "Response Times" && (
            <div className="pr-4">
              <SegmentedToggle
                options={["P90", "P95", "P99", "Average"]}
                value={responseMetric}
                onChange={setResponseMetric}
              />
            </div>
          )}
        </div>
        <div className="px-5 pb-5 pt-8">
          <TimeSeriesChart data={currentData} yUnit={currentUnit} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Section: App Analytics
   ───────────────────────────────────────────── */

const analyticsPeriods = [
  "Last 7 days",
  "Last 14 days",
  "Last 30 days",
  "Last 90 days",
];

function AppAnalytics() {
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

      {/* TLDR Banner */}
      <div className="flex items-center justify-between overflow-hidden rounded-lg bg-gradient-to-r from-[#2d2b55] via-[#3b3875] to-[#2d2b55] px-6 py-5">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[1px] text-white/60">
            Analytics TLDR:
          </span>
          <p className="text-xs font-light leading-[1.4] text-white/50">
            Quick view summary for what's going on
            <br />
            with 'kemdrim.brimble.app'.
          </p>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-medium text-white">322</span>
            <span className="text-[9px] font-medium uppercase tracking-[0.5px] text-white/40">Unique Visitors</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-medium text-white">21</span>
            <span className="text-[9px] font-medium uppercase tracking-[0.5px] text-white/40">Countries</span>
          </div>
          <MiniSparkline className="h-10 w-[140px]" />
        </div>
      </div>

      {/* Site Visitors */}
      <div className="rounded-[4px] border-[0.5px] border-dash-border p-5">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <p className="text-sm font-light text-dash-text-faded">Site Visitors</p>
            <span className="text-[32px] font-medium leading-tight tracking-tight text-dash-text-strong">4,900,442</span>
          </div>
          <div className="flex items-center gap-3">
            <SegmentedToggle options={["Visitors", "Page Views"]} value={visitorTab} onChange={setVisitorTab} />
            <div ref={periodRef} className="relative">
              <button
                onClick={() => setPeriodOpen(!periodOpen)}
                className="flex items-center gap-1.5 rounded-[4px] border-[0.5px] border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text-strong"
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

      {/* Top pages + Funnel */}
      <div className="flex gap-4">
        <ListCard title="Top pages" subtitle="Most visited pages" showSeeAll items={topPages.map((p) => ({ label: p.path, value: `${p.visitors} Visitors` }))} />
        <ListCard title="Funnel" subtitle="Where your visitors have come from" items={funnelSources.map((s) => ({ label: s.name, icon: s.icon, value: String(s.visitors) }))} />
      </div>

      {/* Countries + Browser/Devices */}
      <div className="flex gap-4">
        <ListCard title="Countries" subtitle="Pages with the highest amount of visitors" showSeeAll items={countries.map((c) => ({ label: c.name, icon: c.flag, value: `${c.visitors} Visitors` }))} />
        <div className="flex flex-1 flex-col rounded-[4px] border-[0.5px] border-dash-border">
          <div className="flex items-center justify-between border-b-[0.5px] border-dash-border px-4 py-3">
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

/* ─────────────────────────────────────────────
   Main page
   ───────────────────────────────────────────── */

function ObservabilityPage() {
  const [section, setSection] = useState<"metrics" | "analytics">("metrics");

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 py-8">
      {/* Section toggle */}
      <div className="flex items-center gap-1 self-start rounded-[4px] border-[0.5px] border-dash-border p-0.5">
        <button
          onClick={() => setSection("metrics")}
          className={`rounded-[3px] px-4 py-1.5 text-sm font-medium transition-colors ${
            section === "metrics"
              ? "bg-dash-bg-elevated text-dash-text-strong"
              : "text-dash-text-faded hover:text-dash-text-body"
          }`}
        >
          App Metrics
        </button>
        <button
          onClick={() => setSection("analytics")}
          className={`rounded-[3px] px-4 py-1.5 text-sm font-medium transition-colors ${
            section === "analytics"
              ? "bg-dash-bg-elevated text-dash-text-strong"
              : "text-dash-text-faded hover:text-dash-text-body"
          }`}
        >
          App Analytics
        </button>
      </div>

      {section === "metrics" ? <AppMetrics /> : <AppAnalytics />}
    </div>
  );
}
