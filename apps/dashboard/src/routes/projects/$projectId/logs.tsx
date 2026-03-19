import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Drawer } from "vaul";
import { motion } from "motion/react";
import { Activity, Forward, Pause, Play, ArrowDown, X, Copy, Check, Search, Calendar, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { endOfDay, format, startOfDay, subDays, subHours } from "date-fns";
import { TabHeader } from "../../../components/shared/tab-header";
import { FilterDropdown, type FilterOption } from "../../../components/shared/filter-dropdown";
import { SearchFilterBar } from "../../../components/shared/search-filter-bar";
import { DateRangePicker } from "../../../components/shared/date-range-picker";
import { NumberPagination } from "../../../components/shared/pagination";
import type { DropdownOption } from "../../../components/shared/dropdown";
import { listRequestLogsServerFn } from "@/server/logs/actions";
import type { RequestLogsPage as RequestLogsResponse, RequestLogEntry as ApiRequestLogEntry } from "@/backend/logs";
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
import { isDatabaseProject, isStaticProject } from "@/utils/project-capabilities";

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
  timestamp: string;
  level: UiLogLevel;
  message: string;
}

const levelColors: Record<LogLine["level"], string> = {
  info: "text-[#28c840]",
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
  { label: "Info", value: "info", dot: "#28c840" },
  { label: "Warn", value: "warn", dot: "#ff9b01" },
  { label: "Error", value: "error", dot: "#ff5f57" },
  { label: "Debug", value: "debug", dot: "rgba(255,255,255,0.35)" },
];

/** Strip leading ISO-8601 timestamp from a log message (Loki often embeds one). */
/** Detect URLs for auto-linking. */
const urlRe = /(https?:\/\/[^\s]+)/g;

