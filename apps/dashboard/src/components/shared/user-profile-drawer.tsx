import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Drawer } from "vaul";
import { cn } from "@brimble/ui";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  HelpCircle,
  MoreHorizontal,
  Shield,
  UserMinus,
  Eye,
  EyeOff,
  RefreshCw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { invalidateSessionCache } from "@/lib/auth-guards";
import { InviteMembersModal } from "../settings/invite-members-modal";
import { WarningModal } from "./warning-modal";
import { GlossyButton } from "./glossy-button";
import { OtpInput } from "../auth/auth-split-layout";
import { logoutServerFn } from "@/server/auth/actions";
import {
  createSettingsApiKeyServerFn,
  decryptSettingsApiKeyServerFn,
  disconnectGitProviderServerFn,
  getSettingsSidebarSnapshotServerFn,
  requestSettingsEmailVerificationServerFn,
  resetSettingsApiKeyServerFn,
  testSettingsWebhookServerFn,
  updateSettingsBuildsServerFn,
  updateSettingsNotificationsServerFn,
  updateSettingsProfileServerFn,
  updateSettingsWebhooksServerFn,
} from "@/server/settings/actions";
import { BillingForm } from "../settings/billing-form";
import { usePlanGate } from "@/hooks/use-plan-gate";
import type { PaymentMethod } from "@/backend/payments";
import {
  getWorkspaceTeamMembersServerFn,
  inviteWorkspaceTeamMembersServerFn,
  removeWorkspaceTeamMemberServerFn,
  resendWorkspaceTeamInviteServerFn,
  updateWorkspaceTeamProfileServerFn,
} from "@/server/teams/actions";
import { listGithubAccountsServerFn } from "@/server/repositories/actions";
import type {
  SettingsSidebarSnapshot,
  SettingsWebhookGroup as ServerWebhookGroup,
} from "@/backend/settings";
import type { TeamDetails, TeamMember } from "@/backend/teams";
import config from "@/config";
import {
  mapSettingsSnapshotToDrawerProfile,
  maskSecretWithAsterisks,
  type DrawerUserProfile,
} from "@/utils/dashboard";
import { formatUsdMonthly } from "@/utils/billing";
import { usePricing } from "@/contexts/pricing-context";
import { ProfileTab } from "../../types/enums";
type UserProfile = DrawerUserProfile;

export { ProfileTab };

const accountNav: { label: string; key: ProfileTab }[] = [
  { label: "Profile", key: ProfileTab.Profile },
  { label: "Members", key: ProfileTab.Members },
  { label: "Notifications", key: ProfileTab.Notifications },
  { label: "Billing", key: ProfileTab.Billing },
];

const reachUsNav = [
  { label: "Blog", emoji: "📔", href: "https://brimble.io/blog" },
  { label: "Follow on twitter", emoji: "🔵", href: "https://x.com/brimblehq" },
  {
    label: "Discord",
    emoji: "🟣",
    href: "https://discord.com/invite/XBCBwbXQJQ",
  },
  { label: "Help", emoji: "🛟", href: "mailto:hello@brimble.app" },
];

const aboutNav = [
  { label: "Changelog", emoji: "👥" },
  { label: "Terms and privacy", emoji: "🔔" },
];

const navItemBase =
  "flex items-center gap-2 whitespace-nowrap rounded-[4px] px-3.5 py-1.5 text-sm tracking-[-0.0224px] transition-colors w-full";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 text-dash-text-faded transition-colors hover:text-dash-text-strong"
      title="Copy"
    >
      {copied ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="text-[#34d399]"
        >
          <path
            d="M3 8.5L6.5 12L13 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  );
}

