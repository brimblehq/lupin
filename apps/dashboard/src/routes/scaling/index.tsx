import { useState, useRef, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { Search, Plus, ChevronDown } from "lucide-react";
import { PageHeader } from "../../components/shared/page-header";
import { DashButton } from "../../components/shared/dash-button";
import { GlossyButton } from "../../components/shared/glossy-button";
import { ToggleSwitch } from "../../components/shared/toggle-switch";
import { RangeSlider } from "../../components/shared/range-slider";

export const Route = createFileRoute("/scaling/")({
  component: ScalingPage,
});

/* ─── Constants ─── */

const ease = [0.16, 1, 0.3, 1] as const;

const inputClass =
  "w-full rounded-[6px] bg-[#f9fafb] px-3 py-2.5 text-sm leading-6 text-dash-text-strong shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] outline-none placeholder:text-[#9ca3af] focus:shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08),0px_0px_0px_3px_rgba(72,121,248,0.15)] dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08),0px_0px_0px_3px_rgba(72,121,248,0.2)]";

/* ─── Types ─── */

interface ScalingGroup {
  id: string;
  name: string;
  project: string;
  active: boolean;
  minInstances: number;
  maxInstances: number;
  runningInstances: number;
  cpuThreshold: number;
  memoryThreshold: number;
  createdAt: string;
}

/* ─── Mock Data ─── */

const mockProjects = [
  { id: "1", label: "brimble-dashboard" },
  { id: "2", label: "api-server" },
  { id: "3", label: "landing-page" },
  { id: "4", label: "docs-site" },
];

const initialGroups: ScalingGroup[] = [
  {
    id: "sg-1",
    name: "Web Frontend",
    project: "brimble-dashboard",
    active: true,
    minInstances: 2,
    maxInstances: 5,
    runningInstances: 3,
    cpuThreshold: 70,
    memoryThreshold: 50,
    createdAt: "3 days ago",
  },
  {
    id: "sg-2",
    name: "API Workers",
    project: "api-server",
    active: false,
    minInstances: 1,
    maxInstances: 8,
    runningInstances: 1,
    cpuThreshold: 80,
    memoryThreshold: 60,
    createdAt: "2 weeks ago",
  },
];

/* ─── Threshold Mini-Bars ─── */

function ThresholdBar({ label, value }: { label: string; value: number }) {
  const totalBlocks = 6;
  const filledBlocks = Math.round((value / 100) * totalBlocks);

  return (
    <div className="flex items-center gap-2">
      <span className="w-[28px] text-xs text-dash-text-faded">{label}</span>
      <div className="flex gap-[2px]">
        {Array.from({ length: totalBlocks }).map((_, i) => (
          <div
            key={i}
            className={`h-[8px] w-[6px] rounded-[1px] ${
              i < filledBlocks ? "bg-[#4879f8]" : "bg-dash-border"
            }`}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-dash-text-body">{value}%</span>
    </div>
  );
}

/* ─── Scaling Group Card ─── */

function ScalingGroupCard({
  group,
  onToggle,
}: {
  group: ScalingGroup;
  onToggle: (id: string) => void;
}) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`flex flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border ${
        !group.active ? "opacity-60" : ""
      }`}
    >
      {/* Header: name + toggle */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-1">
        <span className="text-sm font-medium leading-5 text-dash-text-strong">
          {group.name}
        </span>
        <ToggleSwitch
          size="sm"
          checked={group.active}
          onChange={() => onToggle(group.id)}
        />
      </div>

      {/* Linked project */}
      <div className="px-3.5 pb-3">
        <span className="text-xs text-dash-text-faded">
          Linked to:{" "}
          <span className="text-dash-text-body">{group.project}</span>
        </span>
      </div>

      {/* Data section: instances + thresholds */}
      <div className="grid grid-cols-2 gap-3 px-3.5 pb-3">
        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-dash-text-extra-faded">
            Instances
          </span>
          <span className="text-sm font-medium text-dash-text-strong">
            {group.minInstances} &rarr; {group.maxInstances}
          </span>
          <span className="mt-0.5 block text-xs text-dash-text-faded">
            {group.runningInstances} running
          </span>
        </div>
        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-dash-text-extra-faded">
            Thresholds
          </span>
          <div className="flex flex-col gap-1">
            <ThresholdBar label="CPU" value={group.cpuThreshold} />
            <ThresholdBar label="Mem" value={group.memoryThreshold} />
          </div>
        </div>
      </div>

      {/* Footer: timestamp */}
      <div className="flex h-10 items-center border-t-[0.5px] border-dash-border px-3.5">
        <span className="font-mono text-xs uppercase leading-[18px] tracking-[-0.02px] text-dash-text-extra-faded opacity-80">
          Created {group.createdAt}
        </span>
      </div>
    </motion.div>
  );
}

/* ─── Dropdown ─── */

function Dropdown({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const selectedLabel = options.find((o) => o.id === value)?.label;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between ${inputClass}`}
      >
        <span className={selectedLabel ? "" : "text-[#9ca3af]"}>
          {selectedLabel ?? placeholder ?? "Select..."}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease }}
        >
          <ChevronDown className="size-3.5 text-dash-text-faded" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease }}
            className="absolute left-0 top-full z-50 mt-1 w-full overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)]"
          >
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={`flex w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-dash-bg-elevated ${
                  opt.id === value
                    ? "font-medium text-dash-text-strong"
                    : "text-dash-text-faded"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Inline Creation Form ─── */

function CreationForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (group: ScalingGroup) => void;
}) {
  const [name, setName] = useState("");
  const [project, setProject] = useState("");
  const [autoScaling, setAutoScaling] = useState(true);
  const [minInstances, setMinInstances] = useState(1);
  const [maxInstances, setMaxInstances] = useState(5);
  const [cpuThreshold, setCpuThreshold] = useState(70);
  const [memThreshold, setMemThreshold] = useState(80);

  function handleCreate() {
    const projectLabel =
      mockProjects.find((p) => p.id === project)?.label ?? "unknown";
    onCreate({
      id: `sg-${Date.now()}`,
      name: name.trim() || "Untitled Group",
      project: projectLabel,
      active: autoScaling,
      minInstances,
      maxInstances,
      runningInstances: minInstances,
      cpuThreshold,
      memoryThreshold: memThreshold,
      createdAt: "just now",
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease }}
      className="overflow-hidden"
    >
      <div className="mb-6 rounded-[4px] border-[0.5px] border-dash-border p-5">
        {/* Group name */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm text-dash-text-body">
            Group name
          </label>
          <input
            type="text"
            placeholder="e.g. Web Frontend"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            autoFocus
          />
        </div>

        {/* Linked project */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm text-dash-text-body">
            Linked project
          </label>
          <Dropdown
            value={project}
            options={mockProjects}
            onChange={setProject}
            placeholder="Select a project..."
          />
        </div>

        <hr className="my-5 border-dash-border-soft" />

        {/* Auto-scaling toggle */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <span className="block text-sm font-medium text-dash-text-strong">
              Auto-scaling
            </span>
            <span className="text-xs text-dash-text-faded">
              Automatically adjust instances based on load
            </span>
          </div>
          <ToggleSwitch checked={autoScaling} onChange={setAutoScaling} />
        </div>

        {/* Instance range */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm text-dash-text-body">
            Instance range
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-dash-text-faded">
                Min
              </label>
              <input
                type="number"
                min={1}
                value={minInstances}
                onChange={(e) => setMinInstances(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-dash-text-faded">
                Max
              </label>
              <input
                type="number"
                min={1}
                value={maxInstances}
                onChange={(e) => setMaxInstances(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* CPU threshold */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm text-dash-text-body">
            CPU threshold
          </label>
          <RangeSlider
            value={cpuThreshold}
            onChange={setCpuThreshold}
            min={10}
            max={100}
            disabled={!autoScaling}
          />
        </div>

        {/* Memory threshold */}
        <div className="mb-5">
          <label className="mb-1.5 block text-sm text-dash-text-body">
            Memory threshold
          </label>
          <RangeSlider
            value={memThreshold}
            onChange={setMemThreshold}
            min={10}
            max={100}
            disabled={!autoScaling}
          />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3">
          <DashButton variant="outline" onClick={onCancel}>
            Cancel
          </DashButton>
          <GlossyButton
            variant="blue"
            onClick={handleCreate}
            disabled={!name.trim() || !project}
          >
            Create Group
          </GlossyButton>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Empty State ─── */

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease }}
      className="flex flex-col items-center justify-center py-20"
    >
      <img
        src="/icons/scaling.svg"
        alt=""
        className="mb-4 size-10 opacity-30 dark:invert dark:opacity-20"
      />
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">
        No scaling groups yet
      </h3>
      <p className="mb-5 max-w-[320px] text-center text-sm text-dash-text-faded">
        Create a scaling group to automatically manage instance counts based on
        CPU and memory usage.
      </p>
      <GlossyButton variant="blue" onClick={onCreateClick}>
        Create Scaling Group
      </GlossyButton>
    </motion.div>
  );
}

/* ─── Main Page ─── */

function ScalingPage() {
  const [groups, setGroups] = useState<ScalingGroup[]>(initialGroups);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleToggle(id: string) {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, active: !g.active } : g)),
    );
  }

  function handleCreate(group: ScalingGroup) {
    setGroups((prev) => [group, ...prev]);
    setFormOpen(false);
  }

  return (
    <div className="max-w-[1000px]">
      <PageHeader title="Scaling">
        Configure auto-scaling groups to automatically adjust the number of
        running instances for your projects based on CPU and memory thresholds.
      </PageHeader>

      <hr className="-ml-4 mb-6 border-dash-border-soft md:-ml-10" />

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dash-text-extra-faded" />
          <input
            type="text"
            placeholder="Search scaling groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>
        <DashButton
          variant="primary"
          onClick={() => setFormOpen(true)}
        >
          <Plus className="size-3.5" />
          New Scaling Group
        </DashButton>
      </div>

      {/* Inline creation form */}
      <AnimatePresence>
        {formOpen && (
          <CreationForm
            onCancel={() => setFormOpen(false)}
            onCreate={handleCreate}
          />
        )}
      </AnimatePresence>

      {/* Groups grid or empty state */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((group, i) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.08 * i, ease }}
            >
              <ScalingGroupCard group={group} onToggle={handleToggle} />
            </motion.div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState onCreateClick={() => setFormOpen(true)} />
      ) : (
        <div className="py-12 text-center text-sm text-dash-text-faded">
          No scaling groups match your search.
        </div>
      )}
    </div>
  );
}
