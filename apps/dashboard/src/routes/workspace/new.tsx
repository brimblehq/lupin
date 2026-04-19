import { useState, useRef, useEffect } from "react";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import { Formik, Form as FormikForm } from "formik";
import axios from "axios";
import { ArrowLeft, Plus, Minus, X, Check, Users, Info, Settings } from "lucide-react";
import { RoleDropdown } from "../../components/shared/role-dropdown";
import { ImageSquare } from "@phosphor-icons/react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { GlossyButton } from "../../components/shared/glossy-button";
import { Dropdown } from "../../components/shared/dropdown";
import { dashInputClassName } from "@/components/shared/dash-input";
import { Route as RootRoute } from "@/routes/__root";
import config from "@/config";
import { createWorkspaceServerFn, verifyWorkspacePromoCodeServerFn } from "@/server/workspaces/actions";
import { getPaymentMethodsServerFn } from "@/server/payments/actions";
import {
  buildCreateWorkspacePayload,
  extractInvitedEmails,
  slugifyWorkspaceName,
  workspaceConfigStepSchema,
  workspaceInviteStepSchema,
  workspaceNameStepSchema,
  WORKSPACE_MAX_BUILDS,
  WORKSPACE_MIN_BUILDS,
  type WorkspaceConfigStepValues,
  type WorkspaceInviteRow,
  type WorkspaceInviteStepValues,
  type WorkspaceNameStepValues,
} from "@/utils/workspace-create";
import type { Workspace } from "@/backend/workspaces";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import { usePricing } from "@/contexts/pricing-context";
import { useProfileDrawer } from "@/contexts/profile-drawer-context";
import { ProfileTab } from "@/types/enums";

export const Route = createFileRoute("/workspace/new")({
  component: NewWorkspacePage,
});

/* ─── Constants ─── */

const ease = [0.16, 1, 0.3, 1] as const;

const inputClass = dashInputClassName;

type Phase = 1 | 2 | 3;

const teamSizeOptions = [3, 5, 10, 15, 25, 50];

/* ─── Summary Chip ─── */

function SummaryChip({ icon, label, onChangeClick }: { icon: React.ReactNode; label: string; onChangeClick: () => void }) {
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
      <button onClick={onChangeClick} className="text-xs text-[#4879f8] transition-colors hover:text-[#3a6ae6]">
        Change
      </button>
    </motion.div>
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
    <div className="input-base flex items-center">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex size-[42px] items-center justify-center text-dash-text-faded transition-colors hover:text-dash-text-strong disabled:opacity-30"
      >
        <Minus className="size-4" />
      </button>
      <span className="flex-1 text-center text-sm font-medium text-dash-text-strong">{renderValue(value)}</span>
      <button
        type="button"
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
    <div className="mt-2 flex items-start gap-2.5 rounded-[4px] bg-[#f59e0b]/[0.06] px-3 py-2.5 dark:bg-[#f59e0b]/[0.08]">
      <Info className="mt-0.5 size-3.5 shrink-0 text-[#f59e0b]" />
      <div className="text-sm font-light leading-[1.4] text-dash-text-body">{children}</div>
    </div>
  );
}

/* ─── Phase 1: Name & URL ─── */

