import { useState, useRef, useEffect } from "react";
import { Drawer } from "vaul";
import {
  Clock,
  ChevronRight,
  ChevronsDownUp,
  ChevronsDown,
  X,
  CheckCircle2,
  XCircle,
  CircleDashed,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { DownloadSimple } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useServerFn } from "@tanstack/react-start";
import { useHaptics } from "@/hooks/use-haptics";
import type { DeploymentDrawerLogEntry } from "@/utils/deployment-logs";
import { BUILD_PHASE_LABEL, summarizePhases } from "@/utils/deployment-logs";
import { downloadDeploymentLogsServerFn } from "@/server/deployments/actions";
import { LogAiDebugPanel, LOG_AI_DEBUG_MAX_MESSAGE_LENGTH } from "@/components/shared/log-ai-debug-panel";
import { useFeatureFlag, FeatureFlags } from "@/lib/feature-flags";

interface DeploymentLogsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environment: string;
  status: "Successful" | "Failed" | "Pending";
  deploymentStatus?: string;
  logs?: DeploymentDrawerLogEntry[];
  loading?: boolean;
  emptyMessage?: string;
  projectId?: string;
  deploymentId?: string;
  workspace?: string;
}

interface AiDebugSelection {
  message: string;
  messageId: string;
}

const statusDotColor = {
  Successful: "bg-[#13d282]",
  Failed: "bg-[#fc391e]",
  Pending: "bg-[#ff7a00]",
} as const;

const urlPattern = /(https?:\/\/[^\s]+)/g;
const errorPattern = /\b(error|failed|failure|fatal|panic|exception|timed out|timeout|context canceled|cancelled)\b/i;
const warningPattern = /\bwarning|deprecated\b/i;

function getLogLineTone(message: string): "error" | "warning" | "default" {
  if (errorPattern.test(message)) {
    return "error";
  }

  if (warningPattern.test(message)) {
    return "warning";
  }

  return "default";
}

function getDetailToneClasses(tone: "error" | "warning" | "default") {
  if (tone === "error") {
    return {
      row: "bg-[#fc391e]/6",
      text: "text-[#ff8f80]",
      timestamp: "text-[#ffb0a6]",
      link: "hover:text-[#ffe0db]",
    };
  }

  if (tone === "warning") {
    return {
      row: "bg-[#ff7a00]/6",
      text: "text-[#ffc07a]",
      timestamp: "text-[#ffd19f]",
      link: "hover:text-[#ffe5c4]",
    };
  }

  return {
    row: "",
    text: "text-dash-text-faded",
    timestamp: "text-dash-text-faded",
    link: "hover:text-dash-text-strong",
  };
}

