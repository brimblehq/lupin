import { useState, useRef, useEffect } from "react";
import { Drawer } from "vaul";
import {
  Clock,
  ChevronRight,
  ChevronsDownUp,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";

interface LogEntry {
  type: "section" | "detail";
  message: string;
  timestamp: string;
  status?: "success" | "error";
}

interface DeploymentLogsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environment: string;
  status: "Successful" | "Failed" | "Pending";
  logs?: LogEntry[];
}

const mockLogs: LogEntry[] = [
  {
    type: "section",
    message: "deployment queued starting soon",
    timestamp: "we 11/08/2024 17:59:21",
  },
  {
    type: "detail",
    message: "workflow id:random-string",
    timestamp: "we 11/08/2024 17:59:21",
  },
  {
    type: "section",
    message: "deployment started",
    timestamp: "we 11/08/2024 17:59:21",
    status: "success",
  },
  {
    type: "detail",
    message:
      "cloning from github.com/kemdirimakujuobi/kemdirim.design.git(branch:main, commit: 6ef3446)",
    timestamp: "we 11/08/2024 17:59:21",
  },
  {
    type: "detail",
    message: "cloning completed successfully",
    timestamp: "we 11/08/2024 17:59:21",
  },
  {
    type: "detail",
    message: "checking out branch main with commit 6ef3446",
    timestamp: "we 11/08/2024 17:59:21",
  },
  {
    type: "detail",
    message: 'running "brimble build" command',
    timestamp: "we 11/08/2024 17:59:21",
  },
  {
    type: "detail",
    message: "serving to http://127.0.0.1:46587 - PID: 768332",
    timestamp: "we 11/08/2024 17:59:21",
  },
  {
    type: "detail",
    message:
      '{"level":"info","message":"got a bug or suggestion? please report it on https://bit.ly/3cE7iZu or create an issue on Github: https://github.com/brimblehq/brimble/issues"}',
    timestamp: "we 11/08/2024 17:59:21",
  },
  {
    type: "section",
    message:
      "site is live. visit https://kemdirimakujuobi.brimble.app to view your project",
    timestamp: "we 11/08/2024 17:59:21",
    status: "success",
  },
];

const statusDotColor = {
  Successful: "bg-[#13d282]",
  Failed: "bg-[#fc391e]",
  Pending: "bg-[#ff7a00]",
} as const;

export function DeploymentLogsDrawer({
  open,
  onOpenChange,
  environment,
  status,
  logs = mockLogs,
}: DeploymentLogsDrawerProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(
    new Set(),
  );
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onOpenChange]);

  const successCount = logs.filter(
    (l) => l.type === "section" && l.status === "success",
  ).length;
  const errorCount = logs.filter(
    (l) => l.type === "section" && l.status === "error",
  ).length;

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

  // Build visible rows
  const visibleRows: { log: LogEntry; index: number }[] = [];
  let currentSectionIndex: number | null = null;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    if (log.type === "section") {
      currentSectionIndex = i;
      visibleRows.push({ log, index: i });
    } else {
      const isCollapsed =
        currentSectionIndex !== null &&
        collapsedSections.has(currentSectionIndex);
      if (!isCollapsed) {
        visibleRows.push({ log, index: i });
      }
    }
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
            ref={drawerRef}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="flex max-h-[60vh] flex-col overflow-clip rounded-t-[4px] border-t-[0.5px] border-[#d9dadd] bg-dash-bg shadow-[0px_-4px_20px_-8px_rgba(0,0,0,0.15)] dark:border-dash-border dark:bg-[#181819]"
          >
            {/* ─── Top bar ─── */}
            <div className="flex shrink-0 items-center justify-between border-b-[0.5px] border-[#e5e5e5] px-5 py-3.5 dark:border-dash-border">
              {/* Left: Run History */}
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-dash-text-faded" />
                <span className="text-sm leading-[1.3] tracking-[-0.0224px] text-dash-text-strong">
                  Run History
                </span>
              </div>

              {/* Right: counters + actions */}
              <div className="flex flex-1 items-center justify-end gap-6">
                {/* Counters */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 p-0.5">
                    <CheckCircle2 className="size-3 text-[#13d282]" />
                    <span className="font-logs text-xs leading-[1.4] tracking-[-0.01px] text-dash-text-faded">
                      [{successCount}]
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 p-0.5">
                    <span className="flex size-3 items-center justify-center rounded-full bg-[#fc391e]">
                      <X className="size-[5px] text-white" strokeWidth={3} />
                    </span>
                    <span className="font-logs text-xs leading-[1.4] tracking-[-0.01px] text-dash-text-faded">
                      [{errorCount}]
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={collapseAll}
                    className="flex items-center gap-2 rounded p-0.5 text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
                  >
                    <ChevronsDownUp className="size-4" />
                    <span className="font-logs text-xs leading-[1.4] tracking-[-0.01px]">
                      Collapse
                    </span>
                  </button>
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
              </div>
            </div>

            {/* ─── Log body — single scrollable table so rows stay aligned ─── */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full border-collapse">
                <tbody>
                  {visibleRows.map(({ log, index }) => {
                    const isSection = log.type === "section";
                    const isCollapsed = collapsedSections.has(index);

                    return (
                      <tr
                        key={index}
                        className="border-b-[0.5px] border-[#e5e5e5] dark:border-[#2a2a2b]"
                      >
                        {/* Log message cell */}
                        <td className="align-top">
                          {isSection ? (
                            <button
                              onClick={() => toggleSection(index)}
                              className="flex w-full items-center gap-3 py-2.5 pl-5 pr-2 text-left transition-colors hover:bg-dash-bg-elevated"
                            >
                              <ChevronRight
                                className={`size-3.5 shrink-0 text-dash-text-faded transition-transform duration-150 ${
                                  !isCollapsed ? "rotate-90" : ""
                                }`}
                              />
                              {log.status === "success" && (
                                <CheckCircle2 className="size-3.5 shrink-0 text-[#13d282]" />
                              )}
                              {log.status === "error" && (
                                <XCircle className="size-3.5 shrink-0 text-[#fc391e]" />
                              )}
                              <span className="font-logs text-xs leading-[1.4] tracking-[-0.01px] text-dash-text-strong">
                                {log.message}
                              </span>
                            </button>
                          ) : (
                            <div className="py-2.5 pl-12 pr-2">
                              <span className="whitespace-pre-wrap font-logs text-xs leading-[1.4] tracking-[-0.01px] text-dash-text-faded">
                                {log.message}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Timestamp cell */}
                        <td className="w-[100px] border-l-[0.5px] sm:w-[200px] border-[#e5e5e5] align-top dark:border-[#2a2a2b]">
                          <div className="whitespace-nowrap py-2.5 pl-4 pr-3">
                            <span
                              className={`font-logs text-xs leading-[1.4] tracking-[-0.01px] ${
                                isSection
                                  ? "text-dash-text-strong"
                                  : "text-dash-text-faded"
                              }`}
                            >
                              {log.timestamp}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ─── Footer bar ─── */}
            <div className="flex shrink-0 items-center border-t-[0.5px] border-[#e5e5e5] px-5 py-3.5 dark:border-dash-border">
              <div className="flex items-center gap-2">
                <span className="flex size-4 items-center justify-center">
                  <span
                    className={`size-1.5 rounded-full ${statusDotColor[status]}`}
                  />
                </span>
                <span className="text-sm leading-[1.3] tracking-[-0.0224px] text-dash-text-strong">
                  {environment} environment
                </span>
              </div>
            </div>
          </motion.div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
