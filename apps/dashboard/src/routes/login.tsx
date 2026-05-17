import { useState, useRef, useEffect, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Github, ArrowLeft, Loader2, Fingerprint } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { invalidateSessionCache } from "../lib/auth-guards";
import { getClientGeo } from "@/lib/client-geo";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { AuthDivider, AuthField, AuthProviderButton, AuthSplitLayout, OtpInput } from "../components/auth/auth-split-layout";
import {
  getPasskeyAuthOptionsServerFn,
  requestLoginOtpServerFn,
  resendAuthCodeServerFn,
  verifyEmailCodeServerFn,
  verifyPasskeyAuthServerFn,
} from "../server/auth/actions";
import { usePasskeyFeature } from "@/hooks/use-passkey-feature";
import type { OauthProvider } from "../lib/auth/oauth-popup";
import type {
  GetPasskeyAuthOptionsCaller,
  RequestLoginOtpCaller,
  ResendAuthCodeCaller,
  VerifyEmailCodeCaller,
  VerifyPasskeyAuthCaller,
} from "./auth.types";
const loadOauthPopup = () => import("../lib/auth/oauth-popup");
const loadPasskey = () => import("@/lib/auth/passkey");
const loadTwoFactor = () => import("@/lib/auth/two-factor");

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const ease = [0.16, 1, 0.3, 1] as const;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.27-.97 2.34-2.03 3.06l3.28 2.54c1.92-1.77 3.02-4.37 3.02-7.46 0-.7-.06-1.37-.18-2.04H12Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.62-2.45l-3.28-2.54c-.91.61-2.07.97-3.34.97-2.57 0-4.74-1.73-5.52-4.05H3.1v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#4A90E2"
        d="M6.48 13.93A5.98 5.98 0 0 1 6.17 12c0-.67.12-1.32.31-1.93V7.45H3.1A10 10 0 0 0 2 12c0 1.61.38 3.14 1.1 4.55l3.38-2.62Z"
      />
      <path
        fill="#FBBC05"
        d="M12 6.02c1.47 0 2.8.5 3.84 1.48l2.88-2.88C16.96 2.98 14.7 2 12 2A10 10 0 0 0 3.1 7.45l3.38 2.62c.78-2.32 2.95-4.05 5.52-4.05Z"
      />
    </svg>
  );
}

function GitlabIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="currentColor">
      <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 0 0-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 0 0-.867 0L1.387 9.452.045 13.587a.924.924 0 0 0 .331 1.023L12 23.054l11.624-8.443a.92.92 0 0 0 .331-1.024" />
    </svg>
  );
}

function BitbucketIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="currentColor">
      <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
    </svg>
  );
}

/* ─── Step 1: Enter email ─── */

function EmailStep({
  email,
  emailError,
  onEmailChange,
  onEmailBlur,
  onSubmit,
  loading,
  onGithub,
  onGoogle,
  onGitlab,
  onBitbucket,
  oauthLoadingProvider,
  lastAuthMethod,
  passkeyEnabled,
  onPasskey,
  passkeyLoading,
}: {
  email: string;
  emailError?: string;
  onEmailChange: (v: string) => void;
  onEmailBlur: () => void;
  onSubmit: () => void;
  loading: boolean;
  onGithub: () => void;
  onGoogle: () => void;
  onGitlab: () => void;
  onBitbucket: () => void;
  oauthLoadingProvider: OauthProvider | null;
  lastAuthMethod?: AuthMethod | null;
  passkeyEnabled: boolean;
  onPasskey: () => void;
  passkeyLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <div className="space-y-2.5">
        <AuthProviderButton
          icon={<Github className="size-4" />}
          label={oauthLoadingProvider === "github" ? "Connecting GitHub..." : "Continue with GitHub"}
          onClick={onGithub}
          disabled={loading || oauthLoadingProvider !== null}
          lastUsed={lastAuthMethod === "github"}
        />
        <AuthProviderButton
          icon={<GoogleIcon />}
          label={oauthLoadingProvider === "google" ? "Connecting Google..." : "Continue with Google"}
          onClick={onGoogle}
          disabled={loading || oauthLoadingProvider !== null}
          lastUsed={lastAuthMethod === "google"}
        />
        <div className="flex gap-2.5">
          <AuthProviderButton
            icon={<GitlabIcon />}
            label={oauthLoadingProvider === "gitlab" ? "GitLab..." : "GitLab"}
            onClick={onGitlab}
            disabled={loading || oauthLoadingProvider !== null}
            lastUsed={lastAuthMethod === "gitlab"}
          />
          <AuthProviderButton
            icon={<BitbucketIcon />}
            label={oauthLoadingProvider === "bitbucket" ? "Bitbucket..." : "Bitbucket"}
            onClick={onBitbucket}
            disabled={loading || oauthLoadingProvider !== null}
            lastUsed={lastAuthMethod === "bitbucket"}
          />
        </div>
      </div>

      <AuthDivider />

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <AuthField
          id="login-email"
          type="email"
          label="Work email"
          placeholder="name@company.com"
          value={email}
          error={emailError}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={onEmailBlur}
          autoFocus
          inputMode="email"
          autoComplete="off"
        />

        <button
          type="submit"
          disabled={loading}
          className="relative flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#006fff] text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,80,200,0.3)] transition-all hover:bg-[#0060e0] disabled:opacity-40 disabled:hover:bg-[#006fff]"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Continue with email"}
          {lastAuthMethod === "email" && !loading && (
            <span className="absolute right-3 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-normal">Last used</span>
          )}
        </button>

        {passkeyEnabled && (
          <button
            type="button"
            onClick={onPasskey}
            disabled={passkeyLoading || loading || oauthLoadingProvider !== null}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg text-sm font-medium text-dash-text-strong transition-colors hover:bg-dash-bg-elevated disabled:opacity-40"
          >
            {passkeyLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Fingerprint className="size-4" />
                Sign in with passkey
              </>
            )}
          </button>
        )}

        {passkeyEnabled && (
          <p className="text-center text-[12px] text-dash-text-faded">
            Lost your passkey?{" "}
            <a href="/passkey-recovery" className="font-medium text-[#006fff] transition-colors hover:text-[#0060e0] dark:text-[#4879f8]">
              Use a recovery code
            </a>
          </p>
        )}
      </form>
    </motion.div>
  );
}