function Phase1Name({
  onSubmit,
  initialValues,
  disabled,
}: {
  onSubmit: (name: string, slug: string, imageUrl: string) => void;
  initialValues: WorkspaceNameStepValues;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">Name your workspace</h3>
      <p className="mb-4 text-sm text-dash-text-faded">Choose a name and URL for your team workspace.</p>

      <Formik<WorkspaceNameStepValues>
        initialValues={initialValues}
        validationSchema={workspaceNameStepSchema}
        enableReinitialize
        onSubmit={(values) => {
          onSubmit(values.name.trim(), values.slug.trim(), values.imageUrl.trim());
        }}
      >
        {({ values, errors, touched, setFieldValue, handleSubmit }) => (
          <FormikForm onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="mb-3 block text-sm text-dash-text-body">Workspace image (optional)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;

                  setIsUploadingImage(true);
                  try {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("upload_preset", "profile-photos");

                    const response = await axios.post(config.uploadUrl, formData, {
                      headers: {
                        "Content-Type": "multipart/form-data",
                      },
                    });

                    const uploadedUrl = response.data?.secure_url || response.data?.url;
                    if (typeof uploadedUrl === "string" && uploadedUrl.length > 0) {
                      setFieldValue("imageUrl", uploadedUrl);
                      toast.success("Workspace image uploaded.");
                    } else {
                      toast.error("Upload succeeded but no image URL was returned.");
                    }
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Failed to upload image");
                  } finally {
                    setIsUploadingImage(false);
                    if (event.target) event.target.value = "";
                  }
                }}
              />

              {values.imageUrl ? (
                <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-dash-border p-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-full">
                    <img src={values.imageUrl} alt="Workspace preview" className="h-full w-full object-cover" />
                    {isUploadingImage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                        <div className="size-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="text-sm font-medium text-dash-text-body transition-colors hover:text-dash-text-strong disabled:opacity-50"
                    >
                      Change image
                    </button>
                    <button
                      type="button"
                      onClick={() => setFieldValue("imageUrl", "")}
                      disabled={isUploadingImage}
                      className="text-xs text-dash-text-faded transition-colors hover:text-dash-text-strong disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="flex w-full flex-col items-center gap-1.5 rounded-[10px] border border-dashed border-dash-border px-4 py-6 transition-colors hover:border-dash-text-extra-faded"
                >
                  {isUploadingImage ? (
                    <>
                      <div className="size-5 animate-spin rounded-full border-2 border-dash-text-extra-faded border-t-transparent" />
                      <span className="text-sm font-medium text-dash-text-body">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <ImageSquare size={28} weight="light" className="text-dash-text-extra-faded" />
                      <span className="text-sm font-medium text-dash-text-body">Upload image</span>
                      <span className="text-xs text-dash-text-extra-faded">PNG, JPG or WebP</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm text-dash-text-body">Workspace name</label>
                <input
                  type="text"
                  placeholder="My workspace"
                  value={values.name}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setFieldValue("name", nextName);
                    setFieldValue("slug", slugifyWorkspaceName(nextName));
                  }}
                  className={inputClass}
                  autoFocus
                />
                {touched.name && errors.name ? <p className="mt-1.5 text-xs text-[#ef2f1f]">{errors.name}</p> : null}
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-dash-text-body">Workspace URL</label>
                <div className="flex items-stretch">
                  <div className="flex items-center rounded-l-[6px] border border-r-0 border-dash-border bg-dash-bg-elevated px-3">
                    <span className="whitespace-nowrap text-sm text-dash-text-faded">brimble.app/</span>
                  </div>
                  <input
                    type="text"
                    value={values.slug}
                    onChange={(e) => setFieldValue("slug", slugifyWorkspaceName(e.target.value))}
                    className={`${inputClass} rounded-l-none`}
                  />
                </div>
                {touched.slug && errors.slug ? <p className="mt-1.5 text-xs text-[#ef2f1f]">{errors.slug}</p> : null}
              </div>
            </div>

            <div className="mt-6">
              <GlossyButton type="submit" variant="blue" fullWidth disabled={disabled || !values.name.trim() || !values.slug.trim()}>
                Continue
              </GlossyButton>
            </div>
          </FormikForm>
        )}
      </Formik>
    </motion.div>
  );
}

/* ─── Phase 2: Team Configuration ─── */

interface TeamConfig {
  teamSize: number;
  concurrentBuilds: number;
  promoCode: string;
  startupCodeReference?: string;
}

function Phase2Config({
  onSubmit,
  onVerifyPromo,
  initialValues,
  costPerMember,
  costPerBuild,
  disabled,
}: {
  onSubmit: (config: TeamConfig) => void;
  onVerifyPromo: (code: string) => Promise<{ valid: boolean; reference?: string }>;
  initialValues: WorkspaceConfigStepValues;
  costPerMember: number;
  costPerBuild: number;
  disabled?: boolean;
}) {
  const [promoStatus, setPromoStatus] = useState<"idle" | "verifying" | "valid" | "invalid">("idle");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">Team configuration</h3>
      <p className="mb-5 text-sm text-dash-text-faded">Configure your team size and build capacity.</p>

      <Formik<WorkspaceConfigStepValues>
        initialValues={initialValues}
        validationSchema={workspaceConfigStepSchema}
        enableReinitialize
        onSubmit={(values) => {
          onSubmit({
            teamSize: values.teamSize,
            concurrentBuilds: values.concurrentBuilds,
            promoCode: values.promoCode.trim(),
            startupCodeReference: values.startupCodeReference.trim() || undefined,
          });
        }}
      >
        {({ values, setFieldValue, handleSubmit }) => {
          const seatCost = values.teamSize * costPerMember;
          const buildCost = values.concurrentBuilds * costPerBuild;
          const totalCost = seatCost + buildCost;

          return (
            <FormikForm onSubmit={handleSubmit}>
              <div>
                <label className="mb-1.5 block text-sm text-dash-text-body">Team Size</label>
                <Dropdown
                  value={String(values.teamSize)}
                  options={teamSizeOptions.map(String)}
                  onChange={(v) => setFieldValue("teamSize", Number(v))}
                  renderOption={(v) => `${v} Members`}
                />
                <InfoBanner>
                  Seat pricing: ${costPerMember}/member/mo
                  <br />
                  <span className="font-medium">
                    {values.teamSize} {values.teamSize === 1 ? "member" : "members"} = ${seatCost}/mo
                  </span>
                </InfoBanner>
              </div>

              <div className="mt-5">
                <label className="mb-1.5 block text-sm text-dash-text-body">Concurrent Builds</label>
                <Stepper
                  value={values.concurrentBuilds}
                  min={WORKSPACE_MIN_BUILDS}
                  max={WORKSPACE_MAX_BUILDS}
                  onChange={(v) => setFieldValue("concurrentBuilds", v)}
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

              <div className="mt-5">
                <label className="mb-1.5 block text-sm text-dash-text-body">Startup Promo Code</label>
                <div className="flex items-stretch gap-2">
                  <input
                    type="text"
                    placeholder="ABC-123"
                    value={values.promoCode}
                    onChange={(e) => {
                      setFieldValue("promoCode", e.target.value);
                      setFieldValue("startupCodeReference", "");
                      setPromoStatus("idle");
                    }}
                    className={`flex-1 ${inputClass}`}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const code = values.promoCode.trim();
                      if (!code) return;
                      setPromoStatus("verifying");
                      try {
                        const result = await onVerifyPromo(code);
                        if (result.valid) {
                          setFieldValue("startupCodeReference", result.reference || code);
                          setPromoStatus("valid");
                        } else {
                          setFieldValue("startupCodeReference", "");
                          setPromoStatus("invalid");
                        }
                      } catch (error) {
                        setPromoStatus("invalid");
                        toast.error(error instanceof Error ? error.message : "Failed to verify promo code");
                      }
                    }}
                    disabled={!values.promoCode.trim() || promoStatus === "verifying"}
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
                {promoStatus === "invalid" && <p className="mt-1.5 text-sm text-[#ef2f1f]">Invalid promo code. Please try again.</p>}
              </div>

              <div className="mt-6">
                <GlossyButton type="submit" variant="blue" fullWidth disabled={disabled}>
                  Continue
                </GlossyButton>
              </div>
            </FormikForm>
          );
        }}
      </Formik>
    </motion.div>
  );
}