/** Render a log message with auto-linked URLs and preserved whitespace. */
function LogMessage({ text }: { text: string }) {
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
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

function ApplicationLogs({
  allocationOptions,
  allocationContainerByOptionId,
}: {
  allocationOptions: DropdownOption[];
  allocationContainerByOptionId: Record<string, string>;
}) {
  const haptics = useHaptics();
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedAllocation, setSelectedAllocation] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    defaultApplicationLogsDateRange,
  );

  useEffect(() => {
    if (allocationOptions.length === 0) {
      setSelectedAllocation("");
      return;
    }

    const stillExists = allocationOptions.some((option) => option.id === selectedAllocation);
    if (stillExists) {
      return;
    }

    setSelectedAllocation(allocationOptions[0].id);
  }, [allocationOptions, selectedAllocation]);

  const rangeStart = useMemo(() => {
    if (dateRange?.from) {
      return startOfDay(dateRange.from);
    }

    return subHours(new Date(), 1);
  }, [dateRange?.from]);

  const rangeEnd = useMemo(() => {
    if (dateRange?.to) {
      return endOfDay(dateRange.to);
    }

    return undefined;
  }, [dateRange?.to]);

  const selectedContainer = (allocationContainerByOptionId[selectedAllocation] || "").trim();

  const liveLogs = useLiveApplicationLogs({
    container: selectedContainer,
    searchQuery,
    start: rangeStart,
    end: rangeEnd,
    enabled: Boolean(selectedContainer),
    limit: 200,
  });

  const logs = useMemo<LogLine[]>(() => {
    return liveLogs.logs
      .filter((item) => item.message.trim().length > 0)
      .map((item) => {
        // Strip leading ISO timestamp that Loki sometimes embeds
        const message = item.message.replace(embeddedIsoTimestampRegex, "");
        const level = detectAppLogLevel(message);

        return {
          timestamp: formatAppLogTime(new Date(item.epochMs || Date.now())),
          level,
          message,
        };
      });
  }, [liveLogs.logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((line) => {
      if (searchQuery && !line.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (levelFilter !== "all" && line.level !== levelFilter) return false;
      return true;
    });
  }, [logs, searchQuery, levelFilter]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  if (allocationOptions.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-[4px] border border-dash-border bg-dash-bg-elevated">
        <span className="text-sm text-dash-text-faded">
          No application log container available for this project yet.
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
          className="flex-1 bg-dash-bg shadow-[0px_1px_2px_rgba(18,18,23,0.05)]"
          rightSlot={(
            <FilterDropdown
              value={levelFilter}
              onChange={setLevelFilter}
              options={levelFilterOptions}
              placeholder="All Levels"
              align="left"
            />
          )}
        />

        <DateRangePicker value={dateRange} onChange={setDateRange}>
          <button className="flex items-center overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg text-sm text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated">
            <span className="flex items-center gap-2 px-3 py-3">
              <Calendar className="size-3.5 text-dash-text-faded" />
              {dateRange?.from && dateRange?.to
                ? `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
                : "Select date range"}
            </span>
            <span className="flex h-full items-center border-l-[0.5px] border-dash-border px-2 py-3">
              <ChevronDown className="size-4 text-dash-text-faded" />
            </span>
          </button>
        </DateRangePicker>

      </div>

      {/* Terminal */}
      <div className="overflow-hidden rounded-[4px] bg-[#222528] shadow-[0_4px_32px_rgba(0,0,0,0.12)]">
        {/* Terminal header */}
        <div className="flex items-center justify-end border-b border-[#31363a] px-4 py-2">
          <div className="flex items-center gap-2">
            {!liveLogs.isPaused && (
              <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[#28c840]">
                <span className="size-1.5 animate-pulse rounded-full bg-[#28c840]" />
                Live
              </span>
            )}
            {allocationOptions.length > 0 && (
              <select
                value={selectedAllocation}
                onChange={(e) => setSelectedAllocation(e.target.value)}
                className="hidden cursor-pointer appearance-none rounded-md border border-white/10 bg-transparent px-2 py-1 font-logs text-[10px] tracking-wider text-white/40 outline-none transition-colors hover:border-white/20 hover:text-white/60 sm:inline"
              >
                {allocationOptions.map((option) => (
                  <option key={option.id} value={option.id} className="bg-[#222528] text-white/60">
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            {liveLogs.isPaused && liveLogs.pendingLogsCount > 0 && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#ff9b01]">
                {liveLogs.pendingLogsCount} pending
              </span>
            )}
            <button
              onClick={() => {
                if (liveLogs.isPaused) {
                  liveLogs.resume();
                } else {
                  liveLogs.pause();
                }
              }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white/40 transition-colors hover:bg-white/5 hover:text-white/60"
            >
              {liveLogs.isPaused ? (
                <>
                  <Play className="size-3" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="size-3" />
                  Pause
                </>
              )}
            </button>
            <button
              onClick={liveLogs.reconnect}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white/40 transition-colors hover:bg-white/5 hover:text-white/60"
            >
              <Activity className="size-3" />
              Reconnect
            </button>
          </div>
        </div>
        {liveLogs.error && (
          <div className="border-b border-[#442424] bg-[#2b1717] px-4 py-2 text-xs text-[#ff9f95]">
            {liveLogs.error}
          </div>
        )}

        {/* Log output */}
        <div className="relative">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="min-h-[400px] max-h-[600px] overflow-y-auto px-4 py-3 font-logs text-xs leading-[22px] [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.12)_transparent]"
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
                    setTimeout(() => setCopiedIdx((prev) => (prev === i ? null : prev)), 1200);
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
                    <LogMessage text={line.message} />
                  </span>
                  {copiedIdx === i && (
                    <span className="shrink-0 select-none pt-px text-[10px] text-[#28c840]">
                      Copied
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="flex h-[360px] items-center justify-center">
                <span className="text-sm text-white/30">
                  {liveLogs.isConnecting ? "Connecting to logs..." : "No logs matching your filters"}
                </span>
              </div>
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
  const re = /("(?:[^"\\]|\\.)*")(\s*:\s*)?|(\d+(?:\.\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)|([^"\d\w]+|\w+)/g;
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
        <span key={i} className={t.color}>{t.value}</span>
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

  const groups = [
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
        { label: "Status", value: String(log.status), dot: statusDot(log.status) },
        { label: "Duration", value: log.duration },
        { label: "Response", value: log.response },
      ],
    },
    {
      title: "Client",
      items: [
        { label: "IP Address", value: log.ip },
        { label: "Browser", value: log.browser },
        { label: "Time", value: log.isoTimestamp.replace("T", " ").replace("Z", "") },
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
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction="bottom" modal={false}>
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
                <span className={`font-logs text-xs font-medium ${methodColors[log.method] ?? "text-dash-text-body"}`}>
                  {log.method}
                </span>
                <span className="font-logs text-xs leading-[1.3] tracking-[-0.0224px] text-dash-text-strong">{log.path}</span>
                <span className={`flex items-center gap-1 font-logs text-xs ${statusColor(log.status)}`}>
                  <span className={`size-1.5 rounded-full ${statusDot(log.status)}`} />
                  {log.status}
                </span>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-2 rounded p-0.5 text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
              >
                <X className="size-4" />
                <span className="font-logs text-xs leading-[1.4] tracking-[-0.01px]">Close</span>
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
                      <div key={group.title} className="rounded-[4px] border-[0.5px] border-dash-border">
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
                              <span className="font-logs text-xs text-dash-text-faded">{item.label}</span>
                              <span className={`font-logs text-xs text-right ${item.color ?? "text-dash-text-strong"}`}>
                                {item.dot && <span className={`mr-1.5 inline-block size-1.5 rounded-full align-middle ${item.dot}`} />}
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
                          <span className="font-logs text-xs text-dash-text-faded">{item.label}</span>
                          <span className="font-logs text-xs text-dash-text-strong">{item.value}</span>
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
                    {copied ? <Check className="size-3 text-[#28c840]" /> : <Copy className="size-3" />}
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
}: {
  projectId: string;
  workspace?: string;
}) {
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
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    defaultRequestLogsDateRange,
  );

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
        const searchable = `${log.method} ${log.path} ${log.response} ${log.status}`.toLowerCase();
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
          className="flex-1 bg-dash-bg shadow-[0px_1px_2px_rgba(18,18,23,0.05)]"
          rightSlot={(
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
          )}
        />

        <DateRangePicker value={dateRange} onChange={setDateRange}>
          <button className="flex items-center overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg text-sm text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated">
            <span className="flex items-center gap-2 px-3 py-3">
              <Calendar className="size-3.5 text-dash-text-faded" />
              {dateRange?.from && dateRange?.to
                ? `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
                : "Select date range"}
            </span>
            <span className="flex h-full items-center border-l-[0.5px] border-dash-border px-2 py-3">
              <ChevronDown className="size-4 text-dash-text-faded" />
            </span>
          </button>
        </DateRangePicker>
      </div>

      {/* Table */}
      <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
        {/* Table header */}
        <div className="grid grid-cols-[64px_1fr_60px_80px_100px] items-center gap-2 border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-4 py-2.5">
          <span className="font-logs text-xs font-medium text-dash-text-faded">Method</span>
          <span className="font-logs text-xs font-medium text-dash-text-faded">Path</span>
          <span className="font-logs text-xs font-medium text-dash-text-faded">Status</span>
          <span className="font-logs text-xs font-medium text-dash-text-faded">Duration</span>
          <span className="font-logs text-xs font-medium text-dash-text-faded">Time</span>
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
              <span className={`font-logs text-xs font-medium ${methodColors[log.method] ?? "text-dash-text-body"}`}>
                {log.method}
              </span>
              <span className="truncate font-logs text-sm font-light text-dash-text-strong">
                {log.path}
              </span>
              <span className={`font-logs text-xs font-medium ${statusColor(log.status)}`}>
                {log.status}
              </span>
              <span className="font-logs text-xs font-light text-dash-text-faded">{log.duration}</span>
              <span className="font-logs text-xs font-light text-dash-text-faded">{log.timestamp}</span>
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
  const staticProject = isStaticProject(project);
  const databaseProject = isDatabaseProject(project as any);
  const [activeTab, setActiveTab] = useState<LogTab>(staticProject ? LogTab.Request : LogTab.Application);

  useEffect(() => {
    if (staticProject && activeTab !== LogTab.Request) {
      setActiveTab(LogTab.Request);
    }
    if (databaseProject && activeTab === LogTab.Request) {
      setActiveTab(LogTab.Application);
    }
  }, [staticProject, databaseProject, activeTab]);

  const { allocationOptions, allocationContainerByOptionId } = useMemo(() => {
    const options: DropdownOption[] = [];
    const containerMap: Record<string, string> = {};
    const seenIds = new Set<string>();

    function resolveId(rawId: unknown): string {
      if (rawId && typeof rawId === "object" && (rawId as any).$oid) return String((rawId as any).$oid);
      if (rawId != null && typeof rawId !== "object") return String(rawId).trim();
      return "";
    }

    if (Array.isArray(project?.job?.allocations)) {
      for (const [index, allocation] of project.job.allocations.entries()) {
        const container =
          typeof allocation?.container === "string" ? allocation.container.trim() : "";
        if (!container) continue;

        const optionId = resolveId(allocation?.id) || `${container}-${index}`;
        if (seenIds.has(optionId)) continue;

        seenIds.add(optionId);
        options.push({ id: optionId, label: container });
        containerMap[optionId] = container;
      }
    }

    const commonContainer =
      typeof project?.job?.commonContainer === "string"
        ? project.job.commonContainer.trim()
        : "";

    if (commonContainer && options.length === 0) {
      options.push({ id: commonContainer, label: commonContainer });
      containerMap[commonContainer] = commonContainer;
    }

    if (options.length === 1 && commonContainer && !containerMap[options[0].id]) {
      containerMap[options[0].id] = commonContainer;
    }

    return { allocationOptions: options, allocationContainerByOptionId: containerMap };
  }, [project?.job?.allocations, project?.job?.commonContainer]);

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <TabHeader title="Logs">
          Monitor your application and request logs in real-time.{" "}
          <a
            href="#"
            className="text-[#4879f8] underline transition-colors hover:text-[#3a6ae6]"
          >
            Learn more
          </a>
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
          allocationOptions={allocationOptions}
          allocationContainerByOptionId={allocationContainerByOptionId}
        />
      ) : (
        <RequestLogs projectId={project?.id || project?.name || ""} workspace={workspace} />
      )}
    </div>
  );
}