function renderLogTextWithLinks(text: string, linkHoverClass = "hover:text-dash-text-strong") {
  const parts = text.split(urlPattern);

  return parts.map((part, index) => {
    if (/^https?:\/\/[^\s]+$/i.test(part)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline underline-offset-2 ${linkHoverClass}`}
          onClick={(event) => event.stopPropagation()}
        >
          {part}
        </a>
      );
    }

    return <span key={`${index}-${part}`}>{part}</span>;
  });
}

function triggerFileDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadLogsClientFallback(logs: DeploymentDrawerLogEntry[]) {
  const text = logs.map((l) => `[${l.timestamp}] ${l.message}`).join("\n");
  triggerFileDownload(text, `deployment-logs-${Date.now()}.log`);
}

function isBuildInProgress(status?: string): boolean {
  const value = status?.trim().toLowerCase();
  return value === "inprogress" || value === "pending";
}

function formatPhaseDuration(ms: number): string {
  if (ms < 1000) {
    return "<1s";
  }
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

export function DeploymentLogsDrawer({
  open,
  onOpenChange,
  environment,
  status,
  deploymentStatus,
  logs = [],
  loading = false,
  emptyMessage = "No logs available for this deployment yet.",
  projectId,
  deploymentId,
  workspace,
}: DeploymentLogsDrawerProps) {
  const haptics = useHaptics();
  const downloadFromApi = useServerFn(downloadDeploymentLogsServerFn as any) as (args: {
    data: { projectId: string; logId: string; workspace?: string };
  }) => Promise<{ content: string; filename: string }>;
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [aiDebugSelection, setAiDebugSelection] = useState<AiDebugSelection | null>(null);
  const aiDebugEnabled = useFeatureFlag(FeatureFlags.ENABLE_AI_DEBUG);
  const [copiedRowIndex, setCopiedRowIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const buildInProgress = isBuildInProgress(deploymentStatus);

  useEffect(() => {
    if (!open) {
      return;
    }

    setCollapsedSections(new Set());
    setAiDebugSelection(null);
    setAutoScroll(true);
    setCopiedAll(false);
    lastScrollTopRef.current = 0;
  }, [open]);

  useEffect(() => {
    if (!open || !autoScroll || !scrollRef.current) {
      return;
    }

    const el = scrollRef.current;
    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };

    const rafId = window.requestAnimationFrame(scrollToBottom);

    const observer = new ResizeObserver(scrollToBottom);
    observer.observe(el);
    const inner = el.firstElementChild;
    if (inner instanceof Element) {
      observer.observe(inner);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [autoScroll, open, logs, collapsedSections]);

  const phaseSummaries = summarizePhases(logs);
  const activePhase = phaseSummaries.length > 0 ? phaseSummaries[phaseSummaries.length - 1].phase : null;
  const showPhaseRail = phaseSummaries.length > 0;

  const successCount = logs.filter((l) => l.type === "section" && l.status === "success").length;
  const errorCount = logs.filter((l) => {
    if (l.type === "section" && l.status === "error") {
      return true;
    }

    if (l.type === "detail") {
      return getLogLineTone(l.message) === "error";
    }

    return false;
  }).length;

  function toggleSection(index: number) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function collapseAll() {
    const sections = new Set<number>();
    logs.forEach((l, i) => {
      if (l.type === "section") sections.add(i);
    });
    setCollapsedSections(sections);
  }

  function handleBodyScroll() {
    if (!scrollRef.current) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const previousScrollTop = lastScrollTopRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const isScrollingUp = scrollTop < previousScrollTop - 1;

    lastScrollTopRef.current = scrollTop;

    if (isScrollingUp) {
      if (autoScroll) {
        setAutoScroll(false);
      }
      return;
    }

    if (distanceToBottom < 32 && !autoScroll) {
      setAutoScroll(true);
    }
  }

  function copyLogLine(log: DeploymentDrawerLogEntry, index: number) {
    if (window.getSelection()?.toString()) {
      return;
    }
    const text = `[${log.timestamp}] ${log.message}`;
    void navigator.clipboard.writeText(text);
    haptics.light();
    setCopiedRowIndex(index);
    window.setTimeout(() => {
      setCopiedRowIndex((prev) => (prev === index ? null : prev));
    }, 1200);
  }

  function copyAllLogs() {
    if (logs.length === 0) {
      return;
    }
    const text = logs.map((l) => `[${l.timestamp}] ${l.message}`).join("\n");
    void navigator.clipboard.writeText(text);
    haptics.light();
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 1500);
  }

  const visibleRows: { log: DeploymentDrawerLogEntry; index: number }[] = [];
  let currentSectionIndex: number | null = null;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    if (log.type === "section") {
      currentSectionIndex = i;
      visibleRows.push({ log, index: i });
    } else {
      const isCollapsed = currentSectionIndex !== null && collapsedSections.has(currentSectionIndex);
      if (!isCollapsed) {
        visibleRows.push({ log, index: i });
      }
    }
  }

  function sectionHasChildren(sectionIndex: number): boolean {
    for (let i = sectionIndex + 1; i < logs.length; i++) {
      const next = logs[i];

      if (next.type === "section") {
        return false;
      }

      if (next.type === "detail") {
        return true;
      }
    }

    return false;
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
            className="flex max-h-[80dvh] flex-col overflow-clip rounded-t-[4px] border-t-[0.5px] border-[#d9dadd] bg-dash-bg shadow-[0px_-4px_20px_-8px_rgba(0,0,0,0.15)] sm:max-h-[60vh] dark:border-dash-border dark:bg-[#181819]"
          >
            {/* ─── Drag handle ─── */}
            <div className="flex shrink-0 cursor-grab items-center justify-center py-2 active:cursor-grabbing">
              <div className="h-1 w-8 rounded-full bg-dash-border" />
            </div>

            {/* ─── Top bar ─── */}
            <div className="flex shrink-0 flex-col gap-2 border-b-[0.5px] border-[#e5e5e5] px-3.5 pb-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-dash-border">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-dash-text-faded" />
                <span className="text-sm leading-[1.3] tracking-[-0.0224px] text-dash-text-strong">Build History</span>
              </div>

              <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-1 sm:justify-end sm:gap-6">
                {/* Counters */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 p-0.5">
                    <CheckCircle2 className="size-3 text-[#13d282]" />
                    <span className="font-logs text-xs leading-[1.4] tracking-[-0.01px] text-dash-text-faded">[{successCount}]</span>
                  </div>
                  <div className="flex items-center gap-0.5 p-0.5">
                    <span className="flex size-3 items-center justify-center rounded-full bg-[#fc391e]">
                      <X className="size-[5px] text-white" strokeWidth={3} />
                    </span>
                    <span className="font-logs text-xs leading-[1.4] tracking-[-0.01px] text-dash-text-faded">[{errorCount}]</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                  <button
                    onClick={() => {
                      setAutoScroll(true);
                      scrollRef.current?.scrollTo({
                        top: scrollRef.current.scrollHeight,
                        behavior: "smooth",
                      });
                    }}
                    className="flex items-center gap-1.5 rounded px-1 py-0.5 text-dash-text-strong transition-colors hover:bg-dash-bg-elevated sm:gap-2 sm:px-0.5"
                  >
                    <ChevronsDown className="size-4" />
                    <span className="font-logs text-xs leading-[1.4] tracking-[-0.01px] sm:inline">Bottom</span>
                  </button>
                  <button
                    onClick={copyAllLogs}
                    disabled={logs.length === 0}
                    className="flex items-center gap-1.5 rounded px-1 py-0.5 text-dash-text-strong transition-colors hover:bg-dash-bg-elevated disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent sm:gap-2 sm:px-0.5"
                  >
                    {copiedAll ? <Check className="size-4 text-[#13d282]" /> : <Copy className="size-4" />}
                    <span className="font-logs text-xs leading-[1.4] tracking-[-0.01px]">{copiedAll ? "Copied" : "Copy all"}</span>
                  </button>
                  <button
                    onClick={() => {
                      void (async () => {
                        if (projectId && deploymentId) {
                          try {
                            const result = await downloadFromApi({
                              data: { projectId, logId: deploymentId, workspace },
                            });
                            const filename = result.filename.endsWith(".log")
                              ? result.filename
                              : `${result.filename.replace(/\.\w+$/, "")}.log`;
                            triggerFileDownload(result.content, filename);
                            return;
                          } catch {
                            // fall through to client-side download
                          }
                        }
                        downloadLogsClientFallback(logs);
                      })();
                    }}
                    className="flex items-center gap-1.5 rounded px-1 py-0.5 text-dash-text-strong transition-colors hover:bg-dash-bg-elevated sm:gap-2 sm:px-0.5"
                  >
                    <DownloadSimple className="size-4" />
                    <span className="font-logs text-xs leading-[1.4] tracking-[-0.01px]">Download</span>
                  </button>
                  <button
                    onClick={collapseAll}
                    className="flex items-center gap-1.5 rounded px-1 py-0.5 text-dash-text-strong transition-colors hover:bg-dash-bg-elevated sm:gap-2 sm:px-0.5"
                  >
                    <ChevronsDownUp className="size-4" />
                    <span className="font-logs text-xs leading-[1.4] tracking-[-0.01px]">Collapse</span>
                  </button>
                  <button
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-1.5 rounded px-1 py-0.5 text-dash-text-strong transition-colors hover:bg-dash-bg-elevated sm:gap-2 sm:px-0.5"
                  >
                    <X className="size-4" />
                    <span className="font-logs text-xs leading-[1.4] tracking-[-0.01px]">Close</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ─── Phase rail ─── */}
            {showPhaseRail && (
              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b-[0.5px] border-[#e5e5e5] px-3.5 py-2 sm:px-5 dark:border-dash-border">
                {phaseSummaries.map((summary, i) => {
                  const isActive = summary.phase === activePhase && buildInProgress;
                  return (
                    <div key={summary.phase} className="flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full ${isActive ? "bg-[#ffb020]" : "bg-[#13d282]"}`} />
                      <span
                        className={`font-logs text-[11px] leading-[1.4] tracking-[-0.01px] ${
                          isActive ? "text-dash-text-strong" : "text-dash-text-faded"
                        }`}
                      >
                        {BUILD_PHASE_LABEL[summary.phase]}
                      </span>
                      <span className="font-logs text-[11px] leading-[1.4] tracking-[-0.01px] text-dash-text-extra-faded">
                        {formatPhaseDuration(summary.durationMs)}
                      </span>
                      {i < phaseSummaries.length - 1 && <span className="ml-1 font-logs text-[11px] text-dash-text-extra-faded">→</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── Log body ─── */}
            <div
              ref={scrollRef}
              onScroll={handleBodyScroll}
              className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.14)_transparent]"
            >
              <table className="w-full border-collapse">
                <tbody>
                  {loading ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <tr key={`skeleton-${index}`} className="border-b-[0.5px] border-[#e5e5e5] dark:border-[#2a2a2b]">
                        <td className="align-top">
                          <div className="flex items-center gap-3 py-2.5 pl-3.5 pr-2 sm:pl-5">
                            <div className="h-3.5 w-3.5 animate-pulse rounded bg-dash-border-soft" />
                            <div className="h-3.5 w-48 animate-pulse rounded bg-dash-border-soft sm:w-60" />
                          </div>
                        </td>
                        <td className="w-[88px] border-l-[0.5px] border-[#e5e5e5] align-top sm:w-[200px] dark:border-[#2a2a2b]">
                          <div className="py-2.5 pl-3 pr-2 sm:pl-4 sm:pr-3">
                            <div className="h-3.5 w-28 animate-pulse rounded bg-dash-border-soft" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-5 py-8 text-center text-sm text-dash-text-faded">
                        {emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map(({ log, index }) => {
                      const isSection = log.type === "section";
                      const isCollapsed = collapsedSections.has(index);
                      const canCollapse = isSection ? sectionHasChildren(index) : false;
                      const detailTone = getLogLineTone(log.message);
                      const detailClasses = getDetailToneClasses(detailTone);
                      const showDebugAction =
                        aiDebugEnabled &&
                        !isSection &&
                        log.message.trim().length <= LOG_AI_DEBUG_MAX_MESSAGE_LENGTH &&
                        (detailTone === "error" || detailTone === "warning") &&
                        Boolean(projectId && deploymentId && log.messageId);
                      const debugDisabled = showDebugAction && buildInProgress;

                      let rowClassName = "border-b-[0.5px] border-[#e5e5e5] dark:border-[#2a2a2b]";
                      if (!isSection && detailClasses.row) {
                        rowClassName = `${rowClassName} ${detailClasses.row}`;
                      }

                      return (
                        <tr key={index} className={rowClassName}>
                          <td className="align-top">
                            {isSection ? (
                              <button
                                onClick={() => {
                                  if (!canCollapse) {
                                    copyLogLine(log, index);
                                    return;
                                  }

                                  toggleSection(index);
                                }}
                                onDoubleClick={() => copyLogLine(log, index)}
                                className="flex w-full items-center gap-3 py-2.5 pl-3.5 pr-2 text-left transition-colors hover:bg-dash-bg-elevated sm:pl-5"
                              >
                                {canCollapse ? (
                                  <ChevronRight
                                    className={`size-3.5 shrink-0 text-dash-text-faded transition-transform duration-150 ${
                                      !isCollapsed ? "rotate-90" : ""
                                    }`}
                                  />
                                ) : (
                                  <span className="size-3.5 shrink-0" />
                                )}
                                {log.status === "success" && <CheckCircle2 className="size-3.5 shrink-0 text-[#13d282]" />}
                                {log.status === "error" && <XCircle className="size-3.5 shrink-0 text-[#fc391e]" />}
                                {log.status === "pending" && <CircleDashed className="size-3.5 shrink-0 text-[#ffb020]" />}
                                <span className="font-logs text-xs leading-[1.4] tracking-[-0.01px] text-dash-text-strong">
                                  {renderLogTextWithLinks(log.message)}
                                </span>
                                {copiedRowIndex === index && (
                                  <span className="ml-auto shrink-0 font-logs text-[10px] uppercase tracking-wider text-[#13d282]">
                                    Copied
                                  </span>
                                )}
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => copyLogLine(log, index)}
                                  className={`flex w-full items-start gap-3 pt-2.5 pl-9 pr-2 text-left transition-colors hover:bg-dash-bg-elevated sm:pl-12 ${
                                    showDebugAction ? "pb-1" : "pb-2.5"
                                  }`}
                                >
                                  <span
                                    className={`flex-1 whitespace-pre-wrap font-logs text-xs leading-[1.4] tracking-[-0.01px] ${detailClasses.text}`}
                                  >
                                    {renderLogTextWithLinks(log.message, detailClasses.link)}
                                  </span>
                                  {copiedRowIndex === index && (
                                    <span className="shrink-0 font-logs text-[10px] uppercase tracking-wider text-[#13d282]">Copied</span>
                                  )}
                                </button>
                                {showDebugAction && (
                                  <div className="flex items-center pb-2.5 pl-9 pr-2 sm:pl-12">
                                    <button
                                      type="button"
                                      disabled={debugDisabled}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (!log.messageId || debugDisabled) {
                                          return;
                                        }

                                        setAiDebugSelection({
                                          message: log.message,
                                          messageId: log.messageId,
                                        });
                                      }}
                                      title={debugDisabled ? "Debug with A.I is unavailable while the build is in progress." : undefined}
                                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-logs text-[10px] uppercase tracking-wider underline underline-offset-2 transition-colors ${
                                        debugDisabled
                                          ? "cursor-not-allowed text-dash-text-extra-faded decoration-dash-text-extra-faded/50 opacity-70"
                                          : "text-dash-text-strong decoration-dash-text-extra-faded hover:bg-dash-bg-elevated hover:decoration-dash-text-strong"
                                      }`}
                                    >
                                      <Sparkles className="size-3" />
                                      <span>Debug with A.I</span>
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </td>

                          <td className="w-[88px] border-l-[0.5px] border-[#e5e5e5] align-top dark:border-[#2a2a2b] sm:w-[200px]">
                            <div className="whitespace-nowrap py-2.5 pl-3 pr-2 sm:pl-4 sm:pr-3">
                              <span
                                className={`font-logs text-xs leading-[1.4] tracking-[-0.01px] ${
                                  isSection ? "text-dash-text-strong" : detailClasses.timestamp
                                }`}
                              >
                                {log.timestamp}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ─── Footer bar ─── */}
            <div className="flex shrink-0 items-center border-t-[0.5px] border-[#e5e5e5] px-5 py-3.5 dark:border-dash-border">
              <div className="flex items-center gap-2">
                <span className="flex size-4 items-center justify-center">
                  <span className={`size-1.5 rounded-full ${statusDotColor[status]}`} />
                </span>
                <span className="text-sm leading-[1.3] tracking-[-0.0224px] text-dash-text-strong">{environment} environment</span>
              </div>
            </div>
          </motion.div>
        </Drawer.Content>
      </Drawer.Portal>

      <LogAiDebugPanel
        open={aiDebugEnabled && aiDebugSelection !== null}
        onOpenChange={(next) => {
          if (!next) {
            setAiDebugSelection(null);
          }
        }}
        projectId={projectId ?? ""}
        logId={deploymentId ?? ""}
        messageId={aiDebugSelection?.messageId ?? ""}
        message={aiDebugSelection?.message ?? ""}
      />
    </Drawer.Root>
  );
}
