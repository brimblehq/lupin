import { useState, useRef, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ChevronDown,
  Plus,
  Minus,
  X,
  Check,
  Users,
  Info,
  Settings,
} from "lucide-react";
import { GlossyButton } from "../../components/shared/glossy-button";

export const Route = createFileRoute("/workspace/new")({
  component: NewWorkspacePage,
});

/* ─── Constants ─── */

const ease = [0.16, 1, 0.3, 1] as const;

const inputClass =
  "w-full rounded-[6px] bg-[#f9fafb] px-3 py-2.5 text-sm leading-6 text-dash-text-strong shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] outline-none placeholder:text-[#9ca3af] focus:shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08),0px_0px_0px_3px_rgba(72,121,248,0.15)] dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08),0px_0px_0px_3px_rgba(72,121,248,0.2)]";

type Phase = 1 | 2 | 3;

const teamSizeOptions = [3, 5, 10, 15, 25, 50];
const FREE_SEATS = 3;
const COST_PER_EXTRA_SEAT = 10;
const FREE_BUILDS = 2;
const COST_PER_EXTRA_BUILD = 15;
const MIN_BUILDS = 1;
const MAX_BUILDS = 10;

const roles = ["Member", "Admin", "Viewer"];

/* ─── Summary Chip ─── */

function SummaryChip({
  icon,
  label,
  onChangeClick,
}: {
  icon: React.ReactNode;
  label: string;
  onChangeClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease }}
      className="flex items-center gap-3"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dash-border-soft bg-dash-bg-elevated px-3 py-1 text-xs text-dash-text-strong">
        {icon}
        {label}
      </span>
      <button
        onClick={onChangeClick}
        className="text-xs text-[#4879f8] transition-colors hover:text-[#3a6ae6]"
      >
        Change
      </button>
    </motion.div>
  );
}

/* ─── Dropdown ─── */

