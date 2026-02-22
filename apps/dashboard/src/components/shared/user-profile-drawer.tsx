import { useState, useRef, useEffect } from "react";
import { Drawer } from "vaul";
import { cn } from "@brimble/ui";
import {
  ArrowLeft,
  Copy,
  HelpCircle,
  MoreHorizontal,
  Shield,
  UserMinus,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { InviteMembersModal } from "../settings/invite-members-modal";
import { WarningModal } from "./warning-modal";
import { GlossyButton } from "./glossy-button";

interface UserProfile {
  firstName: string;
  lastName: string;
  username: string;
  uniqueId: string;
  email: string;
  avatarUrl?: string;
}

const mockProfile: UserProfile = {
  firstName: "Emmanuel",
  lastName: "Akujuobi",
  username: "kemthereem",
  uniqueId: "64799fb0615d68ff27ac8b8f",
  email: "akujuobiemmanuelk@gmail.com",
};

type ProfileTab =
  | "profile"
  | "members"
  | "notifications"
  | "billing"
  | "invoices";

const accountNav: { label: string; key: ProfileTab }[] = [
  { label: "Profile", key: "profile" },
  { label: "Members", key: "members" },
  { label: "Notifications", key: "notifications" },
  { label: "Billing", key: "billing" },
  { label: "Invoices", key: "invoices" },
];

const reachUsNav = [
  { label: "Blog", emoji: "📔" },
  { label: "Follow on twitter", emoji: "🔵" },
  { label: "Discord", emoji: "🟣" },
  { label: "Help", emoji: "🛟" },
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
  onSave,
  onChangeEmail,
}: {
  profile: UserProfile;
  onSave?: (data: { firstName: string; lastName: string; username: string }) => void;
  onChangeEmail?: () => void;
}) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [username, setUsername] = useState(profile.username);
  const [buildsEnabled, setBuildsEnabled] = useState(true);

  const isDirty =
    firstName !== profile.firstName ||
    lastName !== profile.lastName ||
    username !== profile.username;

  const inputClass =
    "w-full rounded-[6px] bg-[#f9fafb] px-3 py-2.5 text-sm leading-6 text-dash-text-strong shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] outline-none placeholder:text-[#9ca3af] focus:shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08),0px_0px_0px_3px_rgba(72,121,248,0.15)] dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08),0px_0px_0px_3px_rgba(72,121,248,0.2)]";

  function handleSave() {
    onSave?.({ firstName, lastName, username });
  }

  function handleDiscard() {
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setUsername(profile.username);
  }

  return (
    <div className="flex max-w-[488px] flex-col gap-8">
      {/* Avatar + Upload */}
      <div className="flex items-center gap-4">
        <div
          className="size-16 shrink-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 62% 30%, #b8cffc, #94b6f8 25%, #6f9cf3 50%, #4b82ee 75%, #2769e9)",
          }}
        />
        <div className="flex flex-col gap-2">
          <button className="flex h-[34px] w-fit items-center rounded-[4px] border border-dash-border bg-dash-bg px-3.5 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated">
            Upload photo
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
      <GlossyButton onClick={handleSave} disabled={!isDirty} fullWidth>
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
            value={profile.email}
            readOnly
            className={cn(inputClass, "text-dash-text-faded")}
          />
          <button
            onClick={onChangeEmail}
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
        <Toggle checked={buildsEnabled} onChange={setBuildsEnabled} />
      </div>

      <hr className="border-dash-border-soft" />

      {/* API Key */}
      <ApiKeySection />
    </div>
  );
}

const MOCK_API_KEY = "brm_sk_a4f8e2c1d7b3094e5f6a1c8d2e9b7f3a4d6e8c0";

function maskKey(key: string) {
  // Show first 7 chars (brm_sk_) and last 4, mask the rest
  const prefix = key.slice(0, 7);
  const suffix = key.slice(-4);
  return `${prefix}${"•".repeat(key.length - 11)}${suffix}`;
}