/* ─── Step 2: Verify OTP ─── */

function OtpStep({
  email,
  otp,
  onOtpChange,
  onVerify,
  onBack,
  onResend,
  loading,
}: {
  email: string;
  otp: string;
  onOtpChange: (v: string) => void;
  onVerify: () => void;
  onBack: () => void;
  onResend: () => void;
  loading: boolean;
}) {
  function handleOtpChange(value: string) {
    onOtpChange(value);
    if (value.length === 6) {
      onVerify();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-1.5 text-sm text-dash-text-faded transition-colors hover:text-dash-text-strong"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </button>

      <div className="mb-6">
        <p className="text-sm text-dash-text-body">
          We sent a 6-digit code to <span className="font-medium text-dash-text-strong">{email}</span>
        </p>
        <p className="mt-1 text-[13px] text-dash-text-faded">Check your inbox and enter the code below.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onVerify();
        }}
        className="space-y-5"
      >
        <OtpInput value={otp} onChange={handleOtpChange} autoFocus />

        <button
          type="submit"
          disabled={otp.length < 6 || loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#006fff] text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,80,200,0.3)] transition-all hover:bg-[#0060e0] disabled:opacity-40 disabled:hover:bg-[#006fff]"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Verify & sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-[13px] text-dash-text-faded">
        Didn&apos;t receive it?{" "}
        <button onClick={onResend} className="font-medium text-[#006fff] transition-colors hover:text-[#0060e0] dark:text-[#4879f8]">
          Resend code
        </button>
      </p>

      <p className="mt-3 text-center text-xs leading-relaxed text-dash-text-faded">
        Verification codes are only sent to emails linked to an existing Brimble account. Don&apos;t have one?{" "}
        <a href="/signup" className="font-medium text-[#006fff] transition-colors hover:text-[#0060e0] dark:text-[#4879f8]">
          Create an account
        </a>
      </p>
    </motion.div>
  );
}

/* ─── Page ─── */

function getNextUrl(): string {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next) return "/";
  // Only allow relative paths to prevent open-redirect
  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return next.startsWith("/") ? next : "/";
  }
}

const AUTH_METHOD_KEY = "brimble:last-auth-method";
type AuthMethod = "github" | "google" | "gitlab" | "bitbucket" | "email";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FRIENDLY_AUTH_SERVER_ERROR_MESSAGE = "We can't sign you in right now. Please try again in a moment.";
const SERVER_FAILURE_PATTERNS = ["internal server error", "http 500", "status code 500"] as const;
const CLOUDFLARE_HTML_PATTERNS = ["cloudflare", "<!doctype html", "<html"] as const;

function validateEmailInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Enter your email to continue.";
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return "Enter a valid email address.";
  }
  return null;
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const withStatus = error as { status?: unknown };
  if (typeof withStatus.status === "number") {
    return withStatus.status;
  }

  return undefined;
}

function includesAny(input: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => input.includes(pattern));
}

