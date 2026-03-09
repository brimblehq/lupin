import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Search } from "lucide-react";
import { useHaptics } from "@/hooks/use-haptics";

const ease = [0.16, 1, 0.3, 1] as const;

export interface DropdownOption {
  id: string;
  label: string;
  icon?: string;
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
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const safeOptions = Array.isArray(options) ? options : [];
  const isObject = safeOptions.length > 0 && typeof safeOptions[0] === "object";
  const menuWidth = pos.width > 0 ? pos.width : 240;
  const trimmedQuery = query.trim().toLowerCase();
  const showSearch = searchable && safeOptions.length > 0;

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
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
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      )
        return;
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

  const selectedOption = isObject
    ? (safeOptions as DropdownOption[]).find((o) => o.id === value)
    : undefined;
  const displayLabel = isObject
    ? selectedOption?.label
    : renderOption
      ? renderOption(value)
      : value;

  const filteredObjectOptions = isObject
    ? (safeOptions as DropdownOption[]).filter((opt) =>
        trimmedQuery ? opt.label.toLowerCase().includes(trimmedQuery) : true,
      )
    : [];

  const filteredStringOptions = !isObject
    ? (safeOptions as string[]).filter((opt) => {
        if (!trimmedQuery) {
          return true;
        }

        const label = renderOption ? renderOption(opt) : opt;
        return label.toLowerCase().includes(trimmedQuery);
      })
    : [];

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
                  if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm leading-6 text-dash-text-strong outline-none placeholder:text-[#9ca3af]"
              />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-2 shrink-0"
              aria-label="Close dropdown"
            >
              <motion.span
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ duration: 0.2, ease }}
                className="block"
              >
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
            className={`flex min-h-[46px] w-full items-center justify-between input-base px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af] ${className ?? ""}`}
          >
            <span className={`flex items-center gap-2 ${displayLabel ? "" : "text-[#9ca3af]"}`}>
              {selectedOption?.icon && (
                <img src={selectedOption.icon} alt="" className="size-4 shrink-0 object-contain" />
              )}
              {displayLabel || placeholder || "Select..."}
            </span>
            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.2, ease }}
            >
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
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
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
                  ? filteredObjectOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          haptics.selection();
                          (onChange as (id: string) => void)(opt.id);
                          setOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-dash-bg-elevated ${
                          opt.id === value
                            ? "font-medium text-dash-text-strong"
                            : "text-dash-text-faded"
                        }`}
                      >
                        {opt.icon && (
                          <img src={opt.icon} alt="" className="size-4 shrink-0 object-contain" />
                        )}
                        {opt.label}
                      </button>
                    ))
                  : filteredStringOptions.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          haptics.selection();
                          (onChange as (v: string) => void)(opt);
                          setOpen(false);
                        }}
                        className={`flex w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-dash-bg-elevated ${
                          opt === value
                            ? "font-medium text-dash-text-strong"
                            : "text-dash-text-faded"
                        }`}
                      >
                        {renderOption ? renderOption(opt) : opt}
                      </button>
                    ))}
                {((isObject && filteredObjectOptions.length === 0) ||
                  (!isObject && filteredStringOptions.length === 0)) && (
                  <div className="px-3 py-2 text-sm text-dash-text-faded">
                    No results found
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
