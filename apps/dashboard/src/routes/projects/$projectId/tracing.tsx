import { useState, useEffect, useMemo, useRef } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Calendar, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Drawer } from "vaul";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { DateRange } from "react-day-picker";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { TabHeader } from "../../../components/shared/tab-header";
import { FilterDropdown, type FilterOption } from "../../../components/shared/filter-dropdown";
import { SearchFilterBar } from "../../../components/shared/search-filter-bar";
import { DateRangePicker } from "../../../components/shared/date-range-picker";
import { flattenSpans, formatDuration, generateSampleTraces, type TraceDetail, type TraceSpan } from "@/utils/tracing";
import { usePlanGate } from "@/hooks/use-plan-gate";

export const Route = createFileRoute("/projects/$projectId/tracing")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  component: TracingPage,
  pendingComponent: TracingPending,
});

const parentRoute = getRouteApi("/projects/$projectId");

// Tracing bars: traditional amber, dulled in dark mode so they don't glare; red reserved for errors.
const AMBER_BAR = "bg-[#ff9b01] dark:bg-[#bd7f2f]";
const RED_BAR = "bg-[#ff5f57] dark:bg-[#bf5a53]";

// Waterfall grid is [180px_1fr_56px] with gap-3 (12px) inside px-4 (16px) — the
// time track band runs from the label column's right edge to the duration column.
const TRACK_BAND_LEFT = 16 + 180 + 12;
const TRACK_BAND_RIGHT_INSET = 16 + 56 + 12;

// Trace table columns: collapse to method/endpoint/status/total on small screens.
const ROW_GRID =
  "grid grid-cols-[56px_1fr_64px_72px] md:grid-cols-[84px_56px_1fr_64px_72px_132px_72px] items-center gap-3 px-4";

const serviceFilterOptions: FilterOption[] = [
  { label: "All services", value: "all" },
  { label: "api", value: "api" },
  { label: "auth", value: "auth" },
  { label: "db", value: "db" },
  { label: "cache", value: "cache" },
  { label: "queue", value: "queue" },
  { label: "http", value: "http" },
];

const statusFilterOptions: FilterOption[] = [
  { label: "All statuses", value: "all" },
  { label: "Success · 2xx", value: "2xx" },
  { label: "Client error · 4xx", value: "4xx" },
  { label: "Server error · 5xx", value: "5xx" },
];

function matchesStatusBucket(status: number, bucket: string): boolean {
  if (bucket === "2xx") return status >= 200 && status < 300;
  if (bucket === "4xx") return status >= 400 && status < 500;
  if (bucket === "5xx") return status >= 500;
  return true;
}

// Reserve colour for meaning: errors are red, everything else stays neutral.
function statusText(status: number): string {
  return status >= 400 ? "text-[#ff5f57] dark:text-[#cc6a62]" : "text-dash-text-faded";
}

function statusDotClass(status: number): string {
  return status >= 400 ? "bg-[#ff5f57] dark:bg-[#bf5a53]" : "bg-dash-text-extra-faded";
}

