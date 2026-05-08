import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Search } from "lucide-react";
import { useHaptics } from "@/hooks/use-haptics";

const ease = [0.16, 1, 0.3, 1] as const;

export interface DropdownOption {
  id: string;
  label: string;
  icon?: string;
  iconClassName?: string;
  disabled?: boolean;
  asideText?: string;
}

type ObjectProps = {
  value: string;
  options: DropdownOption[];
  onChange: (id: string) => void;
  renderOption?: never;
};

type StringProps = {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  renderOption?: (v: string) => string;
};

type DropdownProps = (ObjectProps | StringProps) & {
  placeholder?: string;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
};

export function Dropdown({
  value,
  options,
  onChange,
  placeholder,
  className,
  renderOption,
  searchable = false,
  searchPlaceholder = "Search...",
}: DropdownProps) {
  const haptics = useHaptics();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const MENU_MAX_HEIGHT = 200;
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, placement: "bottom" as "bottom" | "top" });
  const safeOptions = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const isObject = safeOptions.length > 0 && typeof safeOptions[0] === "object";
  const menuWidth = pos.width > 0 ? pos.width : 240;
  const trimmedQuery = query.trim().toLowerCase();
  const showSearch = searchable && safeOptions.length > 0;

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const flipAbove = spaceBelow < MENU_MAX_HEIGHT + 8 && spaceAbove > spaceBelow;
    setPos({
      top: flipAbove ? rect.top - MENU_MAX_HEIGHT - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      placement: flipAbove ? "top" : "bottom",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("scroll", updatePos, { capture: true, passive: true });
    window.addEventListener("resize", updatePos, { passive: true });
    return () => {
      window.removeEventListener("scroll", updatePos, { capture: true });
      window.removeEventListener("resize", updatePos);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    if (!showSearch) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, showSearch]);

  const selectedOption = isObject ? (safeOptions as DropdownOption[]).find((o) => o.id === value) : undefined;
  const displayLabel = isObject ? selectedOption?.label : renderOption ? renderOption(value) : value;

  const filteredObjectOptions = useMemo(
    () =>
      isObject
        ? (safeOptions as DropdownOption[]).filter((opt) => (trimmedQuery ? opt.label.toLowerCase().includes(trimmedQuery) : true))
        : [],
    [isObject, safeOptions, trimmedQuery],
  );

  const filteredStringOptions = useMemo(
    () =>
      !isObject
        ? (safeOptions as string[]).filter((opt) => {
            if (!trimmedQuery) {
              return true;
            }

            const label = renderOption ? renderOption(opt) : opt;
            return label.toLowerCase().includes(trimmedQuery);
          })
        : [],
    [isObject, renderOption, safeOptions, trimmedQuery],
  );

  const getNextEnabledIndex = useCallback(
    (start: number, direction: 1 | -1): number => {
      if (isObject) {
        const objectOptions = filteredObjectOptions;
        if (objectOptions.length === 0) {
          return -1;
        }

        for (let step = 1; step <= objectOptions.length; step += 1) {
          const candidate = (start + direction * step + objectOptions.length) % objectOptions.length;
          if (!objectOptions[candidate]?.disabled) {
            return candidate;
          }
        }

        return -1;
      }

      if (filteredStringOptions.length === 0) {
        return -1;
      }

      return (start + direction + filteredStringOptions.length) % filteredStringOptions.length;
    },
    [filteredObjectOptions, filteredStringOptions, isObject],
  );

  const selectHighlighted = useCallback(() => {
    if (highlightedIndex < 0) {
      return;
    }

    if (isObject) {
      const option = filteredObjectOptions[highlightedIndex];
      if (!option || option.disabled) {
        return;
      }

      haptics.selection();
      (onChange as (id: string) => void)(option.id);
      setOpen(false);
      return;
    }

    const option = filteredStringOptions[highlightedIndex];
    if (!option) {
      return;
    }

    haptics.selection();
    (onChange as (v: string) => void)(option);
    setOpen(false);
  }, [filteredObjectOptions, filteredStringOptions, haptics, highlightedIndex, isObject, onChange]);

  useEffect(() => {
    if (!open) {
      setHighlightedIndex(-1);
      return;
    }

    if (isObject) {
      if (filteredObjectOptions.length === 0) {
        setHighlightedIndex(-1);
        return;
      }

      const selectedIndex = filteredObjectOptions.findIndex((opt) => opt.id === value && !opt.disabled);
      if (selectedIndex >= 0) {
        setHighlightedIndex(selectedIndex);
        return;
      }

      setHighlightedIndex(getNextEnabledIndex(-1, 1));
      return;
    }

    if (filteredStringOptions.length === 0) {
      setHighlightedIndex(-1);
      return;
    }

    const selectedIndex = filteredStringOptions.findIndex((opt) => opt === value);
    if (selectedIndex >= 0) {
      setHighlightedIndex(selectedIndex);
      return;
    }

    setHighlightedIndex(0);
  }, [filteredObjectOptions, filteredStringOptions, getNextEnabledIndex, isObject, open, value]);

  useEffect(() => {
    if (!open || highlightedIndex < 0) {
      return;
    }

    const highlightedOption = menuRef.current?.querySelector<HTMLElement>(`[data-dropdown-index='${highlightedIndex}']`);
    highlightedOption?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  return (
    <div>
      <div ref={triggerRef}>
        {showSearch && open ? (
          <div
            className={`flex min-h-[46px] w-full items-center justify-between input-base px-3 py-2.5 text-sm leading-6 text-dash-text-strong ${className ?? ""}`}
            onMouseDown={(e) => {
              if (e.target instanceof HTMLElement && e.target.closest("button")) {
                return;
              }
              e.preventDefault();
              searchInputRef.current?.focus();
            }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Search className="size-3.5 shrink-0 text-dash-text-faded" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightedIndex((current) => getNextEnabledIndex(current < 0 ? -1 : current, 1));
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightedIndex((current) => getNextEnabledIndex(current < 0 ? 0 : current, -1));
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    selectHighlighted();
                    return;
                  }
                  if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm leading-6 text-dash-text-strong outline-none placeholder:text-[#9ca3af]"
              />
            </div>
            <button type="button" onClick={() => setOpen(false)} className="ml-2 shrink-0" aria-label="Close dropdown">
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease }} className="block">
                <ChevronDown className="size-3.5 text-dash-text-faded" />
              </motion.span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!open) {
                updatePos();
              }
              setOpen((prev) => !prev);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (!open) {
                  updatePos();
                  setOpen(true);
                  return;
                }
                const direction: 1 | -1 = e.key === "ArrowDown" ? 1 : -1;
                setHighlightedIndex((current) => getNextEnabledIndex(current < 0 ? -1 : current, direction));
                return;
              }

              if (e.key === "Enter" && open) {
                e.preventDefault();
                selectHighlighted();
              }
            }}
            className={`flex min-h-[46px] w-full items-center justify-between input-base px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af] ${className ?? ""}`}
          >
            <span className={`flex items-center gap-2 ${displayLabel ? "" : "text-[#9ca3af]"}`}>
              {selectedOption?.icon && (
                <img src={selectedOption.icon} alt="" className={`size-4 shrink-0 object-contain ${selectedOption.iconClassName ?? ""}`} />
              )}
              {displayLabel || placeholder || "Select..."}
            </span>
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease }}>
              <ChevronDown className="size-3.5 text-dash-text-faded" />
            </motion.span>
          </button>
        )}
      </div>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={menuRef}
                data-dropdown-menu
                initial={{ opacity: 0, y: pos.placement === "top" ? 4 : -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: pos.placement === "top" ? 4 : -4, scale: 0.98 }}
                transition={{ duration: 0.2, ease }}
                style={{
                  position: "fixed",
                  top: pos.top,
                  left: pos.left,
                  width: menuWidth,
                  zIndex: 9999,
                  pointerEvents: "auto",
                }}
                className="max-h-[200px] overflow-x-hidden overflow-y-auto overscroll-contain rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)] [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.15)_transparent]"
                onWheelCapture={(event) => {
                  event.stopPropagation();
                }}
                onTouchMoveCapture={(event) => {
                  event.stopPropagation();
                }}
              >
                {isObject
                  ? filteredObjectOptions.map((opt, index) => (
                      <button
                        key={opt.id}
                        type="button"
                        data-dropdown-index={index}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onClick={() => {
                          if (opt.disabled) {
                            return;
                          }
                          haptics.selection();
                          (onChange as (id: string) => void)(opt.id);
                          setOpen(false);
                        }}
                        disabled={opt.disabled}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-dash-bg-elevated ${
                          opt.disabled
                            ? "cursor-not-allowed text-dash-text-extra-faded hover:bg-transparent"
                            : opt.id === value
                              ? "font-medium text-dash-text-strong"
                              : "text-dash-text-faded"
                        } ${index === highlightedIndex && !opt.disabled ? "bg-dash-bg-elevated" : ""}`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {opt.icon && (
                            <img src={opt.icon} alt="" className={`size-4 shrink-0 object-contain ${opt.iconClassName ?? ""}`} />
                          )}
                          <span className="truncate">{opt.label}</span>
                        </span>
                        {opt.asideText && <span className="ml-auto shrink-0 text-[11px] text-[#4879f8]">{opt.asideText}</span>}
                      </button>
                    ))
                  : filteredStringOptions.map((opt, index) => (
                      <button
                        key={opt}
                        data-dropdown-index={index}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onClick={() => {
                          haptics.selection();
                          (onChange as (v: string) => void)(opt);
                          setOpen(false);
                        }}
                        className={`flex w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-dash-bg-elevated ${
                          opt === value ? "font-medium text-dash-text-strong" : "text-dash-text-faded"
                        } ${index === highlightedIndex ? "bg-dash-bg-elevated" : ""}`}
                      >
                        {renderOption ? renderOption(opt) : opt}
                      </button>
                    ))}
                {((isObject && filteredObjectOptions.length === 0) || (!isObject && filteredStringOptions.length === 0)) && (
                  <div className="px-3 py-2 text-sm text-dash-text-faded">No results found</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