function getFriendlyAuthError(error: unknown, fallback: string): string {
  const status = getErrorStatus(error);
  if (typeof status === "number" && status >= 500) {
    return FRIENDLY_AUTH_SERVER_ERROR_MESSAGE;
  }

  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  const looksLikeServerFailure = includesAny(normalized, SERVER_FAILURE_PATTERNS);
  const looksLikeCloudflareHtml = includesAny(normalized, CLOUDFLARE_HTML_PATTERNS);

  if (looksLikeServerFailure || looksLikeCloudflareHtml) {
    return FRIENDLY_AUTH_SERVER_ERROR_MESSAGE;
  }

  return message || fallback;
}

function getLastAuthMethod(): AuthMethod | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(AUTH_METHOD_KEY) as AuthMethod | null;
  } catch {
    return null;
  }
}

function saveLastAuthMethod(method: AuthMethod) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(AUTH_METHOD_KEY, method);
  } catch {
    // ignore storage unavailability
  }
}

function LoginPage() {
  const haptics = useHaptics();
  const navigate = useNavigate();
  const requestLoginOtp = useServerFn(requestLoginOtpServerFn) as RequestLoginOtpCaller;
  const resendAuthCode = useServerFn(resendAuthCodeServerFn) as ResendAuthCodeCaller;
  const verifyEmailCode = useServerFn(verifyEmailCodeServerFn) as VerifyEmailCodeCaller;
  const getPasskeyAuthOptions = useServerFn(getPasskeyAuthOptionsServerFn) as GetPasskeyAuthOptionsCaller;
  const verifyPasskeyAuth = useServerFn(verifyPasskeyAuthServerFn) as VerifyPasskeyAuthCaller;
  const passkeyFeature = usePasskeyFeature();
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const autofillStartedRef = useRef(false);
  const autofillAbortRef = useRef<AbortController | null>(null);
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const otpRef = useRef(otp);
  otpRef.current = otp;
  const [loading, setLoading] = useState(false);
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<OauthProvider | null>(null);
  const [lastAuthMethod] = useState<AuthMethod | null>(() => getLastAuthMethod());
  const sessionExpiredToastShownRef = useRef(false);

  useEffect(() => {
    if (sessionExpiredToastShownRef.current) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason !== "session-expired") {
      return;
    }

    sessionExpiredToastShownRef.current = true;
    toast.error("Session Expired");
  }, []);

  async function handleOauth(provider: OauthProvider) {
    if (oauthLoadingProvider) {
      return;
    }
    haptics.selection();

    setOauthLoadingProvider(provider);

    try {
      const [{ startOauthPopup }, twoFactor] = await Promise.all([loadOauthPopup(), loadTwoFactor()]);
      const data = await startOauthPopup(provider);
      const challenge = twoFactor.extractTwoFactorChallenge(data);
      if (challenge) {
        const nav = twoFactor.buildTwoFactorChallengeNavigation(challenge, {
          next: getNextUrl(),
        });
        navigate({ to: "/2fa", search: nav.search, hash: nav.hash });
        return;
      }

      saveLastAuthMethod(provider);
      toast.success(`Welcome back${data.user?.firstName ? `, ${data.user.firstName}` : ""}`);
      invalidateSessionCache();
      window.location.replace(getNextUrl());
      return;
    } catch (error) {
      toast.error(getFriendlyAuthError(error, "OAuth sign in failed"));
      setOauthLoadingProvider(null);
    }
  }

  const runPasskeyVerify = useCallback(
    async (challengeToken: string, credential: unknown) => {
      const response = await verifyPasskeyAuth({
        data: {
          challengeToken,
          credential,
          geo: await getClientGeo(),
        },
      });
      saveLastAuthMethod("email");
      toast.success(`Welcome back${response.user.firstName ? `, ${response.user.firstName}` : ""}`);
      invalidateSessionCache();
      window.location.replace(getNextUrl());
    },
    [verifyPasskeyAuth],
  );

  async function handlePasskeySignIn() {
    if (passkeyLoading || loading) return;
    const validationError = validateEmailInput(email);
    if (validationError) {
      setEmailError(validationError);
      return;
    }

    setEmailError(null);
    const normalizedEmail = email.trim().toLowerCase();

    haptics.selection();
    setPasskeyLoading(true);
    const passkey = await loadPasskey();
    try {
      const { options, challengeToken } = await getPasskeyAuthOptions({
        data: { email: normalizedEmail },
      });
      const credential = await passkey.runAuthentication(options);
      await runPasskeyVerify(challengeToken, credential);
    } catch (error) {
      const msg = passkey.passkeyErrorMessage(error);
      if (msg && !msg.toLowerCase().includes("cancel")) {
        toast.error(msg);
      }
      setPasskeyLoading(false);
    }
  }

  useEffect(() => {
    if (!passkeyFeature.enabled) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    if (autofillStartedRef.current) return;
    autofillStartedRef.current = true;

    let cancelled = false;
    const controller = new AbortController();
    autofillAbortRef.current = controller;

    void (async () => {
      try {
        const { isPasskeyAutofillSupported, runAuthentication } = await loadPasskey();
        const supportsAutofill = await isPasskeyAutofillSupported();
        if (cancelled || !supportsAutofill) return;
        const { options, challengeToken } = await getPasskeyAuthOptions({
          data: { email: normalizedEmail },
        });
        if (cancelled) return;
        const credential = await runAuthentication(options, true);
        if (cancelled) return;
        await runPasskeyVerify(challengeToken, credential);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (
          msg &&
          !msg.toLowerCase().includes("abort") &&
          !msg.toLowerCase().includes("cancel") &&
          !msg.toLowerCase().includes("notallowed")
        ) {
          console.warn("[passkey-autofill]", msg);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [passkeyFeature.enabled, email, getPasskeyAuthOptions, runPasskeyVerify]);

  async function handleSendOtp() {
    haptics.selection();
    const validationError = validateEmailInput(email);
    if (validationError) {
      setEmailError(validationError);
      return;
    }

    setEmailError(null);
    setLoading(true);
    try {
      await requestLoginOtp({ data: { email, geo: await getClientGeo() } });
      toast.success("Verification code sent");
      setStep("otp");
    } catch (error) {
      toast.error(getFriendlyAuthError(error, "Failed to send code"));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    haptics.selection();
    const code = otpRef.current;
    if (code.length < 6) return;
    setLoading(true);
    try {
      const response = await verifyEmailCode({
        data: { email, code, geo: await getClientGeo() },
      });
      if (response.requiresTwoFactor) {
        const { buildTwoFactorChallengeNavigation } = await loadTwoFactor();
        const nav = buildTwoFactorChallengeNavigation(
          {
            challengeToken: response.challengeToken,
            expiresIn: response.expiresIn,
          },
          { next: getNextUrl() },
        );
        navigate({ to: "/2fa", search: nav.search, hash: nav.hash });
        return;
      }

      saveLastAuthMethod("email");
      toast.success(`Welcome back${response.user.firstName ? `, ${response.user.firstName}` : ""}`);
      invalidateSessionCache();
      window.location.replace(getNextUrl());
      return;
    } catch (error) {
      toast.error(getFriendlyAuthError(error, "Verification failed"));
      setLoading(false);
    }
  }

  async function handleResend() {
    haptics.selection();
    setOtp("");
    if (!email.trim()) return;
    setLoading(true);
    try {
      await resendAuthCode({ data: { email, geo: await getClientGeo() } });
      toast.success("Code resent");
    } catch (error) {
      toast.error(getFriendlyAuthError(error, "Failed to resend code"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      mode="login"
      title={
        <>
          Welcome back.
          <br />
          Sign in to deploy.
        </>
      }
      description="Access your workspace, review recent builds, and continue shipping without friction."
      footer={
        <>
          By signing in, you agree to Brimble&apos;s{" "}
          <a
            href="https://brimble.io/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-dash-text-faded underline underline-offset-2 transition-colors hover:text-dash-text-body"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="https://brimble.io/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-dash-text-faded underline underline-offset-2 transition-colors hover:text-dash-text-body"
          >
            Privacy Policy
          </a>
          .
        </>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {step === "email" ? (
          <EmailStep
            key="email"
            email={email}
            emailError={emailError ?? undefined}
            onEmailChange={(next) => {
              setEmail(next);
              if (emailError) {
                setEmailError(null);
              }
            }}
            onEmailBlur={() => {
              const trimmed = email.trim();
              if (!trimmed) return;
              const validationError = validateEmailInput(email);
              if (validationError) {
                setEmailError(validationError);
              }
            }}
            onSubmit={handleSendOtp}
            loading={loading}
            onGithub={() => {
              void handleOauth("github");
            }}
            onGoogle={() => {
              void handleOauth("google");
            }}
            onGitlab={() => {
              void handleOauth("gitlab");
            }}
            onBitbucket={() => {
              void handleOauth("bitbucket");
            }}
            oauthLoadingProvider={oauthLoadingProvider}
            lastAuthMethod={lastAuthMethod}
            passkeyEnabled={passkeyFeature.enabled}
            onPasskey={handlePasskeySignIn}
            passkeyLoading={passkeyLoading}
          />
        ) : (
          <OtpStep
            key="otp"
            email={email}
            otp={otp}
            onOtpChange={(v) => {
              setOtp(v);
              otpRef.current = v;
            }}
            onVerify={handleVerify}
            onBack={() => {
              haptics.selection();
              setStep("email");
              setOtp("");
            }}
            onResend={handleResend}
            loading={loading}
          />
        )}
      </AnimatePresence>
    </AuthSplitLayout>
  );
}
