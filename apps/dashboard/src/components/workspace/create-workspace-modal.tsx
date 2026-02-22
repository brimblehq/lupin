import { useState, useRef, useEffect } from "react";
import { Plus, Minus, X, ChevronDown, Check, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  Modal,
  ModalHeader,
  ModalFooter,
  ModalCancelButton,
  ModalContinueButton,
} from "../shared/modal";

type Step = "name" | "config" | "invite" | "done";

const inputClass =
  "w-full rounded-[6px] bg-[#f9fafb] px-3 py-2.5 text-sm leading-6 text-dash-text-strong shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] outline-none placeholder:text-[#9ca3af] focus:shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08),0px_0px_0px_3px_rgba(72,121,248,0.15)] dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08),0px_0px_0px_3px_rgba(72,121,248,0.2)]";

const teamSizeOptions = [3, 5, 10, 15, 25, 50];
const FREE_SEATS = 3;
const COST_PER_EXTRA_SEAT = 10;
const FREE_BUILDS = 2;
const COST_PER_EXTRA_BUILD = 15;
const MIN_BUILDS = 1;
const MAX_BUILDS = 10;

const ease = [0.16, 1, 0.3, 1] as const;

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

/* ─── Step 1: Name ─── */

function StepName({
  name,
  slug,
  onNameChange,
  onSlugChange,
}: {
  name: string;
  slug: string;
  onNameChange: (v: string) => void;
  onSlugChange: (v: string) => void;
}) {
  function handleNameChange(value: string) {
    onNameChange(value);
    onSlugChange(
      value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
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
      <div className="flex flex-col gap-1.5">
        <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
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
            onChange={(e) => onSlugChange(e.target.value)}
            className={`${inputClass} rounded-l-none`}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Step 2: Team Configuration ─── */

function StepConfig({
  teamSize,
  concurrentBuilds,
  promoCode,
  promoStatus,
  onTeamSizeChange,
  onConcurrentBuildsChange,
  onPromoCodeChange,
  onVerifyPromo,
}: {
  teamSize: number;
  concurrentBuilds: number;
  promoCode: string;
  promoStatus: "idle" | "verifying" | "valid" | "invalid";
  onTeamSizeChange: (v: number) => void;
  onConcurrentBuildsChange: (v: number) => void;
  onPromoCodeChange: (v: string) => void;
  onVerifyPromo: () => void;
}) {
  const extraSeats = Math.max(0, teamSize - FREE_SEATS);

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      {/* Team Size */}
      <div>
        <label className="mb-1.5 block text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
          Team Size
        </label>
        <Dropdown
          value={String(teamSize)}
          options={teamSizeOptions.map(String)}
          onChange={(v) => onTeamSizeChange(Number(v))}
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
                +{extraSeats} extra {extraSeats === 1 ? "seat" : "seats"} = ${extraSeats * COST_PER_EXTRA_SEAT}/mo
              </span>
            </>
          )}
        </InfoBanner>
      </div>

      {/* Concurrent Builds */}
      <div>
        <label className="mb-1.5 block text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
          Concurrent Builds
        </label>
        <Stepper
          value={concurrentBuilds}
          min={MIN_BUILDS}
          max={MAX_BUILDS}
          onChange={onConcurrentBuildsChange}
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
      <div>
        <label className="mb-1.5 block text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
          Startup Promo Code
        </label>
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            placeholder="ABC-123"
            value={promoCode}
            onChange={(e) => onPromoCodeChange(e.target.value)}
            className={`flex-1 ${inputClass}`}
          />
          <button
            onClick={onVerifyPromo}
            disabled={!promoCode.trim() || promoStatus === "verifying"}
            className="flex items-center justify-center rounded-[6px] border border-dash-border bg-dash-bg-elevated px-4 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg disabled:opacity-40"
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
    </div>
  );
}

/* ─── Step 3: Invite ─── */

interface InviteRow {
  id: number;
  email: string;
  role: string;
}

const roles = ["Member", "Admin", "Viewer"];
let inviteNextId = 1;

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