/* ─── Phase 3: Invite Members ─── */

let inviteNextId = 1;

function Phase3Invite({
  workspaceName,
  teamSize,
  concurrentBuilds,
  initialValues,
  creating,
  disabled,
  onSubmit,
  costPerMember,
  costPerBuild,
  currentUserEmail,
}: {
  workspaceName: string;
  teamSize: number;
  concurrentBuilds: number;
  initialValues: WorkspaceInviteStepValues;
  creating?: boolean;
  disabled?: boolean;
  onSubmit: (rows: WorkspaceInviteRow[]) => Promise<void> | void;
  costPerMember: number;
  costPerBuild: number;
  currentUserEmail?: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">Invite your team</h3>
      <p className="mb-4 text-sm text-dash-text-faded">Add team members to &ldquo;{workspaceName}&rdquo;. You can always do this later.</p>

      <Formik<WorkspaceInviteStepValues>
        initialValues={initialValues}
        validationSchema={workspaceInviteStepSchema}
        enableReinitialize
        onSubmit={async (values) => {
          const normalizedCurrentUserEmail = currentUserEmail?.trim().toLowerCase() ?? "";
          const hasSelfInvite = values.invites.some((row) => {
            const normalizedEmail = row.email.trim().toLowerCase();
            return Boolean(normalizedEmail && normalizedCurrentUserEmail && normalizedEmail === normalizedCurrentUserEmail);
          });
          if (hasSelfInvite) {
            return;
          }
          await onSubmit(values.invites);
        }}
      >
        {({ values, errors, setFieldValue, handleSubmit, isSubmitting }) => {
          const rows = values.invites;
          const filled = rows.filter((r) => r.email.trim().length > 0).length;
          const busy = creating || isSubmitting || disabled;
          const normalizedCurrentUserEmail = currentUserEmail?.trim().toLowerCase() ?? "";
          const selfInviteRowIds = new Set(
            rows
              .filter((row) => {
                const normalizedEmail = row.email.trim().toLowerCase();
                return Boolean(normalizedEmail && normalizedCurrentUserEmail && normalizedEmail === normalizedCurrentUserEmail);
              })
              .map((row) => row.id),
          );

          function addRow() {
            setFieldValue("invites", [...rows, { id: inviteNextId++, email: "", role: "Member" }]);
          }

          function removeRow(id: number) {
            setFieldValue("invites", rows.length > 1 ? rows.filter((r) => r.id !== id) : rows);
          }

          function updateRow(id: number, field: "email" | "role", value: string) {
            setFieldValue(
              "invites",
              rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
            );
          }

          return (
            <FormikForm onSubmit={handleSubmit}>
              <div className="flex flex-col gap-3">
                {rows.map((row, index) => (
                  <div key={row.id}>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="email"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        name={`workspace-invite-email-${row.id}`}
                        placeholder="colleague@company.com"
                        value={row.email}
                        onChange={(e) => updateRow(row.id, "email", e.target.value)}
                        className={
                          selfInviteRowIds.has(row.id)
                            ? "flex-1 rounded-[6px] px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af] shadow-[0px_0px_0px_1px_#e1291d,0px_0px_0px_3px_rgba(225,41,29,0.15)] outline-none"
                            : `flex-1 ${inputClass}`
                        }
                      />
                      <RoleDropdown value={row.role} onChange={(v) => updateRow(row.id, "role", v)} />
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-dash-text-faded transition-colors hover:text-dash-text-strong"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    {Array.isArray((errors as any).invites) && (errors as any).invites[index]?.email ? (
                      <p className="mt-1.5 text-xs text-[#ef2f1f]">{(errors as any).invites[index].email}</p>
                    ) : selfInviteRowIds.has(row.id) ? (
                      <p className="mt-1.5 text-xs text-[#ef2f1f]">You can&apos;t invite yourself to this workspace.</p>
                    ) : null}
                  </div>
                ))}
              </div>

              {typeof errors.invites === "string" ? <p className="mt-2 text-xs text-[#ef2f1f]">{errors.invites}</p> : null}

              <button
                type="button"
                onClick={addRow}
                className="mt-3 flex items-center gap-1.5 text-sm text-[#4879f8] transition-colors hover:text-[#3a6ae6]"
              >
                <Plus className="size-3.5" />
                Add another
              </button>

              {(() => {
                const seatsCost = teamSize * costPerMember;
                const buildsCost = concurrentBuilds * costPerBuild;
                const total = seatsCost + buildsCost;
                return (
                  <div className="mt-5 rounded-[6px] bg-dash-bg-elevated px-4 py-3.5">
                    <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-dash-text-extra-faded">Billing summary</p>
                    <div className="flex flex-col gap-1.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-dash-text-faded">
                          {teamSize} team {teamSize === 1 ? "seat" : "seats"} &times; ${costPerMember}/mo
                        </span>
                        <span className="text-dash-text-strong">${seatsCost.toFixed(2)}</span>
                      </div>
                      {concurrentBuilds > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-dash-text-faded">
                            {concurrentBuilds} concurrent {concurrentBuilds === 1 ? "build" : "builds"} &times; ${costPerBuild}/mo
                          </span>
                          <span className="text-dash-text-strong">${buildsCost.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="mt-1.5 flex items-center justify-between border-t border-dash-border pt-2">
                        <span className="text-sm font-medium text-dash-text-strong">Total</span>
                        <span className="text-sm font-semibold text-dash-text-strong">${total.toFixed(2)}/mo</span>
                      </div>
                    </div>
                    {filled > 0 && filled > teamSize && (
                      <p className="mt-2 text-xs text-[#f5a623]">
                        You've invited {filled} members but only have {teamSize} seats — additional seats will be charged.
                      </p>
                    )}
                    <p className="mt-2 text-xs text-dash-text-extra-faded">
                      Your card will be charged immediately upon creating the workspace.
                    </p>
                  </div>
                );
              })()}
              <div className="mt-3 flex gap-3">
                <GlossyButton type="submit" variant="blue" fullWidth loading={busy} loadingLabel="Creating...">
                  Create Workspace
                </GlossyButton>
              </div>
            </FormikForm>
          );
        }}
      </Formik>
    </motion.div>
  );
}

