import { useState } from "react";
import { Plus, Minus, X, Check, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Modal, ModalHeader, ModalFooter, ModalCancelButton, ModalContinueButton } from "../shared/modal";
import { Dropdown } from "../shared/dropdown";
import { RoleDropdown } from "../shared/role-dropdown";
import { DashInput } from "../shared/dash-input";
import { WorkspaceStep } from "../../types/enums";
import { usePricing } from "@/contexts/pricing-context";

const teamSizeOptions = Array.from({ length: 48 }, (_, i) => i + 3);

const MIN_BUILDS = 2;
const MAX_BUILDS = 10;

const ease = [0.16, 1, 0.3, 1] as const;

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
    <div className="input-base flex items-center">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex size-[42px] items-center justify-center text-dash-text-faded transition-colors hover:text-dash-text-strong disabled:opacity-30"
      >
        <Minus className="size-4" />
      </button>
      <span className="flex-1 text-center text-sm font-medium text-dash-text-strong">{renderValue(value)}</span>
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
      <div className="text-sm font-light leading-[1.4] text-[#b37a10] dark:text-[#f5a623]">{children}</div>
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
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Workspace name</label>
        <DashInput type="text" placeholder="My workspace" value={name} onChange={(e) => handleNameChange(e.target.value)} autoFocus />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Workspace URL</label>
        <div className="flex items-stretch">
          <div className="flex items-center rounded-l-[6px] border border-r-0 border-dash-border bg-dash-bg-elevated px-3">
            <span className="whitespace-nowrap text-sm text-dash-text-faded">brimble.app/</span>
          </div>
          <DashInput type="text" value={slug} onChange={(e) => onSlugChange(e.target.value)} className="rounded-l-none" />
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
  costPerMember,
  costPerBuild,
}: {
  teamSize: number;
  concurrentBuilds: number;
  promoCode: string;
  promoStatus: "idle" | "verifying" | "valid" | "invalid";
  onTeamSizeChange: (v: number) => void;
  onConcurrentBuildsChange: (v: number) => void;
  onPromoCodeChange: (v: string) => void;
  onVerifyPromo: () => void;
  costPerMember: number;
  costPerBuild: number;
}) {
  const seatCost = teamSize * costPerMember;
  const buildCost = concurrentBuilds * costPerBuild;
  const totalCost = seatCost + buildCost;

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      {/* Team Size */}
      <div>
        <label className="mb-1.5 block text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Team Size</label>
        <Dropdown
          value={String(teamSize)}
          options={teamSizeOptions.map(String)}
          onChange={(v) => onTeamSizeChange(Number(v))}
          renderOption={(v) => `${v} Members`}
        />
        <InfoBanner>
          Seat pricing: ${costPerMember}/member/mo
          <br />
          <span className="font-medium">
            {teamSize} {teamSize === 1 ? "member" : "members"} = ${seatCost}/mo
          </span>
        </InfoBanner>
      </div>

      {/* Concurrent Builds */}
      <div>
        <label className="mb-1.5 block text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Concurrent Builds</label>
        <Stepper
          value={concurrentBuilds}
          min={MIN_BUILDS}
          max={MAX_BUILDS}
          onChange={onConcurrentBuildsChange}
          renderValue={(v) => {
            const cost = v * costPerBuild;
            return `${v} ${v === 1 ? "Build" : "Builds"} — $${cost % 1 === 0 ? cost : cost.toFixed(2)}`;
          }}
        />
        <InfoBanner>
          Build pricing: ${costPerBuild}/build container/mo
          <br />
          <span className="font-medium">Estimated total: ${totalCost % 1 === 0 ? totalCost : totalCost.toFixed(2)}/mo</span>
        </InfoBanner>
      </div>

      {/* Startup Promo Code */}
      <div>
        <label className="mb-1.5 block text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Startup Promo Code</label>
        <div className="flex items-stretch gap-2">
          <DashInput
            type="text"
            placeholder="ABC-123"
            value={promoCode}
            onChange={(e) => onPromoCodeChange(e.target.value)}
            className="flex-1"
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
        {promoStatus === "invalid" && <p className="mt-1.5 text-sm text-[#ef2f1f]">Invalid promo code. Please try again.</p>}
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

let inviteNextId = 1;

function StepInvite({ rows, onRowsChange, teamSize }: { rows: InviteRow[]; onRowsChange: (rows: InviteRow[]) => void; teamSize: number }) {
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
            <DashInput
              type="text"
              inputMode="email"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              name={`workspace-invite-email-${row.id}`}
              placeholder="Enter email address"
              value={row.email}
              onChange={(e) => updateRow(row.id, "email", e.target.value)}
              className="flex-1"
            />
            <RoleDropdown value={row.role} onChange={(v) => updateRow(row.id, "role", v)} />
            <button
              onClick={() => removeRow(row.id)}
              className="flex size-[38px] shrink-0 items-center justify-center rounded-[6px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <button onClick={addRow} className="flex items-center gap-1.5 self-start text-sm text-[#4879f8] hover:text-[#3a6ae6]">
        <Plus className="size-3.5" />
        Add another
      </button>

      {filled > 0 && (
        <div className="rounded-[4px] bg-dash-bg-elevated px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-dash-text-faded">
              {filled} of {teamSize} seats used
            </span>
            {filled > teamSize && <span className="text-xs text-[#f5a623]">Exceeds team size — additional seats will be charged</span>}
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
        <h3 className="text-base font-medium text-dash-text-strong">Workspace created!</h3>
        <p className="text-sm text-dash-text-faded">&ldquo;{name}&rdquo; is ready to go.</p>
      </div>
    </div>
  );
}

/* ─── Modal Container ─── */

const stepDescriptions: Record<WorkspaceStep, { title: string; description: string }> = {
  [WorkspaceStep.Name]: {
    title: "Create workspace",
    description: "Set up a new workspace for your team.",
  },
  [WorkspaceStep.Config]: {
    title: "Create workspace",
    description: "Configure your team size and build capacity.",
  },
  [WorkspaceStep.Invite]: {
    title: "Create workspace",
    description: "Invite people to collaborate.",
  },
  [WorkspaceStep.Done]: { title: "Create workspace", description: "" },
};

interface CreateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceModal({ open, onOpenChange }: CreateWorkspaceModalProps) {
  const pricing = usePricing();
  const [step, setStep] = useState<WorkspaceStep>(WorkspaceStep.Name);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [teamSize, setTeamSize] = useState(3);
  const [concurrentBuilds, setConcurrentBuilds] = useState(2);
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<"idle" | "verifying" | "valid" | "invalid">("idle");
  const [inviteRows, setInviteRows] = useState<InviteRow[]>([{ id: inviteNextId++, email: "", role: "Member" }]);

  function reset() {
    setStep(WorkspaceStep.Name);
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

  const steps: WorkspaceStep[] = [WorkspaceStep.Name, WorkspaceStep.Config, WorkspaceStep.Invite, WorkspaceStep.Done];
  const stepIdx = steps.indexOf(step);

  function next() {
    if (stepIdx < steps.length - 1) setStep(steps[stepIdx + 1]);
  }

  function back() {
    if (stepIdx > 0) setStep(steps[stepIdx - 1]);
  }

  const canContinue =
    step === WorkspaceStep.Name
      ? name.trim().length > 0
      : step === WorkspaceStep.Config
        ? true
        : step === WorkspaceStep.Invite
          ? true
          : false;

  return (
    <Modal open={open} onOpenChange={handleClose} width={500}>
      {step !== WorkspaceStep.Done && <ModalHeader title={stepDescriptions[step].title} description={stepDescriptions[step].description} />}

      {/* Step indicator */}
      {step !== WorkspaceStep.Done && (
        <div className="flex items-center gap-1.5 px-6 pt-4">
          {[WorkspaceStep.Name, WorkspaceStep.Config, WorkspaceStep.Invite].map((s, i) => (
            <div key={s} className={`h-[3px] flex-1 rounded-full transition-colors ${i <= stepIdx ? "bg-[#4879f8]" : "bg-dash-border"}`} />
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
          {step === WorkspaceStep.Name && <StepName name={name} slug={slug} onNameChange={setName} onSlugChange={setSlug} />}
          {step === WorkspaceStep.Config && (
            <StepConfig
              teamSize={teamSize}
              concurrentBuilds={concurrentBuilds}
              promoCode={promoCode}
              promoStatus={promoStatus}
              onTeamSizeChange={setTeamSize}
              onConcurrentBuildsChange={setConcurrentBuilds}
              onPromoCodeChange={handlePromoCodeChange}
              onVerifyPromo={handleVerifyPromo}
              costPerMember={pricing.team.costPerMember}
              costPerBuild={pricing.team.costPerBuild}
            />
          )}
          {step === WorkspaceStep.Invite && <StepInvite rows={inviteRows} onRowsChange={setInviteRows} teamSize={teamSize} />}
          {step === WorkspaceStep.Done && <StepDone name={name} />}
        </motion.div>
      </AnimatePresence>

      {step !== WorkspaceStep.Done ? (
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
            {step === WorkspaceStep.Invite && (
              <button
                onClick={next}
                className="flex h-[34px] items-center px-3.5 text-sm text-dash-text-faded transition-colors hover:text-dash-text-strong"
              >
                Skip
              </button>
            )}
            <ModalContinueButton onClick={next} disabled={!canContinue}>
              {step === WorkspaceStep.Invite ? "New workspace" : "Continue"}
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
