import { useState } from "react";
import { cn } from "@brimble/ui";
import { Copy, Download } from "lucide-react";
import { CheckCircle, CopySimple } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { GlossyButton } from "../shared/glossy-button";
import {
  Modal,
  ModalHeader,
  ModalFooter,
  ModalCancelButton,
  ModalContinueButton,
} from "../shared/modal";
import { OtpInput } from "../auth/auth-split-layout";

const MOCK_SECRET_KEY = "JBSWY3DPEHPK3PXP";
const MOCK_RECOVERY_CODES = [
  "a1b2c-3d4e5",
  "f6g7h-8i9j0",
  "k1l2m-3n4o5",
  "p6q7r-8s9t0",
  "u1v2w-3x4y5",
  "z6a7b-8c9d0",
  "e1f2g-3h4i5",
  "j6k7l-8m9n0",
];

const stepTransition = {
  duration: 0.25,
  ease: [0.16, 1, 0.3, 1] as const,
};

const inputClass =
  "w-full input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]";

export function SecurityForm({
  email: initialEmail,
  onChangeEmail,
}: {
  email: string;
  onChangeEmail?: (email: string) => void | Promise<void>;
}) {
  const haptics = useHaptics();
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  // Email
  const [email, setEmail] = useState(initialEmail);
  const [emailCopied, setEmailCopied] = useState(false);

  // Setup modal
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupStep, setSetupStep] = useState<1 | 2 | 3>(1);
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);

  // Disable modal
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disableOtp, setDisableOtp] = useState("");
  const [disableOtpError, setDisableOtpError] = useState<string | null>(null);

  // Recovery codes modal
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);

  // Secret key copy
  const [keyCopied, setKeyCopied] = useState(false);

  function resetSetup() {
    setShowSetupModal(false);
    setSetupStep(1);
    setOtpValue("");
    setOtpError(null);
  }

  function handleVerifyOtp() {
    if (otpValue.length !== 6) return;
    setOtpError(null);
    setSetupStep(3);
  }

  function handleFinishSetup() {
    setIs2FAEnabled(true);
    resetSetup();
    toast.success("Two-factor authentication enabled");
  }

  function handleDisable() {
    if (disableOtp.length !== 6) return;
    setIs2FAEnabled(false);
    setShowDisableModal(false);
    setDisableOtp("");
    setDisableOtpError(null);
    toast.success("Two-factor authentication disabled");
  }

  function handleCopySecret() {
    void navigator.clipboard.writeText(MOCK_SECRET_KEY);
    setKeyCopied(true);
    haptics.selection();
    setTimeout(() => setKeyCopied(false), 2000);
  }

  function handleCopyRecoveryCodes() {
    void navigator.clipboard.writeText(MOCK_RECOVERY_CODES.join("\n"));
    haptics.selection();
    toast.success("Recovery codes copied");
  }

  function handleDownloadRecoveryCodes() {
    const content = MOCK_RECOVERY_CODES.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brimble-2fa-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    haptics.selection();
  }

  return (
    <>
      <div className="flex max-w-[488px] flex-col gap-8">
        {/* Email */}
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
              Email address
            </span>
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
                className={cn(inputClass, "pr-9 text-dash-text-faded")}
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
                {emailCopied ? (
                  <CheckCircle className="size-4 text-[#34d399]" weight="fill" />
                ) : (
                  <CopySimple className="size-4" />
                )}
              </button>
            </div>
            <button
              onClick={() => onChangeEmail?.(email)}
              className="shrink-0 text-sm font-medium tracking-[-0.0224px] text-dash-text-strong transition-colors hover:text-dash-text-body"
            >
              Change
            </button>
          </div>
        </div>

        <hr className="border-dash-border-soft" />

        {/* 2FA heading */}
        <div className="flex flex-col gap-1">
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
            Two-factor authentication
          </span>
          <span className="text-sm leading-5 text-dash-text-faded">
            {is2FAEnabled
              ? "Your account is protected with two-factor authentication."
              : "Add an extra layer of security to your account by requiring a verification code in addition to your password."}
          </span>
        </div>

        {/* Status + action */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {is2FAEnabled ? (
              <CheckCircle
                className="size-4 text-[#34d399]"
                weight="fill"
              />
            ) : (
              <img
                src="/images/secure.svg"
                alt=""
                className="size-4"
              />
            )}
            <span className="text-sm text-dash-text-body">
              {is2FAEnabled ? "2FA is enabled" : "2FA is not enabled"}
            </span>
          </div>
          {is2FAEnabled ? (
            <GlossyButton
              variant="red"
              onClick={() => setShowDisableModal(true)}
            >
              Disable
            </GlossyButton>
          ) : (
            <GlossyButton
              variant="blue"
              onClick={() => {
                setShowSetupModal(true);
                setSetupStep(1);
              }}
            >
              Enable
            </GlossyButton>
          )}
        </div>

        {/* Recovery codes (only when enabled) */}
        {is2FAEnabled && (
          <>
            <hr className="border-dash-border-soft" />
            <div className="flex flex-col gap-1">
              <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
                Recovery codes
              </span>
              <span className="text-sm leading-5 text-dash-text-faded">
                Use these codes to access your account if you lose your
                authenticator device.
              </span>
            </div>
            <GlossyButton
              variant="white"
              onClick={() => setShowRecoveryCodes(true)}
            >
              View recovery codes
            </GlossyButton>
          </>
        )}
      </div>

      {/* ── Setup modal ── */}
      <Modal
        open={showSetupModal}
        onOpenChange={(open) => {
          if (!open) resetSetup();
        }}
        width={440}
      >
        <AnimatePresence mode="wait" initial={false}>
          {setupStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={stepTransition}
            >
              <ModalHeader
                title="Set up two-factor authentication"
                description="Scan the QR code with your authenticator app"
              />
              <div className="flex flex-col items-center gap-6 px-6 py-6">
                {/* QR code placeholder */}
                <div className="flex size-[200px] items-center justify-center rounded-lg border-2 border-dashed border-dash-border bg-dash-bg-elevated">
                  <div className="flex flex-col items-center gap-2">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 48 48"
                      fill="none"
                      className="text-dash-text-extra-faded"
                    >
                      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                      <rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor" />
                      <rect x="28" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                      <rect x="32" y="8" width="8" height="8" rx="1" fill="currentColor" />
                      <rect x="4" y="28" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                      <rect x="8" y="32" width="8" height="8" rx="1" fill="currentColor" />
                      <rect x="28" y="28" width="4" height="4" rx="0.5" fill="currentColor" />
                      <rect x="36" y="28" width="4" height="4" rx="0.5" fill="currentColor" />
                      <rect x="28" y="36" width="4" height="4" rx="0.5" fill="currentColor" />
                      <rect x="36" y="36" width="4" height="4" rx="0.5" fill="currentColor" />
                      <rect x="40" y="40" width="4" height="4" rx="0.5" fill="currentColor" />
                    </svg>
                    <span className="text-xs text-dash-text-extra-faded">
                      QR Code
                    </span>
                  </div>
                </div>

                {/* Manual key */}
                <div className="flex w-full flex-col gap-2">
                  <span className="text-xs text-dash-text-faded">
                    Or enter this key manually:
                  </span>
                  <div className="flex items-center gap-2 rounded-[6px] border border-dash-border bg-dash-bg-elevated px-3 py-2.5">
                    <code className="flex-1 font-mono text-sm tracking-wider text-dash-text-strong">
                      {MOCK_SECRET_KEY}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="shrink-0 text-dash-text-faded transition-colors hover:text-dash-text-strong"
                    >
                      {keyCopied ? (
                        <CheckCircle
                          className="size-4 text-[#34d399]"
                          weight="fill"
                        />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <ModalFooter>
                <ModalCancelButton />
                <ModalContinueButton onClick={() => setSetupStep(2)}>
                  Continue
                </ModalContinueButton>
              </ModalFooter>
            </motion.div>
          )}

          {setupStep === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={stepTransition}
            >
              <ModalHeader
                title="Verify setup"
                description="Enter the 6-digit code from your authenticator app"
              />
              <div className="flex flex-col items-center gap-4 px-6 py-6">
                <div className="w-full max-w-[320px]">
                  <OtpInput
                    value={otpValue}
                    onChange={(val) => {
                      setOtpValue(val);
                      setOtpError(null);
                    }}
                    autoFocus
                  />
                </div>
                {otpError && (
                  <p className="text-xs text-[#ef2f1f]">{otpError}</p>
                )}
              </div>
              <ModalFooter>
                <ModalCancelButton
                  onClick={() => {
                    setSetupStep(1);
                    setOtpValue("");
                    setOtpError(null);
                  }}
                />
                <ModalContinueButton
                  onClick={handleVerifyOtp}
                  disabled={otpValue.length !== 6}
                >
                  Verify
                </ModalContinueButton>
              </ModalFooter>
            </motion.div>
          )}

          {setupStep === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={stepTransition}
            >
              <ModalHeader
                title="Save your recovery codes"
                description="Store these codes in a safe place. Each code can only be used once."
              />
              <div className="flex flex-col gap-4 px-6 py-6">
                <div className="grid grid-cols-2 gap-2 rounded-[6px] border border-dash-border bg-dash-bg-elevated p-4">
                  {MOCK_RECOVERY_CODES.map((code) => (
                    <code
                      key={code}
                      className="font-mono text-sm text-dash-text-strong"
                    >
                      {code}
                    </code>
                  ))}
                </div>
                <div className="flex gap-2">
                  <GlossyButton
                    variant="white"
                    className="flex-1"
                    onClick={handleCopyRecoveryCodes}
                  >
                    <Copy className="mr-1.5 size-3.5" />
                    Copy all
                  </GlossyButton>
                  <GlossyButton
                    variant="white"
                    className="flex-1"
                    onClick={handleDownloadRecoveryCodes}
                  >
                    <Download className="mr-1.5 size-3.5" />
                    Download
                  </GlossyButton>
                </div>
              </div>
              <ModalFooter>
                <div />
                <ModalContinueButton onClick={handleFinishSetup}>
                  Done
                </ModalContinueButton>
              </ModalFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>

      {/* ── Disable modal ── */}
      <Modal
        open={showDisableModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowDisableModal(false);
            setDisableOtp("");
            setDisableOtpError(null);
          }
        }}
        width={440}
      >
        <ModalHeader
          title="Disable two-factor authentication"
          description="Enter your verification code to confirm"
        />
        <div className="flex flex-col items-center gap-4 px-6 py-6">
          <div className="w-full max-w-[320px]">
            <OtpInput
              value={disableOtp}
              onChange={(val) => {
                setDisableOtp(val);
                setDisableOtpError(null);
              }}
              autoFocus
            />
          </div>
          {disableOtpError && (
            <p className="text-xs text-[#ef2f1f]">{disableOtpError}</p>
          )}
        </div>
        <ModalFooter>
          <ModalCancelButton />
          <ModalContinueButton
            onClick={handleDisable}
            disabled={disableOtp.length !== 6}
          >
            Disable
          </ModalContinueButton>
        </ModalFooter>
      </Modal>

      {/* ── View recovery codes modal ── */}
      <Modal
        open={showRecoveryCodes}
        onOpenChange={setShowRecoveryCodes}
        width={440}
      >
        <ModalHeader
          title="Recovery codes"
          description="Store these codes in a safe place. Each code can only be used once."
        />
        <div className="flex flex-col gap-4 px-6 py-6">
          <div className="grid grid-cols-2 gap-2 rounded-[6px] border border-dash-border bg-dash-bg-elevated p-4">
            {MOCK_RECOVERY_CODES.map((code) => (
              <code
                key={code}
                className="font-mono text-sm text-dash-text-strong"
              >
                {code}
              </code>
            ))}
          </div>
          <div className="flex gap-2">
            <GlossyButton
              variant="white"
              className="flex-1"
              onClick={handleCopyRecoveryCodes}
            >
              <Copy className="mr-1.5 size-3.5" />
              Copy all
            </GlossyButton>
            <GlossyButton
              variant="white"
              className="flex-1"
              onClick={handleDownloadRecoveryCodes}
            >
              <Download className="mr-1.5 size-3.5" />
              Download
            </GlossyButton>
          </div>
        </div>
        <ModalFooter>
          <div />
          <ModalContinueButton onClick={() => setShowRecoveryCodes(false)}>
            Done
          </ModalContinueButton>
        </ModalFooter>
      </Modal>
    </>
  );
}
