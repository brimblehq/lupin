import { useState, useRef, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Search,
  ChevronDown,
  MoreVertical,
  GitBranch,
  Calendar,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { type DateRange } from "react-day-picker";
import { TabHeader } from "../../../components/shared/tab-header";
import { Tooltip } from "../../../components/shared/tooltip";
import { DateRangePicker } from "../../../components/shared/date-range-picker";
import { DeploymentLogsDrawer } from "../../../components/shared/deployment-logs-drawer";

export const Route = createFileRoute(
  "/projects/$projectId/deployment-history",
)({
  component: DeploymentHistoryPage,
});

interface Deployment {
  url: string;
  environment: string;
  status: "Successful" | "Failed" | "Pending";
  duration: string;
  commitMessage: string;
  branch: string;
  timeAgo: string;
  user: {
    name: string;
    displayName: string;
    role: string;
    avatarUrl?: string;
  };
}

const deployments: Deployment[] = [
  {
    url: "audioly-458ghu583.david.brimble.app",
    environment: "Production",
    status: "Successful",
    duration: "29s",
    commitMessage: "feat(step-10) : add pwa setup an import...",
    branch: "step-10",
    timeAgo: "2days",
    user: {
      name: "David Muritala Ad...",
      displayName: "Dacid M.",
      role: "Administrator",
    },
  },
  {
    url: "audioly-458ghu583.david.brimble.app",
    environment: "Production",
    status: "Failed",
    duration: "123m 14s",
    commitMessage: "feat(step-10) : add pwa setup an import...",
    branch: "step-10",
    timeAgo: "2days",
    user: {
      name: "David Muritala Ad...",
      displayName: "Dacid M.",
      role: "Administrator",
    },
  },
  {
    url: "audioly-458ghu583.david.brimble.app",
    environment: "Production",
    status: "Failed",
    duration: "12m 29s",
    commitMessage: "feat(step-10) : add pwa setup an import...",
    branch: "step-10",
    timeAgo: "2days",
    user: {
      name: "David Muritala Ad...",
      displayName: "Dacid M.",
      role: "Administrator",
    },
  },
  {
    url: "audioly-458ghu583.david.brimble.app",
    environment: "Production",
    status: "Successful",
    duration: "29s",
    commitMessage: "feat(step-10) : add pwa setup an import...",
    branch: "step-10",
    timeAgo: "2days",
    user: {
      name: "David Muritala Ad...",
      displayName: "Dacid M.",
      role: "Administrator",
    },
  },
  {
    url: "audioly-458ghu583.david.brimble.app",
    environment: "Production",
    status: "Successful",
    duration: "29s",
    commitMessage: "feat(step-10) : add pwa setup an import...",
    branch: "step-10",
    timeAgo: "2days",
    user: {
      name: "David Muritala Ad...",
      displayName: "Dacid M.",
      role: "Administrator",
    },
  },
  {
    url: "audioly-458ghu583.david.brimble.app",
    environment: "Production",
    status: "Successful",
    duration: "29s",
    commitMessage: "feat(step-10) : add pwa setup an import...",
    branch: "step-10",
    timeAgo: "2days",
    user: {
      name: "David Muritala Ad...",
      displayName: "Dacid M.",
      role: "Administrator",
    },
  },
  {
    url: "audioly-458ghu583.david.brimble.app",
    environment: "Production",
    status: "Successful",
    duration: "29s",
    commitMessage: "feat(step-10) : add pwa setup an import...",
    branch: "step-10",
    timeAgo: "2days",
    user: {
      name: "David Muritala Ad...",
      displayName: "Dacid M.",
      role: "Administrator",
    },
  },
  {
    url: "audioly-458ghu583.david.brimble.app",
    environment: "Production",
    status: "Successful",
    duration: "29s",
    commitMessage: "feat(step-10) : add pwa setup an import...",
    branch: "step-10",
    timeAgo: "2days",
    user: {
      name: "David Muritala Ad...",
      displayName: "Dacid M.",
      role: "Administrator",
    },
  },
];

const statusColor = {
  Successful: "bg-[#13d282]",
  Failed: "bg-[#fc391e]",
  Pending: "bg-[#ff7a00]",
} as const;

/* ─── Filter dropdown (reusable) ─── */

function FilterSelect({
  label,
  options,
  value,
  onChange,
  icon,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center overflow-clip rounded-[4px] border border-dash-border bg-dash-bg text-sm text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated"
      >
        <span className="flex items-center gap-2 px-3 py-1.5">
          {icon}
          {value === "All" ? label : value}
        </span>
        <span className="flex h-full items-center border-l border-dash-border px-2 py-1.5">
          <ChevronDown className="size-4 text-dash-text-faded" />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full z-50 mt-1 min-w-[160px] origin-top-left overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)]"
          >
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className="mx-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-[2px] px-2 py-1.5 text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated dark:text-dash-text-strong"
              >
                {option}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Status dots icon for the Status filter ─── */

function StatusDotsIcon() {
  return (
    <div className="flex items-center gap-0.5">
      <span className="h-2 w-1 rounded-full bg-[#13d282]" />
      <span className="h-2 w-1 rounded-full bg-[#ff7a00]" />
      <span className="h-2 w-1 rounded-full bg-[#fc391e]" />
    </div>
  );
}

/* ─── Deployment row ─── */

function DeploymentRow({
  deployment,
  onClick,
}: {
  deployment: Deployment;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center border-b-[0.5px] border-dash-border px-3.5 py-4 transition-colors last:border-b-0 hover:bg-dash-bg-elevated"
    >
      {/* Col 1: URL + environment */}
      <div className="flex w-[280px] shrink-0 flex-col gap-0.5">
        <span className="truncate text-sm tracking-[-0.084px] text-dash-text-strong">
          {deployment.url}
        </span>
        <span className="text-sm font-light leading-[1.3] text-dash-text-faded">
          {deployment.environment}
        </span>
      </div>

      {/* Col 2: Status + duration */}
      <div className="flex w-[120px] shrink-0 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`size-[6px] shrink-0 rounded-full ${statusColor[deployment.status]}`}
          />
          <span className="text-sm font-light text-dash-text-body">
            {deployment.status}
          </span>
        </div>
        <span className="pl-[14px] text-sm font-light leading-[1.3] text-dash-text-faded">
          {deployment.duration}
        </span>
      </div>

      {/* Col 3: Commit + branch */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-light leading-[1.4] tracking-[-0.28px] text-dash-text-strong">
          {deployment.commitMessage}
        </span>
        <div className="flex items-center gap-1">
          <GitBranch className="size-3.5 text-dash-text-faded" />
          <span className="text-sm font-light leading-[1.3] text-dash-text-faded">
            {deployment.branch}
          </span>
        </div>
      </div>

      {/* Col 4: Time + user with tooltip */}
      <div className="flex w-[160px] shrink-0 flex-col gap-0.5 pl-4">
        <span className="text-sm tracking-[-0.084px] text-dash-text-strong">
          {deployment.timeAgo}
        </span>
        <Tooltip
          user={{
            name: deployment.user.displayName,
            role: deployment.user.role,
            avatarUrl: deployment.user.avatarUrl,
          }}
          side="bottom"
          sideOffset={4}
          delayDuration={200}
        >
          <span className="w-fit cursor-pointer truncate text-sm font-light leading-[1.3] text-dash-text-faded transition-colors hover:text-dash-text-body">
            {deployment.user.name}
          </span>
        </Tooltip>
      </div>

      {/* Col 5: Menu */}
      <button className="ml-4 shrink-0 text-dash-text-faded transition-colors hover:text-dash-text-strong">
        <MoreVertical className="size-4" />
      </button>
    </div>
  );
}

/* ─── Page ─── */

function DeploymentHistoryPage() {
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [environment, setEnvironment] = useState("All");
  const [status, setStatus] = useState("All");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDeployment, setSelectedDeployment] =
    useState<Deployment | null>(null);

  const filtered = deployments.filter((d) => {
    const matchesSearch =
      !search ||
      d.url.toLowerCase().includes(search.toLowerCase()) ||
      d.branch.toLowerCase().includes(search.toLowerCase());
    const matchesEnv =
      environment === "All" || d.environment === environment;
    const matchesStatus = status === "All" || d.status === status;
    return matchesSearch && matchesEnv && matchesStatus;
  });

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 py-8">
      <TabHeader title="Deployment history">
        Set environment-specific config and secrets (such as API keys), then
        read those values from your code.{" "}
        <a
          href="#"
          className="text-[#4879f8] underline transition-colors hover:text-[#3a6ae6]"
        >
          Learn more
        </a>
      </TabHeader>

      {/* Filter bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        {/* Search */}
        <div className="flex flex-1 items-center gap-2 rounded-[4px] border border-dash-border bg-dash-bg px-3 py-1.5 shadow-[0px_1px_2px_rgba(18,18,23,0.05)]">
          <Search className="size-4 shrink-0 text-dash-text-extra-faded" />
          <input
            type="text"
            placeholder="All branches"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm text-dash-text-strong outline-none placeholder:text-dash-text-faded placeholder:opacity-50"
          />
        </div>

        <DateRangePicker value={dateRange} onChange={setDateRange}>
          <button className="flex items-center overflow-clip rounded-[4px] border border-dash-border bg-dash-bg text-sm text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated">
            <span className="flex items-center gap-2 px-3 py-1.5">
              <Calendar className="size-3.5 text-dash-text-faded" />
              {dateRange?.from && dateRange?.to
                ? `${dateRange.from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${dateRange.to.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : "Select date range"}
            </span>
            <span className="flex h-full items-center border-l border-dash-border px-2 py-1.5">
              <ChevronDown className="size-4 text-dash-text-faded" />
            </span>
          </button>
        </DateRangePicker>
        <FilterSelect
          label="All Environments"
          options={["All", "Production", "Preview", "Development"]}
          value={environment}
          onChange={setEnvironment}
        />
        <FilterSelect
          label="Status"
          options={["All", "Successful", "Failed", "Pending"]}
          value={status}
          onChange={setStatus}
          icon={<StatusDotsIcon />}
        />
      </div>

      {/* Deployment list */}
      <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
        {filtered.length > 0 ? (
          filtered.map((deployment, i) => (
            <DeploymentRow
              key={i}
              deployment={deployment}
              onClick={() => {
                setSelectedDeployment(deployment);
                setDrawerOpen(true);
              }}
            />
          ))
        ) : (
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-dash-text-faded">
              No deployments found
            </span>
          </div>
        )}
      </div>

      {/* Deployment logs drawer */}
      {selectedDeployment && (
        <DeploymentLogsDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          environment={selectedDeployment.environment}
          status={selectedDeployment.status}
        />
      )}
    </div>
  );
}
