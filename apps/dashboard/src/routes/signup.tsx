import { useState, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Github, ArrowLeft, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { invalidateSessionCache } from "../lib/auth-guards";
import { getClientGeo } from "@/lib/client-geo";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { AuthDivider, AuthField, AuthProviderButton, AuthSplitLayout, OtpInput } from "../components/auth/auth-split-layout";
import {
  lookupAuthServerFn,
  resendAuthCodeServerFn,
  startSignupServerFn,
  verifyEmailCodeServerFn,
} from "../server/auth/actions";
import { startOauthPopup, type OauthProvider } from "../lib/auth/oauth-popup";
import { buildTwoFactorChallengeNavigation, extractTwoFactorChallenge } from "@/lib/auth/two-factor";
import type {
  LookupAuthCaller,
  ResendAuthCodeCaller,
  StartSignupCaller,
  VerifyEmailCodeCaller,
} from "./auth.types";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
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

/* ─── Step 1: Enter details ─── */

function DetailsStep({
  email,
  onEmailChange,
  username,
  onUsernameChange,
  onSubmit,
  loading,
  onGithub,
  onGoogle,
  onGitlab,
  onBitbucket,
  oauthLoadingProvider,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  username: string;
  onUsernameChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  onGithub: () => void;
  onGoogle: () => void;
  onGitlab: () => void;
  onBitbucket: () => void;
  oauthLoadingProvider: OauthProvider | null;
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
          label={oauthLoadingProvider === "github" ? "Connecting GitHub..." : "Sign up with GitHub"}
          onClick={onGithub}
          disabled={loading || oauthLoadingProvider !== null}
        />
        <AuthProviderButton
          icon={<GoogleIcon />}
          label={oauthLoadingProvider === "google" ? "Connecting Google..." : "Sign up with Google"}
          onClick={onGoogle}
          disabled={loading || oauthLoadingProvider !== null}
        />
        <div className="flex gap-2.5">
          <AuthProviderButton
            icon={<GitlabIcon />}
            label={oauthLoadingProvider === "gitlab" ? "GitLab..." : "GitLab"}
            onClick={onGitlab}
            disabled={loading || oauthLoadingProvider !== null}
          />
          <AuthProviderButton
            icon={<BitbucketIcon />}
            label={oauthLoadingProvider === "bitbucket" ? "Bitbucket..." : "Bitbucket"}
            onClick={onBitbucket}
            disabled={loading || oauthLoadingProvider !== null}
          />
        </div>
      </div>

      <AuthDivider label="or use email" />

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <AuthField
          id="signup-email"
          type="email"
          label="Work email"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          autoFocus
          inputMode="email"
        />

        <AuthField
          id="signup-username"
          label="Username"
          placeholder="armstrong"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
        />

        <button
          type="submit"
          disabled={!email.trim() || !username.trim() || loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#006fff] text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,80,200,0.3)] transition-all hover:bg-[#0060e0] disabled:opacity-40 disabled:hover:bg-[#006fff]"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Continue"}
        </button>
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
        <p className="mt-1 text-[13px] text-dash-text-faded">Enter it below to verify your email and create your account.</p>
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
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Verify & create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-[13px] text-dash-text-faded">
        Didn&apos;t receive it?{" "}
        <button onClick={onResend} className="font-medium text-[#006fff] transition-colors hover:text-[#0060e0] dark:text-[#4879f8]">
          Resend code
        </button>
      </p>
    </motion.div>
  );
}

/* ─── Page ─── */

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

function SignupPage() {
  const haptics = useHaptics();
  const navigate = useNavigate();
  const lookupAuth = useServerFn(lookupAuthServerFn) as LookupAuthCaller;
  const startSignup = useServerFn(startSignupServerFn) as StartSignupCaller;
  const resendAuthCode = useServerFn(resendAuthCodeServerFn) as ResendAuthCodeCaller;
  const verifyEmailCode = useServerFn(verifyEmailCodeServerFn) as VerifyEmailCodeCaller;
  const [step, setStep] = useState<"details" | "otp">("details");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [otp, setOtp] = useState("");
  const otpRef = useRef(otp);
  otpRef.current = otp;
  const [loading, setLoading] = useState(false);
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<OauthProvider | null>(null);

  async function handleOauth(provider: OauthProvider) {
    if (oauthLoadingProvider) {
      return;
    }
    haptics.selection();

    setOauthLoadingProvider(provider);

    try {
      const data = await startOauthPopup(provider);
      const challenge = extractTwoFactorChallenge(data);
      if (challenge) {
        const nav = buildTwoFactorChallengeNavigation(challenge, { next: getNextUrl() });
        navigate({ to: "/2fa", search: nav.search, hash: nav.hash });
        return;
      }

      toast.success(`Welcome${data.user?.firstName ? `, ${data.user.firstName}` : ""}`);
      invalidateSessionCache();
      window.location.replace(getNextUrl());
      return;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "OAuth sign up failed");
      setOauthLoadingProvider(null);
    }
  }

  async function handleSendOtp() {
    haptics.selection();
    if (!email.trim() || !username.trim()) return;
    setLoading(true);
    try {
      const usernameCheck = await lookupAuth({ data: { username } });
      if (!usernameCheck.available) {
        throw new Error(usernameCheck.message || "Username is unavailable");
      }

      const emailCheck = await lookupAuth({ data: { email } });
      if (!emailCheck.available) {
        throw new Error(emailCheck.message || "Email is unavailable");
      }

      await startSignup({ data: { email, username, geo: await getClientGeo() } });
      toast.success("Verification code sent");
      setStep("otp");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Signup failed");
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

      toast.success("Account created successfully");
      invalidateSessionCache();
      window.location.replace(getNextUrl());
      return;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
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
      toast.error(error instanceof Error ? error.message : "Failed to resend code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      mode="signup"
      title={
        <>
          Create your account.
          <br />
          Start shipping today.
        </>
      }
      description="Set up your access once, then move straight into creating projects, connecting repos, and configuring deploys."
      footer={
        <>
          By creating an account, you agree to our{" "}
          <Link
            to="/"
            className="font-medium text-dash-text-faded underline underline-offset-2 transition-colors hover:text-dash-text-body"
          >
            Terms
          </Link>{" "}
          and confirm you&apos;ve read the{" "}
          <Link
            to="/"
            className="font-medium text-dash-text-faded underline underline-offset-2 transition-colors hover:text-dash-text-body"
          >
            Privacy Policy
          </Link>
          .
        </>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {step === "details" ? (
          <DetailsStep
            key="details"
            email={email}
            onEmailChange={setEmail}
            username={username}
            onUsernameChange={setUsername}
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
              setStep("details");
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
