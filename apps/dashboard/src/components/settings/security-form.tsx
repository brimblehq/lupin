import { Fragment, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@brimble/ui";
import { Copy, Download, Loader2, TriangleAlert } from "lucide-react";
import { CheckCircle, CopySimple } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import {
  deletePasskeyServerFn,
  disableTwoFactorServerFn,
  getPasskeyRegisterOptionsServerFn,
  getTwoFactorStatusServerFn,
  listPasskeysServerFn,
  regenerateTwoFactorRecoveryCodesServerFn,
  renamePasskeyServerFn,
  startTwoFactorSetupServerFn,
  verifyPasskeyRegistrationServerFn,
  verifyTwoFactorSetupServerFn,
} from "@/server/auth/actions";
import type { PasskeyRegisterOptionsResult, PasskeySummary, TwoFactorSetup, TwoFactorStatus } from "@/backend/auth/types";
import { usePasskeyFeature } from "@/hooks/use-passkey-feature";
import { guessDeviceName, passkeyErrorMessage, runRegistration } from "@/lib/auth/passkey";
import { GlossyButton } from "../shared/glossy-button";
import { Modal, ModalHeader, ModalFooter, ModalCancelButton, ModalContinueButton } from "../shared/modal";
import { OtpInput } from "../auth/auth-split-layout";
import { dashInputClassName } from "../shared/dash-input";

const stepTransition = {
  duration: 0.25,
  ease: [0.16, 1, 0.3, 1] as const,
};

const inputClass = dashInputClassName;

function normalizeCodeEntry(value: string) {
  return value.replace(/\s+/g, "").trim().toUpperCase();
}

function downloadRecoveryCodes(codes: string[]) {
  const content = codes.join("\n");
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "brimble-2fa-recovery-codes.txt";
  anchor.click();
  URL.revokeObjectURL(url);
}

function RecoveryCodesGrid({ codes }: { codes: string[] }) {
  const normalizedCodes = codes.map(normalizeCodeEntry).filter(Boolean);
  const columnSize = Math.ceil(normalizedCodes.length / 2);
  const leftColumn = normalizedCodes.slice(0, columnSize);
  const rightColumn = normalizedCodes.slice(columnSize);
  const rowCount = Math.max(leftColumn.length, rightColumn.length);

  return (
    <div className="flex justify-center rounded-[6px] border border-dash-border bg-dash-bg-elevated p-4">
      <div className="grid grid-cols-2 gap-x-16 gap-y-2.5">
        {Array.from({ length: rowCount }).map((_, rowIndex) => (
          <Fragment key={rowIndex}>
            <code className="block font-mono text-sm tabular-nums tracking-[0.08em] text-dash-text-strong">
              {leftColumn[rowIndex] ?? ""}
            </code>
            <code className="block font-mono text-sm tabular-nums tracking-[0.08em] text-dash-text-strong">
              {rightColumn[rowIndex] ?? ""}
            </code>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function SecurityForm({
  email: initialEmail,
  firstName,
  initialStatus,
  initialPasskeys,
  onStatusChange,
  onPasskeysChange,
  onChangeEmail,
}: {
  email: string;
  firstName?: string;
  initialStatus?: TwoFactorStatus | null;
  initialPasskeys?: PasskeySummary[];
  onStatusChange?: (status: TwoFactorStatus | null) => void;
  onPasskeysChange?: (passkeys: PasskeySummary[]) => void;
  onChangeEmail?: (email: string) => void | Promise<void>;
}) {
  const haptics = useHaptics();

  const getTwoFactorStatus = useServerFn(getTwoFactorStatusServerFn as any) as () => Promise<TwoFactorStatus>;
  const startTwoFactorSetup = useServerFn(startTwoFactorSetupServerFn as any) as () => Promise<TwoFactorSetup>;
  const verifyTwoFactorSetup = useServerFn(verifyTwoFactorSetupServerFn as any) as (args: {
    data: { code: string };
  }) => Promise<{ ok: true }>;
  const disableTwoFactor = useServerFn(disableTwoFactorServerFn as any) as (args: { data: { code: string } }) => Promise<{ ok: true }>;
  const regenerateTwoFactorRecoveryCodes = useServerFn(regenerateTwoFactorRecoveryCodesServerFn as any) as (args: {
    data: { code: string };
  }) => Promise<{ recoveryCodes: string[] }>;

  const listPasskeys = useServerFn(listPasskeysServerFn as any) as () => Promise<PasskeySummary[]>;
  const getPasskeyRegisterOptions = useServerFn(getPasskeyRegisterOptionsServerFn as any) as (args: {
    data: { deviceName: string };
  }) => Promise<PasskeyRegisterOptionsResult>;
  const verifyPasskeyRegistration = useServerFn(verifyPasskeyRegistrationServerFn as any) as (args: {
    data: { challengeToken: string; credential: unknown; deviceName: string };
  }) => Promise<PasskeySummary>;
  const renamePasskey = useServerFn(renamePasskeyServerFn as any) as (args: {
    data: { id: string; deviceName: string };
  }) => Promise<PasskeySummary>;
  const deletePasskey = useServerFn(deletePasskeyServerFn as any) as (args: {
    data: { id: string; code?: string };
  }) => Promise<{ ok: true }>;

  const hasInitialPasskeys = typeof initialPasskeys !== "undefined";
  const passkeyFeature = usePasskeyFeature();
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>(initialPasskeys ?? []);
  const [loadingPasskeys, setLoadingPasskeys] = useState(!hasInitialPasskeys);
  const [enrollingPasskey, setEnrollingPasskey] = useState(false);
  const [enrollNameOpen, setEnrollNameOpen] = useState(false);
  const [enrollName, setEnrollName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stepUpPasskeyId, setStepUpPasskeyId] = useState<string | null>(null);
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const [stepUpLoading, setStepUpLoading] = useState(false);

  const [email, setEmail] = useState(initialEmail);
  const [emailCopied, setEmailCopied] = useState(false);

  const [status, setStatusInternal] = useState<TwoFactorStatus | null>(initialStatus ?? null);
  const [loadingStatus, setLoadingStatus] = useState(!initialStatus);

  function setStatus(next: TwoFactorStatus | null) {
    setStatusInternal(next);
    onStatusChange?.(next);
  }

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupStep, setSetupStep] = useState<"scan" | "verify" | "codes">("scan");
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupAcknowledged, setSetupAcknowledged] = useState(false);

  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableLoading, setDisableLoading] = useState(false);

  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerateCode, setRegenerateCode] = useState("");
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [regenerateLoading, setRegenerateLoading] = useState(false);

  const [showCodesModal, setShowCodesModal] = useState(false);
  const [codesModalTitle, setCodesModalTitle] = useState("Recovery codes");
  const [codesModalDescription, setCodesModalDescription] = useState("Store these codes in a safe place. Each code can only be used once.");
  const [codesModalCodes, setCodesModalCodes] = useState<string[]>([]);

  const [keyCopied, setKeyCopied] = useState(false);

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (!hasInitialPasskeys) {
      return;
    }

    setPasskeys(initialPasskeys ?? []);
    setLoadingPasskeys(false);
  }, [hasInitialPasskeys, initialPasskeys]);

  async function refreshStatus() {
    setLoadingStatus(true);
    try {
      const nextStatus = await getTwoFactorStatus();
      setStatus(nextStatus);
    } catch (error) {
      setStatus(null);
      toast.error(error instanceof Error ? error.message : "Failed to load two-factor status");
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    if (initialStatus) {
      setStatusInternal(initialStatus);
      setLoadingStatus(false);
      return;
    }
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStatus]);

  function resetSetupModal() {
    setShowSetupModal(false);
    setSetupStep("scan");
    setSetupCode("");
    setSetupError(null);
    setSetupLoading(false);
    setSetupAcknowledged(false);
    setSetupData(null);
  }

  async function handleOpenSetup() {
    setSetupLoading(true);
    try {
      const nextSetup = await startTwoFactorSetup();
      setSetupData(nextSetup);
      setSetupStep("scan");
      setShowSetupModal(true);
      setSetupError(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start 2FA setup");
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleVerifySetup() {
    if (!/^\d{6}$/.test(setupCode) || setupLoading) {
      return;
    }

    setSetupLoading(true);
    setSetupError(null);

    try {
      await verifyTwoFactorSetup({ data: { code: setupCode } });
      setSetupStep("codes");
      await refreshStatus();
      toast.success("Two-factor authentication enabled");
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Invalid verification code");
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleDisable() {
    if (!/^\d{6}$/.test(disableCode) || disableLoading) {
      return;
    }

    setDisableLoading(true);
    setDisableError(null);

    try {
      await disableTwoFactor({ data: { code: disableCode } });
      setShowDisableModal(false);
      setDisableCode("");
      await refreshStatus();
      toast.success("Two-factor authentication disabled");
    } catch (error) {
      setDisableError(error instanceof Error ? error.message : "Failed to disable 2FA");
    } finally {
      setDisableLoading(false);
    }
  }

  async function handleRegenerateCodes() {
    if (!/^\d{6}$/.test(regenerateCode) || regenerateLoading) {
      return;
    }

    setRegenerateLoading(true);
    setRegenerateError(null);

    try {
      const response = await regenerateTwoFactorRecoveryCodes({
        data: { code: regenerateCode },
      });
      setShowRegenerateModal(false);
      setRegenerateCode("");

      setCodesModalTitle("New recovery codes");
      setCodesModalDescription("Your previous recovery codes are now invalid. Save this new list in a safe place.");
      setCodesModalCodes(response.recoveryCodes ?? []);
      setShowCodesModal(true);

      await refreshStatus();
      toast.success("Recovery codes regenerated");
    } catch (error) {
      setRegenerateError(error instanceof Error ? error.message : "Failed to regenerate recovery codes");
    } finally {
      setRegenerateLoading(false);
    }
  }

  function handleCopySecret() {
    if (!setupData?.secret) {
      return;
    }

    void navigator.clipboard.writeText(setupData.secret);
    setKeyCopied(true);
    haptics.selection();
    setTimeout(() => setKeyCopied(false), 2000);
  }

  function handleCopyCodes(codes: string[]) {
    if (!codes.length) {
      return;
    }

    void navigator.clipboard.writeText(codes.join("\n"));
    haptics.selection();
    toast.success("Recovery codes copied");
  }

  const normalizedRemaining = status?.recoveryCodesRemaining ?? 0;
  const lowCodesWarning = Boolean(status?.enabled && normalizedRemaining <= 3);

  const passkeyPanelVisible = passkeyFeature.browserSupported;
  const lastPasskeyDeleteBlocked = useMemo(() => {
    if (status?.enabled) return false;
    if (status?.hasRecoveryCodes) return false;
    return true;
  }, [status?.enabled, status?.hasRecoveryCodes]);

  async function refreshPasskeys() {
    setLoadingPasskeys(true);
    try {
      const list = await listPasskeys();
      setPasskeys(list);
      onPasskeysChange?.(list);
    } catch (error) {
      toast.error(passkeyErrorMessage(error));
    } finally {
      setLoadingPasskeys(false);
    }
  }

  useEffect(() => {
    if (!passkeyPanelVisible) return;
    if (hasInitialPasskeys) return;
    void refreshPasskeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInitialPasskeys, passkeyPanelVisible]);

  async function handleEnrollPasskey() {
    const deviceName = enrollName.trim();
    if (!deviceName || enrollingPasskey) return;
    setEnrollingPasskey(true);
    try {
      const { options, challengeToken } = await getPasskeyRegisterOptions({
        data: { deviceName },
      });
      const credential = await runRegistration(options);
      await verifyPasskeyRegistration({
        data: { challengeToken, credential, deviceName },
      });
      setEnrollNameOpen(false);
      setEnrollName("");
      await refreshPasskeys();
      toast.success("Passkey added");
    } catch (error) {
      toast.error(passkeyErrorMessage(error));
    } finally {
      setEnrollingPasskey(false);
    }
  }

  async function handleRenamePasskey(id: string) {
    const deviceName = renameValue.trim();
    if (!deviceName) return;
    try {
      await renamePasskey({ data: { id, deviceName } });
      setRenamingId(null);
      setRenameValue("");
      await refreshPasskeys();
      toast.success("Passkey renamed");
    } catch (error) {
      toast.error(passkeyErrorMessage(error));
    }
  }

  async function handleDeletePasskey(id: string) {
    if (deletingId || stepUpPasskeyId) return;
    if (status?.enabled) {
      setStepUpPasskeyId(id);
      setStepUpCode("");
      setStepUpError(null);
      return;
    }
    setDeletingId(id);
    try {
      await deletePasskey({ data: { id } });
      await refreshPasskeys();
      toast.success("Passkey removed");
    } catch (error) {
      toast.error(passkeyErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleStepUpDeletePasskey() {
    if (!stepUpPasskeyId || !/^\d{6}$/.test(stepUpCode) || stepUpLoading) return;
    setStepUpLoading(true);
    setStepUpError(null);
    try {
      await deletePasskey({ data: { id: stepUpPasskeyId, code: stepUpCode } });
      setStepUpPasskeyId(null);
      setStepUpCode("");
      await refreshPasskeys();
      toast.success("Passkey removed");
    } catch (error) {
      setStepUpError(passkeyErrorMessage(error));
    } finally {
      setStepUpLoading(false);
    }
  }

  function formatPasskeyDate(value?: string) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <>
      <div className="flex max-w-[488px] flex-col gap-8">
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold leading-5 tracking-[-0.0224px] text-dash-text-strong">Email address</span>
            <span className="text-sm leading-5 text-dash-text-faded">
              This is a vital info. We would have to verify and save your changes
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={cn(inputClass, "cursor-text pr-9 text-dash-text-faded")}
              />
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(email);
                  setEmailCopied(true);
                  setTimeout(() => setEmailCopied(false), 2000);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dash-text-faded transition-colors hover:text-dash-text-strong"
                title="Copy email"
              >
                {emailCopied ? <CheckCircle className="size-4 text-[#34d399]" weight="fill" /> : <CopySimple className="size-4" />}
              </button>
            </div>
            <button
              onClick={() => {
                void onChangeEmail?.(email);
              }}
              className="shrink-0 text-sm font-medium tracking-[-0.0224px] text-dash-text-strong transition-colors hover:text-dash-text-body"
            >
              Change
            </button>
          </div>
        </div>

        <hr className="border-dash-border-soft" />

        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold leading-5 tracking-[-0.0224px] text-dash-text-strong">Two-factor authentication</span>
          <span className="text-sm leading-5 text-dash-text-faded">
            {status?.enabled
              ? "Your account is protected with two-factor authentication."
              : "Add an extra layer of security by requiring a verification code when you sign in."}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status?.enabled ? (
              <CheckCircle className="size-5 text-[#34d399]" weight="fill" />
            ) : (
              <div
                aria-hidden
                className="size-5 bg-dash-text-faded [mask-image:url(/images/secure.svg)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-image:url(/images/secure.svg)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]"
              />
            )}
            <span className="text-sm text-dash-text-body">
              {loadingStatus ? "Checking 2FA status..." : status?.enabled ? "2FA is enabled" : "2FA is not enabled"}
            </span>
          </div>
          {status?.enabled ? (
            <div className="flex items-center gap-2">
              <GlossyButton variant="white" onClick={() => setShowRegenerateModal(true)}>
                Regenerate recovery codes
              </GlossyButton>
              <GlossyButton variant="red" onClick={() => setShowDisableModal(true)}>
                Disable
              </GlossyButton>
            </div>
          ) : (
            <GlossyButton
              variant="blue"
              onClick={() => {
                void handleOpenSetup();
              }}
              disabled={setupLoading || loadingStatus}
            >
              {setupLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  Starting...
                </span>
              ) : (
                "Enable"
              )}
            </GlossyButton>
          )}
        </div>

        {status?.enabled && (
          <>
            <hr className="border-dash-border-soft" />
            <div className="space-y-2">
              <p className="text-sm text-dash-text-body">Recovery codes remaining: {normalizedRemaining}</p>
              {lowCodesWarning && (
                <div className="flex items-start gap-2 rounded-[6px] border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-2.5 text-xs text-[#f59e0b]">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>
                    You have {normalizedRemaining} recovery code
                    {normalizedRemaining === 1 ? "" : "s"} left. Regenerate a new set to avoid being locked out.
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {passkeyPanelVisible && (
          <>
            <hr className="border-dash-border-soft" />
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold leading-5 tracking-[-0.0224px] text-dash-text-strong">Passkeys</span>
                <span className="text-sm leading-5 text-dash-text-faded">
                  Sign in faster and more securely with Touch ID, Windows Hello, or a security key.
                </span>
              </div>

              {loadingPasskeys ? (
                <div className="flex items-center gap-2 text-sm text-dash-text-faded">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading passkeys...
                </div>
              ) : passkeys.length === 0 ? null : (
                <ul className="flex flex-col divide-y divide-dash-border-soft">
                  {passkeys.map((pk) => {
                    const isRenaming = renamingId === pk.id;
                    const isLast = passkeys.length === 1;
                    const deleteBlocked = isLast && lastPasskeyDeleteBlocked;
                    return (
                      <li key={pk.id} className="py-3">
                        <AnimatePresence mode="wait" initial={false}>
                          {isRenaming ? (
                            <motion.div
                              key="rename-mode"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                              className="flex items-center gap-2"
                            >
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void handleRenamePasskey(pk.id);
                                  if (e.key === "Escape") {
                                    setRenamingId(null);
                                    setRenameValue("");
                                  }
                                }}
                                className={cn(inputClass, "max-w-[260px]")}
                              />
                              <button
                                type="button"
                                onClick={() => void handleRenamePasskey(pk.id)}
                                className="text-sm font-medium text-[#006fff] hover:text-[#0060e0]"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRenamingId(null);
                                  setRenameValue("");
                                }}
                                className="text-sm text-dash-text-faded hover:text-dash-text-body"
                              >
                                Cancel
                              </button>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="display-mode"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-sm text-dash-text-strong">
                                  {pk.deviceName || "Unnamed passkey"}
                                </span>
                                <span className="text-xs text-dash-text-faded">
                                  Added {formatPasskeyDate(pk.createdAt)}
                                  {pk.lastUsedAt ? ` · last used ${formatPasskeyDate(pk.lastUsedAt)}` : " · never used"}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenamingId(pk.id);
                                    setRenameValue(pk.deviceName || "");
                                  }}
                                  className="rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg px-2.5 py-1 text-xs font-medium text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  disabled={deleteBlocked || deletingId === pk.id}
                                  onClick={() => void handleDeletePasskey(pk.id)}
                                  title={deleteBlocked ? "Enable 2FA or keep at least one passkey to remove this one." : undefined}
                                  className="rounded-[4px] border-[0.5px] border-dash-border px-2.5 py-1 text-xs font-medium text-[#ef2f1f] transition-colors hover:bg-[#ef2f1f]/5 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {deletingId === pk.id ? "Removing..." : "Delete"}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </li>
                    );
                  })}
                </ul>
              )}

              {passkeys.length > 0 ? null : enrollNameOpen ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={enrollName}
                    onChange={(e) => setEnrollName(e.target.value)}
                    placeholder="e.g. MacBook"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleEnrollPasskey();
                      if (e.key === "Escape") {
                        setEnrollNameOpen(false);
                        setEnrollName("");
                      }
                    }}
                    className={cn(inputClass, "max-w-[260px]")}
                  />
                  <GlossyButton variant="blue" onClick={() => void handleEnrollPasskey()} disabled={!enrollName.trim() || enrollingPasskey}>
                    {enrollingPasskey ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-3.5 animate-spin" />
                        Adding...
                      </span>
                    ) : (
                      "Add passkey"
                    )}
                  </GlossyButton>
                  <button
                    type="button"
                    onClick={() => {
                      setEnrollNameOpen(false);
                      setEnrollName("");
                    }}
                    className="text-sm text-dash-text-faded hover:text-dash-text-body"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <GlossyButton
                    variant="blue"
                    onClick={() => {
                      setEnrollNameOpen(true);
                      const device = guessDeviceName();
                      const owner = (firstName || "").trim();
                      setEnrollName(owner ? `${owner}'s ${device}` : device);
                    }}
                  >
                    Add a passkey
                  </GlossyButton>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Modal
        open={showSetupModal}
        onOpenChange={(open) => {
          if (!open) {
            resetSetupModal();
          }
        }}
        width={460}
      >
        <AnimatePresence mode="wait" initial={false}>
          {setupStep === "scan" && setupData && (
            <motion.div
              key="setup-scan"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={stepTransition}
            >
              <ModalHeader
                title="Set up two-factor authentication"
                description="Scan this QR code with Google Authenticator, Authy, or any TOTP app."
              />
              <div className="flex flex-col items-center gap-6 px-6 py-6">
                <img
                  src={setupData.qrCode}
                  alt="Two-factor authentication QR code"
                  className="size-[200px] rounded-[4px] border border-dash-border bg-white p-2"
                />

                <div className="flex w-full flex-col gap-2">
                  <span className="text-xs text-dash-text-faded">Manual setup key</span>
                  <div className="flex items-center gap-2 rounded-[6px] border border-dash-border bg-dash-bg-elevated px-3 py-2.5">
                    <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm tracking-wider text-dash-text-strong">
                      {setupData.secret}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="shrink-0 text-dash-text-faded transition-colors hover:text-dash-text-strong"
                      title="Copy secret"
                    >
                      {keyCopied ? <CheckCircle className="size-4 text-[#34d399]" weight="fill" /> : <Copy className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <ModalFooter>
                <ModalCancelButton />
                <ModalContinueButton onClick={() => setSetupStep("verify")}>Continue</ModalContinueButton>
              </ModalFooter>
            </motion.div>
          )}

          {setupStep === "verify" && (
            <motion.div
              key="setup-verify"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={stepTransition}
            >
              <ModalHeader title="Verify setup" description="Enter the 6-digit code from your authenticator app" />
              <div className="flex flex-col items-center gap-4 px-6 py-6">
                <div className="w-full max-w-[320px]">
                  <OtpInput
                    value={setupCode}
                    onChange={(value) => {
                      setSetupCode(value);
                      setSetupError(null);
                    }}
                    autoFocus
                    error={Boolean(setupError)}
                  />
                </div>
                {setupError && <p className="text-xs text-[#ef2f1f]">{setupError}</p>}
              </div>
              <ModalFooter>
                <ModalCancelButton
                  onClick={() => {
                    setSetupStep("scan");
                    setSetupCode("");
                    setSetupError(null);
                  }}
                />
                <ModalContinueButton
                  onClick={() => {
                    void handleVerifySetup();
                  }}
                  disabled={!/^\d{6}$/.test(setupCode)}
                  loading={setupLoading}
                  loadingLabel="Verifying..."
                >
                  Verify
                </ModalContinueButton>
              </ModalFooter>
            </motion.div>
          )}

          {setupStep === "codes" && (
            <motion.div
              key="setup-codes"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={stepTransition}
            >
              <ModalHeader title="Save your recovery codes" description="Recovery codes are shown once. Store them in a safe place." />
              <div className="flex flex-col gap-4 px-6 py-6">
                <RecoveryCodesGrid codes={setupData?.recoveryCodes ?? []} />
                <div className="flex gap-2">
                  <GlossyButton
                    variant="white"
                    className="flex-1"
                    onClick={() => {
                      handleCopyCodes(setupData?.recoveryCodes ?? []);
                    }}
                  >
                    <Copy className="mr-1.5 size-3.5" />
                    Copy all
                  </GlossyButton>
                  <GlossyButton
                    variant="white"
                    className="flex-1"
                    onClick={() => {
                      downloadRecoveryCodes(setupData?.recoveryCodes ?? []);
                    }}
                  >
                    <Download className="mr-1.5 size-3.5" />
                    Download
                  </GlossyButton>
                </div>
                <label className="flex items-center gap-2 text-sm text-dash-text-faded">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 rounded border-dash-border"
                    checked={setupAcknowledged}
                    onChange={(event) => setSetupAcknowledged(event.target.checked)}
                  />
                  I have saved my recovery codes.
                </label>
              </div>
              <ModalFooter>
                <div />
                <ModalContinueButton onClick={resetSetupModal} disabled={!setupAcknowledged}>
                  Done
                </ModalContinueButton>
              </ModalFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>

      <Modal
        open={showDisableModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowDisableModal(false);
            setDisableCode("");
            setDisableError(null);
            setDisableLoading(false);
          }
        }}
        width={440}
      >
        <ModalHeader title="Disable two-factor authentication" description="Enter your authenticator code to confirm" />
        <div className="flex flex-col items-center gap-4 px-6 py-6">
          <div className="w-full max-w-[320px]">
            <OtpInput
              value={disableCode}
              onChange={(value) => {
                setDisableCode(value);
                setDisableError(null);
              }}
              autoFocus
              error={Boolean(disableError)}
            />
          </div>
          {disableError && <p className="text-xs text-[#ef2f1f]">{disableError}</p>}
        </div>
        <ModalFooter>
          <ModalCancelButton />
          <ModalContinueButton
            onClick={() => {
              void handleDisable();
            }}
            disabled={!/^\d{6}$/.test(disableCode)}
            loading={disableLoading}
            loadingLabel="Disabling..."
          >
            Disable
          </ModalContinueButton>
        </ModalFooter>
      </Modal>

      <Modal
        open={Boolean(stepUpPasskeyId)}
        onOpenChange={(open) => {
          if (!open) {
            setStepUpPasskeyId(null);
            setStepUpCode("");
            setStepUpError(null);
            setStepUpLoading(false);
          }
        }}
        width={440}
      >
        <ModalHeader
          title="Remove passkey"
          description={(() => {
            const name = passkeys.find((p) => p.id === stepUpPasskeyId)?.deviceName;
            return name ? `Enter your authenticator code to remove "${name}"` : "Enter your authenticator code to remove this passkey";
          })()}
        />
        <div className="flex flex-col items-center gap-4 px-6 py-6">
          <div className="w-full max-w-[320px]">
            <OtpInput
              value={stepUpCode}
              onChange={(value) => {
                setStepUpCode(value);
                setStepUpError(null);
              }}
              autoFocus
              error={Boolean(stepUpError)}
            />
          </div>
          {stepUpError && <p className="text-xs text-[#ef2f1f]">{stepUpError}</p>}
        </div>
        <ModalFooter>
          <ModalCancelButton />
          <ModalContinueButton
            onClick={() => {
              void handleStepUpDeletePasskey();
            }}
            disabled={!/^\d{6}$/.test(stepUpCode)}
            loading={stepUpLoading}
            loadingLabel="Removing..."
          >
            Remove
          </ModalContinueButton>
        </ModalFooter>
      </Modal>

      <Modal
        open={showRegenerateModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowRegenerateModal(false);
            setRegenerateCode("");
            setRegenerateError(null);
            setRegenerateLoading(false);
          }
        }}
        width={440}
      >
        <ModalHeader title="Regenerate recovery codes" description="Enter your authenticator code to generate a new set" />
        <div className="flex flex-col items-center gap-4 px-6 py-6">
          <div className="w-full max-w-[320px]">
            <OtpInput
              value={regenerateCode}
              onChange={(value) => {
                setRegenerateCode(value);
                setRegenerateError(null);
              }}
              autoFocus
              error={Boolean(regenerateError)}
            />
          </div>
          {regenerateError && <p className="text-xs text-[#ef2f1f]">{regenerateError}</p>}
        </div>
        <ModalFooter>
          <ModalCancelButton />
          <ModalContinueButton
            onClick={() => {
              void handleRegenerateCodes();
            }}
            disabled={!/^\d{6}$/.test(regenerateCode)}
            loading={regenerateLoading}
            loadingLabel="Generating..."
          >
            Regenerate
          </ModalContinueButton>
        </ModalFooter>
      </Modal>

      <Modal
        open={showCodesModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowCodesModal(false);
            setCodesModalCodes([]);
          }
        }}
        width={460}
      >
        <ModalHeader title={codesModalTitle} description={codesModalDescription} />
        <div className="flex flex-col gap-4 px-6 py-6">
          <RecoveryCodesGrid codes={codesModalCodes} />
          <div className="flex gap-2">
            <GlossyButton variant="white" className="flex-1" onClick={() => handleCopyCodes(codesModalCodes)}>
              <Copy className="mr-1.5 size-3.5" />
              Copy all
            </GlossyButton>
            <GlossyButton variant="white" className="flex-1" onClick={() => downloadRecoveryCodes(codesModalCodes)}>
              <Download className="mr-1.5 size-3.5" />
              Download
            </GlossyButton>
          </div>
        </div>
        <ModalFooter>
          <div />
          <ModalContinueButton onClick={() => setShowCodesModal(false)}>Done</ModalContinueButton>
        </ModalFooter>
      </Modal>
    </>
  );
}
