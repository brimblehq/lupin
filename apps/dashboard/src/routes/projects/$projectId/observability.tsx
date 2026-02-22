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

/** Reusable SVG line chart with vertical grid, y-axis labels, time x-axis */
function TimeSeriesChart({
  data,
  yUnit,
  color = "#f5a623",
}: {
  data: { time: string; value: number }[];
  yUnit: string;
  color?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1) * 1.15;
  const svgW = 800;
  const svgH = 360;
  const pad = { top: 8, bottom: 8, left: 0, right: 0 };
  const plotW = svgW - pad.left - pad.right;
  const plotH = svgH - pad.top - pad.bottom;

  const pts = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * plotW,
    y: pad.top + plotH - (d.value / max) * plotH,
  }));

  const linePath = "M " + pts.map((p) => `${p.x},${p.y}`).join(" L ");
  const areaPath =
    linePath +
    ` L ${pts[pts.length - 1].x},${svgH - pad.bottom} L ${pts[0].x},${svgH - pad.bottom} Z`;

  // Y-axis ticks
  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = (max / yTicks) * (yTicks - i);
    return { label: `${val.toFixed(1)} ${yUnit}`, y: pad.top + (i / yTicks) * plotH };
  });

  // X-axis: show first, middle, last
  const xIndices = [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <div>
      {/* Y labels */}
      <div className="relative">
        <div className="absolute -left-1 top-0 flex h-[360px] flex-col justify-between">
          {yLabels.map((t, i) => (
            <span key={i} className="text-[10px] text-dash-text-extra-faded">
              {t.label}
            </span>
          ))}
        </div>
      </div>
      <div className="pl-16">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="h-[360px] w-full" preserveAspectRatio="none">
          {/* Horizontal grid */}
          {yLabels.map((t, i) => (
            <line
              key={`hg-${i}`}
              x1={pad.left}
              y1={t.y}
              x2={svgW - pad.right}
              y2={t.y}
              stroke="currentColor"
              className="text-dash-border-soft"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="4 4"
            />
          ))}

          {/* Vertical grid */}
          {data.map((_, i) => {
            if (data.length > 20 && i % 5 !== 0) return null;
            const x = pad.left + (i / (data.length - 1)) * plotW;
            return (
              <line
                key={`vg-${i}`}
                x1={x}
                y1={pad.top}
                x2={x}
                y2={svgH - pad.bottom}
                stroke="currentColor"
                className="text-dash-border-soft"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill={color} opacity="0.06" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* End dot */}
          <circle
            cx={pts[pts.length - 1].x}
            cy={pts[pts.length - 1].y}
            r="4"
            fill={color}
            stroke="white"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* X-axis */}
        <div className="mt-1 flex justify-between">
          {xIndices.map((idx) => (
            <span key={idx} className="text-[10px] text-dash-text-extra-faded">
              {data[idx].time}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Donut ring gauge */
function DonutGauge({
  value,
  max,
  label,
  sublabel,
  color,
}: {
  value: number;
  max: number;
  label: string;
  sublabel: string;
  color: string;
}) {
  const pct = Math.min(value / max, 1);
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <div className="flex flex-1 items-center gap-5 rounded-[4px] border-[0.5px] border-dash-border p-5">
      <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
        {/* Background ring */}
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-dash-border-soft"
          strokeWidth="10"
        />
        {/* Value ring */}
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div>
        <h3 className="text-base font-medium text-dash-text-strong">{label}</h3>
        <p className="text-sm text-dash-text-faded">{sublabel}</p>
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
  { date: "21 Mar", value: 2 },
  { date: "22 Mar", value: 2 },
  { date: "23 Mar", value: 3 },
  { date: "24 Mar", value: 2 },
  { date: "25 Mar", value: 18 },
  { date: "26 Mar", value: 40 },
  { date: "27 Mar", value: 38 },
  { date: "28 Mar", value: 42 },
  { date: "29 Mar", value: 70 },
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

function VisitorChart() {
  const max = Math.max(...visitorData.map((d) => d.value), 1);
  const cols = visitorData.length;
  const pad = { top: 16, bottom: 16, left: 0, right: 0 };
  const svgW = 800;
  const svgH = 280;
  const plotW = svgW - pad.left - pad.right;
  const plotH = svgH - pad.top - pad.bottom;

  const points = visitorData.map((d, i) => ({
    x: pad.left + (i / (cols - 1)) * plotW,
    y: pad.top + plotH - (d.value / max) * plotH,
  }));

  const linePath = "M " + points.map((p) => `${p.x},${p.y}`).join(" L ");

  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="h-[280px] w-full" preserveAspectRatio="none">
        {visitorData.map((_, i) => {
          const x = pad.left + (i / (cols - 1)) * plotW;
          return (
            <line key={`vg-${i}`} x1={x} y1={pad.top} x2={x} y2={svgH - pad.bottom} stroke="currentColor" className="text-dash-border-soft" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          );
        })}
        <line x1={pad.left} y1={svgH - pad.bottom} x2={svgW - pad.right} y2={svgH - pad.bottom} stroke="currentColor" className="text-dash-border-soft" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={linePath} fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => {
          const prev = i > 0 ? visitorData[i - 1].value : visitorData[i].value;
          const curr = visitorData[i].value;
          const next = i < visitorData.length - 1 ? visitorData[i + 1].value : curr;
          if (Math.abs(curr - prev) <= max * 0.1 && Math.abs(next - curr) <= max * 0.1) return null;
          return <circle key={`dot-${i}`} cx={p.x} cy={p.y} r="5" fill="#f5a623" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      <div className="mt-1 flex justify-between px-1">
        <span className="text-xs text-dash-text-extra-faded">{visitorData[0].date}</span>
        <span className="text-xs text-dash-text-extra-faded">{visitorData[visitorData.length - 1].date}</span>
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

      {/* CPU + Memory donut gauges */}
      <div className="flex gap-4">
        <DonutGauge
          value={1287.52}
          max={1600}
          label="CPU"
          sublabel="1287.52 %"
          color="#b53629"
        />
        <DonutGauge
          value={2.63}
          max={100}
          label="Memory"
          sublabel="2.63 % / 1.5GB"
          color="#7c8cf8"
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
        <div className="p-5">
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
        <VisitorChart />
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
