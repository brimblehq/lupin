import { useState, useRef, useEffect } from "react";
import {
  Search,
  SlidersHorizontal,
  MoreVertical,
  Check,
  RefreshCw,
  AlertCircle,
  Minus,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "@tanstack/react-router";

export interface Domain {
  name: string;
  project?: string;
  status: "Active" | "Failed";
  addedAt: string;
  addedBy: string;
}

const statusOptions = ["All", "Active", "Failed"] as const;

function DomainCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex size-[14px] shrink-0 items-center justify-center rounded-[3px] border shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] transition-colors ${
        checked
          ? "border-[#4879f8] bg-[#4879f8]"
          : "border-transparent bg-dash-bg dark:border-white/20 dark:bg-transparent"
      }`}
    >
      {checked && (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none" className="text-white">
          <path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function FilterDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-dash-text-body transition-colors hover:text-dash-text-strong"
      >
        <SlidersHorizontal className="size-4" />
        {value === "All" ? "Filter status" : value}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-1 w-[160px] origin-top-right overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)]"
          >
            {statusOptions.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className="mx-1 flex w-[calc(100%-8px)] items-center justify-between rounded-[2px] px-2 py-1.5 text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated dark:text-dash-text-strong"
              >
                <div className="flex items-center gap-2">
                  {option !== "All" && (
                    <span
                      className={`size-[6px] rounded-full ${
                        option === "Active" ? "bg-[#34d399]" : "bg-[#fc391e]"
                      }`}
                    />
                  )}
                  {option}
                </div>
                {value === option && <Check className="size-3.5 text-[#4879f8]" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FailedDomainRow({
  domain,
  checked,
  onToggle,
  basePath,
}: {
  domain: Domain;
  checked: boolean;
  onToggle: () => void;
  basePath?: string;
}) {
  return (
    <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
      {/* Main row */}
      <div className="flex h-[68px] items-center justify-between bg-dash-bg px-3.5">
        <div className="flex w-[200px] items-center gap-2">
          <DomainCheckbox checked={checked} onChange={onToggle} />
          <div className="flex flex-col gap-1">
            {basePath ? (
              <Link
                to={`${basePath}/${encodeURIComponent(domain.name)}`}
                className="text-sm tracking-[-0.084px] text-dash-text-body transition-colors hover:text-dash-text-strong hover:underline"
              >
                {domain.name}
              </Link>
            ) : (
              <span className="text-sm tracking-[-0.084px] text-dash-text-body">
                {domain.name}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-light leading-[1.3] text-[#fc391e]">
                Failed
              </span>
              <div className="flex size-4 items-center justify-center rounded-full">
                <Minus className="size-3 text-[#fc391e]" strokeWidth={3} />
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="flex w-[200px] items-center gap-1">
          <span className="size-[6px] rounded-full bg-[#fc391e]" />
          <span className="text-sm font-light leading-5 tracking-[-0.02px] text-dash-text-body">
            Failed
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-12">
          <button className="flex items-center gap-2 rounded-[4px] border border-dash-border bg-dash-bg px-3.5 py-1 shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated">
            <RefreshCw className="size-4 text-dash-text-body" />
            <span className="text-sm font-medium text-dash-text-body">Refresh</span>
          </button>
          <button className="text-dash-text-faded transition-colors hover:text-dash-text-strong">
            <MoreVertical className="size-4" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      <div className="flex items-center justify-between bg-dash-bg-elevated px-3.5 py-2.5 border-t-[0.5px] border-dash-border">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-5 shrink-0 text-[#fc391e]" />
          <span className="text-sm font-light leading-[18px] tracking-[-0.02px] text-dash-text-body">
            Domain failed to propagate, click change settings to
          </span>
        </div>
        {basePath ? (
          <Link
            to={`${basePath}/${encodeURIComponent(domain.name)}`}
            className="text-sm tracking-[-0.02px] text-dash-text-body underline hover:text-dash-text-strong"
          >
            Change settings
          </Link>
        ) : (
          <button className="text-sm tracking-[-0.02px] text-dash-text-body underline hover:text-dash-text-strong">
            Change settings
          </button>
        )}
      </div>
    </div>
  );
}

function ActiveDomainRow({
  domain,
  checked,
  onToggle,
  basePath,
}: {
  domain: Domain;
  checked: boolean;
  onToggle: () => void;
  basePath?: string;
}) {
  return (
    <div className="flex h-[68px] items-center justify-between border-b-[0.5px] border-dash-border px-3.5 last:border-b-0">
      {/* Checkbox + name */}
      <div className="flex w-[200px] items-center gap-2">
        <DomainCheckbox checked={checked} onChange={onToggle} />
        <div className="flex flex-col gap-1">
          {basePath ? (
            <Link
              to={`${basePath}/${encodeURIComponent(domain.name)}`}
              className="text-sm tracking-[-0.084px] text-dash-text-body transition-colors hover:text-dash-text-strong hover:underline"
            >
              {domain.name}
            </Link>
          ) : (
            <span className="text-sm tracking-[-0.084px] text-dash-text-body">
              {domain.name}
            </span>
          )}
          {domain.project && (
            <span className="text-sm font-light leading-[1.3] text-dash-text-extra-faded">
              {domain.project}
            </span>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex w-[200px] items-center gap-1">
        <span className="size-[6px] rounded-full bg-[#34d399]" />
        <span className="text-sm font-light leading-5 tracking-[-0.02px] text-dash-text-body">
          Active
        </span>
      </div>

      {/* Added info + menu */}
      <div className="flex items-center gap-12">
        <div className="flex flex-col gap-1">
          <span className="text-sm tracking-[-0.084px] text-dash-text-body">
            {domain.addedAt}
          </span>
          <span className="text-sm font-light leading-[1.3] text-dash-text-extra-faded">
            {domain.addedBy}
          </span>
        </div>
        <button className="text-dash-text-faded transition-colors hover:text-dash-text-strong">
          <MoreVertical className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function DomainList({
  domains,
  basePath,
  onAddDomain,
}: {
  domains: Domain[];
  basePath?: string;
  onAddDomain?: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const allSelected = selected.size === domains.length && domains.length > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(domains.map((_, i) => i)));
    }
  }

  function toggleOne(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const filtered = domains.filter((d) => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const failedDomains = filtered.filter((d) => d.status === "Failed");
  const activeDomains = filtered.filter((d) => d.status === "Active");

  return (
    <div className="flex flex-col gap-4">
      {/* Search + Filter bar + Add Domain */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
          <div className="flex flex-1 items-center gap-2 px-4 py-3">
            <Search className="size-5 shrink-0 text-dash-text-extra-faded" />
            <input
              type="text"
              placeholder="Search domains"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-dash-text-strong outline-none placeholder:text-dash-text-faded placeholder:opacity-50"
            />
          </div>
          <div className="h-full w-px self-stretch bg-dash-border" />
          <FilterDropdown value={statusFilter} onChange={setStatusFilter} />
        </div>

        {onAddDomain && (
          <button
            onClick={onAddDomain}
            className="flex shrink-0 items-center gap-1 rounded-[4px] border border-[#232931] bg-gradient-to-b from-[#545459] via-[#45454b] to-[#2d2d32] px-3 py-[5px] text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" />
            <span className="px-1">Add Domain</span>
          </button>
        )}
      </div>

      {/* Failed domains (each in its own card) */}
      {failedDomains.map((domain, i) => {
        const originalIndex = domains.indexOf(domain);
        return (
          <FailedDomainRow
            key={`failed-${i}`}
            domain={domain}
            checked={selected.has(originalIndex)}
            onToggle={() => toggleOne(originalIndex)}
            basePath={basePath}
          />
        );
      })}

      {/* Active domains (grouped in one card) */}
      {activeDomains.length > 0 && (
        <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
          {activeDomains.map((domain, i) => {
            const originalIndex = domains.indexOf(domain);
            return (
              <ActiveDomainRow
                key={`active-${i}`}
                domain={domain}
                checked={selected.has(originalIndex)}
                onToggle={() => toggleOne(originalIndex)}
                basePath={basePath}
              />
            );
          })}

          {/* Select all footer */}
          <div className="flex items-center gap-2 border-t-[0.5px] border-dash-border px-3.5 py-3">
            <DomainCheckbox checked={allSelected} onChange={toggleAll} />
            <span className="text-sm font-light text-dash-text-extra-faded">
              Select all
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