function ApiKeySection() {
  const [apiKey, setApiKey] = useState(MOCK_API_KEY);
  const [revealed, setRevealed] = useState(false);
  const [rerollOpen, setRerollOpen] = useState(false);

  const inputClass =
    "w-full rounded-[6px] bg-[#f9fafb] px-3 py-2.5 text-sm leading-6 text-dash-text-strong shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] outline-none dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)]";

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
            value={revealed ? apiKey : maskKey(apiKey)}
            readOnly
            className={cn(inputClass, "pr-20 font-mono text-[13px] text-dash-text-faded")}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <button
              onClick={() => setRevealed(!revealed)}
              className="shrink-0 rounded-[4px] p-1 text-dash-text-faded transition-colors hover:text-dash-text-strong"
              title={revealed ? "Hide" : "Reveal"}
            >
              {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <CopyButton text={apiKey} />
          </div>
        </div>

        <button
          onClick={() => setRerollOpen(true)}
          className="flex h-[40px] shrink-0 items-center gap-1.5 rounded-[6px] border border-dash-border bg-dash-bg px-3 text-sm font-medium text-dash-text-body shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated"
        >
          <RefreshCw className="size-3.5" />
          Reroll
        </button>
      </div>

      <WarningModal
        open={rerollOpen}
        onOpenChange={setRerollOpen}
        title="Reroll API key?"
        description="Your current key will be permanently invalidated. Any services using it will lose access immediately."
        confirmLabel="Reroll key"
        cancelLabel="Cancel"
        onConfirm={() => {
          // TODO: wire to API — generate new key
          const newKey = `brm_sk_${Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("")}`;
          setApiKey(newKey);
          setRevealed(true);
        }}
      />
    </div>
  );
}

