import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { AuthSplitLayout, AuthField } from "@/components/auth/auth-split-layout";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { invalidateSessionCache } from "@/lib/auth-guards";
import {
  completePasskeyRecoveryServerFn,
  deletePasskeyRecoveryDeviceServerFn,
  getPasskeyRecoveryDevicesServerFn,
  getPasskeyRecoveryRegisterOptionsServerFn,
  startPasskeyRecoveryServerFn,
  verifyPasskeyRecoveryRegistrationServerFn,
} from "@/server/auth/actions";
import type {
  PasskeyRecoveryDevice,
  PasskeyRegisterOptionsResult,
  PasskeySummary,
} from "@/backend/auth/types";
import {
  isPasskeySupported,
  passkeyErrorMessage,
  runRegistration,
} from "@/lib/auth/passkey";

export const Route = createFileRoute("/passkey-recovery")({
  component: PasskeyRecoveryPage,
});

type Step = "credentials" | "devices" | "enroll" | "complete";

function PasskeyRecoveryPage() {
  const navigate = useNavigate();
  const startRecovery = useServerFn(startPasskeyRecoveryServerFn as any) as (args: {
    data: { email: string; recoveryCode: string };
  }) => Promise<{ recoveryToken: string; expiresIn: number }>;
  const getRecoveryDevices = useServerFn(getPasskeyRecoveryDevicesServerFn as any) as (args: {
    data: { recoveryToken: string };
  }) => Promise<PasskeyRecoveryDevice[]>;
  const deleteRecoveryDevice = useServerFn(deletePasskeyRecoveryDeviceServerFn as any) as (args: {
    data: { recoveryToken: string; id: string };
  }) => Promise<{ ok: true }>;
  const getRegisterOptions = useServerFn(
    getPasskeyRecoveryRegisterOptionsServerFn as any,
  ) as (args: {
    data: { recoveryToken: string; deviceName: string };
  }) => Promise<PasskeyRegisterOptionsResult>;
  const verifyRegistration = useServerFn(
    verifyPasskeyRecoveryRegistrationServerFn as any,
  ) as (args: {
    data: {
      recoveryToken: string;
      challengeToken: string;
      credential: unknown;
      deviceName: string;
    };
  }) => Promise<PasskeySummary>;
  const completeRecovery = useServerFn(completePasskeyRecoveryServerFn as any) as (args: {
    data: { recoveryToken: string };
  }) => Promise<{ ok: true; user: { firstName?: string } }>;

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [devices, setDevices] = useState<PasskeyRecoveryDevice[]>([]);
  const [deletingDeviceId, setDeletingDeviceId] = useState<string | null>(null);
  const [enrollName, setEnrollName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const browserSupported = isPasskeySupported();

  useEffect(() => {
    if (!deadlineAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [deadlineAt]);

  const remainingSeconds = useMemo(() => {
    if (!deadlineAt) return 0;
    return Math.max(0, Math.ceil((deadlineAt - now) / 1000));
  }, [deadlineAt, now]);

  useEffect(() => {
    if (!deadlineAt) return;
    if (remainingSeconds > 0) return;
    if (step === "credentials") return;
    toast.error("Recovery session expired. Please start over.");
    setStep("credentials");
    setRecoveryToken(null);
    setDeadlineAt(null);
  }, [remainingSeconds, deadlineAt, step]);

  function formatRemaining(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = String(seconds % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  }

  async function loadDevices(token: string) {
    try {
      const list = await getRecoveryDevices({ data: { recoveryToken: token } });
      setDevices(list);
    } catch (err) {
      setError(passkeyErrorMessage(err));
    }
  }

  async function handleStart() {
    if (!email.trim() || !recoveryCode.trim() || loading) return;
    setError(null);
    setLoading(true);
    try {
      const result = await startRecovery({
        data: { email: email.trim(), recoveryCode: recoveryCode.trim() },
      });
      setRecoveryToken(result.recoveryToken);
      setDeadlineAt(Date.now() + result.expiresIn * 1000);
      await loadDevices(result.recoveryToken);
      setStep("devices");
    } catch (err) {
      toast.error(passkeyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteDevice(id: string) {
    if (!recoveryToken || deletingDeviceId) return;
    setDeletingDeviceId(id);
    try {
      await deleteRecoveryDevice({ data: { recoveryToken, id } });
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      toast.error(passkeyErrorMessage(err));
    } finally {
      setDeletingDeviceId(null);
    }
  }

  async function handleEnroll() {
    const deviceName = enrollName.trim();
    if (!recoveryToken || !deviceName || loading) return;
    setError(null);
    setLoading(true);
    try {
      const { options, challengeToken } = await getRegisterOptions({
        data: { recoveryToken, deviceName },
      });
      const credential = await runRegistration(options);
      await verifyRegistration({
        data: { recoveryToken, challengeToken, credential, deviceName },
      });
      setStep("complete");
    } catch (err) {
      toast.error(passkeyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (!recoveryToken || loading) return;
    setLoading(true);
    try {
      const response = await completeRecovery({ data: { recoveryToken } });
      invalidateSessionCache();
      toast.success(
        `Welcome back${response.user.firstName ? `, ${response.user.firstName}` : ""}`,
      );
      void navigate({ to: "/" as any });
    } catch (err) {
      toast.error(passkeyErrorMessage(err));
      setLoading(false);
    }
  }

  if (!browserSupported) {
    return (
      <AuthSplitLayout
      mode="login"
      title="Passkey recovery"
      description="Use a TOTP recovery code to regain access to your account."
    >
        <p className="text-sm text-dash-text-body">
          Your browser doesn't support passkeys. Please use a modern browser to recover your account.
        </p>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout
      mode="login"
      title="Passkey recovery"
      description="Use a TOTP recovery code to regain access to your account."
    >
      {deadlineAt && step !== "credentials" && step !== "complete" && (
        <p className="mb-4 text-xs text-dash-text-faded">
          Recovery session expires in {formatRemaining(remainingSeconds)}
        </p>
      )}

      {step === "credentials" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleStart();
          }}
        >
          <p className="mb-2 text-sm text-dash-text-body">
            Enter your email and a recovery code from your TOTP setup to begin.
          </p>
          <AuthField
            id="recovery-email"
            type="email"
            label="Work email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            autoFocus
          />
          <AuthField
            id="recovery-code"
            type="text"
            label="Recovery code"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            placeholder="XXXXXXXX"
          />
          <button
            type="submit"
            disabled={!email.trim() || !recoveryCode.trim() || loading}
            className="flex h-11 w-full items-center justify-center rounded-[10px] bg-[#006fff] text-sm font-semibold text-white hover:bg-[#0060e0] disabled:opacity-40"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Continue"}
          </button>
        </form>
      )}

      {step === "devices" && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-dash-text-strong">Review your devices</p>
            <p className="text-sm text-dash-text-faded">
              Remove any passkeys that look unfamiliar before adding a new one.
            </p>
          </div>
          {devices.length === 0 ? (
            <p className="text-sm text-dash-text-faded">No passkeys on file.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-dash-border-soft rounded-[6px] border border-dash-border">
              {devices.map((d) => (
                <li key={d.id} className="flex items-center justify-between px-3.5 py-3">
                  <span className="truncate text-sm text-dash-text-strong">
                    {d.deviceName || "Unnamed passkey"}
                  </span>
                  <button
                    type="button"
                    disabled={deletingDeviceId === d.id}
                    onClick={() => void handleDeleteDevice(d.id)}
                    className="text-sm text-[#ef2f1f] hover:text-[#c92516] disabled:opacity-40"
                  >
                    {deletingDeviceId === d.id ? "Removing..." : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setStep("enroll")}
            className="flex h-11 w-full items-center justify-center rounded-[10px] bg-[#006fff] text-sm font-semibold text-white hover:bg-[#0060e0]"
          >
            Continue
          </button>
        </div>
      )}

      {step === "enroll" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleEnroll();
          }}
        >
          <div>
            <p className="text-sm font-medium text-dash-text-strong">Add a new passkey</p>
            <p className="text-sm text-dash-text-faded">
              Give your new passkey a name, then complete the prompt from your device.
            </p>
          </div>
          <AuthField
            id="recovery-device-name"
            type="text"
            label="Device name"
            value={enrollName}
            onChange={(e) => setEnrollName(e.target.value)}
            placeholder="e.g. MacBook"
            autoFocus
          />
          <button
            type="submit"
            disabled={!enrollName.trim() || loading}
            className="flex h-11 w-full items-center justify-center rounded-[10px] bg-[#006fff] text-sm font-semibold text-white hover:bg-[#0060e0] disabled:opacity-40"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Add passkey"}
          </button>
        </form>
      )}

      {step === "complete" && (
        <div className="space-y-4">
          <p className="text-sm text-dash-text-body">
            Your new passkey is set up. Sign in to finish recovery.
          </p>
          <button
            type="button"
            onClick={() => void handleComplete()}
            disabled={loading}
            className="flex h-11 w-full items-center justify-center rounded-[10px] bg-[#006fff] text-sm font-semibold text-white hover:bg-[#0060e0] disabled:opacity-40"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-[#ef2f1f]">{error}</p>}
    </AuthSplitLayout>
  );
}
