import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Drawer } from "vaul";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  Forward,
  ArrowDown,
  Download,
  X,
  Copy,
  Check,
  Calendar,
  ChevronDown,
} from "lucide-react";
import {
  Pause,
  Play,
  Clock,
  MagnifyingGlass,
  CircleNotch,
} from "@phosphor-icons/react";
import type { DateRange } from "react-day-picker";
import { endOfDay, format, startOfDay, subDays, subHours } from "date-fns";
import { TabHeader } from "../../../components/shared/tab-header";
import {
  FilterDropdown,
  type FilterOption,
} from "../../../components/shared/filter-dropdown";
import { SearchFilterBar } from "../../../components/shared/search-filter-bar";
import { DateRangePicker } from "../../../components/shared/date-range-picker";
import { NumberPagination } from "../../../components/shared/pagination";
import {
  listRequestLogsServerFn,
  getLogTrendsServerFn,
} from "@/server/logs/actions";
import type {
  RequestLogsPage as RequestLogsResponse,
  LogTrendsResponse,
} from "@/backend/logs";
import { useHaptics } from "@/hooks/use-haptics";
import { useLiveApplicationLogs } from "@/hooks/use-live-application-logs";
import {
  buildRequestLogRawData,
  defaultApplicationLogsDateRange,
  defaultRequestLogsDateRange,
  detectAppLogLevel,
  embeddedIsoTimestampRegex,
  formatAppLogTime,
  mapApiRequestLogToUiRow,
  requestMethodColors as methodColors,
  requestStatusColor as statusColor,
  requestStatusDot as statusDot,
  type UiLogLevel,
  type UiRequestLogEntry as RequestLogEntry,
} from "@/utils/project-logs";
import {
  isDatabaseProject,
  isStaticProject,
} from "@/utils/project-capabilities";
import { usePlanGate } from "@/hooks/use-plan-gate";

export const Route = createFileRoute("/projects/$projectId/logs")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  component: LogsPage,
});

const parentRoute = getRouteApi("/projects/$projectId");

import { LogTab } from "../../../types/enums";

/* ─────────────────────────────────────────────
   Application Logs (terminal-style)
   ───────────────────────────────────────────── */

interface LogLine {
  epochMs: number;
  timestamp: string;
  level: UiLogLevel;
  message: string;
}

const levelColors: Record<LogLine["level"], string> = {
  info: "text-white/55",
  warn: "text-[#ff9b01]",
  error: "text-[#ff5f57]",
  debug: "text-white/35",
};

const levelBadge: Record<LogLine["level"], string> = {
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
  debug: "DEBUG",
};

const levelFilterOptions: FilterOption[] = [
  { label: "All Levels", value: "all" },
  { label: "Info", value: "info", dot: "rgba(255,255,255,0.4)" },
  { label: "Warn", value: "warn", dot: "#ff9b01" },
  { label: "Error", value: "error", dot: "#ff5f57" },
  { label: "Debug", value: "debug", dot: "rgba(255,255,255,0.35)" },
];

/** Strip leading ISO-8601 timestamp from a log message (Loki often embeds one). */
/** Detect URLs for auto-linking. */
const urlRe = /(https?:\/\/[^\s]+)/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatches(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const re = new RegExp(`(${escapeRegExp(trimmed)})`, "ig");
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="rounded-sm bg-[#b37a10]/30 px-0.5 text-[#b37a10] dark:bg-[#f5a623]/25 dark:text-[#f5a623]"
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/** Render a log message with auto-linked URLs and preserved whitespace. */
function LogMessage({ text, highlight }: { text: string; highlight?: string }) {
  const parts = text.split(urlRe);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#4879f8] underline hover:text-[#6b9aff]"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          <span key={i}>
            {highlight ? highlightMatches(part, highlight) : part}
          </span>
        ),
      )}
    </span>
  );
}

function clampDateToBounds(date: Date, minDate: Date, maxDate: Date): Date {
  const value = Math.min(
    Math.max(date.getTime(), minDate.getTime()),
    maxDate.getTime(),
  );
  return new Date(value);
}

function clampRangeToBounds(
  range: DateRange | undefined,
  minDate: Date,
  maxDate: Date,
): DateRange | undefined {
  if (!range) return undefined;

  const next: DateRange = {};
  if (range.from) next.from = clampDateToBounds(range.from, minDate, maxDate);
  if (range.to) next.to = clampDateToBounds(range.to, minDate, maxDate);
  if (!next.from && next.to) next.from = next.to;
  if (next.from && next.to && next.from.getTime() > next.to.getTime()) {
    next.to = next.from;
  }
  return next;
}

interface LogsActionItem {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}

