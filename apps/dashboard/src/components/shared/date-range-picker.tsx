import { useState, useRef, useEffect } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  getResetValue?: () => DateRange | undefined;
  minDate?: Date;
  maxDate?: Date;
  includeTime?: boolean;
  /** Trigger element — the button that opens the picker */
  children: React.ReactNode;
}

function clampDateToBounds(date: Date, minDate?: Date, maxDate?: Date): Date {
  let value = date.getTime();
  if (minDate) {
    value = Math.max(value, minDate.getTime());
  }
  if (maxDate) {
    value = Math.min(value, maxDate.getTime());
  }
  return new Date(value);
}

function clampRangeToBounds(range: DateRange | undefined, minDate?: Date, maxDate?: Date): DateRange | undefined {
  if (!range) return undefined;

  const next: Partial<DateRange> = {};
  if (range.from instanceof Date) {
    next.from = clampDateToBounds(range.from, minDate, maxDate);
  }
  if (range.to instanceof Date) {
    next.to = clampDateToBounds(range.to, minDate, maxDate);
  }

  if (!next.from && next.to) {
    next.from = next.to;
  }

  if (next.from && next.to && next.from.getTime() > next.to.getTime()) {
    next.to = next.from;
  }

  return { from: next.from, to: next.to };
}

function formatTimeValue(date?: Date): string {
  return date ? format(date, "HH:mm") : "";
}

function applyTime(date: Date, time: string): Date {
  const [hours = "0", minutes = "0"] = time.split(":");
  const next = new Date(date);
  next.setHours(Number(hours), Number(minutes), 0, 0);
  return next;
}

function mergeDateWithTime(date: Date, timeSource: Date | undefined, fallback: string): Date {
  return applyTime(date, timeSource ? formatTimeValue(timeSource) : fallback);
}

function formatRangeLabel(range: DateRange | undefined, dateFormat: string): string {
  if (range?.from && range?.to) {
    return `${format(range.from, dateFormat)} - ${format(range.to, dateFormat)}`;
  }

  if (range?.from) {
    return `${format(range.from, dateFormat)} - ...`;
  }

  return "Select a range";
}

