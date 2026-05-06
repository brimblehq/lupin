import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Modal, ModalCancelButton, ModalFooter, ModalHeader } from "./modal";
import { GlossyButton } from "./glossy-button";
import { OtpInput } from "@/components/auth/auth-split-layout";
import { stepUpTwoFactorServerFn } from "@/server/auth/actions";
import type { StepUpRequirement } from "@/lib/auth/two-factor-step-up";

const STEP_UP_TOKEN_TTL_SECONDS = 120;

interface StepUpTwoFactorModalProps {
  open: boolean;
  requirement: StepUpRequirement | null;
  onResolve: (token: string) => void;
  onCancel: () => void;
}

type Mode = "totp" | "recovery";

export function StepUpTwoFactorModal({ open, requirement, onResolve, onCancel }: StepUpTwoFactorModalProps) {
  const exchange = useServerFn(stepUpTwoFactorServerFn as any) as (args: {
    data: { code: string; action: string; resourceId: string };
  }) => Promise<{ token: string; expiresIn: number }>;

  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(STEP_UP_TOKEN_TTL_SECONDS);
  const recoveryRef = useRef<HTMLInputElement | null>(null);

  // Reset whenever the modal is opened for a fresh challenge.
  useEffect(() => {
    if (!open) return;
    setMode("totp");
    setCode("");
    setRecoveryCode("");
    setError(null);
    setSubmitting(false);
    setCountdownSeconds(STEP_UP_TOKEN_TTL_SECONDS);
  }, [open, requirement]);

  useEffect(() => {
    if (!open || countdownSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setCountdownSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [open, countdownSeconds]);

  // Auto-submit once the user types all 6 digits — matches the existing
  // 2FA login flow's UX.
  useEffect(() => {
    if (mode !== "totp" || code.length !== 6 || countdownSeconds <= 0) return;
    void submit(code);
  }, [code, countdownSeconds, mode]);

  useEffect(() => {
    if (mode === "recovery") {
      recoveryRef.current?.focus();
    }
  }, [mode]);

  async function submit(rawCode: string) {
    if (!requirement || submitting || countdownSeconds <= 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await exchange({
        data: {
          code: rawCode,
          action: requirement.action,
          resourceId: requirement.resourceId,
        },
      });
      onResolve(result.token);
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "Verification failed";
      setError(message);
      setCode("");
      setSubmitting(false);
    }
  }

  function handleManualSubmit() {
    if (mode === "totp") {
      void submit(code);
    } else {
      void submit(recoveryCode.trim());
    }
  }

  const submitDisabled =
    submitting || countdownSeconds <= 0 || (mode === "totp" ? code.length !== 6 : recoveryCode.trim().length !== 8);

  return (
    <Modal open={open} onOpenChange={(next) => !next && onCancel()} width={460}>
      <ModalHeader
        title="Confirm with 2FA"
        description={`This action requires verification. Enter the code from your authenticator app.${
          requirement ? ` (Token expires in ${countdownSeconds}s)` : ""
        }`}
      />

      <div className="flex flex-col gap-4 px-6 pb-5 pt-4">
        {mode === "totp" ? (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-dash-text-strong">Authenticator code</label>
            <OtpInput value={code} onChange={setCode} autoFocus error={Boolean(error)} />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-dash-text-strong">Recovery code</label>
            <input
              ref={recoveryRef}
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleManualSubmit();
                }
              }}
              placeholder="8-character code"
              className={`input-base ${error ? "input-error" : "input-focus"} px-3 py-2.5 text-sm font-mono tracking-[0.2em] text-dash-text-strong placeholder:text-dash-text-extra-faded`}
            />
            <p className="text-xs text-dash-text-faded">
              Each recovery code can only be used once.
            </p>
          </div>
        )}

        {error ? <p className="text-xs text-[#ef4444]">{error}</p> : null}

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "totp" ? "recovery" : "totp"));
            setCode("");
            setRecoveryCode("");
            setError(null);
          }}
          className="self-start text-xs text-[#4879f8] transition-colors hover:underline"
        >
          {mode === "totp" ? "Use a recovery code instead" : "Use authenticator code instead"}
        </button>
      </div>

      <ModalFooter>
        <div className="flex w-full items-center justify-between gap-3">
          <ModalCancelButton onClick={onCancel} />
          <GlossyButton
            variant="blue"
            disabled={submitDisabled}
            loading={submitting}
            loadingLabel="Verifying..."
            onClick={handleManualSubmit}
            className="h-[34px] rounded-[4px] px-3.5 text-sm"
          >
            Verify
          </GlossyButton>
        </div>
      </ModalFooter>
    </Modal>
  );
}