function createLogExportFilename(prefix: string): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${prefix}-${yyyy}-${mm}-${dd}-${hh}${min}.log`;
}

function downloadLogsText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function LogsActionsMenu({ actions }: { actions: LogsActionItem[] }) {
  const haptics = useHaptics();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasEnabledAction = actions.some((action) => !action.disabled);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative flex h-full items-stretch">
      <button
        type="button"
        aria-label="Log actions"
        disabled={!hasEnabledAction}
        onClick={() => {
          if (!hasEnabledAction) return;
          haptics.selection();
          setOpen((prev) => !prev);
        }}
        className="flex h-full items-center border-l-[0.5px] border-dash-border px-2 py-3 text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            data-dropdown-menu
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-1 w-[170px] overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)]"
          >
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={action.disabled}
                onClick={() => {
                  if (action.disabled) return;
                  action.onSelect();
                  setOpen(false);
                }}
                className="mx-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-[2px] px-2 py-1.5 text-left text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface VolumeBucket {
  tsStart: number;
  info: number;
  warn: number;
  error: number;
  debug: number;
  total: number;
}

interface VolumeTotals {
  total: number;
  warn: number;
  error: number;
}

const SKELETON_HEIGHTS: number[] = (() => {
  let seed = 42;
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: 60 }, () => Math.round(15 + next() * 70));
})();

function VolumeGraphSkeleton() {
  return (
    <div className="px-4 pt-3 pb-3">
      <div className="flex h-4 items-center">
        <span className="h-2.5 w-24 animate-pulse rounded-sm bg-white/10" />
      </div>
      <div className="mt-2 flex h-[56px] items-end gap-[1px]">
        {SKELETON_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className="relative flex h-full flex-1 flex-col justify-end"
          >
            <div
              className="w-full animate-pulse rounded-[1px] bg-white/10"
              style={{
                height: `${h}%`,
                animationDelay: `${(i % 12) * 60}ms`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function VolumeGraph({
  buckets,
  totals,
  isLoading,
}: {
  buckets: VolumeBucket[];
  totals: VolumeTotals;
  isLoading: boolean;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxBucketTotal = useMemo(
    () => Math.max(1, ...buckets.map((b) => b.total)),
    [buckets],
  );

  const showSkeleton = isLoading && buckets.length === 0;
  const active = hoveredIdx !== null ? (buckets[hoveredIdx] ?? null) : null;

  if (showSkeleton) {
    return <VolumeGraphSkeleton />;
  }

  return (
    <div className="px-4 pt-3 pb-3">
      {/* Header — totals + hovered bucket details cross-fade */}
      <div className="relative h-4 font-logs text-[10px] font-medium uppercase tracking-wider text-white/40">
        <div
          className={`absolute inset-0 flex items-center gap-2 transition-opacity duration-200 ease-out ${
            active ? "opacity-0" : "opacity-100"
          }`}
        >
          <span className="text-white/70">
            {totals.total.toLocaleString()} events
          </span>
          {totals.warn > 0 && (
            <>
              <span>·</span>
              <span className="text-[#b37a10] dark:text-[#f5a623]">
                {totals.warn.toLocaleString()} warn
              </span>
            </>
          )}
          {totals.error > 0 && (
            <>
              <span>·</span>
              <span className="text-[#c92414] dark:text-[#ff5544]">
                {totals.error.toLocaleString()} error
              </span>
            </>
          )}
        </div>
        <div
          className={`absolute inset-0 flex items-center gap-2 transition-opacity duration-200 ease-out ${
            active ? "opacity-100" : "opacity-0"
          }`}
        >
          {active && (
            <>
              <span className="text-white/70">
                {format(new Date(active.tsStart), "MMM d HH:mm")}
              </span>
              <span>·</span>
              <span className="text-white/70">
                {active.total.toLocaleString()} total
              </span>
              {active.warn > 0 && (
                <>
                  <span>·</span>
                  <span className="text-[#b37a10] dark:text-[#f5a623]">
                    {active.warn.toLocaleString()} warn
                  </span>
                </>
              )}
              {active.error > 0 && (
                <>
                  <span>·</span>
                  <span className="text-[#c92414] dark:text-[#ff5544]">
                    {active.error.toLocaleString()} err
                  </span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bars */}
      <div
        className="mt-2 flex h-[56px] items-end gap-[1px]"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {buckets.map((b, i) => {
          const heightPct = (b.total / maxBucketTotal) * 100;
          const isEmpty = b.total === 0;
          const isDimmed = hoveredIdx !== null && hoveredIdx !== i;
          return (
            <div
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              className="relative flex h-full flex-1 cursor-default flex-col justify-end"
            >
              {isEmpty ? (
                <div className="h-px w-full bg-white/[0.04]" />
              ) : (
                <motion.div
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: isDimmed ? 0.3 : 1 }}
                  transition={{
                    scaleY: {
                      delay: i * 0.008,
                      type: "spring",
                      stiffness: 180,
                      damping: 12,
                      mass: 0.6,
                    },
                    opacity: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
                  }}
                  style={{
                    height: `${Math.max(3, heightPct)}%`,
                    transformOrigin: "bottom",
                  }}
                  className="flex w-full flex-col-reverse overflow-hidden rounded-[1px]"
                >
                  {b.info + b.debug > 0 && (
                    <div
                      className="w-full bg-[#4879f8]/45 dark:bg-[#5b87fa]/30"
                      style={{ flex: b.info + b.debug }}
                    />
                  )}
                  {b.warn > 0 && (
                    <div
                      className="w-full bg-[#b37a10]/85 dark:bg-[#f5a623]/75"
                      style={{ flex: b.warn }}
                    />
                  )}
                  {b.error > 0 && (
                    <div
                      className="w-full bg-[#c92414] dark:bg-[#ff5544]"
                      style={{ flex: b.error }}
                    />
                  )}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApplicationLogsEmptyState({
  isConnecting,
  hasActiveFilters,
}: {
  isConnecting: boolean;
  hasActiveFilters: boolean;
}) {
  let icon: ReactNode;
  let title: string;
  let body: ReactNode;

  if (isConnecting) {
    icon = <CircleNotch className="size-6 animate-spin text-white/50" />;
    title = "Connecting to log stream";
    body = (
      <p>
        Establishing a connection to your container's log output. This usually
        takes a moment.
      </p>
    );
  } else if (hasActiveFilters) {
    icon = <MagnifyingGlass className="size-6 text-white/50" />;
    title = "No logs match your filters";
    body = (
      <p>
        Try clearing the search query or switching the level filter back to "All
        Levels". Adjusting the date range above can also surface older activity.
      </p>
    );
  } else {
    icon = <Clock className="size-6 text-white/50" />;
    title = "Nothing to show yet";
    body = (
      <>
        <p>
          We'll show your app's activity here as soon as it starts running. If
          you just deployed, give it a few seconds.
        </p>
        <p>
          Try widening the date range above to look further back, or head to
          Deployments to make sure your latest build is live.
        </p>
      </>
    );
  }

  return (
    <div className="flex h-[420px] flex-col items-center justify-center px-8 text-center">
      {icon}
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <div className="mt-2 flex max-w-[520px] flex-col gap-2 text-sm leading-6 text-white/55">
        {body}
      </div>
    </div>
  );
}

function ApplicationLogs({
  projectId,
  containers,
  logRetentionDays,
}: {
  projectId: string;
  containers: string[];
  logRetentionDays: number;
}) {
  const haptics = useHaptics();
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const maxSelectableDate = useMemo(() => endOfDay(new Date()), []);
  const minSelectableDate = useMemo(
    () =>
      startOfDay(subDays(maxSelectableDate, Math.max(0, logRetentionDays - 1))),
    [logRetentionDays, maxSelectableDate],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() =>
    clampRangeToBounds(
      defaultApplicationLogsDateRange(),
      minSelectableDate,
      maxSelectableDate,
    ),
  );

  useEffect(() => {
    setDateRange((prev) =>
      clampRangeToBounds(
        prev ?? defaultApplicationLogsDateRange(),
        minSelectableDate,
        maxSelectableDate,
      ),
    );
  }, [minSelectableDate, maxSelectableDate]);

  const rangeStart = useMemo(() => {
    if (dateRange?.from) {
      return startOfDay(dateRange.from);
    }

    return subHours(new Date(), 1);
  }, [dateRange]);

  const rangeEnd = useMemo(() => {
    if (dateRange?.to) {
      return endOfDay(dateRange.to);
    }

    return undefined;
  }, [dateRange]);

  const getLogTrends = useServerFn(getLogTrendsServerFn as any) as (args: {
    data: {
      projectId: string;
      from?: number;
      to?: number;
      step?: string;
      interval?: string;
      container?: string;
    };
  }) => Promise<LogTrendsResponse>;

  const stepSec = useMemo(() => {
    const duration =
      ((rangeEnd ?? new Date()).getTime() - rangeStart.getTime()) / 1000;
    return Math.max(15, Math.min(3600, Math.floor(duration / 60)));
  }, [rangeStart, rangeEnd]);

  const trendsQuery = useQuery({
    queryKey: [
      "log-trends",
      projectId,
      rangeStart.getTime(),
      rangeEnd?.getTime() ?? null,
      stepSec,
    ] as const,
    enabled: Boolean(projectId && containers.length > 0),
    staleTime: 30_000,
    queryFn: () =>
      getLogTrends({
        data: {
          projectId,
          from: rangeStart.getTime(),
          to: (rangeEnd ?? new Date()).getTime(),
          step: `${stepSec}s`,
          interval: `${stepSec}s`,
        },
      }),
  });

  const trendBuckets = useMemo<VolumeBucket[]>(() => {
    const data = trendsQuery.data;
    if (!data) return [];
    const total = data.series.totalLogs ?? [];
    const errors = data.series.errorLogs ?? [];
    const warns = data.series.warningLogs ?? [];
    return total.map((p, i) => {
      const errorVal = errors[i]?.value ?? 0;
      const warnVal = warns[i]?.value ?? 0;
      return {
        tsStart: p.timestamp,
        error: errorVal,
        warn: warnVal,
        info: Math.max(0, p.value - errorVal - warnVal),
        debug: 0,
        total: p.value,
      };
    });
  }, [trendsQuery.data]);

  const trendTotals = useMemo<VolumeTotals>(() => {
    const summary = trendsQuery.data?.summary;
    return {
      total: summary?.totalLogs ?? 0,
      warn: summary?.warningLogs ?? 0,
      error: summary?.errorLogs ?? 0,
    };
  }, [trendsQuery.data]);

  const liveLogs = useLiveApplicationLogs({
    containers,
    searchQuery: null,
    start: rangeStart,
    end: rangeEnd,
    enabled: containers.length > 0,
    limit: 200,
  });

  const logs = useMemo<LogLine[]>(() => {
    return liveLogs.logs
      .filter((item) => item.message.trim().length > 0)
      .map((item) => {
        // Strip leading ISO timestamp that Loki sometimes embeds
        const message = item.message.replace(embeddedIsoTimestampRegex, "");
        const level = detectAppLogLevel(message);
        const epochMs = item.epochMs > 0 ? item.epochMs : 0;

        return {
          epochMs,
          timestamp: formatAppLogTime(new Date(epochMs)),
          level,
          message,
        };
      });
  }, [liveLogs.logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((line) => {
      if (
        searchQuery &&
        !line.message.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      if (levelFilter !== "all" && line.level !== levelFilter) return false;
      if (line.epochMs < rangeStart.getTime()) return false;
      if (rangeEnd && line.epochMs > rangeEnd.getTime()) return false;
      return true;
    });
  }, [levelFilter, logs, rangeEnd, rangeStart, searchQuery]);

  const filteredLogsExportText = useMemo(() => {
    return filteredLogs
      .map(
        (line) =>
          `[${line.timestamp}] ${levelBadge[line.level]} ${line.message}`,
      )
      .join("\n");
  }, [filteredLogs]);

  const handleCopyFilteredLogs = useCallback(async () => {
    if (!filteredLogsExportText) return;
    haptics.light();
    await navigator.clipboard.writeText(filteredLogsExportText);
  }, [filteredLogsExportText, haptics]);

  const handleDownloadFilteredLogs = useCallback(() => {
    if (!filteredLogsExportText) return;
    downloadLogsText(
      filteredLogsExportText,
      createLogExportFilename("application-logs"),
    );
    haptics.light();
  }, [filteredLogsExportText, haptics]);

  // Mirror autoScroll into a ref so the auto-scroll effect below only
  // re-runs on new logs, not when the user toggles autoScroll itself
  // (which would otherwise instant-snap and interrupt the smooth scroll).
  const autoScrollRef = useRef(autoScroll);
  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

  // Auto-scroll on new logs
  useEffect(() => {
    if (!autoScrollRef.current || !scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [filteredLogs]);

  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      setAutoScroll(true);
    }
  }, []);

  if (containers.length === 0) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-1.5 rounded-[4px] border border-dash-border bg-dash-bg-elevated px-6 text-center">
        <span className="text-sm font-medium text-dash-text-strong">
          Logs will appear here once your app starts running
        </span>
        <span className="text-[13px] text-dash-text-faded">
          Deploy your project to start streaming application logs.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filter toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <SearchFilterBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search logs..."
          className="flex-1 bg-dash-bg"
          rightSlot={
            <FilterDropdown
              value={levelFilter}
              onChange={setLevelFilter}
              options={levelFilterOptions}
              placeholder="All Levels"
              align="left"
            />
          }
        />

        <div className="flex items-stretch rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg text-sm text-dash-text-body">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            minDate={minSelectableDate}
            maxDate={maxSelectableDate}
          >
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-3 transition-colors hover:bg-dash-bg-elevated"
            >
              <Calendar className="size-3.5 text-dash-text-faded" />
              {dateRange?.from && dateRange?.to
                ? `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
                : "Select date range"}
            </button>
          </DateRangePicker>
          <LogsActionsMenu
            actions={[
              {
                id: "copy-application-logs",
                label: "Copy logs",
                icon: <Copy className="size-3.5 text-dash-text-faded" />,
                onSelect: () => void handleCopyFilteredLogs(),
                disabled: filteredLogs.length === 0,
              },
              {
                id: "download-application-logs",
                label: "Download logs",
                icon: <Download className="size-3.5 text-dash-text-faded" />,
                onSelect: handleDownloadFilteredLogs,
                disabled: filteredLogs.length === 0,
              },
            ]}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            haptics.selection();
            if (liveLogs.isPaused) {
              liveLogs.resume();
            } else {
              liveLogs.pause();
            }
          }}
          aria-label={
            liveLogs.isPaused ? "Resume log stream" : "Pause log stream"
          }
          title={liveLogs.isPaused ? "Resume" : "Pause"}
          className="flex size-[42px] shrink-0 items-center justify-center rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
        >
          {liveLogs.isPaused ? (
            <Play weight="fill" className="size-4 text-dash-text-faded" />
          ) : (
            <Pause weight="fill" className="size-4 text-dash-text-faded" />
          )}
        </button>
      </div>

      {/* Terminal */}
      <div className="overflow-hidden rounded-[4px] border border-[#1f2123] bg-[#0d0e10]">
        {/* Volume graph */}
        <VolumeGraph
          buckets={trendBuckets}
          totals={trendTotals}
          isLoading={trendsQuery.isLoading}
        />
        {/* Log output */}
        <div className="relative">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="min-h-[640px] max-h-[820px] overflow-y-auto px-4 py-3 font-logs text-[11px] leading-[20px] [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.12)_transparent]"
          >
            {filteredLogs.length > 0 ? (
              filteredLogs.map((line, i) => (
                <div
                  key={i}
                  onClick={() => {
                    const raw = `${line.timestamp}  ${levelBadge[line.level]}  ${line.message}`;
                    navigator.clipboard.writeText(raw);
                    haptics.light();
                    setCopiedIdx(i);
                    setTimeout(
                      () => setCopiedIdx((prev) => (prev === i ? null : prev)),
                      1200,
                    );
                  }}
                  className={`flex cursor-pointer gap-3 rounded-[2px] px-1 py-1.5 transition-colors hover:bg-white/[0.04] ${
                    line.level === "error"
                      ? "bg-red-500/[0.06]"
                      : line.level === "warn"
                        ? "bg-yellow-500/[0.06]"
                        : ""
                  }`}
                >
                  <span className="shrink-0 select-none pt-px text-white/20">
                    {line.timestamp}
                  </span>
                  <span
                    className={`shrink-0 select-none pt-px font-medium ${levelColors[line.level]}`}
                  >
                    {levelBadge[line.level]}
                  </span>
                  <span className="min-w-0 flex-1 text-white/60">
                    <LogMessage text={line.message} highlight={searchQuery} />
                  </span>
                  {copiedIdx === i && (
                    <span className="shrink-0 select-none pt-px text-[10px] text-white/80">
                      Copied
                    </span>
                  )}
                </div>
              ))
            ) : (
              <ApplicationLogsEmptyState
                isConnecting={liveLogs.isConnecting}
                hasActiveFilters={
                  searchQuery.trim().length > 0 || levelFilter !== "all"
                }
              />
            )}
          </div>

          {/* Scroll-to-bottom */}
          {!autoScroll && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-white/60 backdrop-blur transition-colors hover:bg-white/15 hover:text-white"
            >
              <ArrowDown className="size-3" />
              New logs
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Request Logs (table-style)
   ───────────────────────────────────────────── */

const methodFilterOptions: FilterOption[] = [
  { label: "All Methods", value: "all" },
  { label: "GET", value: "GET", dot: "#28c840" },
  { label: "POST", value: "POST", dot: "#4879f8" },
  { label: "PUT", value: "PUT", dot: "#ff9b01" },
  { label: "PATCH", value: "PATCH", dot: "#ff9b01" },
  { label: "DELETE", value: "DELETE", dot: "#ff5f57" },
];

const statusFilterOptions: FilterOption[] = [
  { label: "All Statuses", value: "all" },
  { label: "2xx Success", value: "2xx", dot: "#28c840" },
  { label: "4xx Client Error", value: "4xx", dot: "#ff9b01" },
  { label: "5xx Server Error", value: "5xx", dot: "#ff5f57" },
];

/** Tokenize a single line of JSON and return colored spans */
function JsonLine({ text }: { text: string }) {
  const tokens: { value: string; color: string }[] = [];
  const re =
    /("(?:[^"\\]|\\.)*")(\s*:\s*)?|(\d+(?:\.\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)|([^"\d\w]+|\w+)/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m[1]) {
      if (m[2]) {
        // Key: "key":
        tokens.push({ value: m[1], color: "text-[#b5695f]" });
        tokens.push({ value: m[2], color: "" });
      } else {
        // String value
        tokens.push({ value: m[1], color: "text-[#4e9a06]" });
      }
    } else if (m[3]) {
      tokens.push({ value: m[3], color: "text-[#4879f8]" });
    } else if (m[4]) {
      tokens.push({ value: m[4], color: "text-[#4879f8]" });
    } else if (m[5]) {
      tokens.push({ value: m[5], color: "" });
    }
  }

  return (
    <span>
      {tokens.map((t, i) => (
        <span key={i} className={t.color}>
          {t.value}
        </span>
      ))}
    </span>
  );
}

