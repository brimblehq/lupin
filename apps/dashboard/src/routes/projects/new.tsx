import { useState, useRef, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { IpWhitelist } from "@/components/shared/ip-whitelist";
import { createFileRoute, getRouteApi, Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  ArrowLeft,
  Search,
  ChevronDown,
  Plus,
  X,
  Check,
  Lock,
  Globe,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  ShieldAlert,
  HardDrive,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import { GithubLogo, Cube, Database, CircleNotch } from "@phosphor-icons/react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { useGitProvider, type UseGitProviderResult } from "@/hooks/use-git-provider";
import { GlossyButton } from "../../components/shared/glossy-button";
import { ChangePlanModal } from "../../components/shared/change-plan-modal";
import { DashButton } from "../../components/shared/dash-button";
import { ToggleSwitch } from "../../components/shared/toggle-switch";
import { RangeSlider } from "../../components/shared/range-slider";
import { Dropdown } from "../../components/shared/dropdown";
import { SimpleTooltip } from "../../components/shared/tooltip";
import { DiskSizeSelect } from "../../components/shared/disk-size-select";
import { diskSizes } from "../../components/shared/disk-size-options";
import { RootDirectoryTrigger } from "../../components/shared/root-directory-trigger";
import { AccessDenied } from "../../components/shared/access-denied";
import { accessDeniedForbidden } from "../../components/shared/access-denied-presets";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { RootDirectoryDrawer } from "../../components/project/root-directory-drawer";
import { ConfirmServerRuntimeModal } from "../../components/project/confirm-server-runtime-modal";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import { dashInputClassName } from "@/components/shared/dash-input";
import { inferProjectNameFromDockerImage, parseDockerImageRef } from "@/utils/docker-image";
import { mapFrameworksToDropdownOptions } from "@/utils/framework-dropdown";
import { getEnvPrefixForFramework, getLegacyServiceType, isNoBuildFramework } from "@/utils/project-deploy";
import { ServiceType, FrameworkApplicationType } from "@brimble/models/dist/enum";
import { listFrameworksServerFn } from "@/server/frameworks/actions";
import { listRegionsServerFn } from "@/server/regions/actions";
import {
  getGithubInstallUrlServerFn,
  getBitbucketConnectUrlServerFn,
  getBitbucketRepoServerFn,
  listBitbucketAccountsServerFn,
  listBitbucketReposServerFn,
  getGitlabConnectUrlServerFn,
  getGithubRepoServerFn,
  listGithubAccountsServerFn,
  listGithubReposServerFn,
  getGitlabRepoServerFn,
  listGitlabAccountsServerFn,
  listGitlabReposServerFn,
} from "@/server/repositories/actions";
import {
  createProjectServerFn,
  createDatabaseProjectServerFn,
  listAvailableDatabasesServerFn,
  validateDockerImageServerFn,
} from "@/server/projects/actions";
import { getHomeOverviewServerFn } from "@/server/overview/actions";
import type { FrameworkOption } from "@/backend/frameworks";
import type { Region } from "@/backend/regions";
import type {
  DatabaseEngineOption,
  DatabaseProvisionResult,
  GithubAccount,
  GithubRepoListItem,
  RepositoryMetadata,
  RepositoryFrameworkDefaults,
} from "@/backend/repositories";
import type { Project } from "@/backend/projects";
import { usePlanGate } from "@/hooks/use-plan-gate";
import { usePricing } from "@/contexts/pricing-context";
import { usePaymentMethods } from "@/hooks/use-payments";
import { PaymentProvider } from "@/providers/payment-provider";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

const AddCardForm = lazy(() => import("@/components/settings/billing-form").then((m) => ({ default: m.AddCardForm })));
import { estimateComputeCost } from "@/utils/compute-pricing";
import { formatUsdMonthly } from "@/utils/billing";
import { generateStrongPassword } from "@/utils/password";
import { parseEnvPaste } from "@/utils/env-paste";
import { NewProjectPending } from "@/components/shared/route-pending";
import config from "@/config";
import type { Phase3DeployInput } from "./new.types";

export const Route = createFileRoute("/projects/new")({
  pendingComponent: NewProjectPending,
  component: NewProjectPage,
});

/* ─── Constants ─── */

const ease = [0.16, 1, 0.3, 1] as const;

const inputClass = dashInputClassName;

/* ─── Icons ─── */

/* ─── Git Providers ─── */

type IconComponent = React.ComponentType<{ className?: string }>;

interface GitProvider {
  id: string;
  name: string;
  Icon: IconComponent;
  cardIcon: string;
  cardIconClass?: string;
  description: string;
  permissions: { label: string; desc: string }[];
  canAddAccount?: boolean;
}

function GitlabLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 0 0-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 0 0-.867 0L1.387 9.452.045 13.587a.924.924 0 0 0 .331 1.023L12 23.054l11.624-8.443a.92.92 0 0 0 .331-1.024" />
    </svg>
  );
}

function BitbucketLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
    </svg>
  );
}

const gitProviders: GitProvider[] = [
  {
    id: "github",
    name: "GitHub",
    Icon: GithubLogo,
    cardIcon: "/images/git.svg",
    description: "Connect a repository from your GitHub account",
    permissions: [
      {
        label: "Read access to your repositories",
        desc: "Browse and import repos",
      },
      { label: "Webhook notifications", desc: "Auto-deploy on push" },
      { label: "Deploy keys", desc: "Securely clone private repos" },
    ],
  },
  {
    id: "gitlab",
    name: "GitLab",
    Icon: GitlabLogo,
    cardIcon: "/icons/gitlab.svg",
    cardIconClass: "size-5 dark:invert dark:brightness-200",
    description: "Connect a repository from your GitLab account",
    permissions: [
      {
        label: "Read access to your repositories",
        desc: "Browse and import repos",
      },
      { label: "Webhook notifications", desc: "Auto-deploy on push" },
      { label: "Deploy keys", desc: "Securely clone private repos" },
    ],
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    Icon: BitbucketLogo,
    cardIcon: "/icons/bitbucket.svg",
    cardIconClass: "size-5 dark:invert dark:brightness-200",
    canAddAccount: false,
    description: "Connect a repository from your Bitbucket account",
    permissions: [
      {
        label: "Read access to your repositories",
        desc: "Browse and import repos",
      },
      { label: "Webhook notifications", desc: "Auto-deploy on push" },
      { label: "Deploy keys", desc: "Securely clone private repos" },
    ],
  },
];

function getGitProvider(id: string): GitProvider | undefined {
  return gitProviders.find((p) => p.id === id);
}

const GIT_BASE_URLS: Record<string, string> = {
  github: "https://github.com",
  gitlab: "https://gitlab.com",
  bitbucket: "https://bitbucket.org",
};

function isGitSource(type: string): boolean {
  return gitProviders.some((p) => p.id === type);
}

import { SourceType } from "../../types/enums";
type Phase = 1 | 2 | 3;

type RegionOption = { id: string; label: string };

function buildRegionLabel(region: Region) {
  const country = region.country?.trim();
  if (country) {
    return `${region.name} (${country})`;
  }
  return region.name;
}

function slugifyProjectName(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type DockerRegistryCredentials = {
  username: string;
  token: string;
};

type DockerSourceSelection = {
  imageUri: string;
  credentials?: DockerRegistryCredentials;
};

const frameworks = [
  {
    id: "nextjs",
    name: "Next.js",
    buildCmd: "npm run build",
    output: ".next",
    install: "npm install",
    start: "npm run start",
  },
  {
    id: "vite",
    name: "Vite",
    buildCmd: "npm run build",
    output: "dist",
    install: "npm install",
    start: "npm run preview",
  },
  {
    id: "remix",
    name: "Remix",
    buildCmd: "npm run build",
    output: "build",
    install: "npm install",
    start: "npm run start",
  },
  {
    id: "astro",
    name: "Astro",
    buildCmd: "npm run build",
    output: "dist",
    install: "npm install",
    start: "npm run preview",
  },
  {
    id: "static",
    name: "Static",
    buildCmd: "",
    output: "public",
    install: "",
    start: "",
  },
  {
    id: "custom",
    name: "Custom",
    buildCmd: "",
    output: "",
    install: "",
    start: "",
  },
];

/* ─── Database Config ─── */

const cpuSteps = [0.5, 1, 2, 4, 8];
const memorySteps = [0.5, 1, 1.5, 2, 4, 8, 12, 16];
function formatCpu(val: number): string {
  if (val < 1) return `${val} vCPU (Shared)`;
  return `${val} vCPU`;
}

function formatMemory(gb: number): string {
  return `${gb} GB`;
}

function ComputeSliderField({
  label,
  value,
  steps,
  formatValue,
  onCommit,
  disabled = false,
  disabledReason,
}: {
  label: string;
  value: number;
  steps: number[];
  formatValue: (value: number) => string;
  onCommit: (value: number) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const maxIndex = Math.max(steps.length - 1, 1);
  const indexToTrack = (index: number) => (index / maxIndex) * 100;
  const trackToIndex = (track: number) => Math.min(maxIndex, Math.max(0, Math.round((track / 100) * maxIndex)));
  const [trackValue, setTrackValue] = useState(() => indexToTrack(value));

  useEffect(() => {
    setTrackValue((value / maxIndex) * 100);
  }, [value, maxIndex]);

  const previewIndex = trackToIndex(trackValue);

  const content = (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm text-dash-text-body">{label}</label>
        <span className="text-sm font-medium text-dash-text-strong">{formatValue(steps[previewIndex] ?? steps[0] ?? 0)}</span>
      </div>
      {disabled && disabledReason ? (
        <SimpleTooltip content={disabledReason} side="top" sideOffset={2} delayDuration={120}>
          <div>
            <div className="pointer-events-none">
              <RangeSlider
                value={trackValue}
                onChange={disabled ? () => {} : setTrackValue}
                onCommit={disabled ? () => {} : (nextTrackValue) => onCommit(trackToIndex(nextTrackValue))}
                min={0}
                max={100}
                step={1}
                hideValue
              />
            </div>
          </div>
        </SimpleTooltip>
      ) : (
        <div className={disabled ? "pointer-events-none" : ""}>
          <RangeSlider
            value={trackValue}
            onChange={disabled ? () => {} : setTrackValue}
            onCommit={disabled ? () => {} : (nextTrackValue) => onCommit(trackToIndex(nextTrackValue))}
            min={0}
            max={100}
            step={1}
            hideValue
          />
        </div>
      )}
    </div>
  );
  return content;
}

function generateMockCredential(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function generateSecureCredential(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function isValidCidr(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)\/([0-9]|[1-2][0-9]|3[0-2])$/.test(trimmed);
}

type DatabaseEnvDraft = {
  id: number;
  key: string;
  value: string;
  sensitive: boolean;
  isPassword: boolean;
};

let dbEnvNextId = 1;

/* ─── Summary Chip ─── */

function SummaryChip({
  icon,
  label,
  onChangeClick,
  externalUrl,
}: {
  icon: React.ReactNode;
  label: string;
  onChangeClick: () => void;
  externalUrl?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease }}
      className="flex items-center gap-3"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dash-border-soft bg-dash-bg-elevated px-3 py-1 text-xs text-dash-text-strong">
        {icon}
        {label}
        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-0.5 text-dash-text-faded transition-colors hover:text-dash-text-strong"
            onClick={(e) => e.stopPropagation()}
          >
            <ArrowUpRight className="size-3" />
          </a>
        )}
      </span>
      <button onClick={onChangeClick} className="text-xs text-[#4879f8] transition-colors hover:text-[#3a6ae6]">
        Change
      </button>
    </motion.div>
  );
}

/* ─── Phase 1: Source Type ─── */

