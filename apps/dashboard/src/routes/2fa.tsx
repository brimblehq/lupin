import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AuthSplitLayout, OtpInput } from "@/components/auth/auth-split-layout";
import { verifyTwoFactorChallengeServerFn } from "@/server/auth/actions";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { invalidateSessionCache } from "@/lib/auth-guards";
import { getClientGeo } from "@/lib/client-geo";
import { parseTwoFactorChallengeHash } from "@/lib/auth/two-factor";

export const Route = createFileRoute("/2fa")({
  component: TwoFactorChallengePage,
});

function getNextUrl(): string {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next) return "/";

  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return next.startsWith("/") ? next : "/";
  }
}

function getLoginRedirectUrl(): string {
  const next = getNextUrl();
  if (!next || next === "/") {
    return "/login";
  }
  return `/login?next=${encodeURIComponent(next)}`;
}

function formatRemaining(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function TwoFactorChallengePage() {
  const verifyTwoFactorChallenge = useServerFn(verifyTwoFactorChallengeServerFn as any) as (args: {
    data: { challengeToken: string; code: string; geo?: unknown };
  }) => Promise<{ ok: true; user: { firstName?: string } }>;
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const didExpireRef = useRef(false);
  const didParseHashRef = useRef(false);
  const autoSubmittedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (didParseHashRef.current) return;
    didParseHashRef.current = true;

    const parsed = parseTwoFactorChallengeHash(window.location.hash);
    if (!parsed) {
      setErrorMessage("Missing or invalid challenge token. Please log in again.");
      return;
    }

    setChallengeToken(parsed.challengeToken);
    setDeadlineAt(Date.now() + parsed.expiresIn * 1000);
    setNow(Date.now());
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    if (!deadlineAt) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [deadlineAt]);

  const remainingSeconds = useMemo(() => {
    if (!deadlineAt) {
      return 0;
    }
    return Math.max(0, Math.ceil((deadlineAt - now) / 1000));
  }, [deadlineAt, now]);

  useEffect(() => {
    if (!deadlineAt || remainingSeconds > 0 || didExpireRef.current) {
      return;
    }

    didExpireRef.current = true;
    toast.error("Two-factor challenge expired. Please log in again.");
    window.location.replace(getLoginRedirectUrl());
  }, [deadlineAt, remainingSeconds]);

  const normalizedRecoveryCode = recoveryCode.replace(/\s+/g, "").toUpperCase();
  const canSubmit = mode === "totp" ? /^\d{6}$/.test(totpCode) : /^[A-Z0-9]{8}$/.test(normalizedRecoveryCode);

  async function handleVerify() {
    if (!challengeToken || !canSubmit || loading) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await verifyTwoFactorChallenge({
        data: {
          challengeToken,
          code: mode === "totp" ? totpCode : normalizedRecoveryCode,
          geo: await getClientGeo(),
        },
      });

      toast.success(`Welcome back${result.user.firstName ? `, ${result.user.firstName}` : ""}`);
      invalidateSessionCache();
      window.location.replace(getNextUrl());
      return;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : "Verification failed";
      setErrorMessage(message);

      if (error?.status === 401) {
        toast.error(message);
        window.location.replace(getLoginRedirectUrl());
        return;
      }
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mode !== "totp" || !/^\d{6}$/.test(totpCode) || autoSubmittedCodeRef.current === totpCode) {
      return;
    }
    if (!challengeToken || loading) {
      return;
    }

    autoSubmittedCodeRef.current = totpCode;
    void handleVerify();
  }, [mode, totpCode, challengeToken, loading]);

  return (
    <AuthSplitLayout
      mode="login"
      title={
        <>
          Two-factor authentication.
          <br />
          Verify to continue.
        </>
      }
      description="Enter the code from your authenticator app or use one of your recovery codes."
    >
      <div className="space-y-5">
        <div className="rounded-[10px] bg-dash-bg-elevated px-3.5 py-3 text-center text-xs text-dash-text-faded dark:bg-[#202225]">
          {challengeToken ? (
            <>
              This challenge expires in <span className="font-semibold text-dash-text-strong">{formatRemaining(remainingSeconds)}</span>.
            </>
          ) : (
            "Waiting for challenge token..."
          )}
        </div>

        {mode === "totp" ? (
          <OtpInput
            value={totpCode}
            onChange={(value) => {
              setTotpCode(value);
              setErrorMessage(null);
            }}
            autoFocus
            error={Boolean(errorMessage)}
          />
        ) : (
          <label htmlFor="recovery-code" className="block">
            <div className="mb-1.5 text-xs font-medium text-dash-text-strong">Recovery code</div>
            <input
              id="recovery-code"
              type="text"
              autoFocus
              inputMode="text"
              value={recoveryCode}
              maxLength={8}
              onChange={(event) => {
                setRecoveryCode(event.target.value.replace(/\s+/g, "").toUpperCase());
                setErrorMessage(null);
              }}
              placeholder="A1B2C3D4"
              className="h-11 w-full rounded-[10px] border border-dash-border bg-dash-bg px-3.5 font-mono text-sm tracking-[0.18em] text-dash-text-strong uppercase outline-none transition-shadow placeholder:text-dash-text-extra-faded focus:border-[#006fff] focus:shadow-[0_0_0_3px_rgba(0,111,255,0.1)] dark:bg-dash-bg-elevated dark:focus:border-[#4879f8] dark:focus:shadow-[0_0_0_3px_rgba(72,121,248,0.15)]"
            />
          </label>
        )}

        {errorMessage && <p className="text-xs text-[#ef2f1f]">{errorMessage}</p>}

        <button
          type="button"
          disabled={!canSubmit || loading || !challengeToken}
          onClick={() => {
            void handleVerify();
          }}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#006fff] text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,80,200,0.3)] transition-all hover:bg-[#0060e0] disabled:opacity-40 disabled:hover:bg-[#006fff]"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Verify & sign in"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((current) => (current === "totp" ? "recovery" : "totp"));
            setErrorMessage(null);
          }}
          className="w-full text-center text-[13px] font-medium text-[#006fff] transition-colors hover:text-[#0060e0] dark:text-[#4879f8]"
        >
          {mode === "totp" ? "Use a recovery code instead" : "Use authenticator code instead"}
        </button>
      </div>
    </AuthSplitLayout>
  );
}