/** Request log detail drawer (bottom sheet) */
function RequestDetailDrawer({
  log,
  open,
  onOpenChange,
}: {
  log: RequestLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<"details" | "raw">("details");
  const [copied, setCopied] = useState(false);
  const haptics = useHaptics();

  if (!log) return null;

  const rawData = buildRequestLogRawData(log);
  const rawJson = JSON.stringify(rawData, null, 2);
  const rawLines = rawJson.split("\n");

  const groups: Array<{
    title: string;
    items: Array<{
      label: string;
      value: string;
      color?: string;
      dot?: string;
    }>;
  }> = [
    {
      title: "Request",
      items: [
        { label: "Host", value: log.host },
        { label: "Method", value: log.method, color: methodColors[log.method] },
        { label: "Path", value: log.path },
        { label: "URL", value: log.url },
      ],
    },
    {
      title: "Response",
      items: [
        {
          label: "Status",
          value: String(log.status),
          dot: statusDot(log.status),
        },
        { label: "Duration", value: log.duration },
        { label: "Response", value: log.response },
      ],
    },
    {
      title: "Client",
      items: [
        { label: "IP Address", value: log.ip },
        { label: "Browser", value: log.browser },
        {
          label: "Time",
          value: log.isoTimestamp.replace("T", " ").replace("Z", ""),
        },
      ],
    },
  ];

  function handleCopy() {
    navigator.clipboard.writeText(rawJson);
    haptics.light();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      modal={false}
    >
      <Drawer.Portal>
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex flex-col outline-none">
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="flex max-h-[60vh] flex-col overflow-clip rounded-t-[4px] border-t-[0.5px] border-[#d9dadd] bg-dash-bg shadow-[0px_-4px_20px_-8px_rgba(0,0,0,0.15)] dark:border-dash-border dark:bg-[#181819]"
          >
            {/* Top bar */}
            <div className="flex shrink-0 items-center justify-between border-b-[0.5px] border-[#e5e5e5] px-5 py-2.5 dark:border-dash-border">
              <div className="flex items-center gap-2">
                <span
                  className={`font-logs text-xs font-medium ${methodColors[log.method] ?? "text-dash-text-body"}`}
                >
                  {log.method}
                </span>
                <span className="font-logs text-xs leading-[1.3] tracking-[-0.0224px] text-dash-text-strong">
                  {log.path}
                </span>
                <span
                  className={`flex items-center gap-1 font-logs text-xs ${statusColor(log.status)}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${statusDot(log.status)}`}
                  />
                  {log.status}
                </span>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-2 rounded p-0.5 text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
              >
                <X className="size-4" />
                <span className="font-logs text-xs leading-[1.4] tracking-[-0.01px]">
                  Close
                </span>
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b-[0.5px] border-[#e5e5e5] px-5 dark:border-dash-border">
              <button
                onClick={() => setTab("details")}
                className={`px-1 pb-2 pt-2.5 font-logs text-xs leading-[1.4] tracking-[-0.01px] transition-colors ${
                  tab === "details"
                    ? "border-b-2 border-[#3c6ce7] font-medium text-[#3c6ce7]"
                    : "text-dash-text-faded hover:text-dash-text-body"
                }`}
              >
                Event Details
              </button>
              <button
                onClick={() => setTab("raw")}
                className={`ml-4 px-1 pb-2 pt-2.5 font-logs text-xs leading-[1.4] tracking-[-0.01px] transition-colors ${
                  tab === "raw"
                    ? "border-b-2 border-[#3c6ce7] font-medium text-[#3c6ce7]"
                    : "text-dash-text-faded hover:text-dash-text-body"
                }`}
              >
                Raw Data
              </button>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "details" ? (
                <div className="flex flex-col gap-4 p-5">
                  {/* Request + Response side by side */}
                  <div className="grid grid-cols-2 gap-4">
                    {groups.slice(0, 2).map((group) => (
                      <div
                        key={group.title}
                        className="rounded-[4px] border-[0.5px] border-dash-border"
                      >
                        <div className="border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-3.5 py-2">
                          <span className="font-logs text-[10px] uppercase tracking-widest text-dash-text-faded">
                            {group.title}
                          </span>
                        </div>
                        <div>
                          {group.items.map((item, j) => (
                            <div
                              key={item.label}
                              className={`flex justify-between px-3.5 py-2 ${j < group.items.length - 1 ? "border-b-[0.5px] border-dash-border" : ""}`}
                            >
                              <span className="font-logs text-xs text-dash-text-faded">
                                {item.label}
                              </span>
                              <span
                                className={`font-logs text-xs text-right ${item.color ?? "text-dash-text-strong"}`}
                              >
                                {item.dot && (
                                  <span
                                    className={`mr-1.5 inline-block size-1.5 rounded-full align-middle ${item.dot}`}
                                  />
                                )}
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Client full width */}
                  <div className="rounded-[4px] border-[0.5px] border-dash-border">
                    <div className="border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-3.5 py-2">
                      <span className="font-logs text-[10px] uppercase tracking-widest text-dash-text-faded">
                        {groups[2].title}
                      </span>
                    </div>
                    <div>
                      {groups[2].items.map((item, j) => (
                        <div
                          key={item.label}
                          className={`flex justify-between px-3.5 py-2 ${j < groups[2].items.length - 1 ? "border-b-[0.5px] border-dash-border" : ""}`}
                        >
                          <span className="font-logs text-xs text-dash-text-faded">
                            {item.label}
                          </span>
                          <span className="font-logs text-xs text-dash-text-strong">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  {/* Copy button */}
                  <button
                    onClick={handleCopy}
                    className="absolute right-3 top-2 flex items-center gap-1 rounded p-0.5 font-logs text-[10px] leading-[1.4] tracking-[-0.01px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
                  >
                    {copied ? (
                      <Check className="size-3 text-[#28c840]" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </button>

                  <div className="px-5 py-2.5 font-mono text-xs leading-[1.6]">
                    {rawLines.map((line, i) => (
                      <div key={i} className="flex">
                        <span className="inline-block w-6 shrink-0 select-none text-right text-dash-text-extra-faded">
                          {i + 1}
                        </span>
                        <span className="ml-3 whitespace-pre text-dash-text-body">
                          <JsonLine text={line} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function RequestLogs({
  projectId,
  workspace,
  logRetentionDays,
}: {
  projectId: string;
  workspace?: string;
  logRetentionDays: number;
}) {
  const haptics = useHaptics();
  const maxSelectableDate = useMemo(() => endOfDay(new Date()), []);
  const minSelectableDate = useMemo(
    () =>
      startOfDay(subDays(maxSelectableDate, Math.max(0, logRetentionDays - 1))),
    [logRetentionDays, maxSelectableDate],
  );
  const [selectedLog, setSelectedLog] = useState<RequestLogEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [requestLogs, setRequestLogs] = useState<RequestLogEntry[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [requestLogsLoading, setRequestLogsLoading] = useState(false);
  const [requestLogsError, setRequestLogsError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() =>
    clampRangeToBounds(
      defaultRequestLogsDateRange(),
      minSelectableDate,
      maxSelectableDate,
    ),
  );

  useEffect(() => {
    setDateRange((prev) =>
      clampRangeToBounds(
        prev ?? defaultRequestLogsDateRange(),
        minSelectableDate,
        maxSelectableDate,
      ),
    );
  }, [minSelectableDate, maxSelectableDate]);

  const getRequestLogs = useServerFn(listRequestLogsServerFn as any) as (args: {
    data: {
      projectId: string;
      workspace?: string;
      page?: number;
      limit?: number;
    };
  }) => Promise<RequestLogsResponse>;

  const fetchRequestLogs = useCallback(async () => {
    if (!projectId) {
      return;
    }

    setRequestLogsLoading(true);
    setRequestLogsError(null);

    try {
      const rawResult = await getRequestLogs({
        data: {
          projectId,
          workspace,
          page: currentPage,
          limit: 50,
        },
      });

      let result: RequestLogsResponse | undefined;
      if (rawResult && typeof rawResult === "object") {
        const maybeWrapped = rawResult as {
          result?: RequestLogsResponse;
          data?: RequestLogsResponse;
          items?: RequestLogsResponse["items"];
        };

        if (maybeWrapped.result && typeof maybeWrapped.result === "object") {
          result = maybeWrapped.result;
        } else if (maybeWrapped.data && typeof maybeWrapped.data === "object") {
          result = maybeWrapped.data;
        } else if (Array.isArray(maybeWrapped.items)) {
          result = maybeWrapped as unknown as RequestLogsResponse;
        }
      }

      const items = Array.isArray(result?.items) ? result.items : [];
      setRequestLogs(items.map(mapApiRequestLogToUiRow));
      setTotalPages(Math.max(1, Number(result?.totalPages ?? 1)));
    } catch (error) {
      let message = "Failed to load request logs.";
      if (error instanceof Error && error.message.trim()) {
        message = error.message;
      }
      setRequestLogsError(message);
      setRequestLogs([]);
      setTotalPages(1);
    } finally {
      setRequestLogsLoading(false);
    }
  }, [currentPage, getRequestLogs, projectId, workspace]);

  useEffect(() => {
    void fetchRequestLogs();
  }, [fetchRequestLogs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [projectId, workspace]);

  const filteredRequestLogs = useMemo(() => {
    return requestLogs.filter((log) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable =
          `${log.method} ${log.path} ${log.response} ${log.status}`.toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (methodFilter !== "all" && log.method !== methodFilter) return false;
      if (statusFilter !== "all") {
        const prefix = String(log.status)[0];
        if (statusFilter === "2xx" && prefix !== "2") return false;
        if (statusFilter === "4xx" && prefix !== "4") return false;
        if (statusFilter === "5xx" && prefix !== "5") return false;
      }
      if (dateRange?.from) {
        const logDate = new Date(log.isoTimestamp);
        if (logDate < dateRange.from) return false;
        if (dateRange.to) {
          const rangeEndOfDay = endOfDay(dateRange.to);
          if (logDate > rangeEndOfDay) return false;
        }
      }
      return true;
    });
  }, [requestLogs, searchQuery, methodFilter, statusFilter, dateRange]);

  const filteredRequestLogsExportText = useMemo(() => {
    return filteredRequestLogs
      .map((log) =>
        [
          `[${log.isoTimestamp}]`,
          log.method,
          log.path,
          String(log.status),
          log.duration,
          log.response,
        ]
          .filter((token) => token.trim().length > 0)
          .join(" "),
      )
      .join("\n");
  }, [filteredRequestLogs]);

  const handleCopyFilteredRequestLogs = useCallback(async () => {
    if (!filteredRequestLogsExportText) return;
    haptics.light();
    await navigator.clipboard.writeText(filteredRequestLogsExportText);
  }, [filteredRequestLogsExportText, haptics]);

  const handleDownloadFilteredRequestLogs = useCallback(() => {
    if (!filteredRequestLogsExportText) return;
    downloadLogsText(
      filteredRequestLogsExportText,
      createLogExportFilename("request-logs"),
    );
    haptics.light();
  }, [filteredRequestLogsExportText, haptics]);

  function handleRowClick(log: RequestLogEntry) {
    setSelectedLog(log);
    setDrawerOpen(true);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filter toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <SearchFilterBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search requests..."
          className="flex-1 bg-dash-bg"
          rightSlot={
            <div className="flex items-center">
              <FilterDropdown
                value={methodFilter}
                onChange={setMethodFilter}
                options={methodFilterOptions}
                placeholder="All Methods"
                align="left"
              />
              <div className="h-full w-px self-stretch bg-dash-border" />
              <FilterDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusFilterOptions}
                placeholder="All Statuses"
                align="left"
              />
            </div>
          }
        />

        <div className="flex items-stretch rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg text-sm text-dash-text-body">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            minDate={minSelectableDate}
            maxDate={maxSelectableDate}
          >
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-3 transition-colors hover:bg-dash-bg-elevated"
            >
              <Calendar className="size-3.5 text-dash-text-faded" />
              {dateRange?.from && dateRange?.to
                ? `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
                : "Select date range"}
            </button>
          </DateRangePicker>
          <LogsActionsMenu
            actions={[
              {
                id: "copy-request-logs",
                label: "Copy logs",
                icon: <Copy className="size-3.5 text-dash-text-faded" />,
                onSelect: () => void handleCopyFilteredRequestLogs(),
                disabled: filteredRequestLogs.length === 0,
              },
              {
                id: "download-request-logs",
                label: "Download logs",
                icon: <Download className="size-3.5 text-dash-text-faded" />,
                onSelect: handleDownloadFilteredRequestLogs,
                disabled: filteredRequestLogs.length === 0,
              },
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
        {/* Table header */}
        <div className="grid grid-cols-[64px_1fr_60px_80px_100px] items-center gap-2 border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-4 py-2.5">
          <span className="font-logs text-xs font-medium text-dash-text-faded">
            Method
          </span>
          <span className="font-logs text-xs font-medium text-dash-text-faded">
            Path
          </span>
          <span className="font-logs text-xs font-medium text-dash-text-faded">
            Status
          </span>
          <span className="font-logs text-xs font-medium text-dash-text-faded">
            Duration
          </span>
          <span className="font-logs text-xs font-medium text-dash-text-faded">
            Time
          </span>
        </div>

        {/* Rows */}
        {requestLogsLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`req-skeleton-${i}`}
              className="grid grid-cols-[64px_1fr_60px_80px_100px] items-center gap-2 border-b-[0.5px] border-dash-border px-4 py-2.5"
            >
              <div className="h-3.5 w-10 animate-pulse rounded bg-dash-border-soft" />
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-dash-border-soft" />
              <div className="h-3.5 w-8 animate-pulse rounded bg-dash-border-soft" />
              <div className="h-3.5 w-12 animate-pulse rounded bg-dash-border-soft" />
              <div className="h-3.5 w-14 animate-pulse rounded bg-dash-border-soft" />
            </div>
          ))
        ) : filteredRequestLogs.length > 0 ? (
          filteredRequestLogs.map((log, i) => (
            <button
              key={i}
              onClick={() => handleRowClick(log)}
              className="grid w-full grid-cols-[64px_1fr_60px_80px_100px] items-center gap-2 border-b-[0.5px] border-dash-border px-4 py-2.5 text-left transition-colors hover:bg-dash-bg-elevated"
            >
              <span
                className={`font-logs text-xs font-medium ${methodColors[log.method] ?? "text-dash-text-body"}`}
              >
                {log.method}
              </span>
              <span className="truncate font-logs text-sm font-light text-dash-text-strong">
                {log.path}
              </span>
              <span
                className={`font-logs text-xs font-medium ${statusColor(log.status)}`}
              >
                {log.status}
              </span>
              <span className="font-logs text-xs font-light text-dash-text-faded">
                {log.duration}
              </span>
              <span className="font-logs text-xs font-light text-dash-text-faded">
                {log.timestamp}
              </span>
            </button>
          ))
        ) : (
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-dash-text-faded">
              {requestLogsError || "No requests matching your filters"}
            </span>
          </div>
        )}
      </div>

      <NumberPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => setCurrentPage(page)}
      />

      <RequestDetailDrawer
        log={selectedLog}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main page
   ───────────────────────────────────────────── */

function LogsPage() {
  const { project, workspace } = parentRoute.useLoaderData() as any;
  const haptics = useHaptics();
  const plan = usePlanGate();
  const logRetentionDays = Math.max(1, Number(plan.logRetention ?? 1));
  const staticProject = isStaticProject(project);
  const databaseProject = isDatabaseProject(project as any);
  const [activeTab, setActiveTab] = useState<LogTab>(
    staticProject ? LogTab.Request : LogTab.Application,
  );

  useEffect(() => {
    if (staticProject && activeTab !== LogTab.Request) {
      setActiveTab(LogTab.Request);
    }
    if (databaseProject && activeTab === LogTab.Request) {
      setActiveTab(LogTab.Application);
    }
  }, [staticProject, databaseProject, activeTab]);

  const applicationLogContainers = useMemo(() => {
    const containers: string[] = [];
    const seenContainers = new Set<string>();

    if (Array.isArray(project?.job?.allocations)) {
      for (const allocation of project.job.allocations) {
        const container =
          typeof allocation?.container === "string"
            ? allocation.container.trim()
            : "";
        if (!container || seenContainers.has(container)) continue;
        seenContainers.add(container);
        containers.push(container);
      }
    }

    const commonContainer =
      typeof project?.job?.commonContainer === "string"
        ? project.job.commonContainer.trim()
        : "";

    if (commonContainer && !seenContainers.has(commonContainer)) {
      seenContainers.add(commonContainer);
      containers.push(commonContainer);
    }

    return containers;
  }, [project]);

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <TabHeader title="Logs">
          Monitor your application and request logs in real-time.
        </TabHeader>

        {/* Tab switcher */}
        <div className="flex overflow-clip rounded-[4px] border border-dash-border-soft shadow-[0px_1px_2px_rgba(18,18,23,0.05)]">
          {!staticProject && (
            <button
              onClick={() => {
                haptics.selection();
                setActiveTab(LogTab.Application);
              }}
              className={`flex h-[34px] items-center gap-2 border-r border-dash-border-soft px-3.5 text-sm transition-colors ${
                activeTab === LogTab.Application
                  ? "bg-dash-bg font-medium text-dash-text-strong"
                  : "bg-dash-bg-elevated text-dash-text-faded"
              }`}
            >
              <Activity className="size-4" />
              Application Logs
            </button>
          )}
          {!databaseProject && (
            <button
              onClick={() => {
                haptics.selection();
                setActiveTab(LogTab.Request);
              }}
              className={`flex h-[34px] items-center gap-2 px-3.5 text-sm transition-colors ${
                activeTab === LogTab.Request
                  ? "bg-dash-bg font-medium text-dash-text-strong"
                  : "bg-dash-bg-elevated text-dash-text-faded"
              }`}
            >
              <Forward className="size-4" />
              Request Logs
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {activeTab === LogTab.Application ? (
        <ApplicationLogs
          projectId={project?.id ?? ""}
          containers={applicationLogContainers}
          logRetentionDays={logRetentionDays}
        />
      ) : (
        <RequestLogs
          projectId={project?.id || project?.name || ""}
          workspace={workspace}
          logRetentionDays={logRetentionDays}
        />
      )}
    </div>
  );
}
