import { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";
import { Funnel } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import { Spinner } from "./spinner";
import { useHaptics } from "@/hooks/use-haptics";

export interface FilterOption {
  label: string;
  value: string;
  /** Colored dot shown beside the label */
  dot?: string;
}

export interface FilterSection {
  /** Optional uppercase header shown above the section's options */
  label?: string;
  /** The currently selected value within this section */
  value: string;
  /** Called when a new option in this section is selected */
  onChange: (value: string) => void;
  /** Options for this section. The first option is treated as the "all/reset" option. */
  options: FilterOption[];
}

interface FilterDropdownProps {
  /** The currently selected value (flat mode) */
  value?: string;
  /** Called when a new option is selected (flat mode) */
  onChange?: (value: string) => void;
  /** Available filter options (flat mode). The first option is treated as the "all/reset" option (no dot). */
  options?: FilterOption[];
  /** Grouped mode: independent sections each with their own selection. When provided, overrides value/onChange/options. */
  sections?: FilterSection[];
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
  sections,
  placeholder = "Filter status",
  icon,
  dropdownWidth = 160,
  align = "right",
  loading = false,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const haptics = useHaptics();

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

  const grouped = Array.isArray(sections) && sections.length > 0;

  let displayLabel: string | undefined;
  let activeDot: string | undefined;
  if (grouped) {
    const primary = sections[sections.length - 1];
    const activeOption = primary.options.find((o) => o.value === primary.value);
    displayLabel = activeOption?.label ?? placeholder;
    activeDot = activeOption?.dot;
  } else {
    const resetValue = options?.[0]?.value;
    const activeOption = options?.find((o) => o.value === value);
    displayLabel = value === resetValue ? placeholder : activeOption?.label;
    activeDot = value !== resetValue ? activeOption?.dot : undefined;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          haptics.selection();
          setOpen(!open);
        }}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-dash-text-body transition-colors hover:text-dash-text-strong"
      >
        {activeDot ? (
          <span className="size-[6px] shrink-0 rounded-full" style={{ backgroundColor: activeDot }} />
        ) : (
          (icon ?? <Funnel className="size-4" />)
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
            {grouped
              ? sections.map((section, sectionIndex) => (
                  <div
                    key={section.label ?? sectionIndex}
                    className={sectionIndex > 0 ? "mt-1 border-t-[0.5px] border-dash-border pt-1" : ""}
                  >
                    {section.label ? (
                      <div className="px-3 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-dash-text-extra-faded">
                        {section.label}
                      </div>
                    ) : null}
                    {section.options.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          haptics.selection();
                          section.onChange(option.value);
                        }}
                        className="mx-1 flex w-[calc(100%-8px)] items-center justify-between rounded-[2px] px-2 py-1.5 text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated dark:text-dash-text-strong"
                      >
                        <div className="flex items-center gap-2">
                          {option.dot && <span className="size-[6px] rounded-full" style={{ backgroundColor: option.dot }} />}
                          {option.label}
                        </div>
                        {section.value === option.value && <Check className="size-3.5 text-[#4879f8]" />}
                      </button>
                    ))}
                  </div>
                ))
              : (options ?? []).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      haptics.selection();
                      onChange?.(option.value);
                      setOpen(false);
                    }}
                    className="mx-1 flex w-[calc(100%-8px)] items-center justify-between rounded-[2px] px-2 py-1.5 text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated dark:text-dash-text-strong"
                  >
                    <div className="flex items-center gap-2">
                      {option.dot && <span className="size-[6px] rounded-full" style={{ backgroundColor: option.dot }} />}
                      {option.label}
                    </div>
                    {value === option.value && <Check className="size-3.5 text-[#4879f8]" />}
                  </button>
                ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
