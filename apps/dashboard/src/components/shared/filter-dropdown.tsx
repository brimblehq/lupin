import { useState, useRef, useEffect } from "react";
import { SlidersHorizontal, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Spinner } from "./spinner";

export interface FilterOption {
  label: string;
  value: string;
  /** Colored dot shown beside the label */
  dot?: string;
}

interface FilterDropdownProps {
  /** The currently selected value */
  value: string;
  /** Called when a new option is selected */
  onChange: (value: string) => void;
  /** Available filter options. The first option is treated as the "all/reset" option (no dot). */
  options: FilterOption[];
  /** Placeholder text shown when the reset/all option is active. Default: "Filter status" */
  placeholder?: string;
  /** Custom trigger icon. Defaults to SlidersHorizontal. */
  icon?: React.ReactNode;
  /** Dropdown min-width. Default: 160 */
  dropdownWidth?: number;
  /** Alignment of the dropdown. Default: "right" */
  align?: "left" | "right";
  /** Show a loading spinner in the trigger */
  loading?: boolean;
}

export function FilterDropdown({
  value,
  onChange,
  options,
  placeholder = "Filter status",
  icon,
  dropdownWidth = 160,
  align = "right",
  loading = false,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const resetValue = options[0]?.value;
  const activeOption = options.find((o) => o.value === value);
  const displayLabel = value === resetValue ? placeholder : activeOption?.label;
  const activeDot = value !== resetValue ? activeOption?.dot : undefined;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-dash-text-body transition-colors hover:text-dash-text-strong"
      >
        {activeDot ? (
          <span
            className="size-[6px] shrink-0 rounded-full"
            style={{ backgroundColor: activeDot }}
          />
        ) : (
          icon ?? <SlidersHorizontal className="size-4" />
        )}
        {displayLabel}
        {loading ? <Spinner size="size-3.5" className="text-dash-text-faded" /> : null}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: dropdownWidth }}
            className={`absolute top-full z-50 mt-1 origin-top-right overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)] ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="mx-1 flex w-[calc(100%-8px)] items-center justify-between rounded-[2px] px-2 py-1.5 text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated dark:text-dash-text-strong"
              >
                <div className="flex items-center gap-2">
                  {option.dot && (
                    <span
                      className="size-[6px] rounded-full"
                      style={{ backgroundColor: option.dot }}
                    />
                  )}
                  {option.label}
                </div>
                {value === option.value && (
                  <Check className="size-3.5 text-[#4879f8]" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