function ProfileNavSidebar({
  activeTab,
  onTabChange,
  onClose,
  onSignOut,
}: {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  onClose: () => void;
  onSignOut?: () => void;
}) {
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
          {accountNav.map((item) => (
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
              className={cn(navItemBase, "text-dash-text-body hover:bg-dash-bg-elevated")}
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
              className={cn(navItemBase, "text-dash-text-body hover:bg-dash-bg-elevated")}
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
          onClick={onSignOut}
          className={cn(navItemBase, "shrink-0 text-dash-text-body hover:bg-dash-bg-elevated")}
        >
          <span className="text-sm">⛳️</span>
          Sign out
        </button>
      </div>
    </div>
  );
}

export function UserProfileDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");

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
            onSignOut={() => {
              // TODO: wire sign out
              console.log("Sign out");
            }}
          />

          {/* Content area */}
          <div className="scrollbar-hidden flex min-w-0 flex-1 flex-col overflow-y-auto border-l border-dash-border bg-dash-bg">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-dash-border px-8 py-5">
              <Drawer.Title className="text-base font-medium leading-[25px] tracking-[-0.0256px] text-dash-text-strong capitalize">
                {activeTab === "billing" ? "Plan & billing" : activeTab === "members" ? "Members" : activeTab}
              </Drawer.Title>
              <button className="flex size-8 items-center justify-center rounded-full border border-dash-border-soft text-dash-text-faded transition-colors hover:text-dash-text-strong">
                <HelpCircle className="size-4" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 px-8 py-8">
              {activeTab === "profile" && (
                <ProfileForm
                  profile={mockProfile}
                  onSave={(data) => {
                    // TODO: wire to API
                    console.log("Save profile:", data);
                  }}
                  onChangeEmail={() => {
                    // TODO: wire email verification flow
                    console.log("Change email — trigger verification");
                  }}
                />
              )}
              {activeTab === "members" && <MembersForm />}
              {activeTab === "notifications" && <NotificationsForm />}
              {activeTab === "billing" && <BillingForm />}
              {activeTab === "invoices" && <InvoicesForm />}
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

const mockBillingInvoices = ["28th August 2023", "28th July 2023"];

function BillingForm() {
  const [cancelOpen, setCancelOpen] = useState(false);

  return (
    <div className="flex max-w-[488px] flex-col gap-8">
      <div className="relative overflow-hidden rounded-[4px] border border-dash-border bg-[#fcfcfc] dark:border-transparent dark:invert">
        <p className="pr-[116px] px-6 py-3 text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
          You are currently on the Brimble{" "}
          <span className="text-dash-text-strong">Premium</span> plan, you pay{" "}
          <span className="text-dash-text-strong">$30</span> per user, per month.{" "}
          <button className="text-dash-text-strong underline underline-offset-2">
            Go to pricing page.
          </button>
        </p>
        <div className="absolute inset-y-0 right-0 hidden w-[96px] overflow-hidden sm:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,#ffffff_0%,#ececec_48%,#f7f7f7_100%)]" />
          <div className="absolute left-[-8px] top-1/2 h-24 w-20 -translate-y-1/2 bg-gradient-to-r from-[#fafafa] via-[#fafafa] to-transparent" />
          <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[30px] font-extrabold leading-none text-[#d9d9d9] [text-shadow:0px_0.7px_1px_rgba(0,0,0,0.4)]">
            $
          </div>
          <span className="absolute right-3 top-4 size-1.5 rounded-full bg-white/80" />
          <span className="absolute right-8 top-7 size-1.5 rounded-full bg-white/70" />
        </div>
      </div>

      <div className="flex flex-col gap-[30px]">
        <div className="flex items-center gap-[14px]">
          <div className="relative h-12 w-[68px] shrink-0 overflow-hidden rounded-[5px] bg-[radial-gradient(circle_at_84%_10%,#5a5454_0%,#383636_55%,#1f1f1f_100%)] shadow-[0px_1px_1px_rgba(0,0,0,0.16),0px_1px_0px_rgba(0,0,0,0.11)]">
            <div className="absolute left-[7px] top-[19px] h-[10px] w-[14px] rounded-[2px] bg-white/10" />
            <div className="absolute right-[7px] top-[34px] flex items-center gap-0.5">
              <span className="size-[4px] rounded-full bg-[#ea4335]" />
              <span className="size-[4px] rounded-full bg-[#fbbc05]" />
            </div>
          </div>
          <div className="flex flex-col gap-[2px] py-2">
            <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
              Payment cards
            </p>
            <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
              Link your bank cards for payments on Brimble
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-[2px]">
            <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
              Mastercard
            </p>
            <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
              <span className="tabular-nums text-dash-text-strong">9594</span>, expiring{" "}
              <span className="tabular-nums text-dash-text-strong">24/2034</span>
            </p>
          </div>
          <button className="shrink-0 rounded-[8px] border border-dash-border bg-dash-bg px-3.5 py-2 text-sm font-medium leading-5 tracking-[-0.0224px] text-dash-text-body shadow-[0px_1px_2px_rgba(16,24,40,0.05)] transition-colors hover:bg-dash-bg-elevated">
            Update card information
          </button>
        </div>
      </div>

      <hr className="-ml-8 border-dash-border-soft" />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-[2px] py-2">
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
            Payment history and invoices
          </p>
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
            See your billing history with Brimble including invoices
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {mockBillingInvoices.map((date) => (
            <div key={date} className="flex items-center justify-between gap-4">
              <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
                {date}
              </p>
              <button className="rounded-[8px] border border-dash-border bg-dash-bg px-3 py-1.5 text-sm leading-5 tracking-[-0.0224px] text-dash-text-body transition-colors hover:bg-dash-bg-elevated">
                view
              </button>
            </div>
          ))}
        </div>
      </div>

      <hr className="-ml-8 border-dash-border-soft" />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-[2px] py-2">
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
            Manage your subscription
          </p>
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
            Cancel or downgrade from your current plan to the Standard plan
          </p>
        </div>
        <div>
          <button
            onClick={() => setCancelOpen(true)}
            className="rounded-[8px] bg-[#ef2f1f] px-3.5 py-2 text-sm font-semibold leading-5 text-white shadow-[0px_1px_2px_rgba(16,24,40,0.08)] transition-colors hover:bg-[#db2a1b]"
          >
            Cancel subscription
          </button>
        </div>
      </div>

      <WarningModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel your subscription?"
        description="Your plan will be downgraded to the Standard plan at the end of the current billing period. You will lose access to Premium features."
        confirmLabel="Cancel subscription"
        cancelLabel="Keep my plan"
        onConfirm={() => {
          // TODO: wire to API
          console.log("Subscription cancelled");
        }}
      />
    </div>
  );
}

/* ── Event notification data ── */

interface EventItem {
  key: string;
  title: string;
  description: string;
}

interface EventGroup {
  key: string;
  title: string;
  icon: string;
  events: EventItem[];
}

const eventGroups: EventGroup[] = [
  {
    key: "domain",
    title: "Domain Events",
    icon: "/icons/domains.svg",
    events: [
      { key: "domain_purchased", title: "Domain Purchased", description: "Notify when a domain is purchased successfully" },
      { key: "domain_created", title: "Domain Created", description: "Notify when a domain is created in the system" },
      { key: "domain_renewed", title: "Domain Renewed", description: "Notify when a domain is renewed successfully" },
      { key: "domain_expired", title: "Domain Expired", description: "Notify when a domain expires" },
    ],
  },
  {
    key: "deployment",
    title: "Deployment Events",
    icon: "/icons/project.svg",
    events: [
      { key: "deployment_failed", title: "Deployment Failed", description: "Notify when deployments fail or encounter errors" },
      { key: "deployment_started", title: "Deployment Started", description: "Notify when deployments are initiated" },
      { key: "project_domain_updated", title: "Project Domain Updated", description: "Notify when a project domain has been updated" },
      { key: "deployment_created", title: "Deployment Created", description: "Notify when deployments are initiated" },
    ],
  },
  {
    key: "payment",
    title: "Payment Events",
    icon: "/icons/workspace.svg",
    events: [
      { key: "payment_successful", title: "Payment Successful", description: "Notify when payment is processed successfully" },
      { key: "payment_failed", title: "Payment Failed", description: "Notify when payment fails" },
    ],
  },
  {
    key: "database",
    title: "Database Events",
    icon: "/icons/integrations.svg",
    events: [
      { key: "database_created", title: "Database Created", description: "Notify when a database is created" },
      { key: "database_backup_completed", title: "Database Backup Completed", description: "Notify when database backup completes" },
    ],
  },
  {
    key: "env",
    title: "Env Events",
    icon: "/icons/settings.svg",
    events: [
      { key: "env_added", title: "Environment Variables Added", description: "Notify when environment variables have been added" },
      { key: "env_updated", title: "Environment Variables Updated", description: "Notify when environment variables have been updated" },
      { key: "env_deleted", title: "Environment Variables Deleted", description: "Notify when environment variables have been deleted" },
    ],
  },
  {
    key: "dns",
    title: "DNS Events",
    icon: "/icons/discover.svg",
    events: [
      { key: "dns_record_created", title: "DNS Record Created", description: "Notify when a DNS record has been created" },
      { key: "dns_record_updated", title: "DNS Record Updated", description: "Notify when a DNS record has been updated" },
      { key: "dns_record_deleted", title: "DNS Record Deleted", description: "Notify when a DNS record has been deleted" },
    ],
  },
];

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
  return (
    <div className="flex flex-col">
      {/* Group header */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-[#f5a623]/10">
            <img src={group.icon} alt="" className="size-3.5" />
          </div>
          <span className="text-sm font-medium leading-5 text-dash-text-strong">
            {group.title}
          </span>
        </div>
        <Toggle checked={groupEnabled} onChange={onGroupToggle} />
      </div>

      {/* Events */}
      <div className="flex flex-col gap-0 pl-[38px]">
        {group.events.map((event, i) => (
          <div key={event.key}>
            {i === 0 && <hr className="border-dash-border-soft" />}
            <div className="flex items-center justify-between py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
                  {event.title}
                </span>
                <span className="text-[13px] leading-5 tracking-[-0.0224px] text-dash-text-faded">
                  {event.description}
                </span>
              </div>
              <Toggle
                checked={groupEnabled && (eventStates[event.key] ?? false)}
                onChange={(v) => onEventToggle(event.key, v)}
              />
            </div>
            {i < group.events.length - 1 && (
              <hr className="border-dash-border-soft" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationsForm() {
  const [emailNotifs, setEmailNotifs] = useState(false);
  const [discordUrl, setDiscordUrl] = useState("");
  const [slackUrl, setSlackUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [allEvents, setAllEvents] = useState(false);

  // Group-level toggles
  const [groupToggles, setGroupToggles] = useState<Record<string, boolean>>({});
  // Individual event toggles
  const [eventToggles, setEventToggles] = useState<Record<string, boolean>>({});

  function handleAllEventsToggle(v: boolean) {
    setAllEvents(v);
    if (v) {
      const groups: Record<string, boolean> = {};
      const events: Record<string, boolean> = {};
      for (const g of eventGroups) {
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
    const group = eventGroups.find((g) => g.key === groupKey);
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
  const totalCount = eventGroups.reduce((s, g) => s + g.events.length, 0);

  const inputClass =
    "w-full rounded-[6px] bg-[#f9fafb] px-3 py-2.5 text-sm leading-6 text-dash-text-strong shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] outline-none placeholder:text-[#9ca3af] focus:shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08),0px_0px_0px_3px_rgba(72,121,248,0.15)] dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08),0px_0px_0px_3px_rgba(72,121,248,0.2)]";

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

      {/* Webhook URLs */}
      <div className="flex max-w-[488px] flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
            Discord webhook URL
          </label>
          <input
            type="url"
            value={discordUrl}
            onChange={(e) => setDiscordUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
            Slack webhook URL
          </label>
          <input
            type="url"
            value={slackUrl}
            onChange={(e) => setSlackUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
            Custom webhook URL
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-server.com/webhook"
            className={inputClass}
          />
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
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-full bg-[#f5a623]/10">
              <img src="/icons/home.svg" alt="" className="size-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-5 text-dash-text-strong">
                All Events
              </span>
              <span className="text-[13px] leading-5 text-dash-text-faded">
                Subscribe to all current and future events
              </span>
            </div>
          </div>
          <Toggle checked={allEvents} onChange={handleAllEventsToggle} />
        </div>

        <hr className="border-dash-border-soft" />

        {/* Event groups */}
        <div className="flex flex-col gap-4 pt-1">
          {eventGroups.map((group, i) => (
            <div key={group.key}>
              <EventGroupCard
                group={group}
                groupEnabled={groupToggles[group.key] ?? false}
                onGroupToggle={(v) => handleGroupToggle(group.key, v)}
                eventStates={eventToggles}
                onEventToggle={handleEventToggle}
              />
              {i < eventGroups.length - 1 && (
                <hr className="mt-4 border-dash-border-soft" />
              )}
            </div>
          ))}
        </div>

        {/* Save */}
        <div className="flex justify-end pt-4">
          <GlossyButton className="px-6">
            Save Settings
          </GlossyButton>
        </div>
      </div>
    </div>
  );
}

interface Member {
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Member";
  gradient: string;
}

interface PendingInvite {
  email: string;
  role: string;
  sentAt: string;
}

const mockMembers: Member[] = [
  {
    name: "Emmanuel Akujuobi",
    email: "akujuobiemmanuelk@gmail.com",
    role: "Owner",
    gradient: "radial-gradient(circle at 62% 30%, #b8cffc, #94b6f8 25%, #6f9cf3 50%, #4b82ee 75%, #2769e9)",
  },
  {
    name: "Sarah Chen",
    email: "sarah.chen@brimble.io",
    role: "Admin",
    gradient: "radial-gradient(circle at 62% 30%, #b8fce8, #91f2d5 25%, #6ae8c3 50%, #43deb0 75%, #1bd49d)",
  },
  {
    name: "Tunde Adeyemi",
    email: "tunde@brimble.io",
    role: "Member",
    gradient: "radial-gradient(circle at 62% 30%, #fcccb8, #f8a894 25%, #f3856f 50%, #ee614b 75%, #e93e27)",
  },
];

const mockPendingInvites: PendingInvite[] = [
  { email: "james@example.com", role: "Member", sentAt: "2 days ago" },
  { email: "maria@example.com", role: "Viewer", sentAt: "5 days ago" },
];

const MEMBER_COST_PER_SEAT = 10;

const roleBadgeStyles: Record<string, string> = {
  Owner: "bg-[#4879f8]/10 text-[#4879f8]",
  Admin: "bg-[#f5a623]/10 text-[#f5a623]",
  Member: "bg-dash-bg-elevated text-dash-text-faded",
  Viewer: "bg-dash-bg-elevated text-dash-text-faded",
};

function MemberActionMenu({ member }: { member: Member }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const isOwner = member.role === "Owner";

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
          <button
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
          >
            <Shield className="size-3.5" />
            Change role
          </button>
          {!isOwner && (
            <button
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-500 transition-colors hover:bg-dash-bg-elevated"
            >
              <UserMinus className="size-3.5" />
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MembersForm() {
  const [inviteOpen, setInviteOpen] = useState(false);

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
        <GlossyButton onClick={() => setInviteOpen(true)} className="px-5">
          Invite
        </GlossyButton>
      </div>

      <hr className="-ml-8 border-dash-border-soft" />

      {/* Members list */}
      <div className="flex flex-col gap-4">
        {mockMembers.map((member) => (
          <div key={member.email} className="flex items-center gap-3">
            <div
              className="size-8 shrink-0 rounded-full"
              style={{ background: member.gradient }}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
                {member.name}
              </span>
              <span className="truncate text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
                {member.email}
              </span>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${roleBadgeStyles[member.role] ?? roleBadgeStyles.Member
                }`}
            >
              {member.role}
            </span>
            <MemberActionMenu member={member} />
          </div>
        ))}
      </div>

      {/* Pending invites */}
      {mockPendingInvites.length > 0 && (
        <>
          <hr className="-ml-8 border-dash-border-soft" />
          <div className="flex flex-col gap-4">
            <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
              Pending invitations
            </span>
            {mockPendingInvites.map((invite) => (
              <div key={invite.email} className="flex items-center gap-3">
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
                  <button className="text-xs text-[#4879f8] transition-colors hover:text-[#3a6ae6]">
                    Resend
                  </button>
                  <button className="text-xs text-dash-text-faded transition-colors hover:text-red-500">
                    Revoke
                  </button>
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
            {mockMembers.length} seats &times; ${MEMBER_COST_PER_SEAT}/seat/month
          </span>
        </div>
        <span className="text-lg font-medium text-dash-text-strong">
          ${mockMembers.length * MEMBER_COST_PER_SEAT}/mo
        </span>
      </div>

      <InviteMembersModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        currentSeats={mockMembers.length}
      />
    </div>
  );
}

interface Invoice {
  id: string;
  description: string;
  amount: string;
  date: string;
  status: "paid" | "unpaid";
}

const mockInvoices: Invoice[] = [
  { id: "INV-000005", description: "Premium plan", amount: "$30.00", date: "Jan 28", status: "unpaid" },
  { id: "INV-000004", description: "Premium plan", amount: "$30.00", date: "Dec 28", status: "paid" },
  { id: "INV-000003", description: "Premium plan", amount: "$20.00", date: "Nov 28", status: "paid" },
  { id: "INV-000002", description: "Premium plan", amount: "$20.00", date: "Oct 28", status: "paid" },
  { id: "INV-000001", description: "Standard plan", amount: "$0.00", date: "Sep 28", status: "paid" },
];

function InvoicesForm() {
  return (
    <div className="flex max-w-[488px] flex-col gap-6">
      <div className="flex flex-col gap-[2px]">
        <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
          Payment history
        </p>
        <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
          Your billing history with Brimble
        </p>
      </div>

      <div className="flex flex-col">
        {mockInvoices.map((invoice, i) => (
          <div
            key={invoice.id}
            className={cn(
              "flex items-center gap-3 py-3.5",
              i > 0 && "border-t-[0.5px] border-dash-border",
            )}
          >
            {/* Status dot + invoice info */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span
                className={cn(
                  "size-[6px] shrink-0 rounded-full",
                  invoice.status === "paid" ? "bg-[#34d399]" : "bg-[#f5a623]",
                )}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm leading-5 text-dash-text-strong">
                    {invoice.description}
                  </span>
                  <span className="font-mono text-xs text-dash-text-extra-faded">
                    {invoice.id}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-dash-text-faded">
                    {invoice.date}
                  </span>
                  <span className="text-xs text-dash-text-extra-faded">&middot;</span>
                  <span className="text-xs font-medium tabular-nums text-dash-text-body">
                    {invoice.amount}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
              {invoice.status === "unpaid" && (
                <button className="rounded-[4px] border border-[#3964d5] bg-[#4879f8] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#3a6ae6]">
                  Pay
                </button>
              )}
              <button
                className="shrink-0 rounded-[4px] p-1.5 text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
                title="Download"
              >
                <Download className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