function Dropdown({
  value,
  options,
  onChange,
  renderOption,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  renderOption?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const display = renderOption ? renderOption(value) : value;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-[6px] bg-[#f9fafb] px-3 py-2.5 text-sm text-dash-text-strong shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)]"
      >
        {display}
        <ChevronDown
          className={`size-4 text-dash-text-faded transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease }}
            className="absolute left-0 top-full z-50 mt-1 w-full overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-lg"
          >
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`flex w-full px-3 py-2 text-left text-sm transition-colors ${
                  opt === value
                    ? "font-medium text-dash-text-strong bg-dash-bg-elevated"
                    : "text-dash-text-body hover:bg-dash-bg-elevated"
                }`}
              >
                {renderOption ? renderOption(opt) : opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Stepper ─── */

function Stepper({
  value,
  min,
  max,
  onChange,
  renderValue,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  renderValue: (v: number) => string;
}) {
  return (
    <div className="flex items-center rounded-[6px] bg-[#f9fafb] shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)]">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex size-[42px] items-center justify-center text-dash-text-faded transition-colors hover:text-dash-text-strong disabled:opacity-30"
      >
        <Minus className="size-4" />
      </button>
      <span className="flex-1 text-center text-sm font-medium text-dash-text-strong">
        {renderValue(value)}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex size-[42px] items-center justify-center text-dash-text-faded transition-colors hover:text-dash-text-strong disabled:opacity-30"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/* ─── Info Banner ─── */

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-start gap-2.5 rounded-[4px] bg-[#f5a623]/[0.06] px-3 py-2.5 dark:bg-[#f5a623]/[0.08]">
      <Info className="mt-0.5 size-3.5 shrink-0 text-[#f5a623]" />
      <div className="text-sm font-light leading-[1.4] text-[#b37a10] dark:text-[#f5a623]">
        {children}
      </div>
    </div>
  );
}

/* ─── Mini Role Dropdown ─── */

function MiniRoleDropdown({
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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
        className="flex w-[100px] items-center justify-between rounded-[6px] bg-[#f9fafb] px-2.5 py-2.5 text-sm text-dash-text-strong shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)]"
      >
        {value}
        <ChevronDown className="size-3 text-dash-text-faded" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease }}
            className="absolute right-0 top-full z-50 mt-1 w-[100px] overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-lg"
          >
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => { onChange(r); setOpen(false); }}
                className={`flex w-full px-2.5 py-1.5 text-left text-sm ${
                  r === value ? "font-medium text-[#4879f8]" : "text-dash-text-body hover:bg-dash-bg-elevated"
                }`}
              >
                {r}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Phase 1: Name & URL ─── */

function Phase1Name({
  onSubmit,
}: {
  onSubmit: (name: string, slug: string) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  function handleNameChange(value: string) {
    setName(value);
    setSlug(
      value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">
        Name your workspace
      </h3>
      <p className="mb-4 text-sm text-dash-text-faded">
        Choose a name and URL for your team workspace.
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm text-dash-text-body">
            Workspace name
          </label>
          <input
            type="text"
            placeholder="My workspace"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={inputClass}
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-dash-text-body">
            Workspace URL
          </label>
          <div className="flex items-stretch">
            <div className="flex items-center rounded-l-[6px] border border-r-0 border-dash-border bg-dash-bg-elevated px-3">
              <span className="whitespace-nowrap text-sm text-dash-text-faded">
                brimble.app/
              </span>
            </div>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={`${inputClass} rounded-l-none`}
            />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <GlossyButton
          variant="blue"
          fullWidth
          onClick={() => {
            if (name.trim()) onSubmit(name.trim(), slug);
          }}
          disabled={!name.trim()}
        >
          Continue
        </GlossyButton>
      </div>
    </motion.div>
  );
}

/* ─── Phase 2: Team Configuration ─── */

interface TeamConfig {
  teamSize: number;
  concurrentBuilds: number;
  promoCode: string;
}

function Phase2Config({
  onSubmit,
}: {
  onSubmit: (config: TeamConfig) => void;
}) {
  const [teamSize, setTeamSize] = useState(3);
  const [concurrentBuilds, setConcurrentBuilds] = useState(2);
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<"idle" | "verifying" | "valid" | "invalid">("idle");

  function handleVerifyPromo() {
    if (!promoCode.trim()) return;
    setPromoStatus("verifying");
    // Mock verification
    setTimeout(() => {
      setPromoStatus(promoCode.toUpperCase().startsWith("BRIMBLE") ? "valid" : "invalid");
    }, 800);
  }

  const extraSeats = Math.max(0, teamSize - FREE_SEATS);
  const seatCost = extraSeats * COST_PER_EXTRA_SEAT;
  const extraBuilds = Math.max(0, concurrentBuilds - FREE_BUILDS);
  const buildCost = extraBuilds * COST_PER_EXTRA_BUILD;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">
        Team configuration
      </h3>
      <p className="mb-5 text-sm text-dash-text-faded">
        Configure your team size and build capacity.
      </p>

      {/* Team Size */}
      <div>
        <label className="mb-1.5 block text-sm text-dash-text-body">
          Team Size
        </label>
        <Dropdown
          value={String(teamSize)}
          options={teamSizeOptions.map(String)}
          onChange={(v) => setTeamSize(Number(v))}
          renderOption={(v) => `${v} Members`}
        />
        <InfoBanner>
          Seat pricing: {FREE_SEATS} seats included by default
          <br />
          Additional seats: ${COST_PER_EXTRA_SEAT} per seat
          {extraSeats > 0 && (
            <>
              <br />
              <span className="font-medium">
                +{extraSeats} extra {extraSeats === 1 ? "seat" : "seats"} = ${seatCost}/mo
              </span>
            </>
          )}
        </InfoBanner>
      </div>

      {/* Concurrent Builds */}
      <div className="mt-5">
        <label className="mb-1.5 block text-sm text-dash-text-body">
          Concurrent Builds
        </label>
        <Stepper
          value={concurrentBuilds}
          min={MIN_BUILDS}
          max={MAX_BUILDS}
          onChange={setConcurrentBuilds}
          renderValue={(v) => {
            const cost = Math.max(0, v - FREE_BUILDS) * COST_PER_EXTRA_BUILD;
            return `${v} ${v === 1 ? "Build" : "Builds"} — $${cost}`;
          }}
        />
        <InfoBanner>
          Build pricing: {FREE_BUILDS} free builds included
          <br />
          Additional builds: ${COST_PER_EXTRA_BUILD} per extra build container
        </InfoBanner>
      </div>

      {/* Startup Promo Code */}
      <div className="mt-5">
        <label className="mb-1.5 block text-sm text-dash-text-body">
          Startup Promo Code
        </label>
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            placeholder="ABC-123"
            value={promoCode}
            onChange={(e) => {
              setPromoCode(e.target.value);
              setPromoStatus("idle");
            }}
            className={`flex-1 ${inputClass}`}
          />
          <button
            onClick={handleVerifyPromo}
            disabled={!promoCode.trim() || promoStatus === "verifying"}
            className="flex h-[42px] items-center justify-center rounded-[6px] border border-dash-border bg-dash-bg-elevated px-4 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg disabled:opacity-40"
          >
            {promoStatus === "verifying" ? "Verifying..." : "Verify"}
          </button>
        </div>
        {promoStatus === "valid" && (
          <p className="mt-1.5 flex items-center gap-1 text-sm text-[#28c840]">
            <Check className="size-3.5" />
            Promo code applied successfully
          </p>
        )}
        {promoStatus === "invalid" && (
          <p className="mt-1.5 text-sm text-[#ef2f1f]">
            Invalid promo code. Please try again.
          </p>
        )}
      </div>

      <div className="mt-6">
        <GlossyButton
          variant="blue"
          fullWidth
          onClick={() =>
            onSubmit({ teamSize, concurrentBuilds, promoCode })
          }
        >
          Continue
        </GlossyButton>
      </div>
    </motion.div>
  );
}

/* ─── Phase 3: Invite Members ─── */

interface InviteRow {
  id: number;
  email: string;
  role: string;
}

let inviteNextId = 1;

function Phase3Invite({
  workspaceName,
  teamSize,
}: {
  workspaceName: string;
  teamSize: number;
}) {
  const [rows, setRows] = useState<InviteRow[]>([
    { id: inviteNextId++, email: "", role: "Member" },
  ]);

  function addRow() {
    setRows((prev) => [...prev, { id: inviteNextId++, email: "", role: "Member" }]);
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function updateRow(id: number, field: "email" | "role", value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  const filled = rows.filter((r) => r.email.trim().length > 0).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">
        Invite your team
      </h3>
      <p className="mb-4 text-sm text-dash-text-faded">
        Add team members to &ldquo;{workspaceName}&rdquo;. You can always do this later.
      </p>

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <input
              type="email"
              placeholder="colleague@company.com"
              value={row.email}
              onChange={(e) => updateRow(row.id, "email", e.target.value)}
              className={`flex-1 ${inputClass}`}
            />
            <MiniRoleDropdown
              value={row.role}
              onChange={(v) => updateRow(row.id, "role", v)}
            />
            <button
              onClick={() => removeRow(row.id)}
              className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-dash-text-faded transition-colors hover:text-dash-text-strong"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="mt-3 flex items-center gap-1.5 text-sm text-[#4879f8] transition-colors hover:text-[#3a6ae6]"
      >
        <Plus className="size-3.5" />
        Add another
      </button>

      {filled > 0 && (
        <div className="mt-4 rounded-[4px] bg-dash-bg-elevated px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-dash-text-faded">
              {filled} of {teamSize} seats used
            </span>
            {filled > teamSize && (
              <span className="text-[#f5a623] text-xs">
                Exceeds team size — additional seats will be charged
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <GlossyButton variant="blue" fullWidth>
          Create Workspace
        </GlossyButton>
      </div>
      <button
        className="mt-3 w-full text-center text-sm text-dash-text-faded transition-colors hover:text-dash-text-strong"
      >
        Skip for now
      </button>
    </motion.div>
  );
}

/* ─── Main Page ─── */

function NewWorkspacePage() {
  const [phase, setPhase] = useState<Phase>(1);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [teamConfig, setTeamConfig] = useState<TeamConfig | null>(null);

  function handleNameSubmit(name: string, slug: string) {
    setWorkspaceName(name);
    setWorkspaceSlug(slug);
    setPhase(2);
  }

  function handleConfigSubmit(config: TeamConfig) {
    setTeamConfig(config);
    setPhase(3);
  }

  function handleChangePhase(target: Phase) {
    setPhase(target);
    if (target === 1) {
      setWorkspaceName("");
      setWorkspaceSlug("");
      setTeamConfig(null);
    }
    if (target <= 2) {
      setTeamConfig(null);
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-[680px]">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-dash-text-faded transition-colors hover:text-dash-text-strong"
          >
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
          <h1 className="text-xl font-medium text-dash-text-strong">
            New Workspace
          </h1>
          <p className="mt-1 text-sm text-dash-text-faded">
            Set up a new workspace for your team.
          </p>
        </div>

        {/* Phase 1 */}
        {phase > 1 && workspaceName ? (
          <div className="mb-6">
            <SummaryChip
              icon={<Users className="size-3" />}
              label={`${workspaceName} (brimble.app/${workspaceSlug})`}
              onChangeClick={() => handleChangePhase(1)}
            />
          </div>
        ) : (
          phase === 1 && (
            <AnimatePresence mode="wait">
              <Phase1Name key="phase1" onSubmit={handleNameSubmit} />
            </AnimatePresence>
          )
        )}

        {/* Phase 2 */}
        {phase > 2 && teamConfig ? (
          <div className="mb-6">
            <SummaryChip
              icon={<Settings className="size-3" />}
              label={`${teamConfig.teamSize} members · ${teamConfig.concurrentBuilds} builds`}
              onChangeClick={() => handleChangePhase(2)}
            />
          </div>
        ) : (
          phase === 2 && (
            <AnimatePresence mode="wait">
              <Phase2Config key="phase2" onSubmit={handleConfigSubmit} />
            </AnimatePresence>
          )
        )}

        {/* Phase 3 */}
        {phase === 3 && (
          <AnimatePresence mode="wait">
            <Phase3Invite
              key="phase3"
              workspaceName={workspaceName}
              teamSize={teamConfig?.teamSize ?? 3}
            />
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