function Phase1SourceType({ onSelect }: { onSelect: (type: SourceType) => void }) {
  const haptics = useHaptics();
  const sourceCards: {
    type: SourceType;
    icon: string;
    iconClass?: string;
    title: string;
    desc: string;
  }[] = [
    ...gitProviders.map((p) => ({
      type: p.id as SourceType,
      icon: p.cardIcon,
      iconClass: p.cardIconClass,
      title: `Import from ${p.name}`,
      desc: p.description,
    })),
    {
      type: SourceType.Docker,
      icon: "/images/container.svg",
      title: "Deploy Docker image",
      desc: "Deploy from a public or private registry",
    },
    {
      type: SourceType.Database,
      icon: "/images/database.svg",
      title: "Database & Queue",
      desc: "Provision a managed database or message queue",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-4 text-sm font-medium text-dash-text-strong">How would you like to deploy?</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sourceCards.map((card) => (
          <button
            key={card.type}
            onClick={() => {
              haptics.selection();
              onSelect(card.type);
            }}
            className="group flex flex-col gap-3 rounded-[4px] border-[0.5px] border-dash-border p-5 text-left transition-all hover:border-dash-text-faded hover:bg-dash-bg-elevated"
          >
            <img src={card.icon} alt="" className={card.iconClass ?? "size-5 brightness-0 dark:brightness-200"} />
            <div>
              <div className="text-sm font-medium text-dash-text-strong">{card.title}</div>
              <div className="mt-0.5 text-xs text-dash-text-faded">{card.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Phase 2: Git Provider Connect (generic) ─── */

function Phase2GitConnect({
  provider,
  onConnected,
  connecting = false,
  polling = false,
  checkingConnection = false,
  errorMessage,
}: {
  provider: GitProvider;
  onConnected: () => void;
  connecting?: boolean;
  polling?: boolean;
  checkingConnection?: boolean;
  errorMessage?: string | null;
}) {
  const { Icon } = provider;
  const buttonDisabled = connecting || polling || checkingConnection;
  let buttonLabel = `Connect ${provider.name}`;
  if (checkingConnection) {
    buttonLabel = "Checking connection…";
  } else if (connecting) {
    buttonLabel = `Opening ${provider.name}…`;
  } else if (polling) {
    buttonLabel = "Waiting for connection…";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">Connect your {provider.name} account</h3>
      <p className="mb-5 text-sm text-dash-text-faded">
        To import a repository, you need to connect your {provider.name} account to Brimble first.
      </p>

      <div className="rounded-[4px] border-[0.5px] border-dash-border p-5">
        <div className="flex flex-col items-center py-4">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-dash-bg-elevated">
            <Icon className="size-6 text-dash-text-body" />
          </div>
          <p className="mb-1 text-sm font-medium text-dash-text-strong">{provider.name} not connected</p>
          <p className="mb-5 max-w-[320px] text-center text-sm text-dash-text-faded">
            Allow Brimble to access your repositories so you can import and deploy them directly.
          </p>
          <GlossyButton variant="blue" onClick={onConnected} disabled={buttonDisabled}>
            {polling ? <CircleNotch className="size-4 animate-spin" /> : buttonLabel}
          </GlossyButton>
          {errorMessage ? (
            <p className="mt-3 text-center text-xs text-[#ef2f1f]">{errorMessage}</p>
          ) : checkingConnection ? (
            <p className="mt-3 text-center text-xs text-dash-text-faded">Checking your {provider.name} connection status…</p>
          ) : polling ? (
            <p className="mt-3 text-center text-xs text-dash-text-faded">
              Complete the {provider.name} authorization, then return here. We’re checking automatically.
            </p>
          ) : null}
        </div>

        <hr className="my-5 border-dash-border-soft" />

        <div className="flex flex-col gap-3">
          {provider.permissions.map((perm) => (
            <div key={perm.label} className="flex items-start gap-2.5">
              <span className="mt-1 size-[6px] shrink-0 rounded-full bg-[#34d399]" />
              <div className="flex flex-col">
                <span className="text-sm text-dash-text-body">{perm.label}</span>
                <span className="text-xs text-dash-text-faded">{perm.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Phase 2: Git Repo Select ─── */

function Phase2GitRepoSelect({
  provider,
  accounts,
  repos,
  accountsLoading,
  reposLoading,
  importingRepoFullName,
  onRefreshAccounts,
  onConnectAccount,
  canAddAccount = true,
  onLoadRepos,
  onSelect,
}: {
  provider: GitProvider;
  accounts: GithubAccount[];
  repos: GithubRepoListItem[];
  accountsLoading?: boolean;
  reposLoading?: boolean;
  importingRepoFullName?: string | null;
  onRefreshAccounts?: () => void;
  onConnectAccount?: () => void;
  canAddAccount?: boolean;
  onLoadRepos?: (input: { installationId?: number | string; q?: string }) => void;
  onSelect: (repo: GithubRepoListItem) => void;
}) {
  const { deployPrivateOrganization } = usePlanGate();
  const [selectedInstallationId, setSelectedInstallationId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [orgOpen, setOrgOpen] = useState(false);
  const orgRef = useRef<HTMLDivElement>(null);
  const onLoadReposRef = useRef<typeof onLoadRepos>(onLoadRepos);

  useEffect(() => {
    onLoadReposRef.current = onLoadRepos;
  }, [onLoadRepos]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) setOrgOpen(false);
    }
    if (orgOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [orgOpen]);

  useEffect(() => {
    if (!accounts.length) {
      setSelectedInstallationId("");
      return;
    }

    setSelectedInstallationId((prev) => {
      if (prev && accounts.some((a) => String(a.installationId ?? "") === prev)) {
        return prev;
      }

      const preferred = accounts.find((a) => String(a.type ?? "").toLowerCase() !== "organization") ?? accounts[0];

      return String(preferred.installationId ?? "");
    });
  }, [accounts]);

  useEffect(() => {
    if (!selectedInstallationId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onLoadReposRef.current?.({
        installationId: selectedInstallationId,
        q: search.trim() || undefined,
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [search, selectedInstallationId]);

  const selectedOrg = accounts.find((account) => String(account.installationId ?? "") === selectedInstallationId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-4 text-sm font-medium text-dash-text-strong">Import from {provider.name}</h3>

      {!accounts.length ? (
        <div className="rounded-[4px] border-[0.5px] border-dash-border p-5">
          <p className="text-sm text-dash-text-faded">
            {accountsLoading
              ? `Loading connected ${provider.name} accounts…`
              : `No connected ${provider.name} accounts found yet. Finish the ${provider.name} connection step, then refresh.`}
          </p>
          <div className="mt-4 flex gap-2">
            <GlossyButton variant="blue" onClick={() => onRefreshAccounts?.()}>
              Refresh accounts
            </GlossyButton>
          </div>
        </div>
      ) : (
        <>
          {/* Org switcher + search */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={orgRef}>
              <button
                onClick={() => {
                  if (!canAddAccount && accounts.length <= 1) return;
                  setOrgOpen(!orgOpen);
                }}
                className={`flex items-center gap-2 ${inputClass} w-auto min-w-[200px] ${!canAddAccount && accounts.length <= 1 ? "cursor-default" : ""}`}
              >
                {selectedOrg?.avatar ? (
                  <img src={selectedOrg.avatar} alt="" className="size-5 shrink-0 rounded-full object-cover" />
                ) : (
                  <div
                    className="size-5 shrink-0 rounded-full"
                    style={{
                      background: "radial-gradient(circle at 62% 30%, #b8cffc, #94b6f8 25%, #6f9cf3 50%, #4b82ee 75%, #2769e9)",
                    }}
                  />
                )}
                <span className="flex-1 truncate text-left">{selectedOrg?.name || selectedOrg?.username || "Select account"}</span>
                {(canAddAccount || accounts.length > 1) && <ChevronDown className="size-3.5 shrink-0 text-dash-text-faded" />}
              </button>
              <AnimatePresence>
                {orgOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.2, ease }}
                    className="absolute left-0 top-full z-50 mt-1 w-full overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)]"
                  >
                    {accounts.map((account) => {
                      const isOrg = String(account.type ?? "").toLowerCase() === "organization";
                      const locked = isOrg && !deployPrivateOrganization;
                      return (
                        <button
                          key={String(account.id ?? account.installationId ?? account.username ?? account.name)}
                          onClick={() => {
                            if (locked) return;
                            setSelectedInstallationId(String(account.installationId ?? ""));
                            setOrgOpen(false);
                          }}
                          disabled={locked}
                          className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors ${locked ? "cursor-not-allowed text-dash-text-extra-faded" : "text-dash-text-body hover:bg-dash-bg-elevated"}`}
                        >
                          {account.avatar ? (
                            <img src={account.avatar} alt="" className="size-5 shrink-0 rounded-full object-cover" />
                          ) : (
                            <div
                              className="size-5 shrink-0 rounded-full"
                              style={{
                                background: "radial-gradient(circle at 62% 30%, #b8cffc, #94b6f8 25%, #6f9cf3 50%, #4b82ee 75%, #2769e9)",
                              }}
                            />
                          )}
                          <span className="truncate">{account.name || account.username || "GitHub Account"}</span>
                          {locked && (
                            <span className="ml-auto shrink-0 rounded bg-dash-bg px-1.5 py-0.5 text-[10px] font-medium text-dash-text-faded">
                              Upgrade
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {canAddAccount && (
                      <>
                        <div className="mx-2 my-1 h-px bg-dash-border-soft" />
                        <button
                          type="button"
                          onClick={() => {
                            setOrgOpen(false);
                            onConnectAccount?.();
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-body"
                        >
                          <Plus className="size-3.5" />
                          Add account
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dash-text-extra-faded" />
              <input
                type="text"
                placeholder="Search repositories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          {/* Repo list */}
          <div className="mt-3 overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
            {reposLoading ? (
              <div className="px-4 py-8 text-center text-sm text-dash-text-faded">Loading repositories…</div>
            ) : repos.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-dash-text-faded">No repositories found.</div>
            ) : (
              repos.map((repo, i) => {
                let repoHost = "https://github.com";
                if (provider.id === "gitlab") {
                  repoHost = "https://gitlab.com";
                } else if (provider.id === "bitbucket") {
                  repoHost = "https://bitbucket.org";
                }
                const repoUrl = `${repoHost}/${repo.fullName}`;
                return (
                  <motion.div
                    key={repo.fullName}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.04 * i, ease }}
                    className={`group flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t-[0.5px] border-dash-border" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <img src="/icons/git-circle.svg" alt="" className="size-6 shrink-0" />
                      <span className="text-sm font-medium text-dash-text-strong">{repo.name}</span>
                      {repo.private ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-dash-border-soft px-2 py-0.5 text-[11px] text-dash-text-faded">
                          <Lock className="size-3" />
                          Private
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-dash-border-soft px-2 py-0.5 text-[11px] text-dash-text-faded">
                          <Globe className="size-3" />
                          Public
                        </span>
                      )}
                      <a
                        href={repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View ${repo.name} on ${provider.name}`}
                        className="rounded-full p-1 text-dash-text-faded opacity-0 transition-opacity hover:bg-dash-bg-elevated hover:text-dash-text-strong focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    </div>
                    <DashButton size="sm" onClick={() => onSelect(repo)} disabled={importingRepoFullName === repo.fullName}>
                      {importingRepoFullName === repo.fullName ? "Importing…" : "Import"}
                    </DashButton>
                  </motion.div>
                );
              })
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}

/* ─── Phase 2: Docker Image ─── */

function Phase2Docker({
  onSubmit,
  submitting = false,
  initialValue,
  imageError,
  onImageChange,
}: {
  onSubmit: (input: DockerSourceSelection) => void | Promise<void>;
  submitting?: boolean;
  initialValue?: DockerSourceSelection | null;
  imageError?: string | null;
  onImageChange?: () => void;
}) {
  const [image, setImage] = useState(initialValue?.imageUri ?? "");
  const [username, setUsername] = useState(initialValue?.credentials?.username ?? "");
  const [token, setToken] = useState(initialValue?.credentials?.token ?? "");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [authExpanded, setAuthExpanded] = useState(Boolean(initialValue?.credentials?.username || initialValue?.credentials?.token));

  useEffect(() => {
    setImage(initialValue?.imageUri ?? "");
    setUsername(initialValue?.credentials?.username ?? "");
    setToken(initialValue?.credentials?.token ?? "");
    setAuthExpanded(Boolean(initialValue?.credentials?.username || initialValue?.credentials?.token));
  }, [initialValue]);

  const hasPartialCreds = (username.trim() && !token.trim()) || (!username.trim() && token.trim());

  function submitDockerImage() {
    const trimmedImage = image.trim();
    if (!trimmedImage) return;
    if (hasPartialCreds) {
      toast.error("Provide both registry username and token.");
      return;
    }
    void onSubmit({
      imageUri: trimmedImage,
      ...(username.trim() && token.trim()
        ? {
            credentials: {
              username: username.trim(),
              token: token.trim(),
            },
          }
        : {}),
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">Docker Image</h3>
      <p className="mb-4 text-sm text-dash-text-faded">Enter the image name including tag and optional registry.</p>
      <form
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          if (submitting) return;
          submitDockerImage();
        }}
      >
        <div>
          <label className="mb-1.5 block text-sm text-dash-text-body">Image name</label>
          <input
            type="text"
            placeholder="nginx:latest or ghcr.io/org/image:tag"
            value={image}
            onChange={(e) => {
              onImageChange?.();
              setImage(e.target.value);
            }}
            className={`w-full input-base ${
              imageError ? "input-focus-red" : "input-focus"
            } px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]`}
            autoFocus
          />
          {imageError ? <p className="mt-2 text-xs text-[#ef4444]">{imageError}</p> : null}
          <p className={`${imageError ? "mt-1.5" : "mt-2"} text-xs text-dash-text-extra-faded`}>
            Supports Docker Hub, GitHub Container Registry, and custom registries.
          </p>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setAuthExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-[6px] border-[0.5px] border-dash-border px-3 py-2.5 text-left text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
          >
            <span className="font-medium text-dash-text-strong">Private registry credentials</span>
            <motion.span animate={{ rotate: authExpanded ? 180 : 0 }} transition={{ duration: 0.2, ease }}>
              <ChevronDown className="size-4 text-dash-text-faded" />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {authExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                animate={{
                  opacity: 1,
                  height: "auto",
                  transitionEnd: { overflow: "visible" },
                }}
                exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                transition={{ duration: 0.2, ease }}
              >
                <div className="mt-3 grid grid-cols-1 gap-3 px-px pb-px sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm text-dash-text-body">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="octocat"
                      className={inputClass}
                      autoComplete="off"
                      name="registry_username_input"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      spellCheck={false}
                      autoCapitalize="none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm text-dash-text-body">Token</label>
                    <div className="relative">
                      <input
                        type={tokenVisible ? "text" : "password"}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Personal access token"
                        className={`${inputClass} pr-9`}
                        autoComplete="new-password"
                        name="registry_token_input"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        spellCheck={false}
                        autoCapitalize="none"
                      />
                      <button
                        type="button"
                        onClick={() => setTokenVisible((prev) => !prev)}
                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-[4px] p-1 text-dash-text-faded transition-colors hover:text-dash-text-strong"
                      >
                        {tokenVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-dash-text-extra-faded">
                  Optional. Provide both username and token to validate private images.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {hasPartialCreds ? (
          <p className="mt-3 text-xs text-[#f59e0b]">Provide both username and token to use private registry authentication.</p>
        ) : null}
        <div className="mt-5">
          <GlossyButton
            type="submit"
            variant="blue"
            fullWidth
            loading={submitting}
            loadingLabel="Verifying..."
            disabled={submitting || !image.trim() || Boolean(hasPartialCreds)}
          >
            Continue
          </GlossyButton>
        </div>
      </form>
    </motion.div>
  );
}

/* ─── Phase 2: Database Engine Select ─── */

function Phase2DbEngine({
  engines,
  selectedEngineId,
  loading = false,
  regionOptions,
  submitting = false,
  projectCount = 0,
  onSelect,
  onProvision,
}: {
  engines: DatabaseEngineOption[];
  selectedEngineId: string;
  loading?: boolean;
  regionOptions: RegionOption[];
  submitting?: boolean;
  projectCount?: number;
  onSelect: (engineId: string) => void;
  onProvision: (input: {
    engineId: string;
    name: string;
    regionId: string;
    cpu: number;
    memory: number;
    storage: number;
    whitelistedIps: string[];
    environments: Array<{ name: string; value: string }>;
  }) => void | Promise<void>;
}) {
  const { data: paymentMethods, isLoading: paymentMethodsLoading } = usePaymentMethods();
  const hasPaymentCard = (paymentMethods?.length ?? 0) > 0;
  const [showAddCardForm, setShowAddCardForm] = useState(false);
  const { planKey } = usePlanGate();
  const isFreePlan = planKey === "free";
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const orderedEngines = useMemo(() => {
    return [...engines].sort((a, b) => {
      const aGated = isFreePlan && !a.free;
      const bGated = isFreePlan && !b.free;

      if (aGated !== bGated) {
        return aGated ? 1 : -1;
      }

      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [engines, isFreePlan]);

  if (loading || paymentMethodsLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease }}
      >
        <h3 className="mb-1 text-sm font-medium text-dash-text-strong">Choose an engine</h3>
        <p className="mb-4 text-sm text-dash-text-faded">Loading available engines...</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-[4px] border-[0.5px] border-dash-border p-5">
              <div className="h-5 w-5 rounded bg-dash-bg-elevated" />
              <div className="mt-3 h-4 w-28 rounded bg-dash-bg-elevated" />
              <div className="mt-2 h-3 w-40 rounded bg-dash-bg-elevated" />
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (!hasPaymentCard) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease }}
      >
        <h3 className="mb-1 text-sm font-medium text-dash-text-strong">Add a payment card to provision a database</h3>
        <p className="mb-4 text-sm text-dash-text-faded">
          Databases use persistent storage which is billed monthly. Add a card before provisioning so we can keep your data online.
        </p>
        <div className="rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-dash-bg-elevated">
                <img src="/icons/card-payment.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-dash-text-strong">No payment method on file</span>
                <span className="text-xs text-dash-text-faded">
                  You won't be charged until your database is active and storage is in use.
                </span>
              </div>
            </div>
            {!showAddCardForm && (
              <DashButton onClick={() => setShowAddCardForm(true)} className="shrink-0">
                Add a card
              </DashButton>
            )}
          </div>

          <AnimatePresence initial={false}>
            {showAddCardForm && (
              <motion.div
                key="add-card-form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
                }}
                style={{ overflow: "hidden" }}
              >
                {/* px-1 / py-1 keeps the Stripe input's box-shadow ring out of the
                    motion wrapper's clip path during the height animation. */}
                <div className="mt-5 border-t border-dash-border px-1 py-1 pt-5">
                  <PaymentProvider>
                    <Suspense fallback={<div className="h-10 w-full animate-pulse rounded bg-dash-bg-elevated" />}>
                      <AddCardForm onClose={() => setShowAddCardForm(false)} showHeader={false} animated={false} />
                    </Suspense>
                  </PaymentProvider>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  const selectedEngine = orderedEngines.find((engine) => engine.id === selectedEngineId) ?? null;
  const getDropdownIconSrc = (value?: string) => {
    const raw = value?.trim();
    if (!raw) return undefined;
    if (raw.startsWith("<") || raw.includes("<svg")) {
      if (raw.includes("<svg")) {
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
      }
      return undefined;
    }
    if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/") || raw.startsWith("data:image/")) {
      return raw;
    }
    return undefined;
  };
  const engineOptions = orderedEngines.map((engine) => {
    const gated = isFreePlan && !engine.free;
    const version = engine.version?.trim();
    return {
      id: engine.id,
      label: version ? `${engine.name} - v${version}` : engine.name,
      icon: getDropdownIconSrc(engine.imageUrl) || getDropdownIconSrc(engine.image),
      disabled: gated,
      asideText: gated ? "Upgrade to access" : undefined,
    };
  });
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">Provision a database or queue</h3>
      <p className="mb-4 text-sm text-dash-text-faded">Select an engine, then configure compute, storage, and access in one step.</p>
      {isFreePlan && (
        <div className="mb-4 flex items-start gap-3 rounded-[6px] bg-[#4879f8]/[0.08] px-3.5 py-3 dark:bg-[#4879f8]/[0.12]">
          <img src="/icons/info.svg" alt="" aria-hidden="true" className="mt-0.5 size-4 shrink-0 invert dark:invert-0" />
          <div className="flex-1 text-sm leading-[1.4] text-dash-text-body">
            The free plan includes one database. Need more?{" "}
            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className="font-medium text-[#4879f8] transition-colors hover:text-[#3060d0]"
            >
              Upgrade your plan
            </button>{" "}
            to provision additional databases.
          </div>
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-sm text-dash-text-body">Database engine</label>
        <Dropdown
          value={selectedEngineId}
          options={engineOptions}
          onChange={(nextId) => {
            const nextOption = engineOptions.find((option) => option.id === nextId);
            if (nextOption?.disabled) {
              setShowUpgradeModal(true);
              return;
            }
            onSelect(nextId);
          }}
          placeholder="Select a database engine"
          searchable
          searchPlaceholder="Search database engines..."
        />
      </div>

      {selectedEngine ? (
        <div className="mt-6">
          <Phase3DatabaseConfigure
            key={selectedEngine.id}
            engine={selectedEngine}
            regionOptions={regionOptions}
            submitting={submitting}
            projectCount={projectCount}
            onProvision={(payload) =>
              onProvision({
                engineId: selectedEngine.id,
                ...payload,
              })
            }
          />
        </div>
      ) : (
        <div className="mt-6 rounded-[4px] border-[0.5px] border-dash-border p-4 text-sm text-dash-text-faded">
          Choose an engine to continue with database configuration.
        </div>
      )}

      <ChangePlanModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} currentPlan={planKey} />
    </motion.div>
  );
}

/* ─── Phase 3: Database Configure ─── */

function CredentialRow({
  label,
  value,
  onChange,
  sensitive = false,
  canRegenerate = false,
  onRegenerate,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  sensitive?: boolean;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
}) {
  const haptics = useHaptics();
  const [revealed, setRevealed] = useState(!sensitive);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    haptics.light();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 font-family-mono text-xs text-dash-text-faded">{label}</span>
      <input
        type={sensitive && !revealed ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={sensitive ? "new-password" : "off"}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        data-form-type="other"
        className="min-w-0 flex-1 truncate border-0 bg-transparent font-family-mono text-sm text-dash-text-body outline-none placeholder:text-dash-text-extra-faded"
      />
      <div className="flex shrink-0 items-center gap-1">
        {canRegenerate && onRegenerate ? (
          <button
            type="button"
            onClick={onRegenerate}
            title="Generate a strong password"
            aria-label="Generate a strong password"
            className="flex size-7 items-center justify-center rounded-[4px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
          >
            <RefreshCw className="size-3.5" />
          </button>
        ) : null}
        {sensitive && (
          <button
            type="button"
            onClick={() => setRevealed(!revealed)}
            className="flex size-7 items-center justify-center rounded-[4px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
          >
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="flex size-7 items-center justify-center rounded-[4px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
        >
          {copied ? <Check className="size-3.5 text-[#34d399]" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

let ipNextId = 1;

function Phase3DatabaseConfigure({
  engine,
  regionOptions,
  submitting = false,
  projectCount = 0,
  onProvision,
}: {
  engine: DatabaseEngineOption;
  regionOptions: RegionOption[];
  submitting?: boolean;
  projectCount?: number;
  onProvision: (input: {
    name: string;
    regionId: string;
    cpu: number;
    memory: number;
    storage: number;
    whitelistedIps: string[];
    environments: Array<{ name: string; value: string }>;
  }) => void | Promise<void>;
}) {
  const [dbName, setDbName] = useState(`${engine.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-db-${generateMockCredential(4)}`);
  const [region, setRegion] = useState(regionOptions[0]?.id ?? "");
  // Compute defaults to the lowest tier — users opt in to more via the
  // sliders or the "Apply recommended" button below the engine summary.
  const [cpuIdx, setCpuIdx] = useState(0);
  const [memIdx, setMemIdx] = useState(0);
  const [dbDiskSize, setDbDiskSize] = useState(() => {
    const recommendedStorage = engine.recommendations?.[0]?.compute?.storage;
    if (typeof recommendedStorage === "number") {
      const match = diskSizes.find((d) => Number(d.id) === recommendedStorage);
      if (match) return match.id;
      const closest = diskSizes.reduce((prev, curr) =>
        Math.abs(Number(curr.id) - recommendedStorage) < Math.abs(Number(prev.id) - recommendedStorage) ? curr : prev,
      );
      return closest.id;
    }
    return "10";
  });
  const [publicAccess, setPublicAccess] = useState(false);
  const [whitelistIps, setWhitelistIps] = useState<{ id: number; value: string }[]>([]);
  const [whitelistIpErrors, setWhitelistIpErrors] = useState<Record<number, string | undefined>>({});
  const [envDrafts, setEnvDrafts] = useState<DatabaseEnvDraft[]>([]);

  const recommendation = engine.recommendations?.[0]?.compute;

  const planSpecs = usePlanGate();
  const { planKey, projectLimit, dbMaxCpu, dbMaxMemory, dbMaxStorage } = planSpecs;
  const isFreePlan = planKey === "free";
  const pricing = usePricing();
  const limitReached = projectLimit !== null && projectCount > projectLimit;
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const effectiveCpuSteps = useMemo(() => (isFreePlan && dbMaxCpu != null ? [dbMaxCpu] : cpuSteps), [isFreePlan, dbMaxCpu]);
  const effectiveMemorySteps = useMemo(() => (isFreePlan && dbMaxMemory != null ? [dbMaxMemory] : memorySteps), [isFreePlan, dbMaxMemory]);
  const lockedStorageId = isFreePlan && dbMaxStorage != null ? String(dbMaxStorage) : null;
  const storageOptions = useMemo(() => {
    if (!lockedStorageId) return diskSizes;
    return diskSizes.map((option) => ({
      ...option,
      disabled: option.id !== lockedStorageId,
      asideText: option.id === lockedStorageId ? undefined : "Upgrade to access",
    }));
  }, [lockedStorageId]);

  useEffect(() => {
    if (!isFreePlan) return;
    if (cpuIdx !== 0) setCpuIdx(0);
    if (memIdx !== 0) setMemIdx(0);
    if (lockedStorageId && dbDiskSize !== lockedStorageId) setDbDiskSize(lockedStorageId);
  }, [isFreePlan, cpuIdx, memIdx, dbDiskSize, lockedStorageId]);
  const nextPlanName = useMemo(() => {
    const currentIdx = pricing.plans.findIndex((p) => p.id === planKey || p.name.toLowerCase() === planKey);
    return currentIdx >= 0 && currentIdx < pricing.plans.length - 1 ? pricing.plans[currentIdx + 1].name : undefined;
  }, [pricing.plans, planKey]);

  const effectiveCpu = effectiveCpuSteps[Math.min(cpuIdx, effectiveCpuSteps.length - 1)] ?? effectiveCpuSteps[0];
  const effectiveMemory = effectiveMemorySteps[Math.min(memIdx, effectiveMemorySteps.length - 1)] ?? effectiveMemorySteps[0];
  const effectiveStorage = lockedStorageId ? Number(lockedStorageId) : Number(dbDiskSize);
  const costBreakdown = useMemo(
    () =>
      estimateComputeCost(
        {
          cpu: effectiveCpu,
          memory: effectiveMemory,
          storage: effectiveStorage,
        },
        planKey,
        pricing.metered,
      ),
    [effectiveCpu, effectiveMemory, effectiveStorage, planKey, pricing.metered],
  );

  useEffect(() => {
    if (!region && regionOptions[0]?.id) {
      setRegion(regionOptions[0].id);
    }
  }, [region, regionOptions]);

  useEffect(() => {
    const generated = (engine.envs ?? []).map((env) => {
      const key = env.value;
      const lowerType = (env.type ?? "").toLowerCase();
      const lowerKey = key.toLowerCase();
      const isPassword = lowerType.includes("password") || lowerKey.includes("password") || lowerKey.includes("pass");
      const isAuthValue = lowerType.includes("auth") || lowerKey.includes("auth");
      let value = "";

      if (lowerType.includes("user") || lowerKey.includes("user")) {
        value = `brimble_${generateMockCredential(6)}`;
      } else if (isPassword) {
        value = generateStrongPassword();
      } else if (lowerType.includes("database") || lowerKey.includes("database") || lowerKey.endsWith("_db")) {
        value = dbName.replace(/-/g, "_");
      } else if (lowerType.includes("license") || lowerKey.includes("license")) {
        value = "yes";
      } else if (isAuthValue) {
        value = `neo4j/${generateSecureCredential(18)}`;
      }

      const sensitive = isPassword || isAuthValue;

      return {
        id: dbEnvNextId++,
        key,
        value,
        sensitive,
        isPassword,
      };
    });
    setEnvDrafts(generated);
  }, [engine.id, engine.envs, dbName]);

  function updateEnvDraft(id: number, value: string) {
    setEnvDrafts((prev) => prev.map((row) => (row.id === id ? { ...row, value } : row)));
  }

  function addWhitelistIp() {
    setWhitelistIps((prev) => [...prev, { id: ipNextId++, value: "" }]);
  }

  function removeWhitelistIp(id: number) {
    setWhitelistIps((prev) => prev.filter((ip) => ip.id !== id));
    setWhitelistIpErrors((prev) => {
      if (prev[id] === undefined) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function updateWhitelistIp(id: number, value: string) {
    setWhitelistIps((prev) => prev.map((ip) => (ip.id === id ? { ...ip, value } : ip)));
    // Clear the error for this row as soon as the user edits it; we revalidate
    // on submit so we don't badger them while they're typing.
    setWhitelistIpErrors((prev) => {
      if (prev[id] === undefined) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function validateWhitelistIps(): boolean {
    const errors: Record<number, string> = {};
    for (const ip of whitelistIps) {
      const trimmed = ip.value.trim();
      if (!trimmed) {
        errors[ip.id] = "Enter an IP or CIDR (e.g. 192.168.1.1/32) or remove this row.";
      } else if (!isValidCidr(trimmed)) {
        errors[ip.id] = "Use CIDR notation, e.g. 192.168.1.1/32 or 10.0.0.0/24.";
      }
    }
    setWhitelistIpErrors(errors);
    return Object.keys(errors).length === 0;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-4 text-sm font-medium text-dash-text-strong">Configure {engine.name}</h3>

      {limitReached && (
        <div className="mb-4 flex items-center gap-3 rounded-[6px] bg-[#f5a623]/5 px-3.5 py-3 dark:bg-[#f5a623]/15">
          <AlertTriangle className="size-4 shrink-0 text-[#f5a623]" />
          <span className="text-sm text-dash-text-body dark:text-dash-text-strong">
            You've reached your project limit ({projectCount}/{projectLimit}).{" "}
            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className="font-medium text-[#4879f8] transition-colors hover:text-[#3060d0]"
            >
              Upgrade your plan
            </button>{" "}
            to deploy more projects.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm text-dash-text-body">Service name</label>
          <input type="text" value={dbName} onChange={(e) => setDbName(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-dash-text-body">Region</label>
          <Dropdown value={region} options={regionOptions} onChange={setRegion} />
        </div>
      </div>

      {recommendation && !isFreePlan ? (
        <div className="mt-4 rounded-[4px] bg-[#f59e0b]/[0.06] px-3 py-2.5 dark:bg-[#f59e0b]/[0.08]">
          <p className="text-xs leading-relaxed text-dash-text-body">
            Recommended for {engine.name}: {recommendation.cpu ?? "?"} vCPU, {recommendation.memory ?? "?"} GB RAM,{" "}
            {recommendation.storage ?? "?"} GB storage.
          </p>
          <button
            type="button"
            className="mt-1 text-xs font-medium text-[#4879f8] transition-colors hover:text-[#3060d0]"
            onClick={() => {
              if (typeof recommendation.cpu === "number") {
                const nextCpuIdx = cpuSteps.indexOf(recommendation.cpu);
                if (nextCpuIdx >= 0) setCpuIdx(nextCpuIdx);
              }
              if (typeof recommendation.memory === "number") {
                const nextMemIdx = memorySteps.indexOf(recommendation.memory);
                if (nextMemIdx >= 0) setMemIdx(nextMemIdx);
              }
              if (typeof recommendation.storage === "number") {
                const match = diskSizes.find((d) => Number(d.id) === recommendation.storage);
                if (match) setDbDiskSize(match.id);
              }
            }}
          >
            Apply recommended
          </button>
        </div>
      ) : null}

      <hr className="my-6 border-dash-border-soft" />

      {/* Compute resources */}
      <div>
        <h4 className="mb-1 text-sm font-medium text-dash-text-strong">Compute</h4>
        <p className="mb-5 text-sm text-dash-text-faded">
          Choose CPU, memory, and storage for your database instance. You can update these later.
        </p>
        <div className="flex flex-col gap-5">
          <ComputeSliderField
            label="CPU"
            value={cpuIdx}
            steps={effectiveCpuSteps}
            formatValue={formatCpu}
            onCommit={setCpuIdx}
            disabled={isFreePlan}
            disabledReason="Compute controls are locked on the Free plan. Upgrade your plan to customize CPU."
          />
          <ComputeSliderField
            label="Memory"
            value={memIdx}
            steps={effectiveMemorySteps}
            formatValue={formatMemory}
            onCommit={setMemIdx}
            disabled={isFreePlan}
            disabledReason="Compute controls are locked on the Free plan. Upgrade your plan to customize memory."
          />
          <DiskSizeSelect
            label="Storage"
            value={dbDiskSize}
            onChange={(nextId) => {
              if (lockedStorageId && nextId !== lockedStorageId) {
                setShowUpgradeModal(true);
                return;
              }
              setDbDiskSize(nextId);
            }}
            options={storageOptions}
          />
          {isFreePlan && (
            <p className="text-xs text-dash-text-faded">
              Compute and storage are fixed on the free plan.{" "}
              <button type="button" onClick={() => setShowUpgradeModal(true)} className="font-medium text-[#4879f8] hover:text-[#3060d0]">
                Upgrade for more
              </button>
            </p>
          )}
        </div>
      </div>

      <hr className="my-6 border-dash-border-soft" />

      {/* Credentials */}
      <div>
        <h4 className="mb-1 text-sm font-medium text-dash-text-strong">Service credentials</h4>
        <p className="mb-4 text-sm text-dash-text-faded">These values are used to connect to your service after provisioning.</p>
        <div className="rounded-[4px] border-[0.5px] border-dash-border p-4">
          <div className="flex flex-col gap-2.5">
            {envDrafts.length > 0 ? (
              envDrafts.map((row) => (
                <CredentialRow
                  key={row.id}
                  label={row.key}
                  value={row.value}
                  onChange={(v) => updateEnvDraft(row.id, v)}
                  sensitive={row.sensitive}
                  canRegenerate={row.isPassword}
                  onRegenerate={() => updateEnvDraft(row.id, generateStrongPassword())}
                />
              ))
            ) : (
              <p className="text-xs text-dash-text-faded">No engine environment variables required.</p>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-dash-text-extra-faded">
          Credentials are auto-generated but can be customised. Store them securely after provisioning.
        </p>
      </div>

      <hr className="my-6 border-dash-border-soft" />

      {/* Network access */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-dash-text-strong">Public access</h4>
            <p className="mt-0.5 text-xs text-dash-text-faded">Allow connections from any IP address</p>
          </div>
          <ToggleSwitch checked={publicAccess} onChange={setPublicAccess} />
        </div>
        <AnimatePresence>
          {publicAccess && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex items-start gap-2 rounded-[4px] bg-[#f59e0b]/[0.06] px-3 py-2.5">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-[#f59e0b]" />
                <p className="text-xs leading-relaxed text-dash-text-body">
                  Public access exposes your database to the internet. Use strong credentials and consider IP whitelisting in production.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {!publicAccess && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease }}
              className="overflow-hidden"
            >
              <div className="mt-4 px-px pb-px">
                <IpWhitelist
                  ips={whitelistIps}
                  onAdd={addWhitelistIp}
                  onRemove={(id) => removeWhitelistIp(id as number)}
                  onUpdate={(id, value) => updateWhitelistIp(id as number, value)}
                  errors={whitelistIpErrors}
                  inputClassName={`${inputClass} flex-1 font-family-mono text-[13px]`}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <hr className="my-6 border-dash-border-soft" />

      {/* Estimated Billing */}
      <div>
        <h4 className="text-sm font-medium text-dash-text-strong">Estimated Billing</h4>
        <p className="mt-0.5 text-xs text-dash-text-faded">
          {isFreePlan
            ? `Free for the first ${config.databaseFreeTrialDays} days. Upgrade your plan before the trial ends or this database will be paused.`
            : "Monthly cost based on your current plan"}
        </p>

        <div className="mt-3 flex flex-col">
          {costBreakdown.cpu.excess > 0 && (
            <div className="flex items-center justify-between py-1.5 text-xs text-dash-text-body">
              <span>
                CPU ({costBreakdown.cpu.excess} vCPU &times; {formatUsdMonthly(costBreakdown.cpu.rate)})
              </span>
              <span>{formatUsdMonthly(costBreakdown.cpu.cost)}</span>
            </div>
          )}
          {costBreakdown.memory.excess > 0 && (
            <div className="flex items-center justify-between py-1.5 text-xs text-dash-text-body">
              <span>
                Memory ({costBreakdown.memory.excess} GB &times; {formatUsdMonthly(costBreakdown.memory.rate)})
              </span>
              <span>{formatUsdMonthly(costBreakdown.memory.cost)}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-1.5 text-xs text-dash-text-body">
            <span>
              Storage ({costBreakdown.storage.amount} GB &times; {formatUsdMonthly(costBreakdown.storage.rate)})
            </span>
            <span>{formatUsdMonthly(costBreakdown.storage.cost)}</span>
          </div>
          <hr className="my-1.5 border-dash-border-soft" />
          <div className="flex items-center justify-between py-1.5 text-sm font-medium text-dash-text-strong">
            <span>Estimated total</span>
            {isFreePlan ? (
              <span className="flex items-baseline gap-2">
                <span className="text-xs font-normal text-dash-text-faded line-through">{formatUsdMonthly(costBreakdown.total)}/mo</span>
                <span>$0.00 during {config.databaseFreeTrialDays}-day trial</span>
              </span>
            ) : (
              <span>{formatUsdMonthly(costBreakdown.total)}/mo</span>
            )}
          </div>
        </div>
      </div>

      {/* Provision button */}
      <div className="mt-8">
        <GlossyButton
          variant="blue"
          fullWidth
          loading={submitting}
          loadingLabel="Provisioning database..."
          disabled={!dbName.trim() || !region || submitting || limitReached}
          onClick={() => {
            if (limitReached) {
              setShowUpgradeModal(true);
              return;
            }
            if (!publicAccess && !validateWhitelistIps()) {
              return;
            }

            const hasEmptyEnvValue = envDrafts.some((row) => !row.value.trim());
            if (hasEmptyEnvValue) {
              toast.error("Please fill in all database credentials.");
              return;
            }

            void onProvision({
              name: dbName.trim(),
              regionId: region,
              cpu: effectiveCpu,
              memory: effectiveMemory,
              storage: effectiveStorage,
              whitelistedIps: publicAccess ? ["0.0.0.0/0"] : whitelistIps.map((ip) => ip.value.trim()).filter(Boolean),
              environments: envDrafts.map((row) => ({
                name: row.key,
                value: row.value.trim(),
              })),
            });
          }}
        >
          Provision Database
        </GlossyButton>
      </div>

      <ChangePlanModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        currentPlan={planKey}
        defaultSelectedPlan={nextPlanName}
      />
    </motion.div>
  );
}

/* ─── Phase 3: Configure & Deploy ─── */

interface EnvVar {
  id: number;
  key: string;
  value: string;
}

let envNextId = 1;

const SERVER_RUNTIME_FRAMEWORK_TYPES: string[] = [FrameworkApplicationType.Ssr, FrameworkApplicationType.Backend, "other"];
const FREE_PLAN_FRAMEWORK_TYPES: string[] = [FrameworkApplicationType.Static, FrameworkApplicationType.Spa, FrameworkApplicationType.Ssr];

function Phase3Configure({
  sourceType,
  sourceName,
  detectedFramework,
  frameworkOptions,
  regionOptions,
  branchOptions,
  deploying = false,
  saving = false,
  projectCount = 0,
  onDeploy,
  onSaveForLater,
  repoBrowser,
}: {
  sourceType: SourceType;
  sourceName: string;
  detectedFramework?: RepositoryFrameworkDefaults;
  frameworkOptions: Array<{
    id: string;
    name: string;
    icon?: string;
    iconClassName?: string;
    buildCmd?: string;
    start?: string;
    output?: string;
    install?: string;
    port?: number;
    tooltipMessage?: string;
    type?: string;
  }>;
  regionOptions: RegionOption[];
  branchOptions?: string[];
  deploying?: boolean;
  saving?: boolean;
  projectCount?: number;
  onDeploy: (input: Phase3DeployInput) => boolean | Promise<boolean>;
  onSaveForLater: (input: Phase3DeployInput) => boolean | Promise<boolean>;
  repoBrowser?: {
    repoName?: string;
    installationId?: number | string;
  };
}) {
  const defaultName =
    sourceType === SourceType.Docker
      ? inferProjectNameFromDockerImage(sourceName) || sourceName
      : (sourceName.split(":")[0].split("/").pop() ?? sourceName);
  const lastAppliedSourceRef = useRef<string>("");

  const [projectName, setProjectName] = useState(defaultName.toLowerCase().replace(/[^a-z-]/g, ""));
  const [region, setRegion] = useState(regionOptions[0]?.id ?? "");
  const [branch, setBranch] = useState(branchOptions?.[0] ?? "main");
  const [rootDir, setRootDir] = useState("./");
  const [rootDirDrawerOpen, setRootDirDrawerOpen] = useState(false);
  const isGit = isGitSource(sourceType);
  const { planKey, projectLimit } = usePlanGate();
  const pricing = usePricing();
  const isFreePlan = planKey === "free";
  const limitReached = projectLimit !== null && projectCount > projectLimit;

  const deployValidationSchema = useMemo(
    () =>
      Yup.object({
        projectName: Yup.string()
          .trim()
          .required("Project name is required.")
          .matches(/^[a-z-]+$/, "Project name can only contain lowercase letters and hyphens."),
        region: Yup.string().required("Please select a region."),
        limitReached: Yup.boolean().oneOf([false], "You have reached your project limit. Upgrade your plan to create more."),
      }),
    [],
  );

  const deployFormik = useFormik({
    initialValues: { projectName, region, limitReached },
    enableReinitialize: true,
    validateOnMount: true,
    validationSchema: deployValidationSchema,
    onSubmit: () => {},
  });

  const projectNameError = projectName.trim() && deployFormik.errors.projectName ? deployFormik.errors.projectName : null;
  const hasProjectNameError = projectNameError !== null;
  const canSubmit = deployFormik.isValid;
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const nextPlanName = useMemo(() => {
    const currentIdx = pricing.plans.findIndex((p) => p.id === planKey || p.name.toLowerCase() === planKey);
    return currentIdx >= 0 && currentIdx < pricing.plans.length - 1 ? pricing.plans[currentIdx + 1].name : undefined;
  }, [pricing.plans, planKey]);
  const serviceTypeOptions = useMemo(
    () => [
      {
        id: ServiceType.WebService,
        label: "Web Service",
        description: "Run server-side code that handles requests. Ideal for dynamic apps and APIs.",
        disabled: isFreePlan,
        asideText: isFreePlan ? "Upgrade to access" : undefined,
      },
      {
        id: ServiceType.Static,
        label: "Static Site",
        description: "Serve fixed content like HTML, CSS, JS, and images. No server-side code.",
        disabled: false,
      },
      {
        id: ServiceType.Worker,
        label: "Worker",
        description: "Process background jobs and scheduled tasks.",
        disabled: isFreePlan,
        asideText: isFreePlan ? "Upgrade to access" : undefined,
      },
      {
        id: ServiceType.Mcp,
        label: "MCP",
        description: "Deploy MCP servers for AI and context integrations.",
        disabled: isFreePlan,
        asideText: isFreePlan ? "Upgrade to access" : undefined,
      },
    ],
    [isFreePlan],
  );
  const defaultFrameworkId = useMemo(() => {
    if (!isGit) return "custom";
    const detectedSlug = detectedFramework?.slug?.trim();
    if (detectedSlug && frameworkOptions.some((f) => f.id === detectedSlug)) {
      return detectedSlug;
    }
    return frameworkOptions[0]?.id ?? "custom";
  }, [detectedFramework?.slug, frameworkOptions, isGit]);
  const [framework, setFramework] = useState(defaultFrameworkId);
  const fw = frameworkOptions.find((f) => f.id === framework) ??
    frameworkOptions[0] ?? {
      id: "custom",
      name: "Custom",
      buildCmd: "",
      start: "",
      output: "",
      install: "",
    };
  const [buildCmd, setBuildCmd] = useState(fw.buildCmd ?? "");
  const [startCmd, setStartCmd] = useState(fw.start ?? "");
  const [outputDir, setOutputDir] = useState(fw.output ?? "");
  const [installCmd, setInstallCmd] = useState(fw.install ?? "");
  const [preStartCmd, setPreStartCmd] = useState("");
  const defaultPort = detectedFramework?.port ?? frameworkOptions.find((f) => f.id === defaultFrameworkId)?.port ?? 3000;
  const [envVars, setEnvVars] = useState<EnvVar[]>(() => [{ id: envNextId++, key: "PORT", value: String(defaultPort) }]);
  const [envExpanded, setEnvExpanded] = useState(true);
  const [cpuIdx, setCpuIdx] = useState(0);
  const [memIdx, setMemIdx] = useState(0);
  const effectiveCpu = cpuSteps[Math.min(cpuIdx, cpuSteps.length - 1)] ?? cpuSteps[0];
  const effectiveMemory = memorySteps[Math.min(memIdx, memorySteps.length - 1)] ?? memorySteps[0];
  const [diskEnabled, setDiskEnabled] = useState(false);
  const [diskSize, setDiskSize] = useState("10");
  const [mountPath, setMountPath] = useState("/mnt/data");
  const [serviceTypeManuallySelected, setServiceTypeManuallySelected] = useState(false);
  const [serviceType, setServiceType] = useState<string>(() => getLegacyServiceType(sourceType, defaultFrameworkId));
  const [mcpAuthEnabled, setMcpAuthEnabled] = useState(false);
  const selectedServiceTypeOption = useMemo(
    () => serviceTypeOptions.find((option) => option.id === serviceType),
    [serviceType, serviceTypeOptions],
  );
  const hideStorageSettings = isNoBuildFramework(framework) || serviceType === ServiceType.Static;
  const showMcpAuthToggle = serviceType === ServiceType.Mcp;
  const effectiveFrameworkType = fw.type ?? detectedFramework?.type;
  const requiresServerRuntime = SERVER_RUNTIME_FRAMEWORK_TYPES.includes(effectiveFrameworkType ?? "") && serviceType === ServiceType.Static;
  const [confirmServerRuntimeOpen, setConfirmServerRuntimeOpen] = useState(false);

  useEffect(() => {
    setRootDir("./");
    setRootDirDrawerOpen(false);
  }, [sourceName]);

  useEffect(() => {
    const derivedServiceType = getLegacyServiceType(sourceType, framework);
    if (!serviceTypeManuallySelected) {
      setServiceType(derivedServiceType);
    }
  }, [framework, serviceTypeManuallySelected, sourceType]);

  useEffect(() => {
    if (isFreePlan && serviceType !== ServiceType.Static) {
      setServiceType(ServiceType.Static);
    }
  }, [isFreePlan, serviceType]);

  useEffect(() => {
    if (serviceType !== ServiceType.Mcp) {
      setMcpAuthEnabled(false);
    }
  }, [serviceType]);

  useEffect(() => {
    if (!regionOptions.length) {
      return;
    }

    const firstRegionId = regionOptions[0]?.id;
    if (!firstRegionId) {
      return;
    }

    if (!region || !regionOptions.some((option) => option.id === region)) {
      setRegion(firstRegionId);
    }
  }, [region, regionOptions]);

  useEffect(() => {
    if (!isGit) {
      return;
    }

    if (!branchOptions?.length) {
      return;
    }

    if (!branchOptions.includes(branch)) {
      setBranch(branchOptions[0]);
    }
  }, [branch, branchOptions, isGit]);

  useEffect(() => {
    if (!frameworkOptions.length) {
      return;
    }

    if (!frameworkOptions.some((f) => f.id === framework)) {
      setFramework(frameworkOptions[0].id);
    }
  }, [framework, frameworkOptions]);

  useEffect(() => {
    if (!isGit || !sourceName) {
      return;
    }

    if (lastAppliedSourceRef.current === sourceName) {
      return;
    }

    const detectedSlug = detectedFramework?.slug?.trim();
    const matchedFramework = detectedSlug ? frameworkOptions.find((f) => f.id === detectedSlug) : undefined;

    if (matchedFramework?.id) {
      setFramework(matchedFramework.id);
      setBuildCmd(detectedFramework?.buildCommand ?? matchedFramework.buildCmd ?? "");
      setStartCmd(detectedFramework?.startCommand ?? matchedFramework.start ?? "");
      setOutputDir(detectedFramework?.outputDirectory ?? matchedFramework.output ?? "");
      setInstallCmd(detectedFramework?.installCommand ?? matchedFramework.install ?? "");
    } else if (detectedFramework) {
      setBuildCmd(detectedFramework.buildCommand ?? "");
      setStartCmd(detectedFramework.startCommand ?? "");
      setOutputDir(detectedFramework.outputDirectory ?? "");
      setInstallCmd(detectedFramework.installCommand ?? "");
    }

    lastAppliedSourceRef.current = sourceName;
  }, [detectedFramework, frameworkOptions, isGit, sourceName]);

  function handleFrameworkChange(id: string) {
    setFramework(id);
    const newFw = frameworkOptions.find((f) => f.id === id);
    setBuildCmd(newFw?.buildCmd ?? "");
    setStartCmd(newFw?.start ?? "");
    setOutputDir(newFw?.output ?? "");
    setInstallCmd(newFw?.install ?? "");
    setEnvVars((prev) => prev.map((row) => (row.key === "PORT" ? { ...row, value: String(newFw?.port ?? 3000) } : row)));
  }

  const canBrowseRootDir = isGit && Boolean(repoBrowser?.repoName) && Boolean(branch?.trim());

  function addEnvVar() {
    setEnvVars((prev) => [...prev, { id: envNextId++, key: "", value: "" }]);
    setEnvExpanded(true);
  }

  function removeEnvVar(id: number) {
    setEnvVars((prev) => prev.filter((v) => v.id !== id));
  }

  function updateEnvVar(id: number, field: "key" | "value", val: string) {
    setEnvVars((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: val } : v)));
  }

  function handleEnvPaste(id: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const parsed = parseEnvPaste(e.clipboardData.getData("text"));
    if (!parsed) return;
    e.preventDefault();
    setEnvVars((prev) => {
      const withoutCurrent = prev.filter((v) => v.id !== id || v.key || v.value);
      const newVars = parsed.map((p) => ({ id: envNextId++, key: p.name, value: p.value }));
      return [...withoutCurrent, ...newVars];
    });
    setEnvExpanded(true);
  }

  function buildDeployInput(): Phase3DeployInput | null {
    const cleanedEnvVars = envVars.map((v) => ({ key: v.key.trim(), value: v.value })).filter((v) => v.key || v.value);

    const invalidEnv = cleanedEnvVars.find((v) => !v.key || !v.value);
    if (invalidEnv) {
      toast.error("Each secret must include both key and value.");
      return null;
    }

    return {
      name: projectName.trim(),
      regionId: region,
      serviceType,
      authEnabled: serviceType === ServiceType.Mcp ? mcpAuthEnabled : false,
      branch: isGit ? branch : undefined,
      rootDirectory: isGit ? rootDir : "./",
      framework,
      preStartCommand: preStartCmd.trim(),
      buildCommand: buildCmd.trim(),
      startCommand: serviceType === ServiceType.Static ? "" : startCmd.trim(),
      outputDirectory: outputDir.trim(),
      installCommand: installCmd.trim(),
      envVars: cleanedEnvVars,
      cpu: effectiveCpu,
      memory: effectiveMemory,
      diskEnabled,
      diskSizeGb: diskEnabled ? Number(diskSize) : undefined,
      mountPath: diskEnabled ? mountPath.trim() : undefined,
    };
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-4 text-sm font-medium text-dash-text-strong">Configure Project</h3>
      <p className="mb-4 text-xs text-dash-text-faded">Project limits are counted across all environments in this workspace.</p>

      {limitReached && (
        <div className="mb-4 flex items-center gap-3 rounded-[6px] bg-[#f5a623]/5 px-3.5 py-3 dark:bg-[#f5a623]/15">
          <AlertTriangle className="size-4 shrink-0 text-[#f5a623]" />
          <span className="text-sm text-dash-text-body dark:text-dash-text-strong">
            You've reached your project limit across this workspace ({projectCount}/{projectLimit}).{" "}
            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className="font-medium text-[#4879f8] transition-colors hover:text-[#3060d0]"
            >
              Upgrade your plan
            </button>{" "}
            to deploy more projects.
          </span>
        </div>
      )}

      {/* Project settings */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-dash-text-body">Project name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value.toLowerCase())}
              className={inputClass}
              style={{
                transition: "box-shadow 0.2s ease",
                boxShadow: hasProjectNameError ? "0px 1px 2px rgba(239,47,31,0.3), 0px 0px 0px 1px #ef2f1f" : undefined,
              }}
            />
            <AnimatePresence>
              {projectNameError && (
                <motion.span
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, ease }}
                  className="mt-1 block text-xs text-[#ef2f1f]"
                >
                  {projectNameError}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-dash-text-body">Region</label>
            <Dropdown value={region} options={regionOptions} onChange={setRegion} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-dash-text-body">Deployment type</label>
          <Dropdown
            value={serviceType}
            options={serviceTypeOptions.map((option) => ({
              id: option.id,
              label: option.label,
              disabled: option.disabled,
              asideText: option.asideText,
            }))}
            onChange={(nextServiceType) => {
              const nextOption = serviceTypeOptions.find((option) => option.id === nextServiceType);
              if (nextOption?.disabled) {
                return;
              }
              setServiceType(nextServiceType);
              setServiceTypeManuallySelected(true);
            }}
          />
          {selectedServiceTypeOption?.description && (
            <p className="mt-2 text-xs text-dash-text-extra-faded">{selectedServiceTypeOption.description}</p>
          )}
        </div>

        {isGit && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-dash-text-body">Branch</label>
              <Dropdown
                value={branch}
                options={(branchOptions?.length ? branchOptions : ["main"]).map((b) => ({ id: b, label: b }))}
                onChange={setBranch}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-dash-text-body">Root directory</label>
              <RootDirectoryTrigger
                value={rootDir || "./"}
                disabled={!canBrowseRootDir}
                onClick={() => {
                  if (!canBrowseRootDir) return;
                  setRootDirDrawerOpen(true);
                }}
              />
              <p className="mt-2 text-xs text-dash-text-extra-faded">Select the folder in your repository to deploy.</p>
            </div>
          </div>
        )}

        {showMcpAuthToggle && (
          <div>
            <div className="flex items-center justify-between rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-3 py-2.5">
              <div className="pr-4">
                <p className="text-sm font-medium text-dash-text-strong">Enable MCP authentication</p>
                <p className="mt-1 text-xs text-dash-text-faded">
                  Require an API key in the <code>x-brimble-key</code> header for this MCP server.
                </p>
              </div>
              <ToggleSwitch checked={mcpAuthEnabled} onChange={setMcpAuthEnabled} size="sm" />
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <hr className="my-6 border-dash-border-soft" />

      {/* Build settings */}
      {isGit && (
        <>
          <h4 className="mb-4 text-sm font-medium text-dash-text-strong">Build Settings</h4>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm text-dash-text-body">
                Framework
                <span className="rounded-full bg-[#4879f8]/10 px-2 py-0.5 text-[11px] font-medium text-[#4879f8]">Auto-detected</span>
              </label>
              <Dropdown
                value={framework}
                options={frameworkOptions.map((f) => {
                  const gated = isFreePlan && !FREE_PLAN_FRAMEWORK_TYPES.includes(f.type ?? "");
                  return {
                    id: f.id,
                    label: f.name,
                    icon: f.icon,
                    iconClassName: f.iconClassName,
                    disabled: gated,
                    asideText: gated ? "Upgrade to access" : undefined,
                  };
                })}
                onChange={handleFrameworkChange}
                searchable
                searchPlaceholder="Search frameworks..."
              />
            </div>

            {!isNoBuildFramework(framework) && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm text-dash-text-body">Build command</label>
                  <input
                    type="text"
                    value={buildCmd}
                    onChange={(e) => setBuildCmd(e.target.value)}
                    placeholder="npm run build"
                    className={`${inputClass} font-family-mono text-[13px]`}
                  />
                </div>

                {serviceType !== ServiceType.Static && (
                  <div className="pb-2">
                    <label className="mb-1.5 block text-sm text-dash-text-body">Start command</label>
                    <input
                      type="text"
                      value={startCmd}
                      onChange={(e) => setStartCmd(e.target.value)}
                      placeholder="npm run start"
                      className={`${inputClass} font-family-mono text-[13px]`}
                    />
                    <p className="mt-2 text-xs text-dash-text-extra-faded">
                      Make sure your app listens on the port Brimble provides via the{" "}
                      <code className="rounded bg-dash-bg-elevated px-1 py-0.5 font-family-mono text-[11px] text-dash-text-body">PORT</code>{" "}
                      env var so health checks pass on startup.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm text-dash-text-body">Output directory</label>
                    <input
                      type="text"
                      value={outputDir}
                      onChange={(e) => setOutputDir(e.target.value)}
                      placeholder="dist"
                      className={`${inputClass} font-family-mono text-[13px]`}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm text-dash-text-body">Install command</label>
                    <input
                      type="text"
                      value={installCmd}
                      onChange={(e) => setInstallCmd(e.target.value)}
                      placeholder="npm install"
                      className={`${inputClass} font-family-mono text-[13px]`}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {!isNoBuildFramework(framework) && <hr className="my-6 border-dash-border-soft" />}
        </>
      )}

      {!isGit && sourceType === SourceType.Docker && (
        <>
          <h4 className="mb-4 text-sm font-medium text-dash-text-strong">Runtime Settings</h4>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm text-dash-text-body">Pre-start command</label>
              <input
                type="text"
                value={preStartCmd}
                onChange={(e) => setPreStartCmd(e.target.value)}
                placeholder="e.g. node scripts/migrate.js"
                className={`${inputClass} font-family-mono text-[13px]`}
              />
              <p className="mt-2 text-xs text-dash-text-extra-faded">Optional. Runs before your container start command.</p>
            </div>
          </div>

          <hr className="my-6 border-dash-border-soft" />
        </>
      )}

      {serviceType !== ServiceType.Static && (
        <>
          <h4 className="mb-1 text-sm font-medium text-dash-text-strong">Compute</h4>
          <p className="mb-4 text-sm text-dash-text-faded">Choose CPU and memory for your container. You can change this later.</p>
          <div className="flex flex-col gap-4">
            <ComputeSliderField
              label="CPU"
              value={cpuIdx}
              steps={cpuSteps}
              formatValue={(v) => `${v} vCPU`}
              onCommit={(idx) => setCpuIdx(idx)}
              disabled={isFreePlan}
              disabledReason="Compute is locked on the Free plan. Upgrade to customize CPU."
            />
            <ComputeSliderField
              label="Memory"
              value={memIdx}
              steps={memorySteps}
              formatValue={(v) => (v < 1 ? `${v * 1024} MB` : `${v} GB`)}
              onCommit={(idx) => setMemIdx(idx)}
              disabled={isFreePlan}
              disabledReason="Compute is locked on the Free plan. Upgrade to customize memory."
            />
            {isFreePlan && (
              <p className="text-xs text-dash-text-faded">
                Compute is fixed on the Free plan.{" "}
                <button type="button" onClick={() => setShowUpgradeModal(true)} className="font-medium text-[#4879f8] hover:text-[#3060d0]">
                  Upgrade for more
                </button>
              </p>
            )}
          </div>

          <hr className="my-6 border-dash-border-soft" />
        </>
      )}

      {/* Secrets — hidden for no-build frameworks (HTML, Static) */}
      {!isNoBuildFramework(framework) && (
        <div>
          <button onClick={() => setEnvExpanded(!envExpanded)} className="flex w-full items-start justify-between gap-4 text-sm">
            <div className="flex flex-col gap-[2px] text-left">
              <span className="font-medium text-dash-text-strong">Secrets</span>
              <span className="text-xs text-dash-text-faded">Stored securely on Brimble and injected at runtime.</span>
            </div>
            <span className="flex shrink-0 items-center gap-2 pt-0.5 text-xs text-dash-text-faded">
              {envVars.length} secret{envVars.length !== 1 ? "s" : ""}
              <motion.span animate={{ rotate: envExpanded ? 180 : 0 }} transition={{ duration: 0.2, ease }}>
                <ChevronDown className="size-3.5" />
              </motion.span>
            </span>
          </button>

          <AnimatePresence>
            {envExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                animate={{
                  opacity: 1,
                  height: "auto",
                  transitionEnd: { overflow: "visible" },
                }}
                exit={{ overflow: "hidden", opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease }}
              >
                <div className="scrollbar-subtle mt-3 flex max-h-[340px] flex-col gap-2 overflow-y-auto px-px py-px pr-1">
                  {envVars.map((v) => (
                    <div key={v.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="KEY"
                        value={v.key}
                        onChange={(e) => updateEnvVar(v.id, "key", e.target.value)}
                        onPaste={(e) => handleEnvPaste(v.id, e)}
                        className={`${inputClass} flex-1 font-family-mono text-[13px] uppercase`}
                      />
                      <input
                        type="text"
                        placeholder="value"
                        value={v.value}
                        onChange={(e) => updateEnvVar(v.id, "value", e.target.value)}
                        onPaste={(e) => handleEnvPaste(v.id, e)}
                        className={`${inputClass} flex-1 font-family-mono text-[13px]`}
                      />
                      <button
                        onClick={() => removeEnvVar(v.id)}
                        className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-dash-text-faded transition-colors hover:text-dash-text-strong"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addEnvVar}
                  className="mt-3 flex items-center gap-1.5 text-sm text-[#4879f8] transition-colors hover:text-[#3a6ae6]"
                >
                  <Plus className="size-3.5" />
                  Add secret
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Persistent storage — hidden for static services and no-build frameworks */}
      {!hideStorageSettings && (
        <>
          <hr className="my-6 border-dash-border-soft" />

          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="size-4 text-dash-text-faded" />
                <span className="text-sm font-medium text-dash-text-strong">Persistent Storage</span>
              </div>
              <ToggleSwitch checked={diskEnabled} onChange={setDiskEnabled} size="sm" />
            </div>
            <p className="mt-1 ml-6 text-xs text-dash-text-faded">Attach a volume that persists across restarts and deployments.</p>

            <AnimatePresence>
              {diskEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                  animate={{
                    opacity: 1,
                    height: "auto",
                    transitionEnd: { overflow: "visible" },
                  }}
                  exit={{ overflow: "hidden", opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease }}
                >
                  <div className="mt-4 flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-3 px-px pb-px sm:grid-cols-2">
                      <DiskSizeSelect value={diskSize} onChange={setDiskSize} />
                      <div>
                        <label className="mb-1.5 block text-xs text-dash-text-faded">Mount path</label>
                        <input
                          type="text"
                          value={mountPath}
                          onChange={(e) => setMountPath(e.target.value)}
                          placeholder="/mnt/data"
                          className={`${inputClass} font-family-mono text-[13px]`}
                        />
                      </div>
                    </div>

                    <div className="rounded-[4px] bg-[#f59e0b]/[0.06] px-3 py-2.5 dark:bg-[#f59e0b]/[0.08]">
                      <p className="text-xs leading-relaxed text-dash-text-body">
                        <span className="font-medium text-dash-text-strong">$0.25/GB per month.</span> Data persists across container
                        restarts and deployments. The volume mounts at{" "}
                        <code className="rounded bg-dash-bg-elevated px-1 py-0.5 font-family-mono text-[11px] text-dash-text-strong">
                          {mountPath || "/mnt/data"}
                        </code>{" "}
                        inside your container.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Save / Deploy actions */}
      <div className="mt-8">
        <div className="flex flex-col gap-2 sm:flex-row">
          <GlossyButton
            variant="white"
            className="sm:min-w-[190px]"
            loading={saving}
            loadingLabel="Saving..."
            disabled={deploying || saving || !canSubmit}
            onClick={() => {
              if (limitReached) {
                setShowUpgradeModal(true);
                return;
              }
              const deployInput = buildDeployInput();
              if (!deployInput) {
                return;
              }

              void onSaveForLater(deployInput);
            }}
          >
            Save For Later
          </GlossyButton>

          <GlossyButton
            variant="blue"
            fullWidth
            loading={deploying}
            loadingLabel="Deploying..."
            disabled={deploying || saving || !canSubmit}
            onClick={() => {
              if (limitReached) {
                setShowUpgradeModal(true);
                return;
              }
              if (requiresServerRuntime) {
                setConfirmServerRuntimeOpen(true);
                return;
              }
              const deployInput = buildDeployInput();
              if (!deployInput) {
                return;
              }

              void onDeploy(deployInput);
            }}
          >
            Deploy Project
          </GlossyButton>
        </div>

        <ChangePlanModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          currentPlan={planKey}
          defaultSelectedPlan={nextPlanName}
        />

        <ConfirmServerRuntimeModal
          open={confirmServerRuntimeOpen}
          onOpenChange={setConfirmServerRuntimeOpen}
          tooltipMessage={fw.tooltipMessage ?? detectedFramework?.tooltipMessage}
          isFreePlan={isFreePlan}
          loading={deploying}
          onConfirm={() => {
            setConfirmServerRuntimeOpen(false);
            const deployInput = buildDeployInput();
            if (!deployInput) {
              return;
            }
            void onDeploy(deployInput);
          }}
        />
      </div>

      {isGit && (
        <RootDirectoryDrawer
          open={rootDirDrawerOpen}
          onOpenChange={setRootDirDrawerOpen}
          provider={(sourceType as "github" | "gitlab" | "bitbucket") ?? "github"}
          repoName={repoBrowser?.repoName}
          installationId={repoBrowser?.installationId}
          branch={branch}
          selectedPath={rootDir || "./"}
          onSelect={({ path, framework: detectedFrameworkFromPath }) => {
            setRootDir(path || "./");

            if (detectedFrameworkFromPath?.slug) {
              const matched = frameworkOptions.find((f) => f.id === detectedFrameworkFromPath.slug);
              if (matched) {
                setFramework(matched.id);
                setBuildCmd(detectedFrameworkFromPath.buildCommand ?? matched.buildCmd ?? "");
                setStartCmd(detectedFrameworkFromPath.startCommand ?? matched.start ?? "");
                setOutputDir(detectedFrameworkFromPath.outputDirectory ?? matched.output ?? "");
                setInstallCmd(detectedFrameworkFromPath.installCommand ?? matched.install ?? "");
              }
            }
          }}
        />
      )}
    </motion.div>
  );
}

/* ─── Main Page ─── */

const rootRoute = getRouteApi("__root__");

function NewProjectPage() {
  const { canWrite } = useWorkspaceRole();
  const router = useRouter();
  const { onboardingProjects } = (rootRoute.useLoaderData() ?? {}) as {
    onboardingProjects?: { items: unknown[]; total?: number };
  };
  const navigate = useNavigate({ from: "/projects/new" });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const workspace = useMemo(() => {
    const params = new URLSearchParams(searchStr || "");
    return params.get("workspace")?.trim() || undefined;
  }, [searchStr]);
  const environmentId = useMemo(() => {
    const params = new URLSearchParams(searchStr || "");
    const raw = params.get("environmentId")?.trim();
    if (!raw || raw === "all") {
      return undefined;
    }
    return raw;
  }, [searchStr]);

  const [freshProjectCount, setFreshProjectCount] = useState<number | null>(null);
  const getOverview = useServerFn(getHomeOverviewServerFn as any) as (args: {
    data: { workspace?: string };
  }) => Promise<{ total: { project: number } }>;

  useEffect(() => {
    let active = true;
    getOverview({ data: { workspace } })
      .then((res) => {
        if (active) setFreshProjectCount(res?.total?.project ?? 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [workspace, getOverview]);

  const currentProjectCount = freshProjectCount ?? onboardingProjects?.total ?? onboardingProjects?.items?.length ?? 0;

  const listFrameworks = useServerFn(listFrameworksServerFn as any) as () => Promise<FrameworkOption[]>;
  const listRegions = useServerFn(listRegionsServerFn as any) as (args: {
    data?: { type?: "web" | "database"; enabled?: boolean; workspace?: string };
  }) => Promise<Region[]>;
  const listGithubAccounts = useServerFn(listGithubAccountsServerFn as any) as () => Promise<
    GithubAccount[] | { accounts?: GithubAccount[] }
  >;
  const getGithubInstallUrl = useServerFn(getGithubInstallUrlServerFn as any) as () => Promise<{ url: string }>;
  const listGithubRepos = useServerFn(listGithubReposServerFn as any) as (args: {
    data?: {
      q?: string;
      page?: number;
      limit?: number;
      installationId?: number | string;
    };
  }) => Promise<{ repositories: GithubRepoListItem[] }>;
  const getGithubRepo = useServerFn(getGithubRepoServerFn as any) as (args: {
    data: { repoName: string; installationId?: number | string };
  }) => Promise<RepositoryMetadata>;
  const listGitlabAccounts = useServerFn(listGitlabAccountsServerFn as any) as () => Promise<
    GithubAccount[] | { accounts?: GithubAccount[] }
  >;
  const getGitlabConnectUrl = useServerFn(getGitlabConnectUrlServerFn as any) as (args: {
    data?: { device?: string };
  }) => Promise<{ url: string }>;
  const listGitlabRepos = useServerFn(listGitlabReposServerFn as any) as (args: {
    data?: {
      q?: string;
      page?: number;
      limit?: number;
      installationId?: number | string;
    };
  }) => Promise<{ repositories: GithubRepoListItem[] }>;
  const getGitlabRepo = useServerFn(getGitlabRepoServerFn as any) as (args: {
    data: { repoName: string; installationId?: number | string };
  }) => Promise<RepositoryMetadata>;
  const listBitbucketAccounts = useServerFn(listBitbucketAccountsServerFn as any) as () => Promise<
    GithubAccount[] | { accounts?: GithubAccount[] }
  >;
  const getBitbucketConnectUrl = useServerFn(getBitbucketConnectUrlServerFn as any) as (args: {
    data?: { device?: string };
  }) => Promise<{ url: string }>;
  const listBitbucketRepos = useServerFn(listBitbucketReposServerFn as any) as (args: {
    data?: {
      q?: string;
      page?: number;
      limit?: number;
      installationId?: number | string;
    };
  }) => Promise<{ repositories: GithubRepoListItem[] }>;
  const getBitbucketRepo = useServerFn(getBitbucketRepoServerFn as any) as (args: {
    data: { repoName: string; installationId?: number | string };
  }) => Promise<RepositoryMetadata>;
  const createProject = useServerFn(createProjectServerFn as any) as (args: { data: Record<string, unknown> }) => Promise<Project>;
  const listAvailableDatabases = useServerFn(listAvailableDatabasesServerFn as any) as () => Promise<DatabaseEngineOption[]>;
  const createDatabaseProject = useServerFn(createDatabaseProjectServerFn as any) as (args: {
    data: {
      workspace?: string;
      name: string;
      dbImage: string;
      configurations: {
        cpu: number;
        memory: number;
        storage: number;
        region: string;
      };
      whitelistedIps?: string[];
      environments?: Array<{ name: string; value: string }>;
    };
  }) => Promise<DatabaseProvisionResult>;
  const validateDockerImage = useServerFn(validateDockerImageServerFn as any) as (args: {
    data: {
      imageUri: string;
      credentials?: {
        username: string;
        token: string;
      };
    };
  }) => Promise<boolean>;

  const [phase, setPhase] = useState<Phase>(1);
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  const [frameworkOptions, setFrameworkOptions] = useState<
    Array<{
      id: string;
      name: string;
      icon?: string;
      iconClassName?: string;
      buildCmd?: string;
      start?: string;
      output?: string;
      install?: string;
      port?: number;
      tooltipMessage?: string;
      type?: string;
    }>
  >(() =>
    frameworks.map((f) => ({
      id: f.id,
      name: f.name,
      icon: undefined,
      iconClassName: undefined,
      buildCmd: f.buildCmd,
      start: f.start,
      output: f.output,
      install: f.install,
    })),
  );
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([]);
  const [databaseRegionOptions, setDatabaseRegionOptions] = useState<RegionOption[]>([]);
  const [databaseEngineOptions, setDatabaseEngineOptions] = useState<DatabaseEngineOption[]>([]);
  const [databaseEnginesLoading, setDatabaseEnginesLoading] = useState(false);

  const handleProviderConnected = useCallback((providerId: string) => {
    setConnectedProviders((prev) => {
      const next = new Set(prev);
      next.add(providerId);
      return next;
    });
  }, []);

  const handleProviderRepoSelected = useCallback((name: string) => {
    setSourceName(name);
    setPhase(3);
  }, []);

  const github = useGitProvider({
    providerName: "GitHub",
    providerId: "github",
    api: {
      listAccounts: listGithubAccounts,
      getConnectUrl: getGithubInstallUrl,
      listRepos: listGithubRepos,
      getRepo: getGithubRepo,
    },
    active: sourceType === SourceType.Github,
    phase,
    onConnected: handleProviderConnected,
    onRepoSelected: handleProviderRepoSelected,
  });

  const gitlab = useGitProvider({
    providerName: "GitLab",
    providerId: "gitlab",
    api: {
      listAccounts: listGitlabAccounts,
      getConnectUrl: getGitlabConnectUrl,
      listRepos: listGitlabRepos,
      getRepo: getGitlabRepo,
    },
    active: sourceType === SourceType.Gitlab,
    phase,
    onConnected: handleProviderConnected,
    onRepoSelected: handleProviderRepoSelected,
  });

  const bitbucket = useGitProvider({
    providerName: "Bitbucket",
    providerId: "bitbucket",
    api: {
      listAccounts: listBitbucketAccounts,
      getConnectUrl: getBitbucketConnectUrl,
      listRepos: listBitbucketRepos,
      getRepo: getBitbucketRepo,
    },
    active: sourceType === SourceType.Bitbucket,
    phase,
    onConnected: handleProviderConnected,
    onRepoSelected: handleProviderRepoSelected,
  });

  const gitProviders_: Record<string, UseGitProviderResult> = {
    github,
    gitlab,
    bitbucket,
  };

  const [selectedDockerSource, setSelectedDockerSource] = useState<DockerSourceSelection | null>(null);
  const [validatingDockerImage, setValidatingDockerImage] = useState(false);
  const [dockerImageValidationError, setDockerImageValidationError] = useState<string | null>(null);
  const [deployingProject, setDeployingProject] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [provisioningDatabase, setProvisioningDatabase] = useState(false);

  useEffect(() => {
    let active = true;

    void listFrameworks()
      .then((items) => {
        if (!active || !Array.isArray(items) || items.length === 0) return;
        const dropdownOptions = mapFrameworksToDropdownOptions(items);
        setFrameworkOptions(
          items.map((item, index) => ({
            id: item.slug,
            name: item.name,
            icon: dropdownOptions[index]?.icon,
            iconClassName: dropdownOptions[index]?.iconClassName,
            buildCmd: item.buildCommand || "",
            start: item.startCommand || "",
            output: item.outputDirectory || "",
            install: item.installCommand || "",
            port: item.port,
            tooltipMessage: item.tooltipMessage,
            type: item.type,
          })),
        );
      })
      .catch(() => {
        // Keep existing options.
      });

    void listRegions({ data: { type: "web", enabled: true, workspace } })
      .then((items) => {
        if (!active || !Array.isArray(items)) return;
        const mapped = items
          .filter((region) => region.enabled !== false)
          .map((region) => ({
            id: region.id,
            label: buildRegionLabel(region),
          }));
        setRegionOptions(mapped);
      })
      .catch(() => {
        if (active) {
          setRegionOptions([]);
        }
      });

    void listRegions({ data: { type: "database", enabled: true, workspace } })
      .then((items) => {
        if (!active || !Array.isArray(items)) return;
        const mapped = items
          .filter((region) => region.enabled !== false)
          .map((region) => ({
            id: region.id,
            label: buildRegionLabel(region),
          }));
        setDatabaseRegionOptions(mapped);
      })
      .catch(() => {
        if (active) {
          setDatabaseRegionOptions([]);
        }
      });

    setDatabaseEnginesLoading(true);
    void listAvailableDatabases()
      .then((items) => {
        if (!active || !Array.isArray(items)) return;
        const sorted = [...items].sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return a.name.localeCompare(b.name);
        });
        setDatabaseEngineOptions(sorted);
      })
      .catch(() => {
        if (active) {
          setDatabaseEngineOptions([]);
        }
      })
      .finally(() => {
        if (active) {
          setDatabaseEnginesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [listAvailableDatabases, listFrameworks, listRegions, workspace]);

  function handleSourceTypeSelect(type: SourceType) {
    setSourceType(type);
    github.reset();
    gitlab.reset();
    bitbucket.reset();
    setSelectedDockerSource(null);
    setDockerImageValidationError(null);
    setPhase(2);
  }

  async function handleDockerSourceSelect(input: DockerSourceSelection) {
    const imageUri = input.imageUri.trim();
    if (!imageUri) {
      toast.error("Docker image is required.");
      return;
    }

    setValidatingDockerImage(true);
    setDockerImageValidationError(null);
    try {
      const isValid = await validateDockerImage({
        data: {
          imageUri,
          ...(input.credentials ? { credentials: input.credentials } : {}),
        },
      });

      if (!isValid) {
        setDockerImageValidationError("Docker image is not valid. Check the image name/tag and registry credentials.");
        return;
      }

      const normalized: DockerSourceSelection = {
        imageUri,
        ...(input.credentials ? { credentials: input.credentials } : {}),
      };
      setSelectedDockerSource(normalized);
      setDockerImageValidationError(null);
      handleSourceSelect(imageUri);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to validate Docker image";
      const normalizedMessage = message.trim().toLowerCase();
      const isInvalidImageError =
        normalizedMessage.includes("invalid docker image") ||
        normalizedMessage.includes("image is invalid") ||
        normalizedMessage.includes("invalid image");

      if (isInvalidImageError) {
        setDockerImageValidationError("Docker image is not valid. Check the image name/tag and registry credentials.");
      } else {
        toast.error(message);
      }
    } finally {
      setValidatingDockerImage(false);
    }
  }

  function handleSourceSelect(name: string) {
    setSourceName(name);
    setPhase(3);
  }

  function handleChangePhase(target: Phase) {
    setPhase(target);
    if (target === 1) {
      setSourceType(null);
      setSourceName("");
      github.reset();
      gitlab.reset();
      bitbucket.reset();
      setSelectedDockerSource(null);
      setDockerImageValidationError(null);
    } else if (target <= 2) {
      setSourceName("");
      if (sourceType === SourceType.Docker) {
        setDockerImageValidationError(null);
      }
      if (sourceType && gitProviders_[sourceType]) {
        gitProviders_[sourceType].reset();
      }
    }
  }

  async function handleCreateProject(input: Phase3DeployInput, options: { deploy: boolean }): Promise<boolean> {
    const { deploy } = options;
    const normalizedName = slugifyProjectName(input.name) || input.name.trim();
    if (!normalizedName) {
      toast.error("Project name is required.");
      return false;
    }

    const normalizedRootDirectory = (() => {
      const raw = input.rootDirectory.trim();
      if (!raw || raw === "." || raw === "./") return "";
      return raw.replace(/^\.?\//, "");
    })();

    let payload: Record<string, unknown>;

    if (sourceType === SourceType.Github || sourceType === SourceType.Gitlab || sourceType === SourceType.Bitbucket) {
      const providerState = gitProviders_[sourceType];
      const selectedRepo = providerState?.selectedRepo ?? null;
      const gitTag = sourceType.toUpperCase();

      if (!selectedRepo?.repo || !selectedRepo?.metadata) {
        toast.error("Please select a repository first.");
        return false;
      }

      const branch = input.branch?.trim() || selectedRepo.metadata.branches?.[0] || selectedRepo.repo.branch || "main";

      payload = {
        workspace,
        name: normalizedName,
        git: gitTag,
        branch,
        installationId: selectedRepo.metadata.installationId ?? selectedRepo.repo.installationId,
        healthCheckPath: "",
        preStartCommand: "",
        framework: input.framework,
        rootDirectory: normalizedRootDirectory,
        installCommand: input.installCommand,
        buildCommand: input.buildCommand,
        startCommand: input.startCommand,
        outputDirectory: input.outputDirectory,
        serviceType: input.serviceType,
        repo: {
          name: selectedRepo.metadata.fullName || selectedRepo.repo.fullName,
          branch,
          git: gitTag,
        },
        configurations: {
          region: input.regionId,
          cpu: input.cpu,
          memory: input.memory,
          storage: 3,
        },
        autoscalingGroup: null,
        envPrefix: getEnvPrefixForFramework(input.framework),
        environments: input.envVars.map((env) => ({
          name: env.key,
          value: env.value,
        })),
        experimental: {},
        authEnabled: input.authEnabled,
        ...(environmentId ? { environmentId } : {}),
      };
    } else if (sourceType === SourceType.Docker) {
      if (!selectedDockerSource?.imageUri) {
        toast.error("Please validate a Docker image first.");
        return false;
      }

      const parsedImage = parseDockerImageRef(selectedDockerSource.imageUri);
      if (!parsedImage) {
        toast.error("Invalid Docker image reference.");
        return false;
      }

      payload = {
        workspace,
        name: normalizedName,
        git: "DOCKER",
        branch: parsedImage.tag,
        healthCheckPath: "",
        preStartCommand: input.preStartCommand,
        framework: "docker",
        rootDirectory: "",
        installCommand: "",
        buildCommand: "",
        startCommand: "",
        outputDirectory: "",
        serviceType: input.serviceType,
        repo: {
          name: parsedImage.imageUri,
          branch: parsedImage.tag,
          git: "DOCKER",
        },
        configurations: {
          region: input.regionId,
          cpu: input.cpu,
          memory: input.memory,
          storage: 3,
        },
        autoscalingGroup: null,
        envPrefix: "",
        environments: input.envVars.map((env) => ({
          name: env.key,
          value: env.value,
        })),
        experimental: {},
        authEnabled: input.authEnabled,
        ...(environmentId ? { environmentId } : {}),
        ...(selectedDockerSource.credentials
          ? {
              registry_credentials: {
                username: selectedDockerSource.credentials.username,
                token: selectedDockerSource.credentials.token,
              },
            }
          : {}),
      };
    } else {
      toast.message("This deploy source is not wired yet.");
      return false;
    }

    if (input.diskEnabled && input.mountPath && input.diskSizeGb) {
      payload.volumeMount = input.mountPath;
      payload.diskSize = input.diskSizeGb;
    } else {
      payload.volumeMount = "";
      payload.diskSize = 10;
    }
    payload.deploy = deploy;

    try {
      if (deploy) {
        setDeployingProject(true);
      } else {
        setSavingProject(true);
      }
      const created = await createProject({ data: payload });
      const targetProjectId = created.slug || created.name || normalizedName;
      const createdLogId = typeof created.logId === "string" ? created.logId : undefined;

      if (deploy && typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(
            "brimble:open-deployment-drawer",
            JSON.stringify({
              projectId: String(targetProjectId),
              workspace: workspace ?? null,
              logId: createdLogId ?? null,
              createdAt: Date.now(),
            }),
          );
        } catch {
          // ignore storage failures
        }
      }

      if (deploy) {
        toast.success("Your project is deploying!");
      } else {
        toast.success("Project saved. You can continue configuring it anytime.");
      }
      await invalidateActiveMatches(router);
      navigate({
        to: withWorkspaceQuery({
          pathname: deploy
            ? `/projects/${encodeURIComponent(targetProjectId)}/deployment-history`
            : `/projects/${encodeURIComponent(targetProjectId)}/configuration`,
          searchStr,
        }) as any,
      });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : deploy ? "Failed to deploy project" : "Failed to save project");
      if (deploy) {
        setDeployingProject(false);
      } else {
        setSavingProject(false);
      }
      return false;
    }
  }

  async function handleDeployProject(input: Phase3DeployInput): Promise<boolean> {
    return handleCreateProject(input, { deploy: true });
  }

  async function handleSaveProjectForLater(input: Phase3DeployInput): Promise<boolean> {
    return handleCreateProject(input, { deploy: false });
  }

  async function handleProvisionDatabase(input: {
    engineId: string;
    name: string;
    regionId: string;
    cpu: number;
    memory: number;
    storage: number;
    whitelistedIps: string[];
    environments: Array<{ name: string; value: string }>;
  }) {
    const normalizedName = slugifyProjectName(input.name) || input.name.trim();
    if (!normalizedName) {
      toast.error("Database name is required.");
      return;
    }

    try {
      setProvisioningDatabase(true);
      const created = await createDatabaseProject({
        data: {
          workspace,
          name: normalizedName,
          dbImage: input.engineId,
          configurations: {
            cpu: input.cpu,
            memory: input.memory,
            storage: input.storage,
            region: input.regionId,
          },
          whitelistedIps: input.whitelistedIps,
          environments: input.environments,
        },
      });

      const targetProjectId = created?.name?.trim() || normalizedName;
      toast.success("Database provisioning started");
      await invalidateActiveMatches(router);
      navigate({
        to: withWorkspaceQuery({
          pathname: `/projects/${encodeURIComponent(targetProjectId)}`,
          searchStr,
        }) as any,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to provision database");
      setProvisioningDatabase(false);
    }
  }

  const backToProjectsHref = useMemo(() => withWorkspaceQuery({ pathname: "/projects", searchStr }), [searchStr]);

  if (!canWrite) {
    return <AccessDenied {...accessDeniedForbidden} />;
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-[680px]">
        {/* Header */}
        <div className="mb-8">
          <Link
            to={backToProjectsHref as any}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-dash-text-faded transition-colors hover:text-dash-text-strong"
          >
            <ArrowLeft className="size-4" />
            Back to projects
          </Link>
          <h1 className="text-xl font-medium text-dash-text-strong">New Project</h1>
          <p className="mt-1 text-sm text-dash-text-faded">Import a repository, deploy an image, or provision a database.</p>
        </div>

        {/* Phase 1 */}
        {phase > 1 && sourceType ? (
          <div className="mb-6">
            <SummaryChip
              icon={(() => {
                const provider = getGitProvider(sourceType);
                if (provider) {
                  const { Icon } = provider;
                  return <Icon className="size-3" />;
                }
                if (sourceType === SourceType.Database) return <Database className="size-3" />;
                return <Cube className="size-3" />;
              })()}
              label={(() => {
                const provider = getGitProvider(sourceType);
                if (provider) return provider.name;
                if (sourceType === SourceType.Database) return "Database";
                return "Docker";
              })()}
              onChangeClick={() => handleChangePhase(1)}
            />
          </div>
        ) : (
          phase === 1 && (
            <AnimatePresence mode="wait">
              <Phase1SourceType key="phase1" onSelect={handleSourceTypeSelect} />
            </AnimatePresence>
          )
        )}

        {/* Phase 2 */}
        {phase > 2 && sourceName ? (
          <div className="mb-6">
            <SummaryChip
              icon={sourceType === SourceType.Database ? <Database className="size-3" /> : <Check className="size-3" />}
              label={
                sourceType === SourceType.Database
                  ? (databaseEngineOptions.find((e) => e.id === sourceName)?.name ?? sourceName)
                  : sourceName
              }
              onChangeClick={() => handleChangePhase(2)}
              externalUrl={sourceType && GIT_BASE_URLS[sourceType] ? `${GIT_BASE_URLS[sourceType]}/${sourceName}` : undefined}
            />
          </div>
        ) : (
          phase === 2 &&
          sourceType && (
            <AnimatePresence mode="wait">
              {(() => {
                if (sourceType === SourceType.Database) {
                  return (
                    <Phase2DbEngine
                      key="phase2-db-engine"
                      engines={databaseEngineOptions}
                      selectedEngineId={sourceName}
                      loading={databaseEnginesLoading}
                      regionOptions={databaseRegionOptions}
                      submitting={provisioningDatabase}
                      projectCount={currentProjectCount}
                      onSelect={setSourceName}
                      onProvision={(payload) => handleProvisionDatabase(payload)}
                    />
                  );
                }
                const provider = getGitProvider(sourceType);
                const ps = provider ? gitProviders_[provider.id] : undefined;
                if (provider && ps && !connectedProviders.has(provider.id)) {
                  return (
                    <Phase2GitConnect
                      key={`phase2-connect-${provider.id}`}
                      provider={provider}
                      onConnected={ps.handleConnect}
                      connecting={ps.connectOpening}
                      polling={ps.connectPolling}
                      checkingConnection={!ps.accountsChecked || ps.accountsLoading}
                      errorMessage={ps.connectError}
                    />
                  );
                }
                if (provider && ps) {
                  return (
                    <Phase2GitRepoSelect
                      key={`phase2-repos-${provider.id}`}
                      provider={provider}
                      accounts={ps.accounts}
                      repos={ps.repos}
                      accountsLoading={ps.accountsLoading}
                      reposLoading={ps.reposLoading}
                      importingRepoFullName={ps.importingRepoFullName}
                      onRefreshAccounts={() => void ps.refreshAccounts()}
                      onConnectAccount={ps.handleConnect}
                      canAddAccount={provider.canAddAccount !== false}
                      onLoadRepos={ps.loadRepos}
                      onSelect={ps.handleRepoSelect}
                    />
                  );
                }
                return (
                  <Phase2Docker
                    key="phase2-docker"
                    onSubmit={handleDockerSourceSelect}
                    submitting={validatingDockerImage}
                    initialValue={selectedDockerSource}
                    imageError={dockerImageValidationError}
                    onImageChange={() => {
                      if (dockerImageValidationError) {
                        setDockerImageValidationError(null);
                      }
                    }}
                  />
                );
              })()}
            </AnimatePresence>
          )
        )}

        {/* Phase 3 */}
        {phase === 3 && sourceType && sourceName && (
          <AnimatePresence mode="wait">
            {sourceType === SourceType.Database
              ? (() => {
                  const selectedEngine = databaseEngineOptions.find((engine) => engine.id === sourceName);
                  if (!selectedEngine) {
                    return (
                      <motion.div
                        key="phase3-db-missing"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, ease }}
                        className="rounded-[4px] border-[0.5px] border-dash-border p-4 text-sm text-dash-text-faded"
                      >
                        Unable to load the selected database engine. Please go back and choose an engine again.
                      </motion.div>
                    );
                  }

                  return (
                    <Phase3DatabaseConfigure
                      key="phase3-db"
                      engine={selectedEngine}
                      regionOptions={databaseRegionOptions}
                      submitting={provisioningDatabase}
                      projectCount={currentProjectCount}
                      onProvision={(payload) =>
                        handleProvisionDatabase({
                          engineId: selectedEngine.id,
                          ...payload,
                        })
                      }
                    />
                  );
                })()
              : (() => {
                  const activeRepo = sourceType ? (gitProviders_[sourceType]?.selectedRepo ?? null) : null;
                  return (
                    <Phase3Configure
                      key="phase3"
                      sourceType={sourceType}
                      sourceName={sourceName}
                      detectedFramework={activeRepo?.metadata.framework}
                      repoBrowser={
                        activeRepo
                          ? {
                              repoName: activeRepo.metadata.fullName || activeRepo.repo.fullName,
                              installationId: activeRepo.metadata.installationId ?? activeRepo.repo.installationId,
                            }
                          : undefined
                      }
                      frameworkOptions={frameworkOptions}
                      regionOptions={regionOptions}
                      branchOptions={
                        activeRepo
                          ? activeRepo.metadata.branches?.length
                            ? activeRepo.metadata.branches
                            : activeRepo.repo.branch
                              ? [activeRepo.repo.branch]
                              : ["main"]
                          : undefined
                      }
                      deploying={deployingProject}
                      saving={savingProject}
                      projectCount={currentProjectCount}
                      onDeploy={handleDeployProject}
                      onSaveForLater={handleSaveProjectForLater}
                    />
                  );
                })()}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
