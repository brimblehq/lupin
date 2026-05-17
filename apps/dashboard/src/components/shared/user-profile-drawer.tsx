import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Drawer } from "vaul";
import { cn } from "@brimble/ui";
import { SUBSCRIPTION_PLAN_TYPE } from "@brimble/models/dist/enum";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  HelpCircle,
  MoreHorizontal,
  Shield,
  TriangleAlert,
  UserMinus,
  Eye,
  EyeOff,
  RefreshCw,
  Send,
} from "lucide-react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics, setHapticsEnabled } from "@/hooks/use-haptics";
import { invalidateSessionCache } from "@/lib/auth-guards";
import { posthog } from "@/lib/posthog";
import { useFeatureFlag, FeatureFlags } from "@/lib/feature-flags";
import { InviteMembersModal } from "../settings/invite-members-modal";
import { Dropdown } from "./dropdown";
import { dashInputClassName } from "./dash-input";
import { WarningModal } from "./warning-modal";
import { GlossyButton } from "./glossy-button";
import { OtpInput } from "../auth/auth-split-layout";
import { Turnstile } from "@marsidev/react-turnstile";
import { CheckCircle, XCircle, TreeStructure } from "@phosphor-icons/react";
import {
  checkUsernameAvailabilityServerFn,
  confirmDeleteAccountServerFn,
  getTwoFactorStatusServerFn,
  listPasskeysServerFn,
  logoutServerFn,
  requestDeleteAccountOtpServerFn,
} from "@/server/auth/actions";
import type { PasskeySummary, TwoFactorStatus } from "@/backend/auth/types";
import { listActivityLogsServerFn } from "@/server/activity-logs/actions";
import { listProjectEnvironmentsServerFn } from "@/server/environments/actions";
import type { ProjectEnvironment } from "@/backend/environments";
import type { ActivityLogsResponse, ActivityLogGroup } from "@/backend/activity-logs";
import {
  createSettingsApiKeyServerFn,
  decryptSettingsApiKeyServerFn,
  disconnectGitProviderServerFn,
  getSettingsSidebarSnapshotServerFn,
  requestSettingsEmailVerificationServerFn,
  resetSettingsApiKeyServerFn,
  testSettingsWebhookServerFn,
  updateSettingsBuildsServerFn,
  updateSettingsHapticsServerFn,
  updateSettingsNotificationsServerFn,
  updateSettingsProfileServerFn,
  updateSettingsWebhooksServerFn,
} from "@/server/settings/actions";
import { BillingForm } from "../settings/billing-form";
import { SecurityForm } from "../settings/security-form";
import { Avatar } from "./avatar";
import { SimpleTooltip } from "./tooltip";
import { usePlanGate } from "@/hooks/use-plan-gate";
import { useTheme } from "@/hooks/use-theme";
import { isPushEnabled, setPushEnabled } from "@/hooks/use-push-notification";
import type { PaymentMethod } from "@/backend/payments";
import {
  getPaymentInvoicesServerFn,
  getPaymentMethodsServerFn,
  getSpendingLimitStatusServerFn,
  getSubscriptionServerFn,
} from "@/server/payments/actions";
import { paymentKeys } from "@/hooks/use-payments";
import {
  getWorkspaceTeamMembersServerFn,
  inviteWorkspaceTeamMembersServerFn,
  removeWorkspaceTeamMemberServerFn,
  resendWorkspaceTeamInviteServerFn,
  updateWorkspaceTeamProfileServerFn,
  updateMemberEnvironmentsServerFn,
  updateMemberRoleServerFn,
  transferOwnershipServerFn,
  toggleTeamTwoFactorEnforcementServerFn,
} from "@/server/teams/actions";
import {
  getBitbucketConnectUrlServerFn,
  getGithubConnectUrlServerFn,
  getGitlabConnectUrlServerFn,
  listBitbucketAccountsServerFn,
  listGithubAccountsServerFn,
  listGitlabAccountsServerFn,
} from "@/server/repositories/actions";
import config from "@/config";
import type { SettingsSidebarSnapshot, SettingsWebhookGroup as ServerWebhookGroup } from "@/backend/settings";
import type { TeamDetails, TeamMember, TeamOwnershipTransfer } from "@/backend/teams";
import { normalizeMemberRole as normalizeRole } from "@/utils/workspace-role";
import { mapSettingsSnapshotToDrawerProfile, maskSecretWithAsterisks, type DrawerUserProfile } from "@/utils/dashboard";
import { formatUsdMonthly } from "@/utils/billing";
import { usePricing } from "@/contexts/pricing-context";
import { useStepUpTwoFactor } from "@/hooks/use-step-up-two-factor";
import { withStepUp } from "@/lib/auth/two-factor-step-up";
import { ToggleSwitch } from "./toggle-switch";
import { ProfileTab, Theme } from "../../types/enums";
import { invalidateActiveMatches } from "@/utils/router-invalidate";
type UserProfile = DrawerUserProfile;

export { ProfileTab };

const accountNav: { label: string; key: ProfileTab }[] = [
  { label: "Profile", key: ProfileTab.Profile },
  { label: "Activity session", key: ProfileTab.ActivitySession },
  { label: "Members", key: ProfileTab.Members },
  { label: "Notifications", key: ProfileTab.Notifications },
  { label: "Security", key: ProfileTab.Security },
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
  { label: "Changelog", emoji: "👥", href: "https://brimble.io/changelog" },
  { label: "Terms and privacy", emoji: "🔔", href: "https://brimble.io/legal" },
];

const navItemBase =
  "flex items-center gap-2 whitespace-nowrap rounded-[4px] px-3.5 py-1.5 text-sm tracking-[-0.0224px] transition-colors w-full cursor-pointer";