function TracingPage() {
  const { project } = parentRoute.useLoaderData() as any;
  const plan = usePlanGate();
  const retentionDays = Math.max(1, Number(plan.logRetention ?? 1));

  const maxSelectableDate = useMemo(() => endOfDay(new Date()), []);
  const minSelectableDate = useMemo(
    () => startOfDay(subDays(maxSelectableDate, Math.max(0, retentionDays - 1))),
    [retentionDays, maxSelectableDate],
  );

  const [traces, setTraces] = useState<TraceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 1),
    to: new Date(),
  }));

  // TODO: swap for the tracing server function (keyed on projectId) once the backend
  // ships — the UI only depends on the TraceDetail[] shape produced here.
  const projectId: string = project?.id ?? "";
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    const timeout = setTimeout(() => {
      setTraces(generateSampleTraces(Date.now()));
      setLoading(false);
    }, 350);
    return () => clearTimeout(timeout);
  }, [projectId]);

  const filteredTraces = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return traces.filter((trace) => {
      if (statusFilter !== "all" && !matchesStatusBucket(trace.status, statusFilter)) return false;
      if (serviceFilter !== "all" && !trace.spans.some((span) => span.service === serviceFilter)) return false;
      if (query && !(`${trace.method} ${trace.endpoint}`.toLowerCase().includes(query) || trace.id.toLowerCase().includes(query))) {
        return false;
      }
      return true;
    });
  }, [traces, searchQuery, serviceFilter, statusFilter]);

  const maxDurationMs = useMemo(() => Math.max(1, ...filteredTraces.map((trace) => trace.durationMs)), [filteredTraces]);

  const selectedTrace = traces.find((trace) => trace.id === selectedTraceId) ?? null;

  // Keep the span selection valid as the active trace changes — default to the root span.
  useEffect(() => {
    if (!selectedTrace) return;
    setSelectedSpanId((prev) =>
      prev && selectedTrace.spans.some((span) => span.id === prev) ? prev : (selectedTrace.spans[0]?.id ?? null),
    );
  }, [selectedTrace?.id]);

  const selectedSpan = selectedTrace?.spans.find((span) => span.id === selectedSpanId) ?? selectedTrace?.spans[0] ?? null;

  function openTrace(id: string) {
    setSelectedTraceId(id);
    setDrawerOpen(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-0">
      <TabHeader title="Tracing">
        Follow a request across every service it touches. Select a trace to inspect its span timeline and attributes.
      </TabHeader>

      {/* Filter toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <SearchFilterBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search traces by path or id..."
          className="flex-1 bg-dash-bg"
          rightSlot={
            <div className="flex items-center">
              <FilterDropdown value={serviceFilter} onChange={setServiceFilter} options={serviceFilterOptions} placeholder="All services" align="left" />
              <div className="h-full w-px self-stretch bg-dash-border" />
              <FilterDropdown value={statusFilter} onChange={setStatusFilter} options={statusFilterOptions} placeholder="All statuses" align="left" />
            </div>
          }
        />

        <div className="flex items-stretch rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg text-sm text-dash-text-body">
          <DateRangePicker value={dateRange} onChange={setDateRange} minDate={minSelectableDate} maxDate={maxSelectableDate} includeTime>
            <button type="button" className="flex items-center gap-2 px-3 py-3 transition-colors hover:bg-dash-bg-elevated">
              <Calendar className="size-3.5 text-dash-text-faded" />
              <span className="max-w-[260px] truncate">{formatRangeLabel(dateRange)}</span>
            </button>
          </DateRangePicker>
        </div>
      </div>

      <LatencyChart traces={filteredTraces} loading={loading} />

      <TraceTable
        traces={filteredTraces}
        loading={loading}
        activeTraceId={drawerOpen ? selectedTraceId : null}
        maxDurationMs={maxDurationMs}
        onOpen={openTrace}
      />

      <TraceDrawer trace={selectedTrace} open={drawerOpen} onOpenChange={setDrawerOpen} selectedSpan={selectedSpan} onSelectSpan={setSelectedSpanId} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Latency-over-time line chart
   ───────────────────────────────────────────── */

function formatMsTick(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

function LatencyChart({ traces, loading }: { traces: TraceDetail[]; loading: boolean }) {
  const data = useMemo(
    () =>
      [...traces]
        .sort((a, b) => a.startedAt - b.startedAt)
        .map((trace) => ({
          time: format(new Date(trace.startedAt), "HH:mm:ss"),
          value: trace.durationMs,
          endpoint: `${trace.method} ${trace.endpoint}`,
        })),
    [traces],
  );

  return (
    <div className="rounded-[4px] border-[0.5px] border-dash-border [--trace-line:#ff9b01] dark:[--trace-line:#bd7f2f]">
      <div className="flex items-center justify-between border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-4 py-2.5">
        <span className="font-logs text-[11px] font-medium text-dash-text-faded">Latency over time</span>
        {!loading && <span className="font-logs text-[11px] text-dash-text-faded">{data.length} traces</span>}
      </div>

      <div className="px-2 py-3">
        {loading ? (
          <div className="h-[200px] animate-pulse rounded bg-dash-bg-elevated/30" />
        ) : data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-dash-text-faded">No data for this range</div>
        ) : (
          <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={1}>
            <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-dash-border-soft)" strokeOpacity={0.6} vertical={false} />
              <XAxis
                dataKey="time"
                stroke="var(--color-dash-text-extra-faded)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={6}
                interval="preserveStartEnd"
                minTickGap={44}
              />
              <YAxis
                stroke="var(--color-dash-text-extra-faded)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dx={-4}
                width={48}
                tickFormatter={formatMsTick}
              />
              <Tooltip
                cursor={{ stroke: "var(--color-dash-border)", strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as { time: string; value: number; endpoint: string };
                  return (
                    <div className="rounded-md border border-[#141414] bg-gradient-to-b from-[#434343] to-[#232323] px-3 py-2 shadow-[0px_2px_4px_rgba(0,0,0,0.18),inset_0px_1px_0px_rgba(255,255,255,0.18)]">
                      <p className="font-logs text-[10px] leading-4 text-white/60">
                        {point.endpoint} · {point.time}
                      </p>
                      <p className="font-logs text-xs font-medium leading-4 text-white">{formatDuration(point.value)}</p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--trace-line)"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                animationDuration={700}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Trace table
   ───────────────────────────────────────────── */

function TraceTable({
  traces,
  loading,
  activeTraceId,
  maxDurationMs,
  onOpen,
}: {
  traces: TraceDetail[];
  loading: boolean;
  activeTraceId: string | null;
  maxDurationMs: number;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
      <div className="scrollbar-subtle max-h-[520px] overflow-y-auto">
        {/* Header */}
        <div className={`${ROW_GRID} sticky top-0 z-10 border-b-[0.5px] border-dash-border bg-dash-bg-elevated py-2.5`}>
          <span className="hidden font-logs text-[11px] font-medium text-dash-text-faded md:block">Time</span>
          <span className="font-logs text-[11px] font-medium text-dash-text-faded">Method</span>
          <span className="font-logs text-[11px] font-medium text-dash-text-faded">Endpoint</span>
          <span className="font-logs text-[11px] font-medium text-dash-text-faded">Status</span>
          <span className="hidden font-logs text-[11px] font-medium text-dash-text-faded md:block">Spans</span>
          <span className="hidden font-logs text-[11px] font-medium text-dash-text-faded md:block">Latency</span>
          <span className="text-right font-logs text-[11px] font-medium text-dash-text-faded">Total</span>
        </div>

        {/* Rows */}
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={`trace-skeleton-${i}`} className={`${ROW_GRID} border-b-[0.5px] border-dash-border py-3`}>
              <div className="hidden h-3 w-14 animate-pulse rounded bg-dash-border-soft md:block" />
              <div className="h-3 w-10 animate-pulse rounded bg-dash-border-soft" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-dash-border-soft" />
              <div className="h-3 w-10 animate-pulse rounded bg-dash-border-soft" />
              <div className="hidden h-3 w-12 animate-pulse rounded bg-dash-border-soft md:block" />
              <div className="hidden h-1.5 w-full animate-pulse rounded-full bg-dash-border-soft md:block" />
              <div className="ml-auto h-3 w-12 animate-pulse rounded bg-dash-border-soft" />
            </div>
          ))
        ) : traces.length > 0 ? (
          traces.map((trace) => {
            const active = trace.id === activeTraceId;
            const barPct = Math.max(2, (trace.durationMs / maxDurationMs) * 100);
            const barColorClass = trace.status >= 500 ? RED_BAR : AMBER_BAR;
            return (
              <button
                key={trace.id}
                onClick={() => onOpen(trace.id)}
                className={`${ROW_GRID} relative w-full border-b-[0.5px] border-dash-border py-3 text-left transition-colors ${
                  active ? "bg-dash-bg-elevated" : "hover:bg-dash-bg-elevated"
                }`}
              >
                {active && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-[#3c6ce7]" />}
                <span className="hidden font-logs text-[11px] font-light text-dash-text-faded md:block">
                  {format(new Date(trace.startedAt), "HH:mm:ss")}
                </span>
                <span className="font-logs text-[11px] font-medium text-dash-text-faded">{trace.method}</span>
                <span className="truncate font-logs text-[11px] font-light text-dash-text-strong">{trace.endpoint}</span>
                <span className="flex items-center gap-1.5 font-logs text-[11px]">
                  <span className={`size-[6px] shrink-0 rounded-full ${statusDotClass(trace.status)}`} />
                  <span className={statusText(trace.status)}>{trace.status}</span>
                </span>
                <span className="hidden font-logs text-[11px] font-light text-dash-text-faded md:block">{trace.spanCount} spans</span>
                <span className="hidden h-1.5 overflow-hidden rounded-full bg-dash-border-soft md:block">
                  <span className={`block h-full rounded-full ${barColorClass}`} style={{ width: `${barPct}%` }} />
                </span>
                <span className="text-right font-logs text-[11px] font-medium text-dash-text-body">{formatDuration(trace.durationMs)}</span>
              </button>
            );
          })
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-1 px-6 text-center">
            <span className="text-sm font-medium text-dash-text-strong">No traces found</span>
            <span className="text-[13px] text-dash-text-faded">Try adjusting your filters or widening the date range.</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Trace inspector — bottom sheet (vaul)
   ───────────────────────────────────────────── */

function TraceDrawer({
  trace,
  open,
  onOpenChange,
  selectedSpan,
  onSelectSpan,
}: {
  trace: TraceDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSpan: TraceSpan | null;
  onSelectSpan: (id: string) => void;
}) {
  const orderedSpans = useMemo(() => (trace ? flattenSpans(trace.spans) : []), [trace]);
  const trackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);

  useEffect(() => setHover(null), [trace?.id]);

  function handleHoverMove(event: React.MouseEvent<HTMLDivElement>) {
    const el = trackRef.current;
    if (!el || !trace) return;
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const bandRight = rect.width - TRACK_BAND_RIGHT_INSET;
    if (x < TRACK_BAND_LEFT || x > bandRight) {
      setHover(null);
      return;
    }
    const fraction = (x - TRACK_BAND_LEFT) / (bandRight - TRACK_BAND_LEFT);
    setHover({ x, time: fraction * trace.durationMs });
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction="bottom" modal={false}>
      <Drawer.Portal>
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex flex-col outline-none">
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="mx-auto flex max-h-[72vh] w-full max-w-[1000px] flex-col overflow-clip rounded-t-[8px] border-t-[0.5px] border-[#d9dadd] bg-dash-bg shadow-[0px_-4px_20px_-8px_rgba(0,0,0,0.18)] dark:border-dash-border dark:bg-[#181819]"
          >
            <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-dash-border" />

            {trace && (
              <>
                {/* Header */}
                <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b-[0.5px] border-dash-border px-5 py-3">
                  <span className="font-logs text-[11px] font-medium text-dash-text-faded">{trace.method}</span>
                  <span className="truncate font-logs text-[12px] font-medium text-dash-text-strong">{trace.endpoint}</span>
                  <span className="flex items-center gap-1.5 font-logs text-[11px]">
                    <span className={`size-[6px] rounded-full ${statusDotClass(trace.status)}`} />
                    <span className={statusText(trace.status)}>{trace.status}</span>
                  </span>
                  <span className="ml-auto flex items-center gap-3 font-logs text-[11px] text-dash-text-faded">
                    <span>{trace.spanCount} spans</span>
                    <span className="font-medium text-dash-text-body">{formatDuration(trace.durationMs)}</span>
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      aria-label="Close"
                      className="rounded p-0.5 text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                </div>

                {/* Waterfall */}
                <div
                  className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto"
                  onMouseMove={handleHoverMove}
                  onMouseLeave={() => setHover(null)}
                >
                  <div ref={trackRef} className="relative py-1">
                    <AnimatePresence>
                      {hover && (
                        <motion.div
                          key="track-guideline"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="pointer-events-none absolute inset-y-0 z-10"
                          style={{ left: hover.x }}
                        >
                          <div className="absolute inset-y-0 w-px border-l border-dashed border-dash-text-faded/60" />
                          <div className="absolute top-1 -translate-x-1/2 whitespace-nowrap rounded-[3px] border-[0.5px] border-dash-border bg-dash-bg px-1.5 py-0.5 font-logs text-[10px] text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.08)]">
                            {formatDuration(hover.time)}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {orderedSpans.map(({ span, depth }, i) => {
                      const leftPct = Math.min(99, (span.startMs / trace.durationMs) * 100);
                      const widthPct = Math.max(0.8, Math.min(100 - leftPct, (span.durationMs / trace.durationMs) * 100));
                      const active = span.id === selectedSpan?.id;
                      const isError = span.status === "error";
                      const barColorClass = isError ? RED_BAR : AMBER_BAR;
                      const barOpacity = isError ? 0.95 : active ? 1 : 0.55;
                      return (
                        <button
                          // Keyed by trace so reopening / switching replays the grow-in.
                          key={`${trace.id}-${span.id}`}
                          onClick={() => onSelectSpan(span.id)}
                          className={`grid w-full grid-cols-[180px_1fr_56px] items-center gap-3 px-4 py-1.5 text-left transition-colors ${
                            active ? "bg-dash-bg-elevated" : "hover:bg-dash-bg-elevated"
                          }`}
                        >
                          <span className="flex min-w-0 items-baseline gap-1.5" style={{ paddingLeft: depth * 14 }}>
                            <span className="shrink-0 font-logs text-[10px] text-dash-text-extra-faded">{span.service}</span>
                            <span className="truncate font-logs text-[11px] font-light text-dash-text-strong" title={span.name}>
                              {span.name}
                            </span>
                          </span>
                          <span className="relative h-2.5">
                            <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-dash-border-soft" />
                            <motion.span
                              aria-hidden
                              className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-[2px] ${barColorClass}`}
                              style={{ left: `${leftPct}%`, width: `${widthPct}%`, transformOrigin: "left center" }}
                              initial={{ scaleX: 0, opacity: 0 }}
                              animate={{ scaleX: 1, opacity: barOpacity }}
                              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
                            />
                          </span>
                          <span className="text-right font-logs text-[10px] text-dash-text-faded">{formatDuration(span.durationMs)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedSpan && <SpanDetail span={selectedSpan} />}
              </>
            )}
          </motion.div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function SpanDetail({ span }: { span: TraceSpan }) {
  const attributes = Object.entries(span.attributes);
  return (
    <div className="flex shrink-0 flex-col gap-3 border-t-[0.5px] border-dash-border bg-dash-bg px-5 py-3 dark:bg-[#181819]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-logs text-[11px] font-medium text-dash-text-faded">{span.service}</span>
        <span className="font-logs text-[12px] font-medium text-dash-text-strong">{span.name}</span>
        {span.status === "error" && <span className="font-logs text-[10px] font-medium text-[#ff5f57] dark:text-[#cc6a62]">error</span>}
        <span className="ml-auto font-logs text-[11px] text-dash-text-faded">
          +{span.startMs}ms · <span className="font-medium text-dash-text-body">{formatDuration(span.durationMs)}</span>
        </span>
      </div>

      {attributes.length > 0 && (
        <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {attributes.map(([key, value]) => (
            <div key={key} className="flex items-baseline justify-between gap-3 font-logs text-[11px]">
              <span className="shrink-0 text-dash-text-faded">{key}</span>
              <span className="truncate text-dash-text-strong" title={value}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

function formatRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return "Select range";
  const from = format(range.from, "MMM d, HH:mm");
  if (!range.to) return from;
  return `${from} — ${format(range.to, "MMM d, HH:mm")}`;
}

function TracingPending() {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-0" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-28 animate-pulse rounded bg-dash-border-soft" />
        <div className="h-3 w-80 animate-pulse rounded bg-dash-border-soft" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-11 flex-1 min-w-[220px] animate-pulse rounded-[4px] border border-dash-border bg-dash-bg-elevated/30" />
        <div className="h-11 w-[200px] animate-pulse rounded-[4px] border border-dash-border bg-dash-bg-elevated/30" />
      </div>
      <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
        <div className="h-10 border-b-[0.5px] border-dash-border bg-dash-bg-elevated/40" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b-[0.5px] border-dash-border px-4 py-3">
            <div className="h-3 w-12 animate-pulse rounded bg-dash-border-soft" />
            <div className="h-3 flex-1 animate-pulse rounded bg-dash-border-soft" style={{ maxWidth: `${30 + ((i * 17) % 45)}%` }} />
            <div className="h-3 w-12 animate-pulse rounded bg-dash-border-soft" />
          </div>
        ))}
      </div>
    </div>
  );
}
