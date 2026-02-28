import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Github, ArrowLeft, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { invalidateSessionCache } from "../lib/auth-guards";
import { toast } from "sonner";
import {
  AuthDivider,
  AuthField,
  AuthProviderButton,
  AuthSplitLayout,
  OtpInput,
} from "../components/auth/auth-split-layout";
import {
  finalizeOauthSessionServerFn,
  lookupAuthServerFn,
  resendAuthCodeServerFn,
  startSignupServerFn,
  verifyEmailCodeServerFn,
} from "../server/auth/actions";
import { startOauthPopup, type OauthProvider } from "../lib/auth/oauth-popup";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

const ease = [0.16, 1, 0.3, 1] as const;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.27-.97 2.34-2.03 3.06l3.28 2.54c1.92-1.77 3.02-4.37 3.02-7.46 0-.7-.06-1.37-.18-2.04H12Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.45l-3.28-2.54c-.91.61-2.07.97-3.34.97-2.57 0-4.74-1.73-5.52-4.05H3.1v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#4A90E2" d="M6.48 13.93A5.98 5.98 0 0 1 6.17 12c0-.67.12-1.32.31-1.93V7.45H3.1A10 10 0 0 0 2 12c0 1.61.38 3.14 1.1 4.55l3.38-2.62Z" />
      <path fill="#FBBC05" d="M12 6.02c1.47 0 2.8.5 3.84 1.48l2.88-2.88C16.96 2.98 14.7 2 12 2A10 10 0 0 0 3.1 7.45l3.38 2.62c.78-2.32 2.95-4.05 5.52-4.05Z" />
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
          label={
            oauthLoadingProvider === "github"
              ? "Connecting GitHub..."
              : "Sign up with GitHub"
          }
          onClick={onGithub}
          disabled={loading || oauthLoadingProvider !== null}
        />
        <AuthProviderButton
          icon={<GoogleIcon />}
          label={
            oauthLoadingProvider === "google"
              ? "Connecting Google..."
              : "Sign up with Google"
          }
          onClick={onGoogle}
          disabled={loading || oauthLoadingProvider !== null}
        />
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
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Continue"
          )}
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
          We sent a 6-digit code to{" "}
          <span className="font-medium text-dash-text-strong">{email}</span>
        </p>
        <p className="mt-1 text-[13px] text-dash-text-faded">
          Enter it below to verify your email and create your account.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onVerify();
        }}
        className="space-y-5"
      >
        <OtpInput value={otp} onChange={onOtpChange} autoFocus />

        <button
          type="submit"
          disabled={otp.length < 6 || loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#006fff] text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,80,200,0.3)] transition-all hover:bg-[#0060e0] disabled:opacity-40 disabled:hover:bg-[#006fff]"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Verify & create account"
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-[13px] text-dash-text-faded">
        Didn&apos;t receive it?{" "}
        <button
          onClick={onResend}
          className="font-medium text-[#006fff] transition-colors hover:text-[#0060e0] dark:text-[#4879f8]"
        >
          Resend code
        </button>
      </p>
    </motion.div>
  );
}

/* ─── Page ─── */

function SignupPage() {
  const lookupAuth = useServerFn(lookupAuthServerFn);
  const startSignup = useServerFn(startSignupServerFn);
  const resendAuthCode = useServerFn(resendAuthCodeServerFn);
  const verifyEmailCode = useServerFn(verifyEmailCodeServerFn);
  const finalizeOauthSession = useServerFn(finalizeOauthSessionServerFn);
  const [step, setStep] = useState<"details" | "otp">("details");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<OauthProvider | null>(null);

  async function handleOauth(provider: OauthProvider) {
    if (oauthLoadingProvider) {
      return;
    }

    setOauthLoadingProvider(provider);

    try {
      const data = await startOauthPopup(provider);
      const response = await finalizeOauthSession({
        data: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          user: {
            id: data.id,
            email: data.email,
            username: data.username,
            firstName: data.first_name,
            lastName: data.last_name,
            company: data.company,
            onboarded: Boolean(data.onboard?.user),
          },
        },
      });

      toast.success(
        `Welcome${response.user.firstName ? `, ${response.user.firstName}` : ""}`,
      );
      invalidateSessionCache();
      window.location.replace("/");
      return;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "OAuth sign up failed");
    } finally {
      setOauthLoadingProvider(null);
    }
  }

  async function handleSendOtp() {
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

      await startSignup({ data: { email, username } });
      toast.success("Verification code sent");
      setStep("otp");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (otp.length < 6) return;
    setLoading(true);
    try {
      await verifyEmailCode({ data: { email, code: otp } });
      toast.success("Account created successfully");
      invalidateSessionCache();
      window.location.replace("/");
      return;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setOtp("");
    if (!email.trim()) return;
    setLoading(true);
    try {
      await resendAuthCode({ data: { email } });
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
          <Link to="/" className="font-medium text-dash-text-faded underline underline-offset-2 transition-colors hover:text-dash-text-body">
            Terms
          </Link>{" "}
          and confirm you&apos;ve read the{" "}
          <Link to="/" className="font-medium text-dash-text-faded underline underline-offset-2 transition-colors hover:text-dash-text-body">
            Privacy Policy
          </Link>
          .
        </>
      }
    >
      <AnimatePresence mode="wait">
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
            oauthLoadingProvider={oauthLoadingProvider}
          />
        ) : (
          <OtpStep
            key="otp"
            email={email}
            otp={otp}
            onOtpChange={setOtp}
            onVerify={handleVerify}
            onBack={() => {
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