function formatActivityTime(value: string): string {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Unknown time";
  }

  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    const mins = Math.max(1, Math.floor(diff / minute));
    return `${mins}m ago`;
  }

  if (diff < day) {
    const hours = Math.max(1, Math.floor(diff / hour));
    return `${hours}h ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatWorkspaceCreatedAt(value?: string): string {
  if (!value) {
    return "Unavailable";
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function ActivitySessionSkeleton() {
  const rows = [0, 1, 2, 3];

  return (
    <div className="py-2" aria-hidden="true">
      <div className="mb-3 h-3 w-12 animate-pulse rounded bg-dash-bg-elevated" />
      <div className="flex flex-col">
        {rows.map((row, index) => (
          <div
            key={row}
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3",
              index !== 0 && "border-t border-dashed border-dash-border-soft",
            )}
          >
            <div className="size-5 shrink-0 animate-pulse rounded-full bg-dash-bg-elevated" style={{ animationDelay: `${index * 80}ms` }} />
            <div className="min-w-0">
              <div className="h-4 w-[68%] animate-pulse rounded bg-dash-bg-elevated" style={{ animationDelay: `${index * 80 + 40}ms` }} />
              <div
                className="mt-2 h-3 w-[88%] animate-pulse rounded bg-dash-bg-elevated"
                style={{ animationDelay: `${index * 80 + 80}ms` }}
              />
            </div>
            <div className="h-3 w-14 animate-pulse rounded bg-dash-bg-elevated" style={{ animationDelay: `${index * 80 + 120}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivitySessionForm({
  workspace,
  initialData,
  enabled = true,
}: {
  workspace?: string | null;
  initialData?: ActivityLogsResponse | null;
  enabled?: boolean;
}) {
  const getActivityLogs = useServerFn(listActivityLogsServerFn as any) as (args: {
    data: { workspace?: string; page?: number; limit?: number };
  }) => Promise<ActivityLogsResponse>;

  const [groups, setGroups] = useState<ActivityLogGroup[]>(initialData?.logs ?? []);
  const [isLoading, setIsLoading] = useState(!initialData && enabled);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialData?.pagination.totalPages ?? 0);

  const getActivityLogsRef = useRef(getActivityLogs);
  getActivityLogsRef.current = getActivityLogs;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getActivityLogsRef.current({
        data: {
          workspace: workspace ?? undefined,
          page,
          limit: 20,
        },
      });
      setGroups(result.logs);
      setTotalPages(result.pagination.totalPages);
    } catch {
      setError("Failed to load activity logs.");
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspace, page]);

  // Skip the initial fetch if we already have SSR data for page 1
  const skipInitialFetch = useRef(Boolean(initialData));
  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    fetchLogs();
  }, [enabled, fetchLogs]);

  const hasItems = groups.some((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-dash-text-strong">User activity sessions</p>
        <p className="text-xs text-dash-text-faded">Recent account actions across authentication, projects, and domains.</p>
      </div>

      {isLoading && (
        <div>
          <span className="sr-only">Loading activity...</span>
          <ActivitySessionSkeleton />
        </div>
      )}

      {error && <div className="py-6 text-sm text-red-500">{error}</div>}

      {!isLoading && !error && !hasItems && <div className="py-6 text-sm text-dash-text-faded">No activity captured yet.</div>}

      {!isLoading && !error && hasItems && (
        <>
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <div key={group.label} className="flex flex-col">
                <p className="mb-2 text-xs font-medium text-dash-text-faded">{group.label}</p>
                <div className="flex flex-col">
                  {group.items.map((item, index) => (
                    <div
                      key={item._id}
                      className={cn(
                        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3",
                        index !== 0 && "border-t border-dashed border-dash-border-soft",
                      )}
                    >
                      {item.status === "success" ? (
                        <CheckCircle weight="fill" className="size-5 shrink-0 text-green-500" />
                      ) : (
                        <XCircle weight="fill" className="size-5 shrink-0 text-red-500" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium leading-5 text-dash-text-strong">{item.description}</p>
                        <p className="mt-1 text-xs text-dash-text-faded">
                          {item.context}
                          {item.user_agent ? ` \u2022 ${item.user_agent}` : ""}
                          {item.ip_address ? ` \u2022 IP ${item.ip_address}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-dash-text-extra-faded">{formatActivityTime(item.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded px-3 py-1 text-xs font-medium text-dash-text-faded transition-colors hover:text-dash-text-body disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-dash-text-faded">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded px-3 py-1 text-xs font-medium text-dash-text-faded transition-colors hover:text-dash-text-body disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const haptics = useHaptics();

  function handleCopy() {
    navigator.clipboard.writeText(text);
    haptics.light();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button onClick={handleCopy} className="shrink-0 text-dash-text-faded transition-colors hover:text-dash-text-strong" title="Copy">
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#34d399]">
          <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  );
}

function ProfileForm({
  profile,
  projectCount = 0,
  onSave,
  onBuildsChange,
  onHapticsChange,
  onCreateApiKey,
  onResetApiKey,
  onDecryptApiKey,
  gitConnections,
  onDisconnectGitProvider,
  onConnectGitProvider,
  onRequestDeleteAccountOtp,
  onVerifyDeleteAccountOtp,
  onDeleteAccount,
  onOpenBilling,
  isSaving,
}: {
  profile: UserProfile;
  projectCount?: number;
  onSave?: (data: { firstName: string; lastName: string; username: string; avatarUrl?: string }) => void | Promise<void>;
  onBuildsChange?: (enabled: boolean) => Promise<void> | void;
  onHapticsChange?: (enabled: boolean) => Promise<void> | void;
  onCreateApiKey?: () => Promise<string | undefined> | string | undefined;
  onResetApiKey?: () => Promise<string | undefined> | string | undefined;
  onDecryptApiKey?: (encryptedApiKey: string) => Promise<string | null | undefined>;
  gitConnections: { id: string; name: string; connected: boolean }[];
  onDisconnectGitProvider?: (providerId: string) => Promise<void> | void;
  onConnectGitProvider?: (providerId: string) => void;
  onRequestDeleteAccountOtp?: (turnstileToken?: string) => Promise<void> | void;
  onVerifyDeleteAccountOtp?: (code: string) => Promise<void> | void;
  onDeleteAccount?: () => Promise<void> | void;
  onOpenBilling?: () => void;
  isSaving?: boolean;
}) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [username, setUsername] = useState(profile.username);
  const [buildsEnabled, setBuildsEnabled] = useState(profile.buildsEnabled ?? true);
  const [hapticsEnabledLocal, setHapticsEnabledLocal] = useState(profile.haptics !== false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  const checkUsername = useServerFn(checkUsernameAvailabilityServerFn as any) as (args: {
    data: { username: string };
  }) => Promise<{ exists: boolean }>;

  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed || trimmed === profile.username) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void checkUsername({ data: { username: trimmed } })
        .then((result) => {
          if (cancelled) return;
          setUsernameStatus(result.exists ? "taken" : "available");
        })
        .catch(() => {
          if (cancelled) return;
          setUsernameStatus("idle");
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [username, profile.username, checkUsername]);

  const isTextDirty = firstName !== profile.firstName || lastName !== profile.lastName || username !== profile.username;
  const isAvatarDirty = avatarUrl !== (profile.avatarUrl ?? "");
  const isDirty = isTextDirty || isAvatarDirty;
  const isUsernameBlocking = usernameStatus === "taken" || usernameStatus === "checking";

  const inputClass = dashInputClassName;
  const normalizedPlanType = (profile.subscriptionPlanType ?? "").toUpperCase();
  const paidPlanTypes = new Set(
    [SUBSCRIPTION_PLAN_TYPE.HackerPlan, SUBSCRIPTION_PLAN_TYPE.DeveloperPlan, SUBSCRIPTION_PLAN_TYPE.TeamPlan].map((plan) =>
      String(plan).toUpperCase(),
    ),
  );
  const isFreePlan = !paidPlanTypes.has(normalizedPlanType);
  const buildLockReason = getBuildLockReason(profile.buildDisabledBy);

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
    setAvatarUrl(profile.avatarUrl ?? "");
  }, [profile.avatarUrl, profile.firstName, profile.lastName, profile.username]);

  useEffect(() => {
    setBuildsEnabled(profile.buildsEnabled ?? true);
  }, [profile.buildsEnabled]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Alt" || event.altKey) {
        setIsAltPressed(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Alt" || !event.altKey) {
        setIsAltPressed(false);
      }
    }

    function clearAltState() {
      setIsAltPressed(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearAltState);
    document.addEventListener("visibilitychange", clearAltState);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearAltState);
      document.removeEventListener("visibilitychange", clearAltState);
    };
  }, []);

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
        toast.success("Photo uploaded. Click Confirm to save changes.");
      } else {
        toast.error("Upload succeeded but no image URL was returned.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setIsUploadingAvatar(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  const avatarSeed = profile.username || profile.firstName || profile.email || "user";
  const hasCustomAvatar = Boolean(avatarUrl);

  function handleAvatarButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    const useAlternateAction = hasCustomAvatar && (event.altKey || isAltPressed);

    if (useAlternateAction) {
      setAvatarUrl("");
      toast.success("Photo removed. Click Confirm to save changes.");
      return;
    }

    fileInputRef.current?.click();
  }

  const avatarSrc = avatarUrl || `https://avatar.vercel.sh/${encodeURIComponent(avatarSeed)}`;

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
          <Avatar src={avatarSrc} fallbackSeed={avatarSeed} alt="Profile avatar" className="h-full w-full object-cover" />
          {isUploadingAvatar && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleAvatarButtonClick}
            disabled={isUploadingAvatar || Boolean(isSaving)}
            className="flex h-[34px] w-fit items-center rounded-[4px] border border-dash-border bg-dash-bg px-3.5 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:pointer-events-none disabled:opacity-50"
          >
            {isUploadingAvatar ? "Uploading..." : hasCustomAvatar && isAltPressed ? "Remove photo" : "Upload photo"}
          </button>
          {hasCustomAvatar && (
            <span className="text-sm text-dash-text-faded">
              {isAltPressed ? `Release Option "⌥" to upload photo` : `Hold Option "⌥" to remove photo`}
            </span>
          )}
        </div>
      </div>

      <hr className="border-dash-border-soft" />

      {/* Name fields */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-3.5">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">First name</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Last name</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
          </div>
        </div>

        {/* Username */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^\w.-]/g, ""))}
            autoComplete="username"
            spellCheck={false}
            autoCapitalize="none"
            className={cn(inputClass, usernameStatus === "taken" && "input-error")}
          />
          {usernameStatus === "taken" && <p className="text-xs text-[#ef2f1f]">This username is already taken.</p>}
        </div>

        {/* Unique ID */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Unique ID</label>
          <div className="relative">
            <input type="text" value={profile.uniqueId} readOnly className={cn(inputClass, "pr-10 text-dash-text-faded")} />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <CopyButton text={profile.uniqueId} />
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <GlossyButton
        onClick={handleSave}
        disabled={!isDirty || isUploadingAvatar || Boolean(isSaving) || isUsernameBlocking}
        fullWidth
        loading={Boolean(isSaving)}
        loadingLabel="Saving..."
      >
        Confirm
      </GlossyButton>

      <hr className="border-dash-border-soft" />

      {/* Builds toggle */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Builds</span>
          <span className="text-sm leading-5 text-dash-text-faded">Enable or disable builds for your projects</span>
        </div>
        {buildLockReason ? (
          <SimpleTooltip content={buildLockReason} side="left" delayDuration={100}>
            <span>
              <Toggle checked={false} onChange={() => {}} disabled />
            </span>
          </SimpleTooltip>
        ) : (
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
        )}
      </div>

      <hr className="border-dash-border-soft" />

      {/* Haptics toggle */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Haptics</span>
          <span className="text-sm leading-5 text-dash-text-faded">Sound and vibration feedback on interactions</span>
        </div>
        <Toggle
          checked={hapticsEnabledLocal}
          onChange={async (nextValue) => {
            setHapticsEnabledLocal(nextValue);
            setHapticsEnabled(nextValue);
            try {
              await onHapticsChange?.(nextValue);
            } catch (error) {
              setHapticsEnabledLocal(!nextValue);
              setHapticsEnabled(!nextValue);
              throw error;
            }
          }}
        />
      </div>

      <hr className="border-dash-border-soft" />

      {/* API Key */}
      <ApiKeySection
        initialApiKey={profile.apiKey}
        isFreePlan={isFreePlan}
        onUpgradePlan={onOpenBilling}
        onCreate={onCreateApiKey}
        onReset={onResetApiKey}
        onDecrypt={onDecryptApiKey}
      />

      <hr className="border-dash-border-soft" />

      {/* Danger zone */}
      <DangerZone
        projectCount={projectCount}
        gitConnections={gitConnections}
        onDisconnectGitProvider={onDisconnectGitProvider}
        onConnectGitProvider={onConnectGitProvider}
        onRequestDeleteAccountOtp={onRequestDeleteAccountOtp}
        onVerifyDeleteAccountOtp={onVerifyDeleteAccountOtp}
        onDeleteAccount={onDeleteAccount}
      />
    </div>
  );
}

function DangerZone({
  projectCount = 0,
  gitConnections,
  onDisconnectGitProvider,
  onConnectGitProvider,
  onRequestDeleteAccountOtp,
  onVerifyDeleteAccountOtp,
  onDeleteAccount,
}: {
  projectCount?: number;
  gitConnections: { id: string; name: string; connected: boolean }[];
  onDisconnectGitProvider?: (providerId: string) => Promise<void> | void;
  onConnectGitProvider?: (providerId: string) => void;
  onRequestDeleteAccountOtp?: (turnstileToken?: string) => Promise<void> | void;
  onVerifyDeleteAccountOtp?: (code: string) => Promise<void> | void;
  onDeleteAccount?: () => Promise<void> | void;
}) {
  const haptics = useHaptics();
  const { theme } = useTheme();
  const normalizedProjectCount =
    typeof projectCount === "number" && Number.isFinite(projectCount) && projectCount > 0 ? Math.floor(projectCount) : 0;
  const hasRemainingProjects = normalizedProjectCount > 0;
  const projectsLabel = normalizedProjectCount === 1 ? "project" : "projects";
  const [disconnectProvider, setDisconnectProvider] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState("");
  const [gitMenuOpen, setGitMenuOpen] = useState(false);
  const gitMenuRef = useRef<HTMLDivElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"confirm" | "otp">("confirm");
  const connectedProviders = gitConnections.filter((p) => p.connected);
  const disconnectedProviders = gitConnections.filter((p) => !p.connected);

  useEffect(() => {
    if (!gitMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (gitMenuRef.current && !gitMenuRef.current.contains(e.target as Node)) {
        setGitMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [gitMenuOpen]);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isTurnstileReady, setIsTurnstileReady] = useState(false);
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deleteOtpError, setDeleteOtpError] = useState<string | null>(null);

  useEffect(() => {
    if (deleteOpen && deleteStep === "confirm" && !hasRemainingProjects) {
      setIsTurnstileReady(false);
    }
  }, [deleteOpen, deleteStep, hasRemainingProjects, theme]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Danger zone</span>
        <span className="text-sm leading-5 text-dash-text-faded">Irreversible actions for your account</span>
      </div>

      {/* Git providers */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-dash-text-strong">Git providers</span>
          <span className="text-xs text-dash-text-faded">
            {connectedProviders.length > 0
              ? `Connected: ${connectedProviders.map((p) => p.name).join(", ")}`
              : "No git providers connected."}
          </span>
        </div>
        <div className="relative" ref={gitMenuRef}>
          <GlossyButton
            variant={connectedProviders.length > 0 ? "red" : "black"}
            onClick={() => {
              haptics.selection();
              if (connectedProviders.length === 1 && disconnectedProviders.length === 0) {
                setDisconnectProvider(connectedProviders[0]);
              } else {
                setGitMenuOpen((prev) => !prev);
              }
            }}
          >
            {connectedProviders.length > 0 ? "Manage" : "Connect"}
            <ChevronDown className="ml-1 size-3.5" />
          </GlossyButton>
          <AnimatePresence>
            {gitMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-full right-0 z-10 mb-1.5 min-w-[180px] overflow-hidden rounded-[6px] border border-dash-border bg-dash-bg shadow-[0px_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0px_4px_12px_rgba(0,0,0,0.3)]"
              >
                {connectedProviders.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => {
                      haptics.selection();
                      setGitMenuOpen(false);
                      setDisconnectProvider(provider);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#ef4444] transition-colors hover:bg-dash-bg-elevated"
                  >
                    Disconnect {provider.name}
                  </button>
                ))}
                {disconnectedProviders.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => {
                      haptics.selection();
                      setGitMenuOpen(false);
                      onConnectGitProvider?.(provider.id);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
                  >
                    Connect {provider.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Delete account */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-dash-text-strong">Delete account</span>
          <span className="text-xs text-dash-text-faded">Permanently delete your account and all associated data.</span>
        </div>
        <GlossyButton variant="red" onClick={() => setDeleteOpen(true)}>
          Delete
        </GlossyButton>
      </div>

      <WarningModal
        open={disconnectProvider !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDisconnectProvider(null);
            setDisconnectConfirm("");
          }
        }}
        title={`Disconnect ${disconnectProvider?.name ?? "provider"}?`}
        description={`This will remove your ${disconnectProvider?.name ?? ""} connection. All ${disconnectProvider?.name ?? ""}-based deployments will stop working until you reconnect your account.`}
        confirmLabel={`Disconnect ${disconnectProvider?.name ?? ""}`}
        confirmDisabled={disconnectConfirm !== "DISCONNECT"}
        onConfirm={async () => {
          if (disconnectProvider) {
            await onDisconnectGitProvider?.(disconnectProvider.id);
          }
        }}
      >
        <div className="flex flex-col gap-2 text-left">
          <label className="text-sm leading-5 text-dash-text-faded">
            Type <span className="font-medium text-dash-text-strong">DISCONNECT</span> to confirm
          </label>
          <input
            type="text"
            value={disconnectConfirm}
            onChange={(e) => setDisconnectConfirm(e.target.value)}
            placeholder="DISCONNECT"
            className={dashInputClassName}
          />
        </div>
      </WarningModal>

      <WarningModal
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setTurnstileToken(null);
            setIsTurnstileReady(false);
            setDeleteStep("confirm");
            setDeleteOtp("");
            setDeleteOtpError(null);
          }
        }}
        title={deleteStep === "confirm" ? "Delete your account?" : "Verify account deletion"}
        description={
          deleteStep === "confirm"
            ? "This action cannot be undone. All projects, deployments, domains, environment variables, and billing data will be permanently deleted."
            : "We sent a 6-digit verification code to your account email. Enter it to continue."
        }
        confirmLabel={deleteStep === "confirm" ? "Send verification code" : "Delete my account"}
        confirmLoadingLabel={deleteStep === "confirm" ? "Sending code..." : "Deleting account..."}
        confirmDisabled={hasRemainingProjects ? true : deleteStep === "confirm" ? !turnstileToken : deleteOtp.length < 6}
        closeOnConfirm={deleteStep === "otp"}
        onConfirm={async () => {
          if (hasRemainingProjects) {
            return;
          }

          if (deleteStep === "confirm") {
            setDeleteOtpError(null);
            setDeleteStep("otp");
            if (onRequestDeleteAccountOtp) {
              try {
                await onRequestDeleteAccountOtp(turnstileToken ?? undefined);
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
            try {
              await onVerifyDeleteAccountOtp(deleteOtp);
            } catch (error) {
              setDeleteOtpError(error instanceof Error ? error.message : "Invalid verification code");
              throw error;
            }
          }
          await onDeleteAccount?.();
        }}
      >
        <div className="flex flex-col gap-2 text-left">
          <div className={`flex items-start rounded-[8px] bg-dash-bg-elevated px-3 py-2.5 ${hasRemainingProjects ? "" : "gap-2.5"}`}>
            {!hasRemainingProjects ? (
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#ef2f1f]/10">
                <TriangleAlert className="size-2.5 text-[#ef2f1f]" />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-5 text-dash-text-strong">
                {hasRemainingProjects ? `You still have ${normalizedProjectCount} ${projectsLabel}.` : "This action is permanent."}
              </p>
              <p className="text-xs leading-5 text-dash-text-faded">
                {hasRemainingProjects
                  ? `Delete your ${projectsLabel} first before deleting your account.`
                  : "Deleted accounts cannot be recovered."}
              </p>
            </div>
          </div>
          {deleteStep === "confirm" ? (
            <>
              {hasRemainingProjects ? null : (
                <>
                  <label className="text-sm leading-5 text-dash-text-faded">Complete the verification to continue</label>
                  <div className="rounded-[10px] bg-dash-bg-elevated/70 p-2.5">
                    <div className="mx-auto w-full max-w-[360px]">
                      <div className="relative min-h-[65px]">
                        {!isTurnstileReady ? (
                          <div className="absolute inset-0 animate-pulse rounded-[8px] border border-dash-border-soft bg-dash-bg/70 p-3">
                            <div className="flex h-full items-center gap-3">
                              <div className="size-8 shrink-0 rounded-full bg-dash-border-soft/70" />
                              <div className="h-4 flex-1 rounded bg-dash-border-soft/60" />
                              <div className="h-6 w-20 shrink-0 rounded bg-dash-border-soft/50" />
                            </div>
                          </div>
                        ) : null}
                        <Turnstile
                          key={`delete-account-turnstile-${theme}`}
                          siteKey={config.turnstileSiteKey}
                          className={cn("w-full transition-opacity duration-200", isTurnstileReady ? "opacity-100" : "opacity-0")}
                          options={{
                            theme: theme === Theme.Dark ? Theme.Dark : Theme.Light,
                            size: "flexible",
                          }}
                          onWidgetLoad={() => setIsTurnstileReady(true)}
                          onSuccess={(token) => setTurnstileToken(token)}
                          onExpire={() => setTurnstileToken(null)}
                          onError={() => {
                            setTurnstileToken(null);
                            setIsTurnstileReady(true);
                          }}
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-dash-text-extra-faded">Security check powered by Cloudflare.</p>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <label className="text-sm leading-5 text-dash-text-faded">Enter verification code</label>
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
                  error={Boolean(deleteOtpError)}
                />
              </div>
              {deleteOtpError ? <p className="text-xs text-[#ef2f1f]">{deleteOtpError}</p> : null}
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
                    setDeleteOtpError(error instanceof Error ? error.message : "Failed to resend verification code");
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
  isFreePlan = false,
  onUpgradePlan,
  onCreate,
  onReset,
  onDecrypt,
}: {
  initialApiKey?: string;
  isFreePlan?: boolean;
  onUpgradePlan?: () => void;
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
  const hasApiKey = Boolean(encryptedApiKey);

  const inputClass = "w-full input-base px-3 py-2.5 text-sm leading-6 text-dash-text-strong";

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
        <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">API key</span>
        <span className="text-sm leading-5 text-dash-text-faded">
          {isFreePlan ? (
            <>
              API keys are available on paid plans.{" "}
              <button
                type="button"
                onClick={onUpgradePlan}
                className="text-[#4879f8] underline underline-offset-2 transition-colors hover:text-[#3a6ae6]"
              >
                Upgrade
              </button>{" "}
              to enable API key access.
            </>
          ) : (
            "Use this key to authenticate API requests. Keep it secret."
          )}
        </span>
      </div>

      {!isFreePlan && (
        <>
          <div className="flex items-center gap-2">
            {hasApiKey && (
              <div className="relative flex-1">
                <input
                  type="text"
                  value={displayValue}
                  readOnly
                  className={cn(inputClass, "pr-20 font-mono text-[13px] text-dash-text-faded")}
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                  <button
                    onClick={async () => {
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
                    disabled={isDecrypting}
                    className="shrink-0 rounded-[4px] p-1 text-dash-text-faded transition-colors hover:text-dash-text-strong"
                    title={revealed ? "Hide" : "Reveal"}
                  >
                    {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                  {decryptedApiKey ? (
                    <CopyButton text={decryptedApiKey} />
                  ) : (
                    <button disabled className="shrink-0 rounded-[4px] p-1 text-dash-text-extra-faded" title="Reveal key to copy">
                      <Copy className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => setRerollOpen(true)}
              disabled={isSubmitting}
              className="flex h-[40px] shrink-0 items-center gap-1.5 rounded-[6px] border border-dash-border bg-dash-bg px-3 text-sm font-medium text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated"
            >
              <RefreshCw className="size-3.5" />
              {hasApiKey ? "Reroll" : "Generate"}
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
                const nextKey = encryptedApiKey ? await onReset?.() : await onCreate?.();
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
        </>
      )}
    </div>
  );
}

function WorkspaceProfileForm({
  team,
  canEdit = true,
  onSave,
  onBuildsChange,
  isSaving,
}: {
  team: TeamDetails;
  canEdit?: boolean;
  onSave?: (data: { name: string; description?: string; avatarUrl?: string }) => void | Promise<void>;
  onBuildsChange?: (enabled: boolean) => Promise<void> | void;
  isSaving?: boolean;
}) {
  const [name, setName] = useState(team.name || "");
  const [description, setDescription] = useState(team.description || "");
  const [avatarUrl, setAvatarUrl] = useState(team.avatarUrl || "");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [buildsEnabled, setBuildsEnabled] = useState(!(team.buildDisabled ?? false));
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isDirty = name !== (team.name || "") || description !== (team.description || "") || avatarUrl !== (team.avatarUrl || "");

  const inputClass = dashInputClassName;
  const buildLockReason = getBuildLockReason(team.buildDisabledBy);

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
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
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
  const avatarSrc = avatarUrl || `https://avatar.vercel.sh/${encodeURIComponent(avatarSeed)}`;

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
          <Avatar src={avatarSrc} fallbackSeed={avatarSeed} alt="Workspace avatar" className="h-full w-full object-cover" />
          {isUploadingAvatar && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!canEdit || isUploadingAvatar || Boolean(isSaving)}
            className="flex h-[34px] w-fit items-center rounded-[4px] border border-dash-border bg-dash-bg px-3.5 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:pointer-events-none disabled:opacity-50"
          >
            {isUploadingAvatar ? "Uploading..." : "Upload photo"}
          </button>
          <span className="text-sm text-dash-text-faded">Workspace logo</span>
        </div>
      </div>

      <hr className="border-dash-border-soft" />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Workspace name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            className={cn(inputClass, !canEdit && "opacity-60 cursor-not-allowed")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Workspace description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit}
            className={cn(inputClass, !canEdit && "opacity-60 cursor-not-allowed")}
          />
        </div>
      </div>

      {canEdit && (
        <GlossyButton
          variant="blue"
          onClick={handleSave}
          disabled={!isDirty || isUploadingAvatar || !name.trim()}
          loading={Boolean(isSaving)}
          loadingLabel="Saving..."
        >
          Save changes
        </GlossyButton>
      )}

      <hr className="border-dash-border-soft" />

      <div className="flex flex-col gap-2">
        <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Workspace ID</label>
        <div className="flex items-center rounded-[6px] border border-dash-border bg-dash-bg-elevated px-3 py-2.5">
          <span className="flex-1 truncate text-sm text-dash-text-strong">{team.id}</span>
          <CopyButton text={team.id} />
        </div>
      </div>

      <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
        Workspace created {formatWorkspaceCreatedAt(team.createdAt)}
      </p>

      <hr className="border-dash-border-soft" />

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Builds</span>
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">Enable or disable builds for this workspace.</span>
        </div>
        {buildLockReason ? (
          <SimpleTooltip content={buildLockReason} side="left" delayDuration={100}>
            <span>
              <Toggle checked={false} onChange={() => {}} disabled />
            </span>
          </SimpleTooltip>
        ) : canEdit ? (
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
        ) : (
          <SimpleTooltip content="Only Creators and Administrators can change this setting" side="left" delayDuration={100}>
            <span>
              <Toggle checked={buildsEnabled} onChange={() => {}} disabled />
            </span>
          </SimpleTooltip>
        )}
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
  showBillingTab = true,
  showSecurityTab = true,
}: {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  onClose: () => void;
  onSignOut?: () => void | Promise<void>;
  isSigningOut?: boolean;
  showMembersTab: boolean;
  showBillingTab?: boolean;
  showSecurityTab?: boolean;
}) {
  const haptics = useHaptics();
  const hiddenTabs = new Set<ProfileTab>();
  if (!showMembersTab) hiddenTabs.add(ProfileTab.Members);
  if (!showBillingTab) hiddenTabs.add(ProfileTab.Billing);
  if (!showSecurityTab) hiddenTabs.add(ProfileTab.Security);
  const accountNavItems = accountNav.filter((item) => !hiddenTabs.has(item.key));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSections, setMobileSections] = useState({
    account: true,
    reachUs: false,
    about: false,
  });

  function toggleMobileSection(section: keyof typeof mobileSections) {
    setMobileSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

  function renderNavSections() {
    return (
      <>
        <div className="flex flex-col gap-5 md:gap-9">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => toggleMobileSection("account")}
              className="flex items-center justify-between rounded-[8px] px-3.5 py-2 text-left md:hidden"
              aria-expanded={mobileSections.account}
            >
              <span className="text-[11px] font-medium uppercase leading-[11px] tracking-[-0.11px] text-dash-text-faded">Account</span>
              <ChevronDown
                className={cn("size-4 text-dash-text-faded transition-transform md:hidden", mobileSections.account && "rotate-180")}
              />
            </button>
            <div className="md:hidden">
              <AnimatePresence initial={false}>
                {mobileSections.account && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-2">
                      {accountNavItems.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => {
                            haptics.selection();
                            onTabChange(item.key);
                            setMobileMenuOpen(false);
                          }}
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="hidden px-3.5 text-[11px] font-medium uppercase leading-[11px] tracking-[-0.11px] text-dash-text-faded md:block">
              Account
            </span>
            <div className="hidden md:flex md:flex-col md:gap-2">
              {accountNavItems.map((item) => (
                <button
                  key={`desktop-${item.key}`}
                  onClick={() => {
                    haptics.selection();
                    onTabChange(item.key);
                  }}
                  className={cn(
                    navItemBase,
                    activeTab === item.key ? "bg-dash-bg-elevated text-dash-text-strong" : "text-dash-text-body hover:bg-dash-bg-elevated",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => toggleMobileSection("reachUs")}
              className="flex items-center justify-between rounded-[8px] px-3.5 py-2 text-left md:hidden"
              aria-expanded={mobileSections.reachUs}
            >
              <span className="text-[11px] font-medium uppercase leading-[11px] tracking-[-0.11px] text-dash-text-faded">Reach Us</span>
              <ChevronDown
                className={cn("size-4 text-dash-text-faded transition-transform md:hidden", mobileSections.reachUs && "rotate-180")}
              />
            </button>
            <div className="md:hidden">
              <AnimatePresence initial={false}>
                {mobileSections.reachUs && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-2">
                      {reachUsNav.map((item) => (
                        <a
                          key={item.label}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(navItemBase, "text-dash-text-body hover:bg-dash-bg-elevated")}
                        >
                          <span className="text-sm">{item.emoji}</span>
                          {item.label}
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="hidden px-3.5 text-[11px] font-medium uppercase leading-[11px] tracking-[-0.11px] text-dash-text-faded md:block">
              Reach Us
            </span>
            <div className="hidden md:flex md:flex-col md:gap-2">
              {reachUsNav.map((item) => (
                <a
                  key={`desktop-${item.label}`}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(navItemBase, "text-dash-text-body hover:bg-dash-bg-elevated")}
                >
                  <span className="text-sm">{item.emoji}</span>
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => toggleMobileSection("about")}
              className="flex items-center justify-between rounded-[8px] px-3.5 py-2 text-left md:hidden"
              aria-expanded={mobileSections.about}
            >
              <span className="text-[11px] font-medium uppercase leading-[11px] tracking-[-0.11px] text-dash-text-faded">About</span>
              <ChevronDown
                className={cn("size-4 text-dash-text-faded transition-transform md:hidden", mobileSections.about && "rotate-180")}
              />
            </button>
            <div className="md:hidden">
              <AnimatePresence initial={false}>
                {mobileSections.about && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-2">
                      {aboutNav.map((item) => (
                        <button key={item.label} className={cn(navItemBase, "text-dash-text-body hover:bg-dash-bg-elevated")}>
                          <span className="text-sm">{item.emoji}</span>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="hidden px-3.5 text-[11px] font-medium uppercase leading-[11px] tracking-[-0.11px] text-dash-text-faded md:block">
              About
            </span>
            <div className="hidden md:flex md:flex-col md:gap-2">
              {aboutNav.map((item) => (
                <button key={`desktop-${item.label}`} className={cn(navItemBase, "text-dash-text-body hover:bg-dash-bg-elevated")}>
                  <span className="text-sm">{item.emoji}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-3 md:pt-4">
          <button
            onClick={() => {
              void onSignOut?.();
            }}
            disabled={isSigningOut}
            className={cn(navItemBase, "shrink-0 text-dash-text-body hover:bg-dash-bg-elevated")}
          >
            <span className="text-sm">⛳️</span>
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="flex w-full shrink-0 flex-col border-b border-dash-border bg-dash-bg pb-4 pt-3 md:h-full md:w-[380px] md:border-b-0 md:border-l md:pb-6 md:pt-5">
      {/* Back button */}
      <button
        onClick={onClose}
        className="mb-3 flex items-center gap-2 px-4 text-sm text-dash-text-faded transition-colors hover:text-dash-text-strong md:mb-4 md:pl-5 md:pr-0"
      >
        <ArrowLeft className="size-4" />
      </button>

      <button
        type="button"
        onClick={() => setMobileMenuOpen((prev) => !prev)}
        className="mx-4 flex items-center justify-between rounded-[10px] bg-dash-bg-elevated px-3.5 py-2.5 text-sm text-dash-text-body md:hidden"
        aria-expanded={mobileMenuOpen}
      >
        <span>Menu</span>
        <ChevronDown className={cn("size-4 text-dash-text-faded transition-transform", mobileMenuOpen && "rotate-180")} />
      </button>

      <div className="hidden flex-1 flex-col px-4 md:flex md:max-h-none md:gap-0 md:px-0 md:pl-[120px] md:pr-3">
        <div className="scrollbar-hidden flex flex-1 flex-col overflow-y-auto">{renderNavSections()}</div>
      </div>

      <AnimatePresence initial={false}>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden px-4 md:hidden"
          >
            <div className="scrollbar-hidden max-h-[42vh] overflow-y-auto pt-3">{renderNavSections()}</div>
          </motion.div>
        )}
      </AnimatePresence>
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
  initialActivityLogs = null,
  initialSubscriptionStats = null,
  initialUserOverview = null,
  initialProjectEnvironments = null,
  projectCount = 0,
  requestedTab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSnapshot?: SettingsSidebarSnapshot | null;
  initialWorkspaceTeamMembers?: TeamDetails | null;
  initialPaymentMethods?: PaymentMethod[] | null;
  initialInvoices?: any;
  initialActivityLogs?: ActivityLogsResponse | null;
  initialSubscriptionStats?: import("@/backend/payments").SubscriptionStats | null;
  initialUserOverview?: import("@/backend/user-overview").UserOverview | null;
  initialProjectEnvironments?: ProjectEnvironment[] | null;
  projectCount?: number;
  requestedTab?: ProfileTab;
}) {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const queryClient = useQueryClient();
  const router = useRouter();

  const getSettingsSnapshot = useServerFn(getSettingsSidebarSnapshotServerFn as any) as (args?: {
    data?: { workspace?: string };
  }) => Promise<SettingsSidebarSnapshot>;
  const getWorkspaceTeamMembers = useServerFn(getWorkspaceTeamMembersServerFn as any) as (args: {
    data: { workspace: string };
  }) => Promise<TeamDetails>;
  const updateWorkspaceTeamProfile = useServerFn(updateWorkspaceTeamProfileServerFn as any) as (args: {
    data: {
      workspace: string;
      name: string;
      description?: string;
      avatarUrl?: string;
    };
  }) => Promise<{ ok: true }>;
  const updateProfile = useServerFn(updateSettingsProfileServerFn as any) as (args: {
    data: {
      firstName: string;
      lastName: string;
      username: string;
      avatarUrl?: string;
    };
  }) => Promise<SettingsSidebarSnapshot["profile"]>;
  const requestEmailVerification = useServerFn(requestSettingsEmailVerificationServerFn as any) as (args: {
    data: { email: string };
  }) => Promise<{ ok: true }>;
  const updateNotifications = useServerFn(updateSettingsNotificationsServerFn as any) as (args: {
    data: { email: boolean; mute: boolean };
  }) => Promise<{ ok: true }>;
  const updateBuilds = useServerFn(updateSettingsBuildsServerFn as any) as (args: {
    data: { buildDisabled: boolean; workspace?: string };
  }) => Promise<{ ok: true }>;
  const updateHaptics = useServerFn(updateSettingsHapticsServerFn as any) as (args: {
    data: { haptics: boolean };
  }) => Promise<{ ok: true }>;
  const createApiKey = useServerFn(createSettingsApiKeyServerFn);
  const resetApiKey = useServerFn(resetSettingsApiKeyServerFn);
  const disconnectGitProvider = useServerFn(disconnectGitProviderServerFn as any) as (args: {
    data: { provider: string };
  }) => Promise<{ ok: true }>;
  const listGithubAccounts = useServerFn(listGithubAccountsServerFn);
  const getGithubConnectUrl = useServerFn(getGithubConnectUrlServerFn as any) as (args: {
    data?: { device?: string };
  }) => Promise<{ url: string }>;
  const getGitlabConnectUrl = useServerFn(getGitlabConnectUrlServerFn as any) as (args: {
    data?: { device?: string };
  }) => Promise<{ url: string }>;
  const getBitbucketConnectUrl = useServerFn(getBitbucketConnectUrlServerFn as any) as (args: {
    data?: { device?: string };
  }) => Promise<{ url: string }>;
  const listGitlabAccounts = useServerFn(listGitlabAccountsServerFn);
  const listBitbucketAccounts = useServerFn(listBitbucketAccountsServerFn);
  const [gitConnectionStatus, setGitConnectionStatus] = useState<Record<string, boolean | null>>({
    github: null,
    gitlab: null,
    bitbucket: null,
  });
  const getTwoFactorStatus = useServerFn(getTwoFactorStatusServerFn as any) as () => Promise<TwoFactorStatus>;
  const listPasskeys = useServerFn(listPasskeysServerFn as any) as () => Promise<PasskeySummary[]>;
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [prefetchedPasskeys, setPrefetchedPasskeys] = useState<PasskeySummary[] | undefined>(undefined);
  const decryptApiKey = useServerFn(decryptSettingsApiKeyServerFn as any) as (args: {
    data: { encryptedApiKey: string };
  }) => Promise<string | null>;
  const updateWebhooks = useServerFn(updateSettingsWebhooksServerFn as any) as (args: {
    data: {
      webhookUrl: string | null;
      discordUrl: string | null;
      slackUrl: string | null;
      events: string[];
    };
  }) => Promise<SettingsSidebarSnapshot["webhooks"]>;
  const testWebhook = useServerFn(testSettingsWebhookServerFn as any) as (args: {
    data: { url: string; type: "discord" | "slack" | "custom" };
  }) => Promise<{ ok: true }>;
  const requestDeleteAccountOtp = useServerFn(requestDeleteAccountOtpServerFn as any) as (args: {
    data: { turnstileToken?: string };
  }) => Promise<{ ok: true }>;
  const confirmDeleteAccount = useServerFn(confirmDeleteAccountServerFn as any) as (args: {
    data: { accessCode: string };
  }) => Promise<{ ok: true }>;
  const [activeTab, setActiveTab] = useState<ProfileTab>(ProfileTab.Profile);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [snapshot, setSnapshot] = useState<SettingsSidebarSnapshot | null>(initialSnapshot);
  const [workspaceTeamMembersCache, setWorkspaceTeamMembersCache] = useState<Record<string, TeamDetails>>({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const prefetchedBillingScopesRef = useRef<Record<string, true>>({});
  const activeWorkspaceSlug = (() => {
    const params = new URLSearchParams(searchStr || "");
    const workspace = params.get("workspace");
    const normalized = workspace?.trim();
    return normalized ? normalized : null;
  })();
  const settingsScopeKey = activeWorkspaceSlug ?? "__personal__";
  const hasActiveWorkspace = Boolean(activeWorkspaceSlug);
  const workspaceTeam = activeWorkspaceSlug ? (workspaceTeamMembersCache[activeWorkspaceSlug] ?? null) : null;

  const profile = mapSettingsSnapshotToDrawerProfile(snapshot);

  const currentWorkspaceRole = (() => {
    if (!hasActiveWorkspace || !workspaceTeam) return null;
    const me = workspaceTeam.members.find((m) => {
      const mUid = m.userId?.trim();
      const pUid = profile?.uniqueId?.trim();
      if (mUid && pUid && mUid === pUid) return true;
      const mEmail = m.email.trim().toLowerCase();
      const pEmail = profile?.email?.trim().toLowerCase();
      return Boolean(pEmail && mEmail === pEmail);
    });
    return me ? normalizeMemberRole(me) : null;
  })();
  const canEditWorkspace = !hasActiveWorkspace || currentWorkspaceRole === "Creator" || currentWorkspaceRole === "Administrator";
  const canSeeBilling = !hasActiveWorkspace ? true : currentWorkspaceRole === "Creator" || currentWorkspaceRole === "Administrator";

  useEffect(() => {
    setSnapshot(initialSnapshot ?? null);
  }, [initialSnapshot]);

  useEffect(() => {
    if (!canSeeBilling && activeTab === ProfileTab.Billing) {
      setActiveTab(ProfileTab.Profile);
    }
    if (hasActiveWorkspace && activeTab === ProfileTab.Security) {
      setActiveTab(ProfileTab.Profile);
    }
  }, [canSeeBilling, activeTab, hasActiveWorkspace]);

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

  const refreshSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    setSettingsError(null);

    try {
      const nextSnapshot = await getSettingsSnapshot({
        data: { workspace: activeWorkspaceSlug || undefined },
      } as any);
      setSnapshot(nextSnapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load settings";
      setSettingsError(message);
    } finally {
      setIsLoadingSettings(false);
    }
  }, [activeWorkspaceSlug, getSettingsSnapshot]);

  const prefetchBillingData = useCallback(
    async (teamId?: string) => {
      const scopeKey = teamId ? `team:${teamId}` : "personal";
      if (prefetchedBillingScopesRef.current[scopeKey]) {
        return;
      }

      prefetchedBillingScopesRef.current[scopeKey] = true;

      const spendingLimitQueryFn = () => {
        if (!teamId) {
          return getSpendingLimitStatusServerFn();
        }

        return getSpendingLimitStatusServerFn({ data: { team_id: teamId } } as any);
      };

      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: paymentKeys.methods(),
          queryFn: () => getPaymentMethodsServerFn(),
        }),
        queryClient.prefetchQuery({
          queryKey: paymentKeys.subscription(),
          queryFn: () => getSubscriptionServerFn(),
        }),
        queryClient.prefetchQuery({
          queryKey: paymentKeys.spendingLimitStatus(teamId),
          queryFn: spendingLimitQueryFn,
        }),
        queryClient.prefetchQuery({
          queryKey: paymentKeys.invoices(null, teamId),
          queryFn: () =>
            getPaymentInvoicesServerFn({
              data: {
                cursor: null,
                per_page: 7,
                ...(teamId ? { team_id: teamId } : {}),
              },
            } as any),
        }),
      ]);
    },
    [queryClient],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (snapshot) {
      return;
    }

    void refreshSettings();
  }, [open, refreshSettings, snapshot]);

  useEffect(() => {
    if (!canSeeBilling) {
      return;
    }

    if (!hasActiveWorkspace) {
      void prefetchBillingData();
      return;
    }

    const teamId = workspaceTeam?.id;
    if (!teamId) {
      return;
    }

    void prefetchBillingData(teamId);
  }, [canSeeBilling, hasActiveWorkspace, prefetchBillingData, workspaceTeam?.id]);

  useEffect(() => {
    if (!open) return;

    const checks: { id: string; fn: () => Promise<any> }[] = [
      { id: "github", fn: listGithubAccounts },
      { id: "gitlab", fn: listGitlabAccounts },
      { id: "bitbucket", fn: listBitbucketAccounts },
    ];

    const refreshGitStatuses = () => {
      for (const check of checks) {
        check
          .fn()
          .then((result) => {
            const accounts = Array.isArray(result) ? result : (result?.accounts ?? []);
            setGitConnectionStatus((prev) => ({
              ...prev,
              [check.id]: accounts.length > 0,
            }));
          })
          .catch(() => {
            setGitConnectionStatus((prev) => ({
              ...prev,
              [check.id]: prev[check.id] ?? false,
            }));
          });
      }
    };

    refreshGitStatuses();

    const handleConnectionChanged = () => refreshGitStatuses();
    window.addEventListener("brimble:git-connection-changed", handleConnectionChanged);

    if (!twoFactorStatus) {
      getTwoFactorStatus()
        .then(setTwoFactorStatus)
        .catch(() => {});
    }

    if (!hasActiveWorkspace && typeof prefetchedPasskeys === "undefined") {
      listPasskeys()
        .then((list) => {
          setPrefetchedPasskeys(list);
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("brimble:git-connection-changed", handleConnectionChanged);
    };
  }, [
    open,
    getTwoFactorStatus,
    hasActiveWorkspace,
    listBitbucketAccounts,
    listGithubAccounts,
    listGitlabAccounts,
    listPasskeys,
    prefetchedPasskeys,
    twoFactorStatus,
  ]);

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

  function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    logoutServerFn()
      .catch(() => {})
      .then(() => {
        posthog.reset();
        invalidateSessionCache();
        window.location.href = "/login";
      });
  }

  let drawerTitle: string = activeTab;
  if (activeTab === ProfileTab.ActivitySession) {
    drawerTitle = "Activity session";
  } else if (activeTab === ProfileTab.Billing) {
    drawerTitle = "Plan & billing";
  } else if (activeTab === ProfileTab.Members) {
    drawerTitle = "Members";
  } else if (activeTab === ProfileTab.Security) {
    drawerTitle = "Security";
  }

  return (
    <Drawer.Root direction="right" open={open} onOpenChange={onOpenChange} noBodyStyles modal>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
        <Drawer.Content
          className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col overflow-hidden outline-none md:w-[92vw] md:max-w-[1280px] md:flex-row xl:w-[85vw]"
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
            showBillingTab={canSeeBilling}
            showSecurityTab={!hasActiveWorkspace}
          />

          {/* Content area */}
          <div className="scrollbar-hidden flex min-w-0 flex-1 flex-col overflow-y-auto border-t border-dash-border bg-dash-bg md:border-l md:border-t-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-dash-border px-4 py-4 md:px-8 md:py-5">
              <Drawer.Title className="text-base font-medium leading-[25px] tracking-[-0.0256px] text-dash-text-strong capitalize">
                {drawerTitle}
              </Drawer.Title>
              <button className="flex size-8 items-center justify-center rounded-full border border-dash-border-soft text-dash-text-faded transition-colors hover:text-dash-text-strong">
                <HelpCircle className="size-4" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 px-4 py-5 md:px-8 md:py-8">
              {settingsError && activeTab !== ProfileTab.Members && (
                <div className="mb-4 rounded-[6px] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
                  {settingsError}
                </div>
              )}
              {isLoadingSettings &&
              !snapshot &&
              activeTab !== ProfileTab.Members &&
              activeTab !== ProfileTab.ActivitySession &&
              !(activeTab === ProfileTab.Profile && hasActiveWorkspace) ? (
                <div className="text-sm text-dash-text-faded">Loading settings…</div>
              ) : null}
              {activeTab === ProfileTab.Profile && hasActiveWorkspace && workspaceTeam && (
                <WorkspaceProfileForm
                  team={workspaceTeam}
                  canEdit={canEditWorkspace}
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

                      void invalidateActiveMatches(router);
                      toast.success("Workspace profile updated");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed to update workspace profile");
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
              {activeTab === ProfileTab.Profile && hasActiveWorkspace && !workspaceTeam && (
                <div className="text-sm text-dash-text-faded">Loading workspace profile…</div>
              )}
              {activeTab === ProfileTab.Profile && !hasActiveWorkspace && profile && (
                <ProfileForm
                  profile={profile}
                  projectCount={projectCount}
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
                      void invalidateActiveMatches(router);
                      toast.success("Profile updated");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed to update profile");
                    } finally {
                      setIsSavingProfile(false);
                    }
                  }}
                  onBuildsChange={async (enabled) => {
                    try {
                      await updateBuilds({
                        data: { buildDisabled: !enabled },
                      });
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
                      toast.error(error instanceof Error ? error.message : "Failed to update build settings");
                      throw error;
                    }
                  }}
                  onHapticsChange={async (enabled) => {
                    try {
                      await updateHaptics({
                        data: { haptics: enabled },
                      });
                      setSnapshot((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          profile: { ...prev.profile, haptics: enabled },
                        };
                      });
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed to update haptics settings");
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
                      toast.error(error instanceof Error ? error.message : "Failed to create API key");
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
                      toast.error(error instanceof Error ? error.message : "Failed to reset API key");
                      return undefined;
                    }
                  }}
                  onDecryptApiKey={async (encryptedApiKey) => {
                    try {
                      return await decryptApiKey({
                        data: { encryptedApiKey },
                      });
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed to decrypt API key");
                      return null;
                    }
                  }}
                  gitConnections={[
                    {
                      id: "github",
                      name: "GitHub",
                      connected: gitConnectionStatus.github ?? false,
                    },
                    {
                      id: "gitlab",
                      name: "GitLab",
                      connected: gitConnectionStatus.gitlab ?? false,
                    },
                    {
                      id: "bitbucket",
                      name: "Bitbucket",
                      connected: gitConnectionStatus.bitbucket ?? false,
                    },
                  ]}
                  onDisconnectGitProvider={async (providerId) => {
                    try {
                      await disconnectGitProvider({
                        data: { provider: providerId as any },
                      });
                      setGitConnectionStatus((prev) => ({
                        ...prev,
                        [providerId]: false,
                      }));
                      window.dispatchEvent(new Event("brimble:git-connection-changed"));
                      toast.success(`${providerId.charAt(0).toUpperCase() + providerId.slice(1)} disconnected successfully`);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : `Failed to disconnect ${providerId}`);
                    }
                  }}
                  onConnectGitProvider={async (providerId) => {
                    try {
                      const connectFns: Record<string, () => Promise<{ url: string }>> = {
                        github: () =>
                          getGithubConnectUrl({
                            data: {
                              device: window.sessionStorage.getItem("brimble.oauth.device_id") ?? undefined,
                            },
                          }),
                        gitlab: () =>
                          getGitlabConnectUrl({
                            data: {
                              device: window.sessionStorage.getItem("brimble.oauth.device_id") ?? undefined,
                            },
                          }),
                        bitbucket: () =>
                          getBitbucketConnectUrl({
                            data: {
                              device: window.sessionStorage.getItem("brimble.oauth.device_id") ?? undefined,
                            },
                          }),
                      };
                      const getFn = connectFns[providerId];
                      if (!getFn) {
                        toast.error(`${providerId} connection is not available yet.`);
                        return;
                      }
                      const result = await getFn();
                      const url = result?.url?.trim();
                      if (!url) throw new Error(`Could not start ${providerId} connection.`);

                      const popup = window.open(url, "_blank", "width=900,height=760");
                      if (!popup) {
                        toast.error("Popup blocked. Please allow popups and try again.");
                        return;
                      }

                      toast.success(`Complete the ${providerId} authorization in the popup, then refresh.`);
                      setGitConnectionStatus((prev) => ({
                        ...prev,
                        [providerId]: null,
                      }));

                      const checkFns: Record<string, () => Promise<any>> = {
                        github: listGithubAccounts,
                        gitlab: listGitlabAccounts,
                        bitbucket: listBitbucketAccounts,
                      };
                      const checkFn = checkFns[providerId];
                      if (checkFn) {
                        const interval = window.setInterval(async () => {
                          try {
                            const accounts = await checkFn();
                            const items = Array.isArray(accounts) ? accounts : (accounts?.accounts ?? []);
                            if (items.length > 0) {
                              setGitConnectionStatus((prev) => ({
                                ...prev,
                                [providerId]: true,
                              }));
                              window.clearInterval(interval);
                              window.dispatchEvent(new Event("brimble:git-connection-changed"));
                              toast.success(`${providerId.charAt(0).toUpperCase() + providerId.slice(1)} connected successfully`);
                            }
                          } catch {
                            return;
                          }
                        }, 3000);
                        window.setTimeout(() => {
                          window.clearInterval(interval);
                          setGitConnectionStatus((prev) => {
                            if (prev[providerId] === null) return { ...prev, [providerId]: false };
                            return prev;
                          });
                        }, 90_000);
                      }
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : `Could not open ${providerId} connection.`);
                    }
                  }}
                  onRequestDeleteAccountOtp={async (turnstileToken) => {
                    try {
                      await requestDeleteAccountOtp({
                        data: { turnstileToken },
                      });
                      toast.success("Verification code sent to your email");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed to send verification code");
                      throw error;
                    }
                  }}
                  onVerifyDeleteAccountOtp={async (code) => {
                    const accessCode = code.trim();
                    if (!/^\d{6}$/.test(accessCode)) {
                      throw new Error("Enter a valid 6-digit code");
                    }
                    try {
                      await confirmDeleteAccount({
                        data: { accessCode },
                      });
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed to delete account");
                      throw error;
                    }
                  }}
                  onDeleteAccount={async () => {
                    posthog.reset();
                    invalidateSessionCache();
                    window.location.href = "/";
                  }}
                  onOpenBilling={() => {
                    setActiveTab(ProfileTab.Billing);
                  }}
                />
              )}
              {activeTab === ProfileTab.Profile && !hasActiveWorkspace && !profile && !isLoadingSettings && (
                <div className="text-sm text-dash-text-faded">Profile settings are unavailable right now.</div>
              )}
              {open && (
                <div
                  className={cn(activeTab === ProfileTab.ActivitySession ? "block" : "hidden")}
                  aria-hidden={activeTab !== ProfileTab.ActivitySession}
                >
                  <ActivitySessionForm workspace={activeWorkspaceSlug} initialData={initialActivityLogs} enabled={open} />
                </div>
              )}
              {activeTab === ProfileTab.Members && activeWorkspaceSlug && (
                <MembersForm
                  workspace={activeWorkspaceSlug}
                  initialTeam={workspaceTeamMembersCache[activeWorkspaceSlug] ?? null}
                  currentUser={profile ? { uniqueId: profile.uniqueId, email: profile.email } : null}
                  showBillingInfo={canSeeBilling}
                  initialEnvironments={initialProjectEnvironments}
                />
              )}
              {activeTab === ProfileTab.Notifications && profile && (
                <NotificationsForm
                  key={`notifications-${settingsScopeKey}`}
                  profile={profile}
                  canEdit={canEditWorkspace}
                  workspace={activeWorkspaceSlug}
                  webhooks={snapshot?.webhooks}
                  onTestWebhook={async (url, type) => {
                    try {
                      await testWebhook({ data: { url, type } });
                      toast.success("Test webhook sent successfully");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed to send test webhook");
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
                      const nextWebhooks = data.updateWebhooks
                        ? await updateWebhooks({
                            data: {
                              webhookUrl: data.webhookUrl,
                              discordUrl: data.discordUrl,
                              slackUrl: data.slackUrl,
                              events: data.events,
                            },
                          })
                        : snapshot?.webhooks;

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
                      toast.error(error instanceof Error ? error.message : "Failed to save notification settings");
                    }
                  }}
                />
              )}
              {activeTab === ProfileTab.Notifications && !profile && !isLoadingSettings && (
                <div className="text-sm text-dash-text-faded">Notification settings are unavailable right now.</div>
              )}
              {activeTab === ProfileTab.Billing && profile && hasActiveWorkspace && !workspaceTeam && (
                <div className="text-sm text-dash-text-faded">Loading workspace billing…</div>
              )}
              {activeTab === ProfileTab.Billing && profile && (!hasActiveWorkspace || workspaceTeam) && (
                <BillingForm
                  key={`billing-${settingsScopeKey}`}
                  profile={profile}
                  initialPaymentMethods={initialPaymentMethods}
                  initialInvoices={hasActiveWorkspace ? undefined : initialInvoices}
                  initialSubscriptionStats={initialSubscriptionStats}
                  initialUserOverview={initialUserOverview}
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
                <div className="text-sm text-dash-text-faded">Billing settings are unavailable right now.</div>
              )}
              {activeTab === ProfileTab.Security && (
                <SecurityForm
                  email={profile?.email ?? ""}
                  firstName={profile?.firstName ?? profile?.username ?? ""}
                  initialStatus={twoFactorStatus}
                  initialPasskeys={prefetchedPasskeys}
                  onStatusChange={setTwoFactorStatus}
                  onPasskeysChange={setPrefetchedPasskeys}
                  onChangeEmail={async (email) => {
                    try {
                      await requestEmailVerification({ data: { email } });
                      toast.success("Verification email sent");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed to send verification email");
                    }
                  }}
                />
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function getBuildLockReason(buildDisabledBy?: string | null): string | null {
  switch (buildDisabledBy?.toLowerCase()) {
    case "system":
      return "Builds were disabled by the system. Contact support to re-enable.";
    case "payment_failure":
      return "Builds were disabled due to a failed payment. Update your billing to re-enable.";
    default:
      return null;
  }
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  const haptics = useHaptics();
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        haptics.selection();
        onChange(!checked);
      }}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-[#006fff]" : "bg-[#f2f4f7] dark:bg-[#3a3a3c]",
        disabled && "cursor-not-allowed opacity-50",
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
        <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">{title}</span>
        <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">{description}</span>
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

const fallbackEventGroups: EventGroup[] = [
  {
    key: "domain",
    title: "Domain Events",
    icon: "/icons/domains.svg",
    events: [
      {
        key: "domain.purchased",
        title: "Domain Purchased",
        description: "Notify when a domain is purchased successfully",
      },
      {
        key: "domain.created",
        title: "Domain Created",
        description: "Notify when a domain is created in the system",
      },
      {
        key: "domain.renewed",
        title: "Domain Renewed",
        description: "Notify when a domain is renewed successfully",
      },
      {
        key: "domain.expired",
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
        key: "deployment.failed",
        title: "Deployment Failed",
        description: "Notify when deployments fail or encounter errors",
      },
      {
        key: "deployment.started",
        title: "Deployment Started",
        description: "Notify when deployments are initiated",
      },
      {
        key: "deployment.success",
        title: "Deployment Success",
        description: "Notify when deployments complete successfully",
      },
      {
        key: "project.domain.updated",
        title: "Project Domain Updated",
        description: "Notify when a project domain has been updated",
      },
      {
        key: "deployment.created",
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
        key: "payment.successful",
        title: "Payment Successful",
        description: "Notify when payment is processed successfully",
      },
      {
        key: "payment.failed",
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
        key: "database.created",
        title: "Database Created",
        description: "Notify when a database is created",
      },
      {
        key: "database.backup.completed",
        title: "Database Backup Completed",
        description: "Notify when database backup completes",
      },
    ],
  },
  {
    key: "project",
    title: "Project Events",
    icon: "/icons/project.svg",
    events: [
      {
        key: "project.created",
        title: "Project Created",
        description: "Notify when a project has been successfully created",
      },
      {
        key: "project.updated",
        title: "Project Updated",
        description: "Notify when a project has been successfully updated",
      },
      {
        key: "project.deleted",
        title: "Project Deleted",
        description: "Notify when a project has been successfully deleted",
      },
    ],
  },
  {
    key: "autoscaling",
    title: "Autoscaling Events",
    icon: "/icons/scaling.svg",
    events: [
      {
        key: "autoscaling.group.created",
        title: "Autoscaling Group Created",
        description: "Notify when an autoscaling group has been created",
      },
      {
        key: "autoscaling.group.updated",
        title: "Autoscaling Group Updated",
        description: "Notify when an autoscaling group has been updated",
      },
      {
        key: "autoscaling.group.deleted",
        title: "Autoscaling Group Deleted",
        description: "Notify when an autoscaling group has been deleted",
      },
    ],
  },
  {
    key: "env",
    title: "Env Events",
    icon: "/icons/settings.svg",
    events: [
      {
        key: "environment.variables.added",
        title: "Environment Variables Added",
        description: "Notify when environment variables have been added",
      },
      {
        key: "environment.variables.updated",
        title: "Environment Variables Updated",
        description: "Notify when environment variables have been updated",
      },
      {
        key: "environment.variables.deleted",
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
        key: "dns.record.created",
        title: "DNS Record Created",
        description: "Notify when a DNS record has been created",
      },
      {
        key: "dns.record.updated",
        title: "DNS Record Updated",
        description: "Notify when a DNS record has been updated",
      },
      {
        key: "dns.record.deleted",
        title: "DNS Record Deleted",
        description: "Notify when a DNS record has been deleted",
      },
    ],
  },
];

function toEventGroupKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeServerWebhookGroups(groups?: ServerWebhookGroup[] | null): EventGroup[] {
  if (!Array.isArray(groups)) {
    return [];
  }

  const fallbackIconsByTitle = new Map(fallbackEventGroups.map((group) => [group.title.trim().toLowerCase(), group.icon]));

  return groups
    .map((group) => {
      const title = String(group?.title ?? "").trim();
      if (!title || title.toLowerCase() === "all events") {
        return null;
      }

      const events = Array.isArray(group?.events)
        ? group.events
            .map((event) => {
              const key = String(event?.key ?? "").trim();
              if (!key || key === "*") {
                return null;
              }

              return {
                key,
                title: String(event?.label ?? key).trim() || key,
                description: String(event?.description ?? "").trim(),
              } satisfies EventItem;
            })
            .filter((event): event is EventItem => event !== null)
        : [];

      if (events.length === 0) {
        return null;
      }

      return {
        key: toEventGroupKey(title),
        title,
        icon: fallbackIconsByTitle.get(title.toLowerCase()),
        events,
      } satisfies EventGroup;
    })
    .filter((group): group is EventGroup => group !== null);
}

function hasWildcardEventEnabled(groups?: ServerWebhookGroup[] | null): boolean {
  if (!Array.isArray(groups)) {
    return false;
  }

  return groups.some((group) =>
    Array.isArray(group?.events) ? group.events.some((event) => event?.key === "*" && event?.enabled) : false,
  );
}

function Checkbox({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex size-[14px] shrink-0 items-center justify-center rounded-[3px] border shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] transition-colors ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      } ${checked ? "border-[#4879f8] bg-[#4879f8]" : "border-transparent bg-dash-bg dark:border-white/20 dark:bg-transparent"}`}
    >
      {checked && (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none" className="text-white">
          <path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function EventGroupCard({
  group,
  expanded,
  onExpandedChange,
  groupEnabled,
  onGroupToggle,
  eventStates,
  onEventToggle,
  disabled,
}: {
  group: EventGroup;
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
  groupEnabled: boolean;
  onGroupToggle: (v: boolean) => void;
  eventStates: Record<string, boolean>;
  onEventToggle: (key: string, v: boolean) => void;
  disabled?: boolean;
}) {
  const checkedCount = group.events.filter((e) => groupEnabled && (eventStates[e.key] ?? false)).length;

  return (
    <div className="flex flex-col">
      {/* Collapsible header row */}
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
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
            <span className="text-[10px] font-semibold text-[#f5a623]">{group.title.slice(0, 1)}</span>
          )}
        </div>
        <span className="flex-1 text-sm font-normal leading-5 text-dash-text-strong">{group.title}</span>
        {!expanded ? (
          <span className="text-xs text-dash-text-faded">
            {checkedCount === group.events.length ? `${group.events.length} events` : `${checkedCount} of ${group.events.length}`}
          </span>
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) onGroupToggle(!groupEnabled);
            }}
            className={cn("text-xs text-[#4879f8] hover:underline", disabled && "pointer-events-none opacity-50")}
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
                  className={cn("flex items-center gap-2", disabled ? "cursor-not-allowed" : "cursor-pointer")}
                >
                  <Checkbox
                    checked={groupEnabled && (eventStates[event.key] ?? false)}
                    onChange={(v) => onEventToggle(event.key, v)}
                    disabled={disabled}
                  />
                  <span className="text-sm font-light text-dash-text-body">{event.title}</span>
                </label>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function isValidWebhookUrl(value: string, type: "discord" | "slack" | "custom"): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  if (type === "discord") {
    return (host === "discord.com" || host === "discordapp.com") && parsed.pathname.startsWith("/api/webhooks/");
  }
  if (type === "slack") {
    return host === "hooks.slack.com" && parsed.pathname.startsWith("/services/");
  }
  return true;
}

function NotificationsForm({
  profile,
  canEdit = true,
  workspace,
  webhooks,
  onTestWebhook,
  onSave,
}: {
  profile: UserProfile;
  canEdit?: boolean;
  workspace?: string | null;
  webhooks?: {
    webhookUrl: string;
    discordUrl: string;
    slackUrl: string;
    groups: ServerWebhookGroup[];
  };
  onTestWebhook?: (url: string, type: "discord" | "slack" | "custom") => Promise<void> | void;
  onSave?: (data: {
    emailNotifications: boolean;
    mute: boolean;
    webhookUrl: string | null;
    discordUrl: string | null;
    slackUrl: string | null;
    events: string[];
    updateWebhooks: boolean;
  }) => Promise<void> | void;
}) {
  const [emailNotifs, setEmailNotifs] = useState(profile.notifications?.email ?? false);
  const [pushNotifs, setPushNotifs] = useState(() => isPushEnabled());
  const isMuted = profile.notifications?.mute ?? false;
  const [discordUrl, setDiscordUrl] = useState(webhooks?.discordUrl ?? "");
  const [slackUrl, setSlackUrl] = useState(webhooks?.slackUrl ?? "");
  const [webhookUrl, setWebhookUrl] = useState(webhooks?.webhookUrl ?? "");
  const [allEvents, setAllEvents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  async function handlePushToggle(enabled: boolean) {
    if (!enabled) {
      setPushNotifs(false);
      setPushEnabled(false, workspace);
      return;
    }

    if (typeof window === "undefined" || !window.Notification) {
      toast.error("Your browser doesn't support push notifications.");
      return;
    }

    const permission = await window.Notification.requestPermission();

    if (permission === "granted") {
      setPushNotifs(true);
      setPushEnabled(true, workspace);
    } else {
      setPushNotifs(false);
      setPushEnabled(false, workspace);
      toast.error("Notifications blocked by your browser. Enable them in your browser's site settings.");
    }
  }

  async function handleTestWebhook(url: string, type: "discord" | "slack" | "custom") {
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

  const [eventToggles, setEventToggles] = useState<Record<string, boolean>>({});
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);

  const normalizedServerGroups = useMemo(() => normalizeServerWebhookGroups(webhooks?.groups), [webhooks?.groups]);
  const groupsForUi: EventGroup[] = normalizedServerGroups.length > 0 ? normalizedServerGroups : fallbackEventGroups;
  const wildcardEventEnabled = useMemo(() => hasWildcardEventEnabled(webhooks?.groups), [webhooks?.groups]);

  useEffect(() => {
    setEmailNotifs(profile.notifications?.email ?? false);
  }, [profile.notifications?.email]);

  useEffect(() => {
    if (expandedGroupKey && !groupsForUi.some((group) => group.key === expandedGroupKey)) {
      setExpandedGroupKey(null);
    }
  }, [expandedGroupKey, groupsForUi]);

  useEffect(() => {
    setWebhookUrl(webhooks?.webhookUrl ?? "");
    setDiscordUrl(webhooks?.discordUrl ?? "");
    setSlackUrl(webhooks?.slackUrl ?? "");

    const nextEvents: Record<string, boolean> = {};
    const nextGroups: Record<string, boolean> = {};

    const serverEventStates = new Map<string, boolean>();
    if (Array.isArray(webhooks?.groups)) {
      for (const group of webhooks.groups) {
        if (!Array.isArray(group?.events)) {
          continue;
        }

        for (const event of group.events) {
          const key = String(event?.key ?? "").trim();
          if (!key || key === "*") {
            continue;
          }
          serverEventStates.set(key, Boolean(event?.enabled));
        }
      }
    }

    for (const group of groupsForUi) {
      const groupKey = group.key;
      let allEnabled = group.events.length > 0;

      for (const event of group.events) {
        const enabled = wildcardEventEnabled ? true : (serverEventStates.get(event.key) ?? false);
        nextEvents[event.key] = enabled;
        if (!enabled) {
          allEnabled = false;
        }
      }

      nextGroups[groupKey] = allEnabled;
    }

    setEventToggles(nextEvents);
    setGroupToggles(nextGroups);
  }, [groupsForUi, webhooks, wildcardEventEnabled]);

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

  const inputClass = dashInputClassName;

  const { webhookEnabled } = usePlanGate(profile.subscriptionPlanType ?? "");
  const webhooksFeatureEnabled = useFeatureFlag(FeatureFlags.ENABLE_WEBHOOKS);
  const webhookInteractionsEnabled = canEdit && webhookEnabled;

  const discordUrlValid = isValidWebhookUrl(discordUrl, "discord");
  const slackUrlValid = isValidWebhookUrl(slackUrl, "slack");
  const webhookUrlValid = isValidWebhookUrl(webhookUrl, "custom");

  return (
    <div className="flex flex-col gap-[30px]">
      {/* Push notifications */}
      <div className="flex max-w-[488px] items-center justify-between">
        <div className="flex items-center gap-[18px]">
          <div className="flex shrink-0 items-center justify-center">
            <img src="/icons/bell.svg" alt="" className="size-12" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Push notifications</span>
            <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
              {isMuted ? "Unmute notifications to enable browser alerts" : "Get browser alerts when your deployments finish"}
            </span>
          </div>
        </div>
        <Toggle checked={pushNotifs && !isMuted} onChange={handlePushToggle} disabled={isMuted} />
      </div>

      {/* Email notifications */}
      <div className="flex max-w-[488px] items-center justify-between">
        <div className="flex items-center gap-[18px]">
          <div className="flex shrink-0 items-center justify-center">
            <img src="/icons/email-settings.svg" alt="" className="size-12" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Email notifications</span>
            <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
              Get alerts sent directly to your email address
            </span>
          </div>
        </div>
        <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
      </div>

      {webhooksFeatureEnabled && (
        <>
          <hr className="-ml-8 border-dash-border-soft" />
          {!webhookEnabled && (
            <div className="max-w-[488px] rounded-[6px] bg-[#f5a623]/8 px-3.5 py-3 text-sm text-dash-text-faded">
              Your current plan doesn't support webhooks. Upgrade to a higher plan to configure webhook URLs and event subscriptions.
            </div>
          )}
          {/* Webhook URLs */}
          <div className="flex max-w-[488px] flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Discord webhook URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={discordUrl}
                  onChange={(e) => setDiscordUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  disabled={!webhookInteractionsEnabled}
                  aria-invalid={!discordUrlValid}
                  className={cn(
                    inputClass,
                    "flex-1",
                    !webhookInteractionsEnabled && "opacity-60 cursor-not-allowed",
                    !discordUrlValid && "!shadow-[0px_1px_2px_rgba(239,68,68,0.2),0px_0px_0px_1px_#ef4444]",
                  )}
                />
                <button
                  onClick={() => handleTestWebhook(discordUrl, "discord")}
                  disabled={!webhookInteractionsEnabled || !discordUrl.trim() || !discordUrlValid || testingWebhook === "discord"}
                  className="flex h-[40px] shrink-0 items-center gap-1.5 rounded-[6px] border border-dash-border bg-dash-bg px-3 text-sm font-medium text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:pointer-events-none disabled:opacity-40"
                >
                  <Send className="size-3.5" />
                  {testingWebhook === "discord" ? "Sending..." : "Test"}
                </button>
              </div>
              {!discordUrlValid && (
                <p className="text-xs text-red-500">Must be a Discord webhook URL (https://discord.com/api/webhooks/...)</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Slack webhook URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={slackUrl}
                  onChange={(e) => setSlackUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  disabled={!webhookInteractionsEnabled}
                  aria-invalid={!slackUrlValid}
                  className={cn(
                    inputClass,
                    "flex-1",
                    !webhookInteractionsEnabled && "opacity-60 cursor-not-allowed",
                    !slackUrlValid && "!shadow-[0px_1px_2px_rgba(239,68,68,0.2),0px_0px_0px_1px_#ef4444]",
                  )}
                />
                <button
                  onClick={() => handleTestWebhook(slackUrl, "slack")}
                  disabled={!webhookInteractionsEnabled || !slackUrl.trim() || !slackUrlValid || testingWebhook === "slack"}
                  className="flex h-[40px] shrink-0 items-center gap-1.5 rounded-[6px] border border-dash-border bg-dash-bg px-3 text-sm font-medium text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:pointer-events-none disabled:opacity-40"
                >
                  <Send className="size-3.5" />
                  {testingWebhook === "slack" ? "Sending..." : "Test"}
                </button>
              </div>
              {!slackUrlValid && <p className="text-xs text-red-500">Must be a Slack webhook URL (https://hooks.slack.com/services/...)</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Custom webhook URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  disabled={!webhookInteractionsEnabled}
                  aria-invalid={!webhookUrlValid}
                  className={cn(
                    inputClass,
                    "flex-1",
                    !webhookInteractionsEnabled && "opacity-60 cursor-not-allowed",
                    !webhookUrlValid && "!shadow-[0px_1px_2px_rgba(239,68,68,0.2),0px_0px_0px_1px_#ef4444]",
                  )}
                />
                <button
                  onClick={() => handleTestWebhook(webhookUrl, "custom")}
                  disabled={!webhookInteractionsEnabled || !webhookUrl.trim() || !webhookUrlValid || testingWebhook === "custom"}
                  className="flex h-[40px] shrink-0 items-center gap-1.5 rounded-[6px] border border-dash-border bg-dash-bg px-3 text-sm font-medium text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:pointer-events-none disabled:opacity-40"
                >
                  <Send className="size-3.5" />
                  {testingWebhook === "custom" ? "Sending..." : "Test"}
                </button>
              </div>
              {!webhookUrlValid && <p className="text-xs text-red-500">Must be a valid https:// URL</p>}
            </div>
          </div>

          <hr className="-ml-8 border-dash-border-soft" />

          {/* Event Notifications */}
          <div className="flex max-w-[488px] flex-col gap-2">
            {/* Section header */}
            <div className="flex items-center justify-between pb-1">
              <span className="text-sm font-medium leading-5 tracking-[-0.0224px] text-dash-text-strong">Event Notifications</span>
              <span className="text-[13px] text-dash-text-faded">
                {enabledCount === totalCount ? "All events enabled" : `${enabledCount} of ${totalCount} enabled`}
              </span>
            </div>

            {/* All Events */}
            <div className="flex items-center py-2">
              <div className="flex items-center gap-2.5">
                <Checkbox checked={allEvents} onChange={handleAllEventsToggle} disabled={!webhookInteractionsEnabled} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-5 text-dash-text-strong">All Events</span>
                  <span className="text-[13px] leading-5 text-dash-text-faded">Subscribe to all current and future events</span>
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
                    expanded={expandedGroupKey === group.key}
                    onExpandedChange={(next) => setExpandedGroupKey(next ? group.key : null)}
                    groupEnabled={groupToggles[group.key] ?? false}
                    onGroupToggle={(v) => handleGroupToggle(group.key, v)}
                    eventStates={eventToggles}
                    onEventToggle={handleEventToggle}
                    disabled={!webhookInteractionsEnabled}
                  />
                  {i < groupsForUi.length - 1 && <hr className="border-dash-border-soft" />}
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
          disabled={!canEdit || isSaving}
          loading={isSaving}
          loadingLabel="Saving..."
          onClick={async () => {
            const selectedEvents = !webhookInteractionsEnabled
              ? []
              : Object.entries(eventToggles)
                  .filter(([, enabled]) => enabled)
                  .map(([key]) => key);

            setIsSaving(true);

            try {
              await onSave?.({
                emailNotifications: emailNotifs,
                mute: profile.notifications?.mute ?? false,
                webhookUrl: !webhookEnabled ? null : webhookUrl.trim() || null,
                discordUrl: !webhookEnabled ? null : discordUrl.trim() || null,
                slackUrl: !webhookEnabled ? null : slackUrl.trim() || null,
                events: selectedEvents,
                updateWebhooks: webhookInteractionsEnabled,
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
  role: "Creator" | "Administrator" | "Member" | "Viewer";
  gradient?: string;
  avatarUrl?: string;
  userId?: string;
  is2FACompliant?: boolean;
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
  Viewer: "bg-[#8b5cf6]/10 text-[#8b5cf6]",
};

function normalizeMemberRole(member: TeamMember): Member["role"] {
  return normalizeRole(member);
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
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}

function mapActiveMembers(team?: TeamDetails | null): Member[] {
  if (!team?.members?.length) return [];

  return team.members
    .filter((member) => member.accepted !== false)
    .map((member) => {
      const name = [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || member.username || member.email;
      const role = normalizeMemberRole(member);
      return {
        id: member.id,
        name,
        email: member.email,
        role,
        avatarUrl: member.avatarUrl,
        gradient: buildAvatarGradient(member.email || name || member.id),
        userId: member.userId,
        is2FACompliant: member.is2FACompliant,
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
      sentAt: formatRelativeInviteTime(member.invitedAt ?? member.createdAt ?? member.updatedAt),
    }));
}

const ASSIGNABLE_ROLES: Array<{
  value: string;
  label: string;
  description: string;
}> = [
  {
    value: "ADMINISTRATOR",
    label: "Administrator",
    description: "Can manage members, environments, and settings",
  },
  {
    value: "MEMBER",
    label: "Member",
    description: "Can access assigned environments and deploy",
  },
  {
    value: "VIEWER",
    label: "Viewer",
    description: "Read-only access to assigned environments",
  },
];

function MemberActionMenu({
  member,
  onRemove,
  onChangeRole,
  onToggleEnv,
  removing,
  changingRole,
  environments,
  memberEnvIds,
  envBusyId,
  canChangeRole = false,
  canRemove = false,
}: {
  member: Member;
  onRemove?: (member: Member) => void | Promise<void>;
  onChangeRole?: (member: Member, role: string) => Promise<boolean> | boolean;
  onToggleEnv?: (memberId: string, envId: string) => void;
  removing?: boolean;
  changingRole?: boolean;
  environments?: ProjectEnvironment[];
  memberEnvIds?: Set<string>;
  envBusyId?: string | null;
  canChangeRole?: boolean;
  canRemove?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [subMenu, setSubMenu] = useState<"role" | "env" | null>(null);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const roleChangeInFlight = changingRole || pendingRole !== null;
  const hasEnvironments = (environments?.length ?? 0) > 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (roleChangeInFlight) return;
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSubMenu(null);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, roleChangeInFlight]);

  if (!canChangeRole && !canRemove) {
    return null;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          setSubMenu(null);
        }}
        className="shrink-0 text-dash-text-faded transition-colors hover:text-dash-text-strong"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {/* Main menu */}
      {open && !subMenu && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[190px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-lg">
          {canChangeRole && (
            <button
              onClick={() => setSubMenu("role")}
              disabled={roleChangeInFlight}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
            >
              <Shield className="size-3.5" />
              Change role
            </button>
          )}
          {canChangeRole && hasEnvironments && (
            <button
              onClick={() => setSubMenu("env")}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
            >
              <TreeStructure className="size-3.5" weight="bold" />
              Environments
            </button>
          )}
          {canRemove && (
            <>
              {(canChangeRole || hasEnvironments) && <hr className="my-1 border-dash-border-soft" />}
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
            </>
          )}
        </div>
      )}

      {/* Role picker */}
      {open && subMenu === "role" && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[220px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-lg">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <button onClick={() => setSubMenu(null)} className="text-dash-text-faded transition-colors hover:text-dash-text-strong">
              <ArrowLeft className="size-3.5" />
            </button>
            <span className="text-xs font-medium text-dash-text-faded">Select role</span>
          </div>
          <hr className="my-1 border-dash-border-soft" />
          {ASSIGNABLE_ROLES.map((role) => {
            const isCurrentRole = member.role === role.label;
            const isUpdatingRole = pendingRole === role.value && roleChangeInFlight;
            return (
              <button
                key={role.value}
                disabled={isCurrentRole || roleChangeInFlight}
                onClick={async () => {
                  if (isCurrentRole || roleChangeInFlight) return;
                  setPendingRole(role.value);
                  try {
                    const didUpdateRole = await onChangeRole?.(member, role.value);
                    if (didUpdateRole !== false) {
                      setOpen(false);
                      setSubMenu(null);
                    }
                  } finally {
                    setPendingRole(null);
                  }
                }}
                className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-dash-bg-elevated disabled:opacity-50 ${
                  isCurrentRole ? "bg-dash-bg-elevated" : ""
                }`}
              >
                <span className="flex items-center gap-2 text-sm text-dash-text-body">
                  {role.label}
                  {isUpdatingRole && <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" />}
                  {isCurrentRole && <span className="text-[10px] text-dash-text-extra-faded">Current</span>}
                </span>
                <span className="text-[11px] leading-tight text-dash-text-extra-faded">
                  {isUpdatingRole ? "Updating role..." : role.description}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Environment picker */}
      {open && subMenu === "env" && environments && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[220px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-lg">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <button onClick={() => setSubMenu(null)} className="text-dash-text-faded transition-colors hover:text-dash-text-strong">
              <ArrowLeft className="size-3.5" />
            </button>
            <span className="text-xs font-medium text-dash-text-faded">Environment access</span>
          </div>
          <hr className="my-1 border-dash-border-soft" />
          {environments.map((env) => {
            const checked = memberEnvIds?.has(env._id) ?? false;
            const isBusy = envBusyId === env._id;
            return (
              <button
                key={env._id}
                disabled={!!envBusyId}
                onClick={() => onToggleEnv?.(member.id, env._id)}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated disabled:opacity-50"
              >
                <span
                  className={`flex size-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors ${
                    isBusy
                      ? "border-dash-border-soft bg-transparent"
                      : checked
                        ? "border-[#4879f8] bg-[#4879f8]"
                        : "border-dash-border-soft bg-transparent"
                  }`}
                >
                  {isBusy ? (
                    <span className="size-2.5 animate-spin rounded-full border-[1.5px] border-dash-text-faded border-t-transparent" />
                  ) : checked ? (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </span>
                {env.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function countNonCompliantMembers(team: TeamDetails | null): number {
  if (!team?.members?.length) return 0;
  return team.members.filter((m) => m.accepted !== false && normalizeRole(m) !== "Creator" && m.is2FACompliant === false).length;
}

function WorkspaceSecuritySection({
  workspace,
  team,
  onChanged,
}: {
  workspace: string;
  team: TeamDetails | null;
  onChanged: (next: { enforce2FA: boolean }) => void;
}) {
  const toggleEnforcement = useServerFn(toggleTeamTwoFactorEnforcementServerFn as any) as (args: {
    data: { workspace: string; enforce: boolean; twoFactorToken?: string };
  }) => Promise<{ id: string; enforce2FA: boolean }>;
  const { requestStepUp } = useStepUpTwoFactor();
  const [busy, setBusy] = useState(false);

  const enforce2FA = Boolean(team?.enforce2FA);
  const nonCompliantCount = enforce2FA ? countNonCompliantMembers(team) : 0;

  const handleToggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await withStepUp(
        (twoFactorToken) => toggleEnforcement({ data: { workspace, enforce: next, twoFactorToken } }),
        requestStepUp,
      );
      onChanged({ enforce2FA: result.enforce2FA });
      toast.success(result.enforce2FA ? "2FA enforcement enabled" : "2FA enforcement disabled");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update 2FA enforcement";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Require 2FA for all members</span>
            {enforce2FA && (
              <span className="rounded-full bg-[#4879f8]/10 px-2 py-0.5 text-[10px] font-medium text-[#4879f8]">2FA required</span>
            )}
          </div>
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
            Non-compliant members lose access until they enable 2FA on their account.
          </span>
          {enforce2FA && nonCompliantCount > 0 && (
            <span className="text-xs leading-4 text-[#f5a623]">
              {nonCompliantCount} {nonCompliantCount === 1 ? "member is" : "members are"} non-compliant
            </span>
          )}
        </div>
        <ToggleSwitch checked={enforce2FA} onChange={handleToggle} disabled={busy} />
      </div>
    </div>
  );
}

function MembersForm({
  workspace,
  initialTeam = null,
  currentUser = null,
  showBillingInfo = true,
  initialEnvironments = null,
}: {
  workspace: string;
  initialTeam?: TeamDetails | null;
  currentUser?: Pick<UserProfile, "uniqueId" | "email"> | null;
  showBillingInfo?: boolean;
  initialEnvironments?: ProjectEnvironment[] | null;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const pricing = usePricing();
  const getTeamMembers = useServerFn(getWorkspaceTeamMembersServerFn as any) as (args: {
    data: { workspace: string };
  }) => Promise<TeamDetails>;
  const inviteTeamMembers = useServerFn(inviteWorkspaceTeamMembersServerFn as any) as (args: {
    data: { workspace: string; members: string[] };
  }) => Promise<{ ok: true }>;
  const resendInvite = useServerFn(resendWorkspaceTeamInviteServerFn as any) as (args: {
    data: { workspace: string; email: string };
  }) => Promise<{ ok: true }>;
  const removeTeamMember = useServerFn(removeWorkspaceTeamMemberServerFn as any) as (args: {
    data: { workspace: string; memberId: string };
  }) => Promise<{ ok: true }>;
  const changeMemberRole = useServerFn(updateMemberRoleServerFn as any) as (args: {
    data: { workspace: string; memberId: string; role: string };
  }) => Promise<{ ok: true }>;
  const transferOwnership = useServerFn(transferOwnershipServerFn as any) as (args: {
    data: { workspace: string; memberId: string; twoFactorToken?: string };
  }) => Promise<TeamOwnershipTransfer>;
  const { requestStepUp } = useStepUpTwoFactor();

  const [team, setTeam] = useState<TeamDetails | null>(initialTeam);
  const [isLoadingMembers, setIsLoadingMembers] = useState(!initialTeam);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [busyMemberAction, setBusyMemberAction] = useState<"resend" | "revoke" | "remove" | "role" | null>(null);
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>(initialEnvironments ?? []);
  const [envAccess, setEnvAccess] = useState<Record<string, Set<string>>>({});
  const [envBusyKey, setEnvBusyKey] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);
  const [transferConfirmText, setTransferConfirmText] = useState("");
  const [transferring, setTransferring] = useState(false);

  const updateMemberEnvs = useServerFn(updateMemberEnvironmentsServerFn as any) as (args: {
    data: {
      workspace: string;
      memberId: string;
      project_environments: string[];
    };
  }) => Promise<{ ok: true }>;

  const getEnvironments = useServerFn(listProjectEnvironmentsServerFn as any) as (args: {
    data: { workspace?: string };
  }) => Promise<ProjectEnvironment[]>;

  useEffect(() => {
    if (initialEnvironments?.length) {
      setEnvironments(initialEnvironments);
    } else {
      void getEnvironments({ data: { workspace } })
        .then(setEnvironments)
        .catch(() => {});
    }
  }, [getEnvironments, initialEnvironments, workspace]);

  useEffect(() => {
    if (!team?.members?.length) return;
    setEnvAccess((prev) => {
      const next = { ...prev };
      for (const m of team.members) {
        const memberId = String(m.id);
        if (m.project_environments?.length) {
          next[memberId] = new Set(m.project_environments.map((e) => e._id));
        } else if (!next[memberId]) {
          next[memberId] = new Set(environments.map((e) => e._id));
        }
      }
      return next;
    });
  }, [team, environments]);

  const toggleEnvAccess = async (memberId: string, envId: string) => {
    const current = new Set(envAccess[memberId] ?? []);
    if (current.has(envId)) current.delete(envId);
    else current.add(envId);
    const nextIds = Array.from(current);

    setEnvAccess((prev) => ({ ...prev, [memberId]: current }));
    setEnvBusyKey(`${memberId}:${envId}`);

    try {
      await updateMemberEnvs({
        data: {
          workspace,
          memberId,
          project_environments: nextIds,
        },
      });
    } catch (error) {
      const reverted = new Set(current);
      if (reverted.has(envId)) reverted.delete(envId);
      else reverted.add(envId);
      setEnvAccess((prev) => ({ ...prev, [memberId]: reverted }));
      toast.error(error instanceof Error ? error.message : "Failed to update environment access");
    } finally {
      setEnvBusyKey(null);
    }
  };

  const members = mapActiveMembers(team);
  const pendingInvites = mapPendingInvites(team);
  const configuredSeats = team?.seatCount ?? 0;
  const memberCount = team?.totalMembers ?? members.length;
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
  const currentUserRole = currentUserTeamMember ? normalizeMemberRole(currentUserTeamMember) : null;
  const canManageMembers = currentUserRole === "Creator" || currentUserRole === "Administrator";

  const refreshMembers = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoadingMembers(true);
      }
      setMembersError(null);

      try {
        const nextTeam = await getTeamMembers({ data: { workspace } });
        setTeam(nextTeam);
      } catch (error) {
        setMembersError(error instanceof Error ? error.message : "Failed to load team members");
      } finally {
        if (!options?.silent) {
          setIsLoadingMembers(false);
        }
      }
    },
    [getTeamMembers, workspace],
  );

  useEffect(() => {
    setTeam(initialTeam);
    setIsLoadingMembers(!initialTeam);
    setMembersError(null);
    void refreshMembers({ silent: Boolean(initialTeam) });
  }, [workspace, initialTeam, refreshMembers]);

  const enforce2FA = Boolean(team?.enforce2FA);
  const selfNonCompliant = enforce2FA && currentUserTeamMember?.is2FACompliant === false;

  return (
    <div className="flex max-w-[488px] flex-col gap-8">
      {selfNonCompliant && (
        <div className="rounded-[6px] border border-[#f5a623]/30 bg-[#f5a623]/5 px-4 py-3 text-sm leading-5 text-[#a16207] dark:text-[#f5a623]">
          This workspace requires 2FA. Set it up on your account to keep your access.
        </div>
      )}

      {canManageMembers && (
        <>
          <WorkspaceSecuritySection
            workspace={workspace}
            team={team}
            onChanged={({ enforce2FA }) => {
              setTeam((prev) => (prev ? { ...prev, enforce2FA } : prev));
              void refreshMembers({ silent: true });
            }}
          />
          <hr className="-ml-8 border-dash-border-soft" />
        </>
      )}

      {/* Invite button */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">Workspace members</span>
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">Manage who has access to this workspace</span>
        </div>
        <GlossyButton
          onClick={() => setInviteOpen(true)}
          className="px-5"
          disabled={!canManageMembers}
          title={!canManageMembers ? "Only workspace creators and administrators can invite members" : undefined}
        >
          Invite
        </GlossyButton>
      </div>

      <hr className="-ml-8 border-dash-border-soft" />

      {/* Members list */}
      {membersError ? (
        <div className="rounded-[6px] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">{membersError}</div>
      ) : null}
      {isLoadingMembers ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-8 shrink-0 animate-pulse rounded-full bg-dash-bg-elevated" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="h-3.5 w-28 animate-pulse rounded bg-dash-bg-elevated" style={{ animationDelay: `${i * 100}ms` }} />
                <div className="h-3 w-40 animate-pulse rounded bg-dash-bg-elevated" style={{ animationDelay: `${i * 100 + 50}ms` }} />
              </div>
              <div className="h-5 w-16 animate-pulse rounded-full bg-dash-bg-elevated" style={{ animationDelay: `${i * 100 + 100}ms` }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {members.map((member) => {
            const currentEmail = currentUser?.email?.trim().toLowerCase() ?? "";
            const isSelf =
              (member.userId && currentUser?.uniqueId && member.userId === currentUser.uniqueId) ||
              (currentEmail.length > 0 && member.email.trim().toLowerCase() === currentEmail);
            const canManageTarget = canManageMembers && !isSelf && member.role !== "Creator";

            const memberEnvs = envAccess[member.id] ?? new Set<string>();

            return (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar
                  src={member.avatarUrl}
                  fallbackSeed={member.email || member.name || member.id}
                  alt={member.name}
                  className="size-8 shrink-0 rounded-full border border-dash-border-soft object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
                    {member.name}
                    {isSelf ? <span className="text-dash-text-faded"> - You</span> : null}
                  </span>
                  <span className="truncate text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">{member.email}</span>
                </div>
                {enforce2FA && member.role !== "Creator" && member.is2FACompliant === false && (
                  <SimpleTooltip content="Member must enable 2FA on their account to regain access.">
                    <span className="shrink-0 rounded-full bg-[#f5a623]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#f5a623]">
                      Locked out
                    </span>
                  </SimpleTooltip>
                )}
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    roleBadgeStyles[member.role] ?? roleBadgeStyles.Member
                  }`}
                >
                  {member.role}
                </span>
                <MemberActionMenu
                  member={member}
                  removing={busyMemberId === member.id && busyMemberAction === "remove"}
                  changingRole={busyMemberId === member.id && busyMemberAction === "role"}
                  canChangeRole={canManageTarget}
                  canRemove={canManageTarget}
                  environments={canManageTarget ? environments : undefined}
                  memberEnvIds={memberEnvs}
                  envBusyId={envBusyKey?.startsWith(`${member.id}:`) ? envBusyKey.split(":")[1] : null}
                  onToggleEnv={toggleEnvAccess}
                  onChangeRole={async (target, role) => {
                    try {
                      setBusyMemberId(target.id);
                      setBusyMemberAction("role");
                      await changeMemberRole({
                        data: { workspace, memberId: target.id, role },
                      });
                      toast.success("Role updated");
                      await refreshMembers();
                      return true;
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed to update role");
                      return false;
                    } finally {
                      setBusyMemberId(null);
                      setBusyMemberAction(null);
                    }
                  }}
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
                      toast.error(error instanceof Error ? error.message : "Failed to remove member");
                    } finally {
                      setBusyMemberId(null);
                      setBusyMemberAction(null);
                    }
                  }}
                />
              </div>
            );
          })}
          {!members.length && <div className="text-sm text-dash-text-faded">No workspace members found.</div>}
        </div>
      )}

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <>
          <hr className="-ml-8 border-dash-border-soft" />
          <div className="flex flex-col gap-4">
            <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Pending invitations</span>
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-dash-bg-elevated">
                  <span className="text-xs text-dash-text-extra-faded">{invite.email[0].toUpperCase()}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">{invite.email}</span>
                  <span className="text-xs leading-4 text-dash-text-extra-faded">Sent {invite.sentAt}</span>
                </div>
                <SimpleTooltip
                  content={enforce2FA ? "Invitee must enable 2FA on their account before they can join." : "Invitation is pending"}
                >
                  <span className="shrink-0 rounded-full bg-[#f5a623]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#f5a623]">
                    Pending
                  </span>
                </SimpleTooltip>
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
                          toast.error(error instanceof Error ? error.message : "Failed to resend invite");
                        } finally {
                          setBusyMemberId(null);
                          setBusyMemberAction(null);
                        }
                      }}
                      disabled={busyMemberId === invite.id}
                      className="inline-flex items-center gap-1 text-xs text-[#4879f8] transition-colors hover:text-[#3a6ae6] disabled:opacity-50"
                    >
                      {busyMemberId === invite.id && busyMemberAction === "resend" && (
                        <span className="size-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                      )}
                      {busyMemberId === invite.id && busyMemberAction === "resend" ? "Resending..." : "Resend"}
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
                          toast.error(error instanceof Error ? error.message : "Failed to revoke invitation");
                        } finally {
                          setBusyMemberId(null);
                          setBusyMemberAction(null);
                        }
                      }}
                      disabled={busyMemberId === invite.id}
                      className="inline-flex items-center gap-1 text-xs text-dash-text-faded transition-colors hover:text-red-500 disabled:opacity-50"
                    >
                      {busyMemberId === invite.id && busyMemberAction === "revoke" && (
                        <span className="size-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                      )}
                      {busyMemberId === invite.id && busyMemberAction === "revoke" ? "Revoking..." : "Revoke"}
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
      {(() => {
        const extraSeats = Math.max(0, memberCount - configuredSeats);
        const extraCost = extraSeats * pricing.team.costPerMember;
        const baseCost = configuredSeats * pricing.team.costPerMember;
        return (
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-[2px]">
              <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Seat usage</span>
              <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
                {memberCount} of {configuredSeats} included seats used
              </span>
              {showBillingInfo && extraSeats > 0 ? (
                <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
                  {extraSeats} extra {extraSeats === 1 ? "seat" : "seats"} &times; {formatUsdMonthly(pricing.team.costPerMember)}
                  /seat/month
                </span>
              ) : null}
              {showBillingInfo && (
                <span className="text-xs leading-4 tracking-[-0.02px] text-dash-text-extra-faded">
                  Team billing also includes concurrent builds at {formatUsdMonthly(pricing.team.costPerBuild)}/build/month.
                </span>
              )}
            </div>
            {showBillingInfo && (
              <span className="text-lg font-medium text-dash-text-strong">
                {extraSeats > 0 ? `+${formatUsdMonthly(extraCost)}/mo` : `${formatUsdMonthly(baseCost)}/mo`}
              </span>
            )}
          </div>
        );
      })()}

      {/* Transfer ownership danger zone — Creator only */}
      {currentUserRole === "Creator" && (
        <>
          <hr className="-ml-8 border-dash-border-soft" />
          <div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h4 className="text-sm font-medium text-dash-text-strong">Transfer ownership</h4>
                <p className="text-sm font-light leading-[1.3] text-dash-text-faded">
                  Transfer Creator role to another workspace member. You will become an Administrator.
                </p>
              </div>
              <button
                onClick={() => setTransferOpen(true)}
                className="shrink-0 rounded-[4px] border border-red-500/30 bg-gradient-to-b from-red-500 via-red-600 to-red-700 px-4 py-[5px] text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-opacity hover:opacity-90"
              >
                Transfer ownership
              </button>
            </div>
          </div>

          <WarningModal
            open={transferOpen}
            onOpenChange={(open) => {
              setTransferOpen(open);
              if (!open) {
                setTransferTarget(null);
                setTransferConfirmText("");
              }
            }}
            title="Send ownership transfer request?"
            description={
              transferTarget
                ? `Send Creator role transfer request to ${transferTarget.name}. If accepted, you'll become an Administrator. Expires in 7 days.`
                : "Select a member to send a transfer request. If accepted, you'll become an Administrator. Expires in 7 days."
            }
            confirmLabel="Transfer"
            confirmLoadingLabel="Sending..."
            confirmDisabled={!transferTarget || transferConfirmText !== team?.name || transferring}
            closeOnConfirm={false}
            onConfirm={async () => {
              if (!transferTarget) return;
              setTransferring(true);
              try {
                await withStepUp(
                  (twoFactorToken) =>
                    transferOwnership({
                      data: { workspace, memberId: transferTarget.id, twoFactorToken },
                    }),
                  requestStepUp,
                );
                toast.success("Transfer request sent. Expires in 7 days.");
                setTransferOpen(false);
                setTransferTarget(null);
                setTransferConfirmText("");
                await refreshMembers();
              } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to transfer ownership";
                if (/already a pending/i.test(message)) {
                  toast.error("There is already a pending transfer for this team. Cancel it first.");
                } else if (/already the team owner/i.test(message)) {
                  toast.error("This person is already the team owner.");
                } else {
                  toast.error(message);
                }
              } finally {
                setTransferring(false);
              }
            }}
          >
            {/* Member picker */}
            <Dropdown
              value={transferTarget?.id ?? ""}
              options={members.filter((m) => m.role !== "Creator").map((m) => ({ id: m.id, label: `${m.name} (${m.role})` }))}
              onChange={(id) => {
                const match = members.find((m) => m.id === id);
                setTransferTarget(match ?? null);
              }}
              placeholder="Select a member..."
              searchable={members.length > 4}
              searchPlaceholder="Search members..."
            />

            {/* Type-to-confirm */}
            {transferTarget && (
              <div className="flex flex-col gap-2 pt-3">
                <label className="text-sm text-dash-text-faded">
                  Type <span className="font-medium text-dash-text-strong">{team?.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={transferConfirmText}
                  onChange={(e) => setTransferConfirmText(e.target.value)}
                  onPaste={(e) => e.preventDefault()}
                  placeholder={team?.name}
                  className="h-[38px] rounded-[6px] border border-dash-border bg-dash-bg px-3 text-sm text-dash-text-strong outline-none placeholder:text-dash-text-extra-faded focus:border-[#4879f8]/50 focus:ring-1 focus:ring-[#4879f8]/20"
                />
              </div>
            )}
          </WarningModal>
        </>
      )}

      <InviteMembersModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        currentMembers={memberCount}
        includedSeats={configuredSeats}
        currentUserEmail={currentUser?.email ?? null}
        onInvite={async (emails) => {
          await inviteTeamMembers({ data: { workspace, members: emails } });
          toast.success(`Sent ${emails.length} invitation${emails.length === 1 ? "" : "s"}`);
          await refreshMembers();
        }}
      />
    </div>
  );
}
