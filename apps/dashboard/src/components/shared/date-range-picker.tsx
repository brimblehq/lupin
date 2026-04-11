import { useState, useRef, useEffect } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
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

function clampRangeToBounds(
  range: DateRange | undefined,
  minDate?: Date,
  maxDate?: Date,
): DateRange | undefined {
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

export function DateRangePicker({
  value,
  onChange,
  minDate,
  maxDate,
  children,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(
    clampRangeToBounds(value, minDate, maxDate),
  );
  const ref = useRef<HTMLDivElement>(null);

  // Sync draft when value changes externally
  useEffect(() => {
    setDraft(clampRangeToBounds(value, minDate, maxDate));
  }, [value, minDate, maxDate]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleApply() {
    onChange(clampRangeToBounds(draft, minDate, maxDate));
    setOpen(false);
  }

  function handleCancel() {
    setDraft(value);
    setOpen(false);
  }

  const rangeLabel =
    draft?.from && draft?.to
      ? `${format(draft.from, "MMM d, yyyy")} - ${format(draft.to, "MMM d, yyyy")}`
      : draft?.from
        ? `${format(draft.from, "MMM d, yyyy")} - ...`
        : "Select a range";

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
            className="absolute right-0 top-full z-50 mt-1.5 origin-top-right"
          >
            <div className="brimble-date-picker flex flex-col overflow-clip rounded-[4px] border-[0.5px] border-[#d9dadd] bg-dash-bg shadow-[0px_4px_20px_-8px_rgba(18,18,23,0.25),0px_1px_2px_rgba(18,18,23,0.07)] dark:border-dash-border">
              {/* Calendar area */}
              <DayPicker
                mode="range"
                numberOfMonths={2}
                selected={draft}
                onSelect={setDraft}
                disabled={[
                  ...(minDate ? [{ before: minDate }] : []),
                  ...(maxDate ? [{ after: maxDate }] : []),
                ]}
                showOutsideDays
                weekStartsOn={1}
                classNames={{
                  root: "relative",
                  months: "rdp-months flex",
                  month: "rdp-month relative w-[296px]",
                  month_caption:
                    "rdp-month_caption flex items-center justify-center border-b-[0.5px] border-[#d9dadd] px-3 py-3 dark:border-dash-border",
                  caption_label:
                    "text-[13px] font-medium leading-5 text-dash-text-strong",
                  nav: "flex items-center",
                  button_previous:
                    "absolute left-3 top-2.5 z-10 inline-flex size-7 items-center justify-center rounded-[6px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong",
                  button_next:
                    "absolute right-3 top-2.5 z-10 inline-flex size-7 items-center justify-center rounded-[6px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong",
                  month_grid: "w-full border-collapse",
                  weekdays: "rdp-weekdays flex",
                  weekday:
                    "rdp-weekday flex h-8 flex-1 items-center justify-center text-[13px] font-medium text-dash-text-faded",
                  week: "rdp-week flex",
                  day: "rdp-day relative flex h-8 flex-1 items-center justify-center text-[13px] font-medium text-dash-text-strong",
                  day_button:
                    "rdp-day_button relative z-10 inline-flex size-8 items-center justify-center rounded-[6px] text-[13px] transition-colors hover:bg-dash-bg-elevated",
                  selected: "rdp-selected",
                  range_start: "rdp-range-start",
                  range_end: "rdp-range-end",
                  range_middle: "rdp-range-middle",
                  outside:
                    "rdp-outside [&_.rdp-day_button]:text-[#d1d5db] dark:[&_.rdp-day_button]:text-[#555]",
                  disabled: "opacity-25 pointer-events-none",
                  today: "rdp-today",
                }}
                components={{
                  Chevron: ({ orientation }) =>
                    orientation === "left" ? (
                      <ChevronLeft className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    ),
                }}
              />

              {/* Footer */}
              <div className="flex items-center justify-between border-t-[0.5px] border-[#d9dadd] px-4 py-3.5 dark:border-dash-border">
                <div className="flex items-center gap-1 text-[13px] font-medium leading-5">
                  <span className="text-dash-text-faded">Range:</span>
                  <span className="text-dash-text-strong">{rangeLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancel}
                    className="flex h-[34px] items-center rounded-[4px] border border-dash-border-soft bg-dash-bg px-3.5 text-sm font-medium text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApply}
                    className="flex h-[34px] items-center rounded-[4px] bg-[#010f1a] px-4 text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-[#0a1f2e] dark:bg-white dark:text-[#010f1a] dark:hover:bg-white/90"
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