function ProfileForm({
  profile,
  onSave,
  onChangeEmail,
  onBuildsChange,
  onCreateApiKey,
  onResetApiKey,
  onDecryptApiKey,
  isGithubConnected,
  onDisconnectGithub,
  onConnectGithub,
  onRequestDeleteAccountOtp,
  onVerifyDeleteAccountOtp,
  onDeleteAccount,
  isSaving,
}: {
  profile: UserProfile;
  onSave?: (data: {
    firstName: string;
    lastName: string;
    username: string;
    avatarUrl?: string;
  }) => void | Promise<void>;
  onChangeEmail?: (email: string) => void | Promise<void>;
  onBuildsChange?: (enabled: boolean) => Promise<void> | void;
  onCreateApiKey?: () => Promise<string | undefined> | string | undefined;
  onResetApiKey?: () => Promise<string | undefined> | string | undefined;
  onDecryptApiKey?: (
    encryptedApiKey: string,
  ) => Promise<string | null | undefined>;
  isGithubConnected: boolean;
  onDisconnectGithub?: () => Promise<void> | void;
  onConnectGithub?: () => void;
  onRequestDeleteAccountOtp?: () => Promise<void> | void;
  onVerifyDeleteAccountOtp?: (code: string) => Promise<void> | void;
  onDeleteAccount?: () => Promise<void> | void;
  isSaving?: boolean;
}) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.email);
  const [buildsEnabled, setBuildsEnabled] = useState(
    profile.buildsEnabled ?? true,
  );
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isTextDirty =
    firstName !== profile.firstName ||
    lastName !== profile.lastName ||
    username !== profile.username;
  const isAvatarDirty = avatarUrl !== (profile.avatarUrl ?? "");
  const isDirty = isTextDirty || isAvatarDirty;

  const inputClass =
    "w-full input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]";

  function handleSave() {
    void onSave?.({
      firstName,
      lastName,
      username,
      avatarUrl: avatarUrl || undefined,
    });
  }

  useEffect(() => {
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setUsername(profile.username);
    setEmail(profile.email);
    setAvatarUrl(profile.avatarUrl ?? "");
  }, [
    profile.avatarUrl,
    profile.email,
    profile.firstName,
    profile.lastName,
    profile.username,
  ]);

  useEffect(() => {
    setBuildsEnabled(profile.buildsEnabled ?? true);
  }, [profile.buildsEnabled]);

  async function handleAvatarFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "profile-photos");

      const response = await axios.post(config.uploadUrl, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const nextAvatarUrl = response.data?.secure_url || response.data?.url;

      if (typeof nextAvatarUrl === "string" && nextAvatarUrl.length > 0) {
        setAvatarUrl(String(nextAvatarUrl));
        toast.success("Photo uploaded. Click Confirm to save changes.");
      } else {
        toast.error("Upload succeeded but no image URL was returned.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image",
      );
    } finally {
      setIsUploadingAvatar(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  const avatarSeed =
    profile.username || profile.firstName || profile.email || "user";
  const avatarSrc =
    avatarUrl ||
    `${config.avatarUrl}/adventurer-neutral/svg?seed=${encodeURIComponent(avatarSeed)}`;

  return (
    <div className="flex max-w-[488px] flex-col gap-8">
      {/* Avatar + Upload */}
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          className="hidden"
          onChange={handleAvatarFileChange}
        />
        <div className="relative size-16 shrink-0 overflow-hidden rounded-full border border-dash-border-soft bg-dash-bg-elevated">
          <img
            src={avatarSrc}
            alt="Profile avatar"
            className="h-full w-full object-cover"
          />
          {isUploadingAvatar && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingAvatar || Boolean(isSaving)}
            className="flex h-[34px] w-fit items-center rounded-[4px] border border-dash-border bg-dash-bg px-3.5 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:pointer-events-none disabled:opacity-50"
          >
            {isUploadingAvatar ? "Uploading..." : "Upload photo"}
          </button>
          <span className="text-sm text-dash-text-faded">
            Hold Option "⌥" to reveal alternate action
          </span>
        </div>
      </div>

      <hr className="border-dash-border-soft" />

      {/* Name fields */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-3.5">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
              First name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
              Last name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Username */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Unique ID */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
            Unique ID
          </label>
          <div className="relative">
            <input
              type="text"
              value={profile.uniqueId}
              readOnly
              className={cn(inputClass, "pr-10 text-dash-text-faded")}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <CopyButton text={profile.uniqueId} />
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <GlossyButton
        onClick={handleSave}
        disabled={!isDirty || isUploadingAvatar || Boolean(isSaving)}
        fullWidth
        loading={Boolean(isSaving)}
        loadingLabel="Saving..."
      >
        Confirm
      </GlossyButton>

      <hr className="border-dash-border-soft" />

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
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={cn(inputClass, "text-dash-text-faded")}
          />
          <button
            onClick={() => onChangeEmail?.(email)}
            className="shrink-0 text-sm font-medium tracking-[-0.0224px] text-dash-text-strong transition-colors hover:text-dash-text-body"
          >
            Change
          </button>
        </div>
      </div>

      <hr className="border-dash-border-soft" />

      {/* Builds toggle */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
            Builds
          </span>
          <span className="text-sm leading-5 text-dash-text-faded">
            Enable or disable builds for your projects
          </span>
        </div>
        <Toggle
          checked={buildsEnabled}
          onChange={async (nextValue) => {
            setBuildsEnabled(nextValue);
            try {
              await onBuildsChange?.(nextValue);
            } catch (error) {
              setBuildsEnabled(!nextValue);
              throw error;
            }
          }}
        />
      </div>

      <hr className="border-dash-border-soft" />

      {/* API Key */}
      <ApiKeySection
        initialApiKey={profile.apiKey}
        onCreate={onCreateApiKey}
        onReset={onResetApiKey}
        onDecrypt={onDecryptApiKey}
      />

      <hr className="border-dash-border-soft" />

      {/* Danger zone */}
      <DangerZone
        isGithubConnected={isGithubConnected}
        onDisconnectGithub={onDisconnectGithub}
        onConnectGithub={onConnectGithub}
        onDeleteAccount={onDeleteAccount}
      />
    </div>
  );
}

function DangerZone({
  isGithubConnected,
  onDisconnectGithub,
  onConnectGithub,
  onDeleteAccount,
}: {
  isGithubConnected: boolean;
  onDisconnectGithub?: () => Promise<void> | void;
  onConnectGithub?: () => void;
  onDeleteAccount?: () => Promise<void> | void;
}) {
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"confirm" | "otp">("confirm");
  const [disconnectConfirm, setDisconnectConfirm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deleteOtpError, setDeleteOtpError] = useState<string | null>(null);

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
          Danger zone
        </span>
        <span className="text-sm leading-5 text-dash-text-faded">
          Irreversible actions for your account
        </span>
      </div>

      {/* GitHub connection */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-dash-text-strong">
            {isGithubConnected ? "Disconnect GitHub" : "Connect GitHub"}
          </span>
          <span className="text-xs text-dash-text-faded">
            {isGithubConnected
              ? "You won't be able to deploy from Git until you reconnect."
              : "Connect your GitHub account to deploy from Git."}
          </span>
        </div>
        {isGithubConnected ? (
          <GlossyButton variant="red" onClick={() => setDisconnectOpen(true)}>
            Disconnect
          </GlossyButton>
        ) : (
          <GlossyButton variant="black" onClick={() => onConnectGithub?.()}>
            Connect
          </GlossyButton>
        )}
      </div>

      {/* Delete account */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-dash-text-strong">
            Delete account
          </span>
          <span className="text-xs text-dash-text-faded">
            Permanently delete your account and all associated data.
          </span>
        </div>
        <GlossyButton variant="red" onClick={() => setDeleteOpen(true)}>
          Delete
        </GlossyButton>
      </div>

      <WarningModal
        open={disconnectOpen}
        onOpenChange={(open) => {
          setDisconnectOpen(open);
          if (!open) setDisconnectConfirm("");
        }}
        title="Disconnect GitHub?"
        description="This will remove your GitHub connection. All Git-based deployments will stop working until you reconnect your account."
        confirmLabel="Disconnect GitHub"
        confirmDisabled={disconnectConfirm !== "DISCONNECT"}
        onConfirm={async () => {
          await onDisconnectGithub?.();
        }}
      >
        <div className="flex flex-col gap-2 text-left">
          <label className="text-sm leading-5 text-dash-text-faded">
            Type{" "}
            <span className="font-medium text-dash-text-strong">
              DISCONNECT
            </span>{" "}
            to confirm
          </label>
          <input
            type="text"
            value={disconnectConfirm}
            onChange={(e) => setDisconnectConfirm(e.target.value)}
            placeholder="DISCONNECT"
            className="w-full input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]"
          />
        </div>
      </WarningModal>

      <WarningModal
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeleteConfirm("");
            setDeleteStep("confirm");
            setDeleteOtp("");
            setDeleteOtpError(null);
          }
        }}
        title={
          deleteStep === "confirm"
            ? "Delete your account?"
            : "Verify account deletion"
        }
        description={
          deleteStep === "confirm"
            ? "This action cannot be undone. All projects, deployments, domains, environment variables, and billing data will be permanently deleted."
            : "We sent a 6-digit verification code to your account email. Enter it to continue."
        }
        confirmLabel={
          deleteStep === "confirm"
            ? "Send verification code"
            : "Delete my account"
        }
        confirmLoadingLabel={
          deleteStep === "confirm" ? "Sending code..." : "Deleting account..."
        }
        confirmDisabled={
          deleteStep === "confirm"
            ? deleteConfirm !== "DELETE"
            : deleteOtp.length < 6
        }
        closeOnConfirm={deleteStep === "otp"}
        onConfirm={async () => {
          if (deleteStep === "confirm") {
            setDeleteOtpError(null);
            setDeleteStep("otp");
            if (onRequestDeleteAccountOtp) {
              try {
                await onRequestDeleteAccountOtp();
              } catch (error) {
                setDeleteStep("confirm");
                throw error;
              }
            }
            return;
          }

          if (deleteOtp.length < 6) {
            setDeleteOtpError("Enter the 6-digit verification code.");
            return;
          }

          setDeleteOtpError(null);
          if (onVerifyDeleteAccountOtp) {
            await onVerifyDeleteAccountOtp(deleteOtp);
          }
          await onDeleteAccount?.();
        }}
      >
        <div className="flex flex-col gap-2 text-left">
          {deleteStep === "confirm" ? (
            <>
              <label className="text-sm leading-5 text-dash-text-faded">
                Type{" "}
                <span className="font-medium text-dash-text-strong">
                  DELETE
                </span>{" "}
                to confirm
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="w-full input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]"
              />
            </>
          ) : (
            <>
              <label className="text-sm leading-5 text-dash-text-faded">
                Enter verification code
              </label>
              <div className="flex justify-center">
                <OtpInput
                  value={deleteOtp}
                  onChange={(value) => {
                    setDeleteOtp(value);
                    if (deleteOtpError) {
                      setDeleteOtpError(null);
                    }
                  }}
                  autoFocus
                />
              </div>
              {deleteOtpError ? (
                <p className="text-xs text-[#ef2f1f]">{deleteOtpError}</p>
              ) : null}
              <button
                type="button"
                onClick={async () => {
                  try {
                    setDeleteOtpError(null);
                    if (onRequestDeleteAccountOtp) {
                      await onRequestDeleteAccountOtp();
                    } else {
                      toast.success("Verification code resent");
                    }
                  } catch (error) {
                    setDeleteOtpError(
                      error instanceof Error
                        ? error.message
                        : "Failed to resend verification code",
                    );
                  }
                }}
                className="self-start text-xs font-medium text-[#4879f8] transition-colors hover:text-[#3a6ae6]"
              >
                Resend code
              </button>
            </>
          )}
        </div>
      </WarningModal>
    </>
  );
}

function ApiKeySection({
  initialApiKey,
  onCreate,
  onReset,
  onDecrypt,
}: {
  initialApiKey?: string;
  onCreate?: () => Promise<string | undefined> | string | undefined;
  onReset?: () => Promise<string | undefined> | string | undefined;
  onDecrypt?: (encryptedApiKey: string) => Promise<string | null | undefined>;
}) {
  const [encryptedApiKey, setEncryptedApiKey] = useState(initialApiKey ?? "");
  const [decryptedApiKey, setDecryptedApiKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [rerollOpen, setRerollOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const inputClass =
    "w-full input-base px-3 py-2.5 text-sm leading-6 text-dash-text-strong";

  useEffect(() => {
    setEncryptedApiKey(initialApiKey ?? "");
    setDecryptedApiKey(null);
    setRevealed(false);
  }, [initialApiKey]);

  const displayValue = (() => {
    if (!encryptedApiKey) {
      return "No API Key Yet";
    }

    if (revealed && decryptedApiKey) {
      return decryptedApiKey;
    }

    return maskSecretWithAsterisks(encryptedApiKey);
  })();

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
          API key
        </span>
        <span className="text-sm leading-5 text-dash-text-faded">
          Use this key to authenticate API requests. Keep it secret.
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={displayValue}
            readOnly
            className={cn(
              inputClass,
              "pr-20 font-mono text-[13px] text-dash-text-faded",
            )}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <button
              onClick={async () => {
                if (!encryptedApiKey) {
                  return;
                }

                if (revealed) {
                  setRevealed(false);
                  return;
                }

                if (decryptedApiKey) {
                  setRevealed(true);
                  return;
                }

                setIsDecrypting(true);

                try {
                  const decrypted = await onDecrypt?.(encryptedApiKey);
                  if (decrypted) {
                    setDecryptedApiKey(decrypted);
                    setRevealed(true);
                  }
                } finally {
                  setIsDecrypting(false);
                }
              }}
              disabled={!encryptedApiKey || isDecrypting}
              className="shrink-0 rounded-[4px] p-1 text-dash-text-faded transition-colors hover:text-dash-text-strong"
              title={revealed ? "Hide" : "Reveal"}
            >
              {revealed ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
            {decryptedApiKey ? (
              <CopyButton text={decryptedApiKey} />
            ) : (
              <button
                disabled
                className="shrink-0 rounded-[4px] p-1 text-dash-text-extra-faded"
                title="Reveal key to copy"
              >
                <Copy className="size-4" />
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setRerollOpen(true)}
          disabled={isSubmitting}
          className="flex h-[40px] shrink-0 items-center gap-1.5 rounded-[6px] border border-dash-border bg-dash-bg px-3 text-sm font-medium text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated"
        >
          <RefreshCw className="size-3.5" />
          {encryptedApiKey ? "Reroll" : "Generate"}
        </button>
      </div>

      <WarningModal
        open={rerollOpen}
        onOpenChange={setRerollOpen}
        title="Reroll API key?"
        description="Your current key will be permanently invalidated. Any services using it will lose access immediately."
        confirmLabel="Reroll key"
        cancelLabel="Cancel"
        onConfirm={async () => {
          setIsSubmitting(true);
          try {
            const nextKey = encryptedApiKey
              ? await onReset?.()
              : await onCreate?.();
            if (nextKey) {
              setEncryptedApiKey(nextKey);
              setDecryptedApiKey(null);
              setRevealed(false);
            }
          } finally {
            setIsSubmitting(false);
          }
        }}
      />
    </div>
  );
}

function WorkspaceProfileForm({
  team,
  onSave,
  onBuildsChange,
  isSaving,
}: {
  team: TeamDetails;
  onSave?: (data: {
    name: string;
    description?: string;
    avatarUrl?: string;
  }) => void | Promise<void>;
  onBuildsChange?: (enabled: boolean) => Promise<void> | void;
  isSaving?: boolean;
}) {
  const [name, setName] = useState(team.name || "");
  const [description, setDescription] = useState(team.description || "");
  const [avatarUrl, setAvatarUrl] = useState(team.avatarUrl || "");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [buildsEnabled, setBuildsEnabled] = useState(!(team.buildDisabled ?? false));
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isDirty =
    name !== (team.name || "") ||
    description !== (team.description || "") ||
    avatarUrl !== (team.avatarUrl || "");

  const inputClass =
    "w-full input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]";

  useEffect(() => {
    setName(team.name || "");
    setDescription(team.description || "");
    setAvatarUrl(team.avatarUrl || "");
  }, [team.avatarUrl, team.description, team.name]);

  useEffect(() => {
    setBuildsEnabled(!(team.buildDisabled ?? false));
  }, [team.buildDisabled]);

  async function handleAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "profile-photos");

      const response = await axios.post(config.uploadUrl, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const nextAvatarUrl = response.data?.secure_url || response.data?.url;

      if (typeof nextAvatarUrl === "string" && nextAvatarUrl.length > 0) {
        setAvatarUrl(String(nextAvatarUrl));
        toast.success("Photo uploaded. Click Save changes to confirm.");
      } else {
        toast.error("Upload succeeded but no image URL was returned.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image",
      );
    } finally {
      setIsUploadingAvatar(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  function handleSave() {
    void onSave?.({
      name: name.trim(),
      description: description.trim(),
      avatarUrl: avatarUrl || undefined,
    });
  }

  const avatarSeed = team.name || "workspace";
  const avatarSrc =
    avatarUrl ||
    `${config.avatarUrl}/initials/svg?seed=${encodeURIComponent(avatarSeed)}`;

  return (
    <div className="flex max-w-[488px] flex-col gap-8">
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          className="hidden"
          onChange={handleAvatarFileChange}
        />
        <div className="relative size-16 shrink-0 overflow-hidden rounded-full border border-dash-border-soft bg-dash-bg-elevated">
          <img
            src={avatarSrc}
            alt="Workspace avatar"
            className="h-full w-full object-cover"
          />
          {isUploadingAvatar && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingAvatar || Boolean(isSaving)}
            className="flex h-[34px] w-fit items-center rounded-[4px] border border-dash-border bg-dash-bg px-3.5 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:pointer-events-none disabled:opacity-50"
          >
            {isUploadingAvatar ? "Uploading..." : "Upload photo"}
          </button>
          <span className="text-sm text-dash-text-faded">
            Workspace logo
          </span>
        </div>
      </div>

      <hr className="border-dash-border-soft" />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
            Workspace name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
            Workspace description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <GlossyButton
        variant="blue"
        onClick={handleSave}
        disabled={!isDirty || isUploadingAvatar || !name.trim()}
        loading={Boolean(isSaving)}
        loadingLabel="Saving..."
      >
        Save changes
      </GlossyButton>

      <hr className="border-dash-border-soft" />

      <div className="flex flex-col gap-2">
        <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
          Workspace ID
        </label>
        <div className="flex items-center rounded-[6px] border border-dash-border bg-dash-bg-elevated px-3 py-2.5">
          <span className="flex-1 truncate text-sm text-dash-text-strong">
            {team.id}
          </span>
          <CopyButton text={team.id} />
        </div>
      </div>

      <hr className="border-dash-border-soft" />

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
            Builds
          </span>
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
            Enable or disable builds for this workspace.
          </span>
        </div>
        <Toggle
          checked={buildsEnabled}
          onChange={async (next) => {
            setBuildsEnabled(next);
            try {
              await onBuildsChange?.(next);
            } catch {
              setBuildsEnabled(!next);
            }
          }}
        />
      </div>
    </div>
  );
}

function ProfileNavSidebar({
  activeTab,
  onTabChange,
  onClose,
  onSignOut,
  isSigningOut,
  showMembersTab,
}: {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  onClose: () => void;
  onSignOut?: () => void | Promise<void>;
  isSigningOut?: boolean;
  showMembersTab: boolean;
}) {
  const accountNavItems = showMembersTab
    ? accountNav
    : accountNav.filter((item) => item.key !== ProfileTab.Members);

  return (
    <div className="flex h-full w-[380px] shrink-0 flex-col border-l border-dash-border bg-dash-bg pb-6 pt-5">
      {/* Back button */}
      <button
        onClick={onClose}
        className="mb-4 flex items-center gap-2 pl-5 text-sm text-dash-text-faded transition-colors hover:text-dash-text-strong"
      >
        <ArrowLeft className="size-4" />
      </button>

      <div className="scrollbar-hidden flex flex-1 flex-col gap-9 overflow-y-auto pl-[120px] pr-3">
        {/* Account section */}
        <div className="flex flex-col gap-2">
          <span className="px-3.5 text-[11px] font-medium uppercase leading-[11px] tracking-[-0.11px] text-dash-text-faded">
            Account
          </span>
          {accountNavItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onTabChange(item.key)}
              className={cn(
                navItemBase,
                activeTab === item.key
                  ? "bg-dash-bg-elevated text-dash-text-strong"
                  : "text-dash-text-body hover:bg-dash-bg-elevated",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Reach Us section */}
        <div className="flex flex-col gap-2">
          <span className="px-3.5 text-[11px] font-medium uppercase leading-[11px] tracking-[-0.11px] text-dash-text-faded">
            Reach Us
          </span>
          {reachUsNav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={cn(
                navItemBase,
                "text-dash-text-body hover:bg-dash-bg-elevated",
              )}
            >
              <span className="text-sm">{item.emoji}</span>
              {item.label}
            </a>
          ))}
        </div>

        {/* About section */}
        <div className="flex flex-col gap-2">
          <span className="px-3.5 text-[11px] font-medium uppercase leading-[11px] tracking-[-0.11px] text-dash-text-faded">
            About
          </span>
          {aboutNav.map((item) => (
            <button
              key={item.label}
              className={cn(
                navItemBase,
                "text-dash-text-body hover:bg-dash-bg-elevated",
              )}
            >
              <span className="text-sm">{item.emoji}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <div className="pl-[120px] pr-3 pt-4">
        <button
          onClick={() => {
            void onSignOut?.();
          }}
          disabled={isSigningOut}
          className={cn(
            navItemBase,
            "shrink-0 text-dash-text-body hover:bg-dash-bg-elevated",
          )}
        >
          <span className="text-sm">⛳️</span>
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </div>
  );
}

export function UserProfileDrawer({
  open,
  onOpenChange,
  initialSnapshot = null,
  initialWorkspaceTeamMembers = null,
  initialPaymentMethods = null,
  initialInvoices = null,
  requestedTab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSnapshot?: SettingsSidebarSnapshot | null;
  initialWorkspaceTeamMembers?: TeamDetails | null;
  initialPaymentMethods?: PaymentMethod[] | null;
  initialInvoices?: any;
  requestedTab?: ProfileTab;
}) {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const logout = useServerFn(logoutServerFn);
  const getSettingsSnapshot = useServerFn(
    getSettingsSidebarSnapshotServerFn as any,
  ) as (args?: {
    data?: { workspace?: string };
  }) => Promise<SettingsSidebarSnapshot>;
  const getWorkspaceTeamMembers = useServerFn(
    getWorkspaceTeamMembersServerFn as any,
  ) as (args: { data: { workspace: string } }) => Promise<TeamDetails>;
  const updateWorkspaceTeamProfile = useServerFn(
    updateWorkspaceTeamProfileServerFn as any,
  ) as (args: {
    data: {
      workspace: string;
      name: string;
      description?: string;
      avatarUrl?: string;
    };
  }) => Promise<{ ok: true }>;
  const updateProfile = useServerFn(
    updateSettingsProfileServerFn as any,
  ) as (args: {
    data: {
      firstName: string;
      lastName: string;
      username: string;
      avatarUrl?: string;
    };
  }) => Promise<SettingsSidebarSnapshot["profile"]>;
  const requestEmailVerification = useServerFn(
    requestSettingsEmailVerificationServerFn as any,
  ) as (args: { data: { email: string } }) => Promise<{ ok: true }>;
  const updateNotifications = useServerFn(
    updateSettingsNotificationsServerFn as any,
  ) as (args: {
    data: { email: boolean; mute: boolean };
  }) => Promise<{ ok: true }>;
  const updateBuilds = useServerFn(
    updateSettingsBuildsServerFn as any,
  ) as (args: {
    data: { buildDisabled: boolean; workspace?: string };
  }) => Promise<{ ok: true }>;
  const createApiKey = useServerFn(createSettingsApiKeyServerFn);
  const resetApiKey = useServerFn(resetSettingsApiKeyServerFn);
  const disconnectGitProvider = useServerFn(
    disconnectGitProviderServerFn as any,
  ) as (args: { data: { provider: string } }) => Promise<{ ok: true }>;
  const listGithubAccounts = useServerFn(listGithubAccountsServerFn);
  const [isGithubConnected, setIsGithubConnected] = useState<boolean | null>(null);
  const decryptApiKey = useServerFn(
    decryptSettingsApiKeyServerFn as any,
  ) as (args: { data: { encryptedApiKey: string } }) => Promise<string | null>;
  const updateWebhooks = useServerFn(
    updateSettingsWebhooksServerFn as any,
  ) as (args: {
    data: {
      webhookUrl: string | null;
      discordUrl: string | null;
      slackUrl: string | null;
      events: string[];
    };
  }) => Promise<SettingsSidebarSnapshot["webhooks"]>;
  const testWebhook = useServerFn(
    testSettingsWebhookServerFn as any,
  ) as (args: {
    data: { url: string; type: "discord" | "slack" | "custom" };
  }) => Promise<{ ok: true }>;
  const [activeTab, setActiveTab] = useState<ProfileTab>(ProfileTab.Profile);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [snapshot, setSnapshot] = useState<SettingsSidebarSnapshot | null>(
    initialSnapshot,
  );
  const [workspaceTeamMembersCache, setWorkspaceTeamMembersCache] = useState<
    Record<string, TeamDetails>
  >({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const activeWorkspaceSlug = (() => {
    const params = new URLSearchParams(searchStr || "");
    const workspace = params.get("workspace");
    const normalized = workspace?.trim();
    return normalized ? normalized : null;
  })();
  const hasActiveWorkspace = Boolean(activeWorkspaceSlug);
  const workspaceTeam = activeWorkspaceSlug
    ? (workspaceTeamMembersCache[activeWorkspaceSlug] ?? null)
    : null;

  const profile = mapSettingsSnapshotToDrawerProfile(snapshot);

  useEffect(() => {
    if (initialSnapshot) {
      setSnapshot(initialSnapshot);
    }
  }, [initialSnapshot]);

  useEffect(() => {
    if (!activeWorkspaceSlug || !initialWorkspaceTeamMembers) {
      return;
    }

    setWorkspaceTeamMembersCache((prev) => {
      if (prev[activeWorkspaceSlug]) {
        return prev;
      }

      return {
        ...prev,
        [activeWorkspaceSlug]: initialWorkspaceTeamMembers,
      };
    });
  }, [activeWorkspaceSlug, initialWorkspaceTeamMembers]);

  const refreshSettings = async () => {
    setIsLoadingSettings(true);
    setSettingsError(null);

    try {
      const nextSnapshot = await getSettingsSnapshot({
        data: { workspace: activeWorkspaceSlug || undefined },
      } as any);
      setSnapshot(nextSnapshot);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load settings";
      setSettingsError(message);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    if (snapshot) {
      return;
    }

    void refreshSettings();
  }, [open, snapshot]);

  useEffect(() => {
    if (!open || isGithubConnected !== null) {
      return;
    }

    listGithubAccounts()
      .then((accounts) => {
        setIsGithubConnected(Array.isArray(accounts) && accounts.length > 0);
      })
      .catch(() => {
        setIsGithubConnected(false);
      });
  }, [open]);

  useEffect(() => {
    if (!hasActiveWorkspace && activeTab === ProfileTab.Members) {
      setActiveTab(ProfileTab.Profile);
    }
  }, [activeTab, hasActiveWorkspace]);

  useEffect(() => {
    if (!requestedTab) {
      return;
    }

    if (requestedTab === ProfileTab.Members && !hasActiveWorkspace) {
      setActiveTab(ProfileTab.Profile);
      return;
    }

    setActiveTab(requestedTab);
  }, [requestedTab, hasActiveWorkspace]);

  useEffect(() => {
    if (!activeWorkspaceSlug) {
      return;
    }

    if (workspaceTeamMembersCache[activeWorkspaceSlug]) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const team = await getWorkspaceTeamMembers({
          data: { workspace: activeWorkspaceSlug },
        });
        if (cancelled) {
          return;
        }

        setWorkspaceTeamMembersCache((prev) => ({
          ...prev,
          [activeWorkspaceSlug]: team,
        }));
      } catch {
        // MembersForm handles visible error state if/when user opens the Members tab.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceSlug, getWorkspaceTeamMembers, workspaceTeamMembersCache]);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    invalidateSessionCache();

    try {
      await logout();
    } catch {
      // Ignore logout failures. Cookie clearing is handled server-side.
    } finally {
      onOpenChange(false);
      window.location.replace("/login");
    }
  }

  let drawerTitle: string = activeTab;
  if (activeTab === ProfileTab.Billing) {
    drawerTitle = "Plan & billing";
  } else if (activeTab === ProfileTab.Members) {
    drawerTitle = "Members";
  }

  return (
    <Drawer.Root
      direction="right"
      open={open}
      onOpenChange={onOpenChange}
      noBodyStyles
      modal
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
        <Drawer.Content
          className="fixed right-0 top-0 z-50 flex h-dvh w-[85vw] outline-none"
          aria-describedby={undefined}
        >
          {/* Navigation sidebar */}
          <ProfileNavSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onClose={() => onOpenChange(false)}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
            showMembersTab={hasActiveWorkspace}
          />

          {/* Content area */}
          <div className="scrollbar-hidden flex min-w-0 flex-1 flex-col overflow-y-auto border-l border-dash-border bg-dash-bg">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-dash-border px-8 py-5">
              <Drawer.Title className="text-base font-medium leading-[25px] tracking-[-0.0256px] text-dash-text-strong capitalize">
                {drawerTitle}
              </Drawer.Title>
              <button className="flex size-8 items-center justify-center rounded-full border border-dash-border-soft text-dash-text-faded transition-colors hover:text-dash-text-strong">
                <HelpCircle className="size-4" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 px-8 py-8">
              {settingsError && activeTab !== "members" && (
                <div className="mb-4 rounded-[6px] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
                  {settingsError}
                </div>
              )}
              {isLoadingSettings && !snapshot && activeTab !== "members" ? (
                <div className="text-sm text-dash-text-faded">
                  Loading settings…
                </div>
              ) : null}
              {activeTab === ProfileTab.Profile &&
                hasActiveWorkspace &&
                workspaceTeam && (
                <WorkspaceProfileForm
                  team={workspaceTeam}
                  isSaving={isSavingProfile}
                  onSave={async (data) => {
                    if (!activeWorkspaceSlug) {
                      return;
                    }

                    setIsSavingProfile(true);
                    try {
                      await updateWorkspaceTeamProfile({
                        data: {
                          workspace: activeWorkspaceSlug,
                          name: data.name,
                          description: data.description,
                          avatarUrl: data.avatarUrl,
                        },
                      });

                      setWorkspaceTeamMembersCache((prev) => ({
                        ...prev,
                        [activeWorkspaceSlug]: {
                          ...workspaceTeam,
                          name: data.name,
                          description: data.description || "",
                          avatarUrl: data.avatarUrl,
                        },
                      }));

                      toast.success("Workspace profile updated");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to update workspace profile",
                      );
                    } finally {
                      setIsSavingProfile(false);
                    }
                  }}
                  onBuildsChange={async (enabled) => {
                    if (!activeWorkspaceSlug) {
                      return;
                    }

                    await updateBuilds({
                      data: {
                        workspace: activeWorkspaceSlug,
                        buildDisabled: !enabled,
                      },
                    });

                    setWorkspaceTeamMembersCache((prev) => ({
                      ...prev,
                      [activeWorkspaceSlug]: {
                        ...workspaceTeam,
                        buildDisabled: !enabled,
                      },
                    }));
                  }}
                />
              )}
              {activeTab === ProfileTab.Profile &&
                hasActiveWorkspace &&
                !workspaceTeam && (
                <div className="text-sm text-dash-text-faded">
                  Loading workspace profile…
                </div>
              )}
              {activeTab === ProfileTab.Profile && !hasActiveWorkspace && profile && (
                <ProfileForm
                  profile={profile}
                  isSaving={isSavingProfile}
                  onSave={async (data) => {
                    setIsSavingProfile(true);
                    try {
                      const updated = await updateProfile({ data });
                      setSnapshot((prev) => {
                        if (!prev) {
                          return prev;
                        }

                        return {
                          ...prev,
                          profile: {
                            ...prev.profile,
                            firstName: updated.firstName,
                            lastName: updated.lastName,
                            username: updated.username,
                            avatarUrl: updated.avatarUrl,
                          },
                        };
                      });
                      toast.success("Profile updated");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to update profile",
                      );
                    } finally {
                      setIsSavingProfile(false);
                    }
                  }}
                  onChangeEmail={async (email) => {
                    try {
                      await requestEmailVerification({ data: { email } });
                      toast.success("Verification email sent");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to send verification email",
                      );
                    }
                  }}
                  onBuildsChange={async (enabled) => {
                    try {
                      await updateBuilds({ data: { buildDisabled: !enabled } });
                      setSnapshot((prev) => {
                        if (!prev) {
                          return prev;
                        }

                        return {
                          ...prev,
                          profile: {
                            ...prev.profile,
                            buildDisabled: !enabled,
                          },
                        };
                      });
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to update build settings",
                      );
                      throw error;
                    }
                  }}
                  onCreateApiKey={async () => {
                    try {
                      const result = await createApiKey();
                      const apiKeyValue = result.apiKey;

                      if (apiKeyValue) {
                        setSnapshot((prev) => {
                          if (!prev) {
                            return prev;
                          }

                          return {
                            ...prev,
                            profile: {
                              ...prev.profile,
                              apiKey: apiKeyValue,
                            },
                          };
                        });
                        toast.success("API key created");
                      }

                      return apiKeyValue;
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to create API key",
                      );
                      return undefined;
                    }
                  }}
                  onResetApiKey={async () => {
                    try {
                      const result = await resetApiKey();
                      const apiKeyValue = result.apiKey;

                      if (apiKeyValue) {
                        setSnapshot((prev) => {
                          if (!prev) {
                            return prev;
                          }

                          return {
                            ...prev,
                            profile: {
                              ...prev.profile,
                              apiKey: apiKeyValue,
                            },
                          };
                        });
                        toast.success("API key reset");
                      }

                      return apiKeyValue;
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to reset API key",
                      );
                      return undefined;
                    }
                  }}
                  onDecryptApiKey={async (encryptedApiKey) => {
                    try {
                      return await decryptApiKey({ data: { encryptedApiKey } });
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to decrypt API key",
                      );
                      return null;
                    }
                  }}
                  isGithubConnected={isGithubConnected ?? true}
                  onDisconnectGithub={async () => {
                    try {
                      await disconnectGitProvider({ data: { provider: "github" } });
                      setIsGithubConnected(false);
                      window.dispatchEvent(new Event("brimble:git-connection-changed"));
                      toast.success("GitHub disconnected successfully");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to disconnect GitHub",
                      );
                    }
                  }}
                  onConnectGithub={() => {
                    const popup = window.open(
                      "https://github.com/apps/brimble-build/installations/new",
                      "_blank",
                      "width=900,height=760",
                    );

                    if (!popup) {
                      toast.error("Popup blocked. Please allow popups and try again.");
                      return;
                    }

                    toast.success("Complete the GitHub installation in the popup, then refresh.");
                    setIsGithubConnected(null);
                    // Poll for connection
                    const interval = window.setInterval(async () => {
                      try {
                        const accounts = await listGithubAccounts();
                        if (Array.isArray(accounts) && accounts.length > 0) {
                          setIsGithubConnected(true);
                          window.clearInterval(interval);
                          window.dispatchEvent(new Event("brimble:git-connection-changed"));
                          toast.success("GitHub connected successfully");
                        }
                      } catch {}
                    }, 3000);
                    // Stop polling after 90s
                    window.setTimeout(() => {
                      window.clearInterval(interval);
                      if (isGithubConnected === null) {
                        setIsGithubConnected(false);
                      }
                    }, 90_000);
                  }}
                  onRequestDeleteAccountOtp={async () => {
                    toast.success("Verification code sent to your email");
                  }}
                  onVerifyDeleteAccountOtp={async (code) => {
                    if (code.trim().length !== 6) {
                      throw new Error("Enter a valid 6-digit code");
                    }
                  }}
                  onDeleteAccount={async () => {
                    toast.success("Account deletion requested");
                  }}
                />
              )}
              {activeTab === ProfileTab.Profile &&
                !hasActiveWorkspace &&
                !profile &&
                !isLoadingSettings && (
                <div className="text-sm text-dash-text-faded">
                  Profile settings are unavailable right now.
                </div>
              )}
              {activeTab === ProfileTab.Members && activeWorkspaceSlug && (
                <MembersForm
                  workspace={activeWorkspaceSlug}
                  initialTeam={
                    workspaceTeamMembersCache[activeWorkspaceSlug] ?? null
                  }
                  currentUser={
                    profile
                      ? { uniqueId: profile.uniqueId, email: profile.email }
                      : null
                  }
                />
              )}
              {activeTab === ProfileTab.Notifications && profile && (
                <NotificationsForm
                  profile={profile}
                  webhooks={snapshot?.webhooks}
                  onTestWebhook={async (url, type) => {
                    try {
                      await testWebhook({ data: { url, type } });
                      toast.success("Test webhook sent successfully");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to send test webhook",
                      );
                    }
                  }}
                  onSave={async (data) => {
                    try {
                      await updateNotifications({
                        data: {
                          email: data.emailNotifications,
                          mute: data.mute,
                        },
                      });
                      const nextWebhooks = await updateWebhooks({
                        data: {
                          webhookUrl: data.webhookUrl,
                          discordUrl: data.discordUrl,
                          slackUrl: data.slackUrl,
                          events: data.events,
                        },
                      });

                      setSnapshot((prev) => {
                        if (!prev) {
                          return prev;
                        }

                        return {
                          ...prev,
                          profile: {
                            ...prev.profile,
                            notifications: {
                              ...prev.profile.notifications,
                              email: data.emailNotifications,
                              mute: data.mute,
                            },
                          },
                          webhooks: nextWebhooks,
                        };
                      });

                      toast.success("Notification settings saved");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to save notification settings",
                      );
                    }
                  }}
                />
              )}
              {activeTab === ProfileTab.Notifications &&
                !profile &&
                !isLoadingSettings && (
                  <div className="text-sm text-dash-text-faded">
                    Notification settings are unavailable right now.
                  </div>
                )}
              {activeTab === ProfileTab.Billing && profile && hasActiveWorkspace && !workspaceTeam && (
                <div className="text-sm text-dash-text-faded">
                  Loading workspace billing…
                </div>
              )}
              {activeTab === ProfileTab.Billing && profile && (!hasActiveWorkspace || workspaceTeam) && (
                <BillingForm
                  profile={profile}
                  initialPaymentMethods={initialPaymentMethods}
                  initialInvoices={hasActiveWorkspace ? undefined : initialInvoices}
                  initialSpendingStats={snapshot?.billing.spending}
                  hidePaymentMethods={hasActiveWorkspace}
                  hideCurrentPlan={hasActiveWorkspace}
                  teamId={hasActiveWorkspace ? workspaceTeam?.id : undefined}
                  workspaceTeam={hasActiveWorkspace ? workspaceTeam : undefined}
                  onSpendingLimitSaved={async () => {
                    await refreshSettings();

                    if (!activeWorkspaceSlug) {
                      return;
                    }

                    try {
                      const nextTeam = await getWorkspaceTeamMembers({
                        data: { workspace: activeWorkspaceSlug },
                      });

                      setWorkspaceTeamMembersCache((prev) => ({
                        ...prev,
                        [activeWorkspaceSlug]: nextTeam,
                      }));
                    } catch {
                      // Keep the current cached team state if refresh fails.
                    }
                  }}
                />
              )}
              {activeTab === ProfileTab.Billing && !profile && !isLoadingSettings && (
                <div className="text-sm text-dash-text-faded">
                  Billing settings are unavailable right now.
                </div>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-[#006fff]" : "bg-[#f2f4f7] dark:bg-[#3a3a3c]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-[0px_1px_3px_rgba(16,24,40,0.1),0px_1px_2px_rgba(16,24,40,0.06)] transition-transform",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}

function NotificationRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
          {title}
        </span>
        <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
          {description}
        </span>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}
void NotificationRow;



/* ── Event notification data ── */

interface EventItem {
  key: string;
  title: string;
  description: string;
}

interface EventGroup {
  key: string;
  title: string;
  icon?: string;
  events: EventItem[];
}

const eventGroups: EventGroup[] = [
  {
    key: "domain",
    title: "Domain Events",
    icon: "/icons/domains.svg",
    events: [
      {
        key: "domain_purchased",
        title: "Domain Purchased",
        description: "Notify when a domain is purchased successfully",
      },
      {
        key: "domain_created",
        title: "Domain Created",
        description: "Notify when a domain is created in the system",
      },
      {
        key: "domain_renewed",
        title: "Domain Renewed",
        description: "Notify when a domain is renewed successfully",
      },
      {
        key: "domain_expired",
        title: "Domain Expired",
        description: "Notify when a domain expires",
      },
    ],
  },
  {
    key: "deployment",
    title: "Deployment Events",
    icon: "/icons/project.svg",
    events: [
      {
        key: "deployment_failed",
        title: "Deployment Failed",
        description: "Notify when deployments fail or encounter errors",
      },
      {
        key: "deployment_started",
        title: "Deployment Started",
        description: "Notify when deployments are initiated",
      },
      {
        key: "project_domain_updated",
        title: "Project Domain Updated",
        description: "Notify when a project domain has been updated",
      },
      {
        key: "deployment_created",
        title: "Deployment Created",
        description: "Notify when deployments are initiated",
      },
    ],
  },
  {
    key: "payment",
    title: "Payment Events",
    icon: "/icons/payment.svg",
    events: [
      {
        key: "payment_successful",
        title: "Payment Successful",
        description: "Notify when payment is processed successfully",
      },
      {
        key: "payment_failed",
        title: "Payment Failed",
        description: "Notify when payment fails",
      },
    ],
  },
  {
    key: "database",
    title: "Database Events",
    icon: "/icons/integrations.svg",
    events: [
      {
        key: "database_created",
        title: "Database Created",
        description: "Notify when a database is created",
      },
      {
        key: "database_backup_completed",
        title: "Database Backup Completed",
        description: "Notify when database backup completes",
      },
    ],
  },
  {
    key: "env",
    title: "Env Events",
    icon: "/icons/settings.svg",
    events: [
      {
        key: "env_added",
        title: "Environment Variables Added",
        description: "Notify when environment variables have been added",
      },
      {
        key: "env_updated",
        title: "Environment Variables Updated",
        description: "Notify when environment variables have been updated",
      },
      {
        key: "env_deleted",
        title: "Environment Variables Deleted",
        description: "Notify when environment variables have been deleted",
      },
    ],
  },
  {
    key: "dns",
    title: "DNS Events",
    icon: "/icons/discover.svg",
    events: [
      {
        key: "dns_record_created",
        title: "DNS Record Created",
        description: "Notify when a DNS record has been created",
      },
      {
        key: "dns_record_updated",
        title: "DNS Record Updated",
        description: "Notify when a DNS record has been updated",
      },
      {
        key: "dns_record_deleted",
        title: "DNS Record Deleted",
        description: "Notify when a DNS record has been deleted",
      },
    ],
  },
];

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex size-[14px] shrink-0 items-center justify-center rounded-[3px] border shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] transition-colors ${
        checked
          ? "border-[#4879f8] bg-[#4879f8]"
          : "border-transparent bg-dash-bg dark:border-white/20 dark:bg-transparent"
      }`}
    >
      {checked && (
        <svg
          width="8"
          height="6"
          viewBox="0 0 8 6"
          fill="none"
          className="text-white"
        >
          <path
            d="M1 3L3 5L7 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

function EventGroupCard({
  group,
  groupEnabled,
  onGroupToggle,
  eventStates,
  onEventToggle,
}: {
  group: EventGroup;
  groupEnabled: boolean;
  onGroupToggle: (v: boolean) => void;
  eventStates: Record<string, boolean>;
  onEventToggle: (key: string, v: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const checkedCount = group.events.filter(
    (e) => groupEnabled && (eventStates[e.key] ?? false),
  ).length;

  return (
    <div className="flex flex-col">
      {/* Collapsible header row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2.5 py-3 text-left transition-colors hover:opacity-80"
      >
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex"
        >
          <ChevronDown className="size-3.5 text-dash-text-faded" />
        </motion.span>
        <div className="flex size-7 items-center justify-center rounded-full bg-[#f5a623]/10">
          {group.icon ? (
            <img src={group.icon} alt="" className="size-3.5" />
          ) : (
            <span className="text-[10px] font-semibold text-[#f5a623]">
              {group.title.slice(0, 1)}
            </span>
          )}
        </div>
        <span className="flex-1 text-sm font-normal leading-5 text-dash-text-strong">
          {group.title}
        </span>
        {!expanded ? (
          <span className="text-xs text-dash-text-faded">
            {checkedCount === group.events.length
              ? `${group.events.length} events`
              : `${checkedCount} of ${group.events.length}`}
          </span>
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onGroupToggle(!groupEnabled);
            }}
            className="text-xs text-[#4879f8] hover:underline"
          >
            {groupEnabled ? "Deselect all" : "Select all"}
          </span>
        )}
      </button>

      {/* Expandable event list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0, overflow: "hidden" }}
            animate={{
              opacity: 1,
              height: "auto",
              transitionEnd: { overflow: "visible" },
            }}
            exit={{ overflow: "hidden", opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex flex-col gap-2.5 pb-2 pl-[50px]">
              {group.events.map((event) => (
                <label
                  key={event.key}
                  title={event.description}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <Checkbox
                    checked={groupEnabled && (eventStates[event.key] ?? false)}
                    onChange={(v) => onEventToggle(event.key, v)}
                  />
                  <span className="text-sm font-light text-dash-text-body">
                    {event.title}
                  </span>
                </label>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotificationsForm({
  profile,
  webhooks,
  onTestWebhook,
  onSave,
}: {
  profile: UserProfile;
  webhooks?: {
    webhookUrl: string;
    discordUrl: string;
    slackUrl: string;
    groups: ServerWebhookGroup[];
  };
  onTestWebhook?: (
    url: string,
    type: "discord" | "slack" | "custom",
  ) => Promise<void> | void;
  onSave?: (data: {
    emailNotifications: boolean;
    mute: boolean;
    webhookUrl: string | null;
    discordUrl: string | null;
    slackUrl: string | null;
    events: string[];
  }) => Promise<void> | void;
}) {
  const [emailNotifs, setEmailNotifs] = useState(
    profile.notifications?.email ?? false,
  );
  const [discordUrl, setDiscordUrl] = useState(webhooks?.discordUrl ?? "");
  const [slackUrl, setSlackUrl] = useState(webhooks?.slackUrl ?? "");
  const [webhookUrl, setWebhookUrl] = useState(webhooks?.webhookUrl ?? "");
  const [allEvents, setAllEvents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  async function handleTestWebhook(
    url: string,
    type: "discord" | "slack" | "custom",
  ) {
    if (!url.trim()) return;
    setTestingWebhook(type);
    try {
      await onTestWebhook?.(url.trim(), type);
    } finally {
      setTestingWebhook(null);
    }
  }

  // Group-level toggles
  const [groupToggles, setGroupToggles] = useState<Record<string, boolean>>({});
  // Individual event toggles
  const [eventToggles, setEventToggles] = useState<Record<string, boolean>>({});

  const groupsForUi: EventGroup[] =
    webhooks?.groups.map((group) => ({
      key: group.title.toLowerCase().replace(/\s+/g, "_"),
      title: group.title,
      events: group.events.map((event) => ({
        key: event.key,
        title: event.label || event.key,
        description: event.description || "",
      })),
    })) ?? eventGroups;

  useEffect(() => {
    setEmailNotifs(profile.notifications?.email ?? false);
  }, [profile.notifications?.email]);

  useEffect(() => {
    setWebhookUrl(webhooks?.webhookUrl ?? "");
    setDiscordUrl(webhooks?.discordUrl ?? "");
    setSlackUrl(webhooks?.slackUrl ?? "");

    const nextEvents: Record<string, boolean> = {};
    const nextGroups: Record<string, boolean> = {};
    const sourceGroups = webhooks?.groups ?? [];

    for (const group of sourceGroups) {
      const groupKey = group.title.toLowerCase().replace(/\s+/g, "_");
      let allEnabled = true;

      for (const event of group.events) {
        nextEvents[event.key] = Boolean(event.enabled);
        if (!event.enabled) {
          allEnabled = false;
        }
      }

      nextGroups[groupKey] = allEnabled;
    }

    setEventToggles(nextEvents);
    setGroupToggles(nextGroups);
  }, [webhooks]);

  function handleAllEventsToggle(v: boolean) {
    setAllEvents(v);
    if (v) {
      const groups: Record<string, boolean> = {};
      const events: Record<string, boolean> = {};
      for (const g of groupsForUi) {
        groups[g.key] = true;
        for (const e of g.events) events[e.key] = true;
      }
      setGroupToggles(groups);
      setEventToggles(events);
    } else {
      setGroupToggles({});
      setEventToggles({});
    }
  }

  function handleGroupToggle(groupKey: string, v: boolean) {
    setGroupToggles((prev) => ({ ...prev, [groupKey]: v }));
    const group = groupsForUi.find((g) => g.key === groupKey);
    if (group) {
      setEventToggles((prev) => {
        const next = { ...prev };
        for (const e of group.events) next[e.key] = v;
        return next;
      });
    }
  }

  function handleEventToggle(key: string, v: boolean) {
    setEventToggles((prev) => ({ ...prev, [key]: v }));
  }

  const enabledCount = Object.values(eventToggles).filter(Boolean).length;
  const totalCount = groupsForUi.reduce((s, g) => s + g.events.length, 0);

  useEffect(() => {
    if (totalCount === 0) {
      setAllEvents(false);
      return;
    }

    if (enabledCount === totalCount) {
      setAllEvents(true);
      return;
    }

    setAllEvents(false);
  }, [enabledCount, totalCount]);

  const inputClass =
    "w-full input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]";

  const { webhookEnabled } = usePlanGate();

  return (
    <div className="flex flex-col gap-[30px]">
      {/* Email notifications */}
      <div className="flex max-w-[488px] items-center justify-between">
        <div className="flex items-center gap-[18px]">
          <div className="flex shrink-0 items-center justify-center">
            <img src="/icons/email-settings.svg" alt="" className="size-12" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
              Email notifications
            </span>
            <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
              Get alerts sent directly to your email address
            </span>
          </div>
        </div>
        <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
      </div>

      <hr className="-ml-8 border-dash-border-soft" />

      {!webhookEnabled ? (
        <div className="flex max-w-[488px] flex-col gap-3">
          <span className="text-sm font-medium leading-5 text-dash-text-strong">
            Webhooks & Event Notifications
          </span>
          <p className="text-sm leading-5 text-dash-text-faded">
            Configure webhook integrations (Discord, Slack, custom) and fine-grained event notifications by upgrading to a paid plan.
          </p>
        </div>
      ) : (
        <>
          {/* Webhook URLs */}
          <div className="flex max-w-[488px] flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
                Discord webhook URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={discordUrl}
                  onChange={(e) => setDiscordUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className={cn(inputClass, "flex-1")}
                />
                <button
                  onClick={() => handleTestWebhook(discordUrl, "discord")}
                  disabled={!discordUrl.trim() || testingWebhook === "discord"}
                  className="flex h-[40px] shrink-0 items-center gap-1.5 rounded-[6px] border border-dash-border bg-dash-bg px-3 text-sm font-medium text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:pointer-events-none disabled:opacity-40"
                >
                  <Send className="size-3.5" />
                  {testingWebhook === "discord" ? "Sending..." : "Test"}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
                Slack webhook URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={slackUrl}
                  onChange={(e) => setSlackUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className={cn(inputClass, "flex-1")}
                />
                <button
                  onClick={() => handleTestWebhook(slackUrl, "slack")}
                  disabled={!slackUrl.trim() || testingWebhook === "slack"}
                  className="flex h-[40px] shrink-0 items-center gap-1.5 rounded-[6px] border border-dash-border bg-dash-bg px-3 text-sm font-medium text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:pointer-events-none disabled:opacity-40"
                >
                  <Send className="size-3.5" />
                  {testingWebhook === "slack" ? "Sending..." : "Test"}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
                Custom webhook URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className={cn(inputClass, "flex-1")}
                />
                <button
                  onClick={() => handleTestWebhook(webhookUrl, "custom")}
                  disabled={!webhookUrl.trim() || testingWebhook === "custom"}
                  className="flex h-[40px] shrink-0 items-center gap-1.5 rounded-[6px] border border-dash-border bg-dash-bg px-3 text-sm font-medium text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:pointer-events-none disabled:opacity-40"
                >
                  <Send className="size-3.5" />
                  {testingWebhook === "custom" ? "Sending..." : "Test"}
                </button>
              </div>
            </div>
          </div>

          <hr className="-ml-8 border-dash-border-soft" />

          {/* Event Notifications */}
          <div className="flex max-w-[488px] flex-col gap-2">
            {/* Section header */}
            <div className="flex items-center justify-between pb-1">
              <span className="text-sm font-medium leading-5 tracking-[-0.0224px] text-dash-text-strong">
                Event Notifications
              </span>
              <span className="text-[13px] text-dash-text-faded">
                {enabledCount === totalCount
                  ? "All events enabled"
                  : `${enabledCount} of ${totalCount} enabled`}
              </span>
            </div>

            {/* All Events */}
            <div className="flex items-center py-2">
              <div className="flex items-center gap-2.5">
                <Checkbox checked={allEvents} onChange={handleAllEventsToggle} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-5 text-dash-text-strong">
                    All Events
                  </span>
                  <span className="text-[13px] leading-5 text-dash-text-faded">
                    Subscribe to all current and future events
                  </span>
                </div>
              </div>
            </div>

            <hr className="border-dash-border-soft" />

            {/* Event groups */}
            <div className="flex flex-col pt-1">
              {groupsForUi.map((group, i) => (
                <div key={group.key}>
                  <EventGroupCard
                    group={group}
                    groupEnabled={groupToggles[group.key] ?? false}
                    onGroupToggle={(v) => handleGroupToggle(group.key, v)}
                    eventStates={eventToggles}
                    onEventToggle={handleEventToggle}
                  />
                  {i < groupsForUi.length - 1 && (
                    <hr className="border-dash-border-soft" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Save */}
      <div className="flex max-w-[488px] justify-end pt-4">
        <GlossyButton
          className="px-6"
          disabled={isSaving}
          loading={isSaving}
          loadingLabel="Saving..."
          onClick={async () => {
            const selectedEvents = !webhookEnabled
              ? []
              : Object.entries(eventToggles)
                  .filter(([, enabled]) => enabled)
                  .map(([key]) => key);

            setIsSaving(true);

            try {
              await onSave?.({
                emailNotifications: emailNotifs,
                mute: profile.notifications?.mute ?? false,
                webhookUrl: !webhookEnabled ? null : (webhookUrl.trim() || null),
                discordUrl: !webhookEnabled ? null : (discordUrl.trim() || null),
                slackUrl: !webhookEnabled ? null : (slackUrl.trim() || null),
                events: selectedEvents,
              });
            } finally {
              setIsSaving(false);
            }
          }}
        >
          Save Settings
        </GlossyButton>
      </div>
    </div>
  );
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: "Creator" | "Administrator" | "Member";
  gradient?: string;
  avatarUrl?: string;
  userId?: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  sentAt: string;
}

const roleBadgeStyles: Record<string, string> = {
  Creator: "bg-[#4879f8]/10 text-[#4879f8]",
  Administrator: "bg-[#f5a623]/10 text-[#f5a623]",
  Member: "bg-dash-bg-elevated text-dash-text-faded",
};

function normalizeMemberRole(member: TeamMember): Member["role"] {
  if (member.isCreator) return "Creator";

  const role = (member.role ?? "").toLowerCase();
  if (role.includes("admin")) return "Administrator";
  if (role.includes("creator") || role.includes("owner")) return "Creator";
  return "Member";
}

function buildAvatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }

  const hue = Math.abs(hash) % 360;
  const hue2 = (hue + 28) % 360;
  const hue3 = (hue + 52) % 360;

  return `radial-gradient(circle at 62% 30%, hsl(${hue} 95% 88%), hsl(${hue2} 82% 72%) 28%, hsl(${hue3} 74% 58%) 68%, hsl(${hue3} 74% 46%))`;
}

function formatRelativeInviteTime(input?: string) {
  if (!input) return "recently";
  const timestamp = Date.parse(input);
  if (!Number.isFinite(timestamp)) return "recently";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60_000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12)
    return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}

function mapActiveMembers(team?: TeamDetails | null): Member[] {
  if (!team?.members?.length) return [];

  return team.members
    .filter((member) => member.accepted !== false)
    .map((member) => {
      const name =
        [member.firstName, member.lastName].filter(Boolean).join(" ").trim() ||
        member.username ||
        member.email;
      const role = normalizeMemberRole(member);
      return {
        id: member.id,
        name,
        email: member.email,
        role,
        avatarUrl: member.avatarUrl,
        gradient: buildAvatarGradient(member.email || name || member.id),
        userId: member.userId,
      } satisfies Member;
    });
}

function mapPendingInvites(team?: TeamDetails | null): PendingInvite[] {
  if (!team?.members?.length) return [];

  return team.members
    .filter((member) => member.accepted === false)
    .map((member) => ({
      id: member.id,
      email: member.email,
      role: normalizeMemberRole(member),
      sentAt: formatRelativeInviteTime(
        member.invitedAt ?? member.createdAt ?? member.updatedAt,
      ),
    }));
}

function MemberActionMenu({
  member,
  onRemove,
  removing,
  canChangeRole = false,
  canRemove = false,
}: {
  member: Member;
  onRemove?: (member: Member) => void | Promise<void>;
  removing?: boolean;
  canChangeRole?: boolean;
  canRemove?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!canChangeRole && !canRemove) {
    return null;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="shrink-0 text-dash-text-faded transition-colors hover:text-dash-text-strong"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[160px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-lg">
          {canChangeRole && (
            <button
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
            >
              <Shield className="size-3.5" />
              Change role
            </button>
          )}
          {canRemove && (
            <button
              onClick={() => {
                setOpen(false);
                void onRemove?.(member);
              }}
              disabled={removing}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-500 transition-colors hover:bg-dash-bg-elevated"
            >
              <UserMinus className="size-3.5" />
              {removing ? "Removing..." : "Remove"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MembersForm({
  workspace,
  initialTeam = null,
  currentUser = null,
}: {
  workspace: string;
  initialTeam?: TeamDetails | null;
  currentUser?: Pick<UserProfile, "uniqueId" | "email"> | null;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const pricing = usePricing();
  const getTeamMembers = useServerFn(
    getWorkspaceTeamMembersServerFn as any,
  ) as (args: { data: { workspace: string } }) => Promise<TeamDetails>;
  const inviteTeamMembers = useServerFn(
    inviteWorkspaceTeamMembersServerFn as any,
  ) as (args: {
    data: { workspace: string; members: string[] };
  }) => Promise<{ ok: true }>;
  const resendInvite = useServerFn(
    resendWorkspaceTeamInviteServerFn as any,
  ) as (args: {
    data: { workspace: string; email: string };
  }) => Promise<{ ok: true }>;
  const removeTeamMember = useServerFn(
    removeWorkspaceTeamMemberServerFn as any,
  ) as (args: {
    data: { workspace: string; memberId: string };
  }) => Promise<{ ok: true }>;

  const [team, setTeam] = useState<TeamDetails | null>(initialTeam);
  const [isLoadingMembers, setIsLoadingMembers] = useState(!initialTeam);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [busyMemberAction, setBusyMemberAction] = useState<
    "resend" | "revoke" | "remove" | null
  >(null);

  const members = mapActiveMembers(team);
  const pendingInvites = mapPendingInvites(team);
  const configuredSeats = team?.seatCount ?? 0;
  const billableSeats = Math.max(configuredSeats, members.length);
  const currentUserTeamMember = team?.members.find((member) => {
    const memberUserId = member.userId?.trim();
    const currentUserId = currentUser?.uniqueId?.trim();

    if (memberUserId && currentUserId && memberUserId === currentUserId) {
      return true;
    }

    const memberEmail = member.email.trim().toLowerCase();
    const currentEmail = currentUser?.email?.trim().toLowerCase();
    return Boolean(currentEmail && memberEmail === currentEmail);
  });
  const currentUserRole = currentUserTeamMember
    ? normalizeMemberRole(currentUserTeamMember)
    : null;
  const canManageMembers =
    currentUserRole === "Creator" || currentUserRole === "Administrator";

  const refreshMembers = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoadingMembers(true);
    }
    setMembersError(null);

    try {
      const nextTeam = await getTeamMembers({ data: { workspace } });
      setTeam(nextTeam);
    } catch (error) {
      setMembersError(
        error instanceof Error ? error.message : "Failed to load team members",
      );
    } finally {
      if (!options?.silent) {
        setIsLoadingMembers(false);
      }
    }
  };

  useEffect(() => {
    setTeam(initialTeam);
    setIsLoadingMembers(!initialTeam);
    setMembersError(null);
    void refreshMembers({ silent: Boolean(initialTeam) });
  }, [workspace, initialTeam]);

  return (
    <div className="flex max-w-[488px] flex-col gap-8">
      {/* Invite button */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
            Workspace members
          </span>
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
            Manage who has access to this workspace
          </span>
        </div>
        <GlossyButton
          onClick={() => setInviteOpen(true)}
          className="px-5"
          disabled={!canManageMembers}
          title={
            !canManageMembers
              ? "Only workspace creators and administrators can invite members"
              : undefined
          }
        >
          Invite
        </GlossyButton>
      </div>

      <hr className="-ml-8 border-dash-border-soft" />

      {/* Members list */}
      {membersError ? (
        <div className="rounded-[6px] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
          {membersError}
        </div>
      ) : null}
      {isLoadingMembers ? (
        <div className="text-sm text-dash-text-faded">Loading members…</div>
      ) : (
        <div className="flex flex-col gap-4">
          {members.map((member) => {
            const currentEmail = currentUser?.email?.trim().toLowerCase() ?? "";
            const isSelf =
              (member.userId &&
                currentUser?.uniqueId &&
                member.userId === currentUser.uniqueId) ||
              (currentEmail.length > 0 &&
                member.email.trim().toLowerCase() === currentEmail);
            const canManageTarget =
              canManageMembers && !isSelf && member.role !== "Creator";

            return (
              <div key={member.id} className="flex items-center gap-3">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.name}
                    className="size-8 shrink-0 rounded-full border border-dash-border-soft object-cover"
                  />
                ) : (
                  <div
                    className="size-8 shrink-0 rounded-full"
                    style={{ background: member.gradient }}
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
                    {member.name}
                  </span>
                  <span className="truncate text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
                    {member.email}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    roleBadgeStyles[member.role] ?? roleBadgeStyles.Member
                  }`}
                >
                  {member.role}
                </span>
                <MemberActionMenu
                  member={member}
                  removing={busyMemberId === member.id}
                  canChangeRole={canManageTarget}
                  canRemove={canManageTarget}
                  onRemove={async (target) => {
                    try {
                      setBusyMemberId(target.id);
                      setBusyMemberAction("remove");
                      await removeTeamMember({
                        data: { workspace, memberId: target.id },
                      });
                      toast.success("Member removed");
                      await refreshMembers();
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to remove member",
                      );
                    } finally {
                      setBusyMemberId(null);
                      setBusyMemberAction(null);
                    }
                  }}
                />
              </div>
            );
          })}
          {!members.length && (
            <div className="text-sm text-dash-text-faded">
              No workspace members found.
            </div>
          )}
        </div>
      )}

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <>
          <hr className="-ml-8 border-dash-border-soft" />
          <div className="flex flex-col gap-4">
            <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
              Pending invitations
            </span>
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-dash-bg-elevated">
                  <span className="text-xs text-dash-text-extra-faded">
                    {invite.email[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
                    {invite.email}
                  </span>
                  <span className="text-xs leading-4 text-dash-text-extra-faded">
                    Sent {invite.sentAt}
                  </span>
                </div>
                <span className="shrink-0 rounded-full bg-[#f5a623]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#f5a623]">
                  Pending
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {canManageMembers && (
                    <button
                      onClick={async () => {
                        try {
                          setBusyMemberId(invite.id);
                          setBusyMemberAction("resend");
                          await resendInvite({
                            data: { workspace, email: invite.email },
                          });
                          toast.success("Invitation resent");
                          await refreshMembers();
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Failed to resend invite",
                          );
                        } finally {
                          setBusyMemberId(null);
                          setBusyMemberAction(null);
                        }
                      }}
                      disabled={busyMemberId === invite.id}
                      className="inline-flex items-center gap-1 text-xs text-[#4879f8] transition-colors hover:text-[#3a6ae6] disabled:opacity-50"
                    >
                      {busyMemberId === invite.id &&
                        busyMemberAction === "resend" && (
                          <span className="size-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                        )}
                      {busyMemberId === invite.id &&
                      busyMemberAction === "resend"
                        ? "Resending..."
                        : "Resend"}
                    </button>
                  )}
                  {canManageMembers && (
                    <button
                      onClick={async () => {
                        try {
                          setBusyMemberId(invite.id);
                          setBusyMemberAction("revoke");
                          await removeTeamMember({
                            data: { workspace, memberId: invite.id },
                          });
                          toast.success("Invitation revoked");
                          await refreshMembers();
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Failed to revoke invitation",
                          );
                        } finally {
                          setBusyMemberId(null);
                          setBusyMemberAction(null);
                        }
                      }}
                      disabled={busyMemberId === invite.id}
                      className="inline-flex items-center gap-1 text-xs text-dash-text-faded transition-colors hover:text-red-500 disabled:opacity-50"
                    >
                      {busyMemberId === invite.id &&
                        busyMemberAction === "revoke" && (
                          <span className="size-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                        )}
                      {busyMemberId === invite.id &&
                      busyMemberAction === "revoke"
                        ? "Revoking..."
                        : "Revoke"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <hr className="-ml-8 border-dash-border-soft" />

      {/* Seat cost summary */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-[2px]">
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
            Seat usage
          </span>
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
            {billableSeats} seats &times;{" "}
            {formatUsdMonthly(pricing.team.costPerMember)}/seat/month
          </span>
          <span className="text-xs leading-4 tracking-[-0.02px] text-dash-text-extra-faded">
            Team billing also includes concurrent builds at{" "}
            {formatUsdMonthly(pricing.team.costPerBuild)}/build/month.
          </span>
        </div>
        <span className="text-lg font-medium text-dash-text-strong">
          {formatUsdMonthly(billableSeats * pricing.team.costPerMember)}/mo
        </span>
      </div>

      <InviteMembersModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        currentSeats={billableSeats}
        onInvite={async (emails) => {
          await inviteTeamMembers({ data: { workspace, members: emails } });
          toast.success(
            `Sent ${emails.length} invitation${emails.length === 1 ? "" : "s"}`,
          );
          await refreshMembers();
        }}
      />
    </div>
  );
}