/* ─── Main Page ─── */

function NewWorkspacePage() {
  const pricing = usePricing();
  const profileDrawer = useProfileDrawer();
  const { settingsSnapshot } = RootRoute.useLoaderData() ?? ({} as any);
  const navigate = useNavigate({ from: "/workspace/new" });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const createWorkspace = useServerFn(createWorkspaceServerFn as any) as (args: { data: Record<string, unknown> }) => Promise<Workspace>;
  const verifyPromo = useServerFn(verifyWorkspacePromoCodeServerFn as any) as (args: {
    data: { code: string };
  }) => Promise<{ valid: boolean; reference?: string }>;

  const [phase, setPhase] = useState<Phase>(1);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [workspaceImageUrl, setWorkspaceImageUrl] = useState("");
  const [teamConfig, setTeamConfig] = useState<TeamConfig | null>(null);
  const [inviteRows, setInviteRows] = useState<WorkspaceInviteRow[]>([{ id: inviteNextId++, email: "", role: "Member" }]);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [hasPaymentMethod, setHasPaymentMethod] = useState<boolean | null>(null);
  const currentUserEmail = settingsSnapshot?.profile?.email ?? null;

  async function fetchLatestPaymentMethods() {
    const methods = await getPaymentMethodsServerFn();
    return Array.isArray(methods) ? methods : [];
  }

  useEffect(() => {
    fetchLatestPaymentMethods()
      .then((methods: any[]) => {
        setHasPaymentMethod(Array.isArray(methods) && methods.length > 0);
      })
      .catch(() => {
        setHasPaymentMethod(false);
      });
  }, []);

  function handleNameSubmit(name: string, slug: string, imageUrl: string) {
    setWorkspaceName(name);
    setWorkspaceSlug(slug);
    setWorkspaceImageUrl(imageUrl);
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
      setWorkspaceImageUrl("");
      setTeamConfig(null);
      setInviteRows([{ id: inviteNextId++, email: "", role: "Member" }]);
    }
    if (target <= 2) {
      setTeamConfig(null);
    }
  }

  async function handleVerifyPromo(code: string) {
    return verifyPromo({ data: { code } });
  }

  async function submitWorkspaceCreate(rows: WorkspaceInviteRow[]) {
    if (!teamConfig) {
      toast.error("Team configuration is missing.");
      return;
    }

    let latestDefaultPaymentMethod: string | undefined;
    try {
      const methods = await fetchLatestPaymentMethods();
      const defaultPm = methods.find((m: any) => m.is_default) ?? methods[0];
      latestDefaultPaymentMethod = defaultPm?.id;
      setHasPaymentMethod(methods.length > 0);
    } catch {
      setHasPaymentMethod(false);
    }

    if (!latestDefaultPaymentMethod) {
      toast.error("Add a payment method before creating a workspace.");
      return;
    }

    const payload = buildCreateWorkspacePayload({
      workspaceName,
      imageUrl: workspaceImageUrl,
      teamSize: teamConfig.teamSize,
      concurrentBuilds: teamConfig.concurrentBuilds,
      promoCode: teamConfig.promoCode,
      startupCodeReference: teamConfig.startupCodeReference,
      invitedEmails: extractInvitedEmails(rows),
      paymentMethod: latestDefaultPaymentMethod,
    });

    try {
      setCreatingWorkspace(true);
      const created = await createWorkspace({ data: payload as Record<string, unknown> });
      const nextWorkspaceSlug = created.slug || workspaceSlug;
      toast.success("Workspace created successfully");
      navigate({
        to: "/",
        search: nextWorkspaceSlug ? { workspace: nextWorkspaceSlug } : {},
      } as any);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create workspace");
      setCreatingWorkspace(false);
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-[680px]">
        {/* Header */}
        <div className="mb-8">
          <Link
            to={withWorkspaceQuery({ pathname: "/", searchStr }) as any}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-dash-text-faded transition-colors hover:text-dash-text-strong"
          >
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
          <h1 className="text-xl font-medium text-dash-text-strong">New Workspace</h1>
          <p className="mt-1 text-sm text-dash-text-faded">Set up a new workspace for your team.</p>
        </div>

        {hasPaymentMethod === false && (
          <div className="mb-6">
            <InfoBanner>
              A payment method is required to create a workspace.{" "}
              <button
                type="button"
                onClick={() => profileDrawer.open(ProfileTab.Billing)}
                className="font-medium text-[#4879f8] hover:text-[#3a6ae6]"
              >
                Add a payment method
              </button>
            </InfoBanner>
          </div>
        )}

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
              <Phase1Name
                key="phase1"
                onSubmit={handleNameSubmit}
                initialValues={{ name: workspaceName, slug: workspaceSlug, imageUrl: workspaceImageUrl }}
                disabled={hasPaymentMethod === false}
              />
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
              <Phase2Config
                key="phase2"
                onSubmit={handleConfigSubmit}
                onVerifyPromo={handleVerifyPromo}
                costPerMember={pricing.team.costPerMember}
                costPerBuild={pricing.team.costPerBuild}
                initialValues={{
                  teamSize: teamConfig?.teamSize ?? 3,
                  concurrentBuilds: teamConfig?.concurrentBuilds ?? 2,
                  promoCode: teamConfig?.promoCode ?? "",
                  startupCodeReference: teamConfig?.startupCodeReference ?? "",
                }}
                disabled={hasPaymentMethod === false}
              />
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
              concurrentBuilds={teamConfig?.concurrentBuilds ?? WORKSPACE_MIN_BUILDS}
              costPerMember={pricing.team.costPerMember}
              costPerBuild={pricing.team.costPerBuild}
              initialValues={{ invites: inviteRows }}
              creating={creatingWorkspace}
              disabled={hasPaymentMethod === false}
              onSubmit={async (rows) => {
                setInviteRows(rows);
                await submitWorkspaceCreate(rows);
              }}
              currentUserEmail={currentUserEmail}
            />
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