function StepInvite({
  rows,
  onRowsChange,
  teamSize,
}: {
  rows: InviteRow[];
  onRowsChange: (rows: InviteRow[]) => void;
  teamSize: number;
}) {
  function addRow() {
    onRowsChange([...rows, { id: inviteNextId++, email: "", role: "Member" }]);
  }

  function removeRow(id: number) {
    onRowsChange(rows.length > 1 ? rows.filter((r) => r.id !== id) : rows);
  }

  function updateRow(id: number, field: "email" | "role", value: string) {
    onRowsChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  const filled = rows.filter((r) => r.email.trim().length > 0).length;

  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <input
              type="email"
              placeholder="Enter email address"
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
              className="flex size-[38px] shrink-0 items-center justify-center rounded-[6px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="flex items-center gap-1.5 self-start text-sm text-[#4879f8] hover:text-[#3a6ae6]"
      >
        <Plus className="size-3.5" />
        Add another
      </button>

      {filled > 0 && (
        <div className="rounded-[4px] bg-dash-bg-elevated px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-dash-text-faded">
              {filled} of {teamSize} seats used
            </span>
            {filled > teamSize && (
              <span className="text-xs text-[#f5a623]">
                Exceeds team size — additional seats will be charged
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Step 4: Done ─── */

function StepDone({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 14 }}
        className="flex size-14 items-center justify-center rounded-full bg-[#28c840]/15"
      >
        <Check className="size-7 text-[#28c840]" />
      </motion.div>
      <div className="flex flex-col items-center gap-1">
        <h3 className="text-base font-medium text-dash-text-strong">
          Workspace created!
        </h3>
        <p className="text-sm text-dash-text-faded">
          &ldquo;{name}&rdquo; is ready to go.
        </p>
      </div>
    </div>
  );
}

/* ─── Modal Container ─── */

const stepDescriptions: Record<Step, { title: string; description: string }> = {
  name: { title: "Create workspace", description: "Set up a new workspace for your team." },
  config: { title: "Create workspace", description: "Configure your team size and build capacity." },
  invite: { title: "Create workspace", description: "Invite people to collaborate." },
  done: { title: "Create workspace", description: "" },
};

interface CreateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceModal({
  open,
  onOpenChange,
}: CreateWorkspaceModalProps) {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [teamSize, setTeamSize] = useState(3);
  const [concurrentBuilds, setConcurrentBuilds] = useState(2);
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<"idle" | "verifying" | "valid" | "invalid">("idle");
  const [inviteRows, setInviteRows] = useState<InviteRow[]>([
    { id: inviteNextId++, email: "", role: "Member" },
  ]);

  function reset() {
    setStep("name");
    setName("");
    setSlug("");
    setTeamSize(3);
    setConcurrentBuilds(2);
    setPromoCode("");
    setPromoStatus("idle");
    setInviteRows([{ id: inviteNextId++, email: "", role: "Member" }]);
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function handleVerifyPromo() {
    if (!promoCode.trim()) return;
    setPromoStatus("verifying");
    setTimeout(() => {
      setPromoStatus(promoCode.toUpperCase().startsWith("BRIMBLE") ? "valid" : "invalid");
    }, 800);
  }

  function handlePromoCodeChange(v: string) {
    setPromoCode(v);
    setPromoStatus("idle");
  }

  const steps: Step[] = ["name", "config", "invite", "done"];
  const stepIdx = steps.indexOf(step);

  function next() {
    if (stepIdx < steps.length - 1) setStep(steps[stepIdx + 1]);
  }

  function back() {
    if (stepIdx > 0) setStep(steps[stepIdx - 1]);
  }

  const canContinue =
    step === "name" ? name.trim().length > 0 :
    step === "config" ? true :
    step === "invite" ? true :
    false;

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      width={500}
    >
      {step !== "done" && (
        <ModalHeader
          title={stepDescriptions[step].title}
          description={stepDescriptions[step].description}
        />
      )}

      {/* Step indicator */}
      {step !== "done" && (
        <div className="flex items-center gap-1.5 px-6 pt-4">
          {["name", "config", "invite"].map((s, i) => (
            <div
              key={s}
              className={`h-[3px] flex-1 rounded-full transition-colors ${
                i <= stepIdx ? "bg-[#4879f8]" : "bg-dash-border"
              }`}
            />
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease }}
        >
          {step === "name" && (
            <StepName
              name={name}
              slug={slug}
              onNameChange={setName}
              onSlugChange={setSlug}
            />
          )}
          {step === "config" && (
            <StepConfig
              teamSize={teamSize}
              concurrentBuilds={concurrentBuilds}
              promoCode={promoCode}
              promoStatus={promoStatus}
              onTeamSizeChange={setTeamSize}
              onConcurrentBuildsChange={setConcurrentBuilds}
              onPromoCodeChange={handlePromoCodeChange}
              onVerifyPromo={handleVerifyPromo}
            />
          )}
          {step === "invite" && (
            <StepInvite
              rows={inviteRows}
              onRowsChange={setInviteRows}
              teamSize={teamSize}
            />
          )}
          {step === "done" && <StepDone name={name} />}
        </motion.div>
      </AnimatePresence>

      {step !== "done" ? (
        <ModalFooter>
          {stepIdx === 0 ? (
            <ModalCancelButton />
          ) : (
            <button
              onClick={back}
              className="flex h-[34px] items-center rounded-[4px] border border-dash-border bg-dash-bg px-3.5 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated"
            >
              Back
            </button>
          )}
          <div className="flex items-center gap-2">
            {step === "invite" && (
              <button
                onClick={next}
                className="flex h-[34px] items-center px-3.5 text-sm text-dash-text-faded transition-colors hover:text-dash-text-strong"
              >
                Skip
              </button>
            )}
            <ModalContinueButton onClick={next} disabled={!canContinue}>
              {step === "invite" ? "Create Team" : "Continue"}
            </ModalContinueButton>
          </div>
        </ModalFooter>
      ) : (
        <div className="flex justify-center px-6 pb-6">
          <button
            onClick={() => handleClose(false)}
            className="flex h-[34px] items-center rounded-[4px] border border-[#3964d5] bg-[#4879f8] px-5 text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-[#3a6ae6]"
          >
            Go to workspace
          </button>
        </div>
      )}
    </Modal>
  );
}