export function DateRangePicker({ value, onChange, getResetValue, minDate, maxDate, includeTime = false, children }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)").matches : false,
  );
  const [draft, setDraft] = useState<DateRange | undefined>(clampRangeToBounds(value, minDate, maxDate));
  const ref = useRef<HTMLDivElement>(null);

  // Sync draft when value changes externally
  useEffect(() => {
    setDraft(clampRangeToBounds(value, minDate, maxDate));
  }, [value, minDate, maxDate]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 639px)");
    const updateViewportMode = () => {
      setIsMobileView(media.matches);
    };

    updateViewportMode();
    media.addEventListener("change", updateViewportMode);
    return () => media.removeEventListener("change", updateViewportMode);
  }, []);

  function handleApply() {
    onChange(clampRangeToBounds(draft, minDate, maxDate));
    setOpen(false);
  }

  function handleCancel() {
    setDraft(value);
    setOpen(false);
  }

  function handleReset() {
    if (!getResetValue) return;

    const next = clampRangeToBounds(getResetValue(), minDate, maxDate);
    setDraft(next);
    onChange(next);
    setOpen(false);
  }

  const dateFormat = includeTime ? "MMM d, yyyy HH:mm" : "MMM d, yyyy";
  const rangeLabel = formatRangeLabel(draft, dateFormat);

  function handleDateSelect(range: DateRange | undefined) {
    if (!includeTime) {
      setDraft(range);
      return;
    }

    setDraft((prev) => ({
      from: range?.from ? mergeDateWithTime(range.from, prev?.from, "00:00") : undefined,
      to: range?.to ? mergeDateWithTime(range.to, prev?.to, "23:59") : undefined,
    }));
  }

  function handleTimeChange(field: "from" | "to", time: string) {
    setDraft((prev) => {
      if (!prev?.[field]) {
        return prev;
      }

      return clampRangeToBounds(
        {
          ...prev,
          [field]: applyTime(prev[field], time),
        },
        minDate,
        maxDate,
      );
    });
  }

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(!open)}>{children}</div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 right-0 top-full z-50 mt-1.5 origin-top sm:left-auto sm:right-0 sm:origin-top-right"
          >
            <div className="brimble-date-picker flex w-full flex-col overflow-clip rounded-[4px] border-[0.5px] border-[#d9dadd] bg-dash-bg shadow-[0px_4px_20px_-8px_rgba(18,18,23,0.25),0px_1px_2px_rgba(18,18,23,0.07)] sm:w-auto dark:border-dash-border">
              {/* Calendar area */}
              <DayPicker
                mode="range"
                numberOfMonths={isMobileView ? 1 : 2}
                selected={draft}
                onSelect={handleDateSelect}
                disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
                showOutsideDays
                weekStartsOn={1}
                classNames={{
                  root: "relative",
                  months: "rdp-months flex flex-col sm:flex-row",
                  month: "rdp-month relative w-full sm:w-[296px]",
                  month_caption:
                    "rdp-month_caption flex items-center justify-center border-b-[0.5px] border-[#d9dadd] px-3 py-3 dark:border-dash-border",
                  caption_label: "text-[13px] font-medium leading-5 text-dash-text-strong",
                  nav: "flex items-center",
                  button_previous:
                    "absolute left-3 top-2.5 z-10 inline-flex size-7 items-center justify-center rounded-[6px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong",
                  button_next:
                    "absolute right-3 top-2.5 z-10 inline-flex size-7 items-center justify-center rounded-[6px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong",
                  month_grid: "w-full border-collapse",
                  weekdays: "rdp-weekdays flex",
                  weekday: "rdp-weekday flex h-8 flex-1 items-center justify-center text-[13px] font-medium text-dash-text-faded",
                  week: "rdp-week flex",
                  day: "rdp-day relative flex h-8 flex-1 items-center justify-center text-[13px] font-medium text-dash-text-strong",
                  day_button:
                    "rdp-day_button relative z-10 inline-flex size-8 items-center justify-center rounded-[6px] text-[13px] transition-colors hover:bg-dash-bg-elevated",
                  selected: "rdp-selected",
                  range_start: "rdp-range-start",
                  range_end: "rdp-range-end",
                  range_middle: "rdp-range-middle",
                  outside: "rdp-outside [&_.rdp-day_button]:text-[#d1d5db] dark:[&_.rdp-day_button]:text-[#555]",
                  disabled: "opacity-25 pointer-events-none",
                  today: "rdp-today",
                }}
                components={{
                  Chevron: ({ orientation }) =>
                    orientation === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />,
                }}
              />

              {includeTime && (
                <div className="grid gap-3 border-t-[0.5px] border-[#d9dadd] px-4 py-3 sm:grid-cols-2 dark:border-dash-border">
                  <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-dash-text-faded">
                    From
                    <input
                      type="time"
                      value={formatTimeValue(draft?.from)}
                      onChange={(event) => handleTimeChange("from", event.target.value)}
                      disabled={!draft?.from}
                      className="h-9 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-2.5 text-sm font-medium tracking-normal text-dash-text-strong outline-none transition-colors focus:border-[#4879f8] disabled:opacity-40"
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-dash-text-faded">
                    To
                    <input
                      type="time"
                      value={formatTimeValue(draft?.to)}
                      onChange={(event) => handleTimeChange("to", event.target.value)}
                      disabled={!draft?.to}
                      className="h-9 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-2.5 text-sm font-medium tracking-normal text-dash-text-strong outline-none transition-colors focus:border-[#4879f8] disabled:opacity-40"
                    />
                  </label>
                </div>
              )}

              {/* Footer */}
              <div className="flex flex-col gap-3 border-t-[0.5px] border-[#d9dadd] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-dash-border">
                <div className="min-w-0 text-[13px] font-medium leading-5">
                  <span className="text-dash-text-faded">Range:</span>
                  <span className="ml-1 inline-block max-w-full truncate align-bottom text-dash-text-strong">{rangeLabel}</span>
                </div>
                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                  {getResetValue && (
                    <button
                      onClick={handleReset}
                      className="flex h-[34px] flex-1 items-center justify-center rounded-[4px] border border-transparent bg-transparent px-3 text-sm font-medium text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong sm:flex-none"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={handleCancel}
                    className="flex h-[34px] flex-1 items-center justify-center rounded-[4px] border border-dash-border-soft bg-dash-bg px-3.5 text-sm font-medium text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated sm:flex-none"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApply}
                    className="flex h-[34px] flex-1 items-center justify-center rounded-[4px] bg-[#010f1a] px-4 text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-[#0a1f2e] sm:flex-none dark:bg-white dark:text-[#010f1a] dark:hover:bg-white/90"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
