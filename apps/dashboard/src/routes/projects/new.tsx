import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { IpWhitelist } from "@/components/shared/ip-whitelist";
import { createFileRoute, Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
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
  ShieldAlert,
  HardDrive,
  ArrowUpRight,
} from "lucide-react";
import { GithubLogo, Cube, Database, CircleNotch } from "@phosphor-icons/react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { GlossyButton } from "../../components/shared/glossy-button";
import { DashButton } from "../../components/shared/dash-button";
import { ToggleSwitch } from "../../components/shared/toggle-switch";
import { RangeSlider } from "../../components/shared/range-slider";
import { Dropdown } from "../../components/shared/dropdown";
import { DiskSizeSelect, diskSizes } from "../../components/shared/disk-size-select";
import { RootDirectoryTrigger } from "../../components/shared/root-directory-trigger";
import { AccessDenied, accessDeniedForbidden } from "../../components/shared/access-denied";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { RootDirectoryDrawer } from "../../components/project/root-directory-drawer";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import {
  inferProjectNameFromDockerImage,
  parseDockerImageRef,
} from "@/utils/docker-image";
import { mapFrameworksToDropdownOptions } from "@/utils/framework-dropdown";
import {
  getEnvPrefixForFramework,
  getLegacyServiceType,
  isNoBuildFramework,
} from "@/utils/project-deploy";
import { ServiceType } from "@brimble/models/dist/enum";
import { listFrameworksServerFn } from "@/server/frameworks/actions";
import { listRegionsServerFn } from "@/server/regions/actions";
import {
  getGithubInstallUrlServerFn,
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
import { estimateComputeCost } from "@/utils/compute-pricing";
import { formatUsdMonthly } from "@/utils/billing";

export const Route = createFileRoute("/projects/new")({
  component: NewProjectPage,
});

/* ─── Constants ─── */

const ease = [0.16, 1, 0.3, 1] as const;

const inputClass =
  "w-full input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]";

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
}

function GitlabLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 0 0-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 0 0-.867 0L1.387 9.452.045 13.587a.924.924 0 0 0 .331 1.023L12 23.054l11.624-8.443a.92.92 0 0 0 .331-1.024" />
    </svg>
  );
}

const gitProviders: GitProvider[] = [
  {
    id: "github",
    name: "GitHub",
    Icon: GithubLogo,
    cardIcon: "/images/icons8-git.svg",
    description: "Connect a repository from your GitHub account",
    permissions: [
      { label: "Read access to your repositories", desc: "Browse and import repos" },
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
      { label: "Read access to your repositories", desc: "Browse and import repos" },
      { label: "Webhook notifications", desc: "Auto-deploy on push" },
      { label: "Deploy keys", desc: "Securely clone private repos" },
    ],
  },
];

function getGitProvider(id: string): GitProvider | undefined {
  return gitProviders.find((p) => p.id === id);
}

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

function debugMaskDeployPayload(payload: Record<string, unknown>) {
  const copy: Record<string, unknown> = { ...payload };

  if (Array.isArray(copy.environments)) {
    copy.environments = copy.environments.map((env) => {
      if (!env || typeof env !== "object") return env;
      const row = env as Record<string, unknown>;
      return {
        ...row,
        value:
          typeof row.value === "string" && row.value.length > 0
            ? "[REDACTED]"
            : row.value,
      };
    });
  }

  if (copy.registry_credentials && typeof copy.registry_credentials === "object") {
    const creds = copy.registry_credentials as Record<string, unknown>;
    copy.registry_credentials = {
      ...creds,
      token:
        typeof creds.token === "string" && creds.token.length > 0
          ? "[REDACTED]"
          : creds.token,
    };
  }

  return copy;
}

type DockerRegistryCredentials = {
  username: string;
  token: string;
};

type DockerSourceSelection = {
  imageUri: string;
  credentials?: DockerRegistryCredentials;
};

const mockOrgs = [
  { id: "personal", name: "Kemdirimakujuobi", avatar: "radial-gradient(circle at 62% 30%, #b8fce8, #91f2d5 25%, #6ae8c3 50%, #43deb0 75%, #1bd49d)" },
  { id: "team", name: "Brimble Team", avatar: "radial-gradient(circle at 62% 30%, #b8cffc, #94b6f8 25%, #6f9cf3 50%, #4b82ee 75%, #2769e9)" },
];

const mockRepos = [
  { name: "brimble-dashboard", visibility: "private" as const, language: "TypeScript" },
  { name: "landing-page", visibility: "public" as const, language: "TypeScript" },
  { name: "api-server", visibility: "private" as const, language: "Go" },
  { name: "design-system", visibility: "public" as const, language: "TypeScript" },
  { name: "mobile-app", visibility: "private" as const, language: "React Native" },
  { name: "docs-site", visibility: "public" as const, language: "MDX" },
];

const frameworks = [
  { id: "nextjs", name: "Next.js", buildCmd: "npm run build", output: ".next", install: "npm install", start: "npm run start" },
  { id: "vite", name: "Vite", buildCmd: "npm run build", output: "dist", install: "npm install", start: "npm run preview" },
  { id: "remix", name: "Remix", buildCmd: "npm run build", output: "build", install: "npm install", start: "npm run start" },
  { id: "astro", name: "Astro", buildCmd: "npm run build", output: "dist", install: "npm install", start: "npm run preview" },
  { id: "static", name: "Static", buildCmd: "", output: "public", install: "", start: "" },
  { id: "custom", name: "Custom", buildCmd: "", output: "", install: "", start: "" },
];

const regions = ["US East", "EU West", "Asia Pacific"];
const branches = ["main", "develop", "staging"];

function getGithubAccountsSignature(accounts: GithubAccount[]) {
  return [...accounts]
    .map((account) => ({
      installationId: String(account.installationId ?? ""),
      username: String(account.username ?? ""),
      name: String(account.name ?? ""),
      type: String(account.type ?? ""),
    }))
    .sort((a, b) =>
      `${a.installationId}:${a.username}:${a.name}:${a.type}`.localeCompare(
        `${b.installationId}:${b.username}:${b.name}:${b.type}`,
      ),
    )
    .map((item) => `${item.installationId}:${item.username}:${item.name}:${item.type}`)
    .join("|");
}

/* ─── Database Config ─── */

interface DbEngine {
  id: string;
  name: string;
  description: string;
  defaultPort: number;
  envPrefix: string;
}

const fallbackDbEngines: DbEngine[] = [
  { id: "postgresql", name: "PostgreSQL", description: "Relational, ACID-compliant", defaultPort: 5432, envPrefix: "POSTGRES" },
  { id: "mysql", name: "MySQL", description: "Popular relational database", defaultPort: 3306, envPrefix: "MYSQL" },
  { id: "mongodb", name: "MongoDB", description: "Document-oriented NoSQL", defaultPort: 27017, envPrefix: "MONGO" },
  { id: "redis", name: "Redis", description: "In-memory key-value store", defaultPort: 6379, envPrefix: "REDIS" },
];

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
}: {
  label: string;
  value: number;
  steps: number[];
  formatValue: (value: number) => string;
  onCommit: (value: number) => void;
}) {
  const maxIndex = Math.max(steps.length - 1, 1);
  const indexToTrack = (index: number) => (index / maxIndex) * 100;
  const trackToIndex = (track: number) =>
    Math.min(maxIndex, Math.max(0, Math.round((track / 100) * maxIndex)));
  const [trackValue, setTrackValue] = useState(() => indexToTrack(value));

  useEffect(() => {
    setTrackValue(indexToTrack(value));
  }, [value]);

  const previewIndex = trackToIndex(trackValue);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm text-dash-text-body">{label}</label>
        <span className="text-sm font-medium text-dash-text-strong">
          {formatValue(steps[previewIndex] ?? steps[0] ?? 0)}
        </span>
      </div>
      <RangeSlider
        value={trackValue}
        onChange={setTrackValue}
        onCommit={(nextTrackValue) => onCommit(trackToIndex(nextTrackValue))}
        min={0}
        max={100}
        step={1}
        hideValue
      />
    </div>
  );
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
  return /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)\/([0-9]|[1-2][0-9]|3[0-2])$/.test(
    trimmed,
  );
}

type DatabaseEnvDraft = {
  id: number;
  key: string;
  value: string;
  sensitive: boolean;
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
      <button
        onClick={onChangeClick}
        className="text-xs text-[#4879f8] transition-colors hover:text-[#3a6ae6]"
      >
        Change
      </button>
    </motion.div>
  );
}

/* ─── Phase 1: Source Type ─── */

function Phase1SourceType({
  onSelect,
}: {
  onSelect: (type: SourceType) => void;
}) {
  const haptics = useHaptics();
  const sourceCards: { type: SourceType; icon: string; iconClass?: string; title: string; desc: string }[] = [
    ...gitProviders.map((p) => ({
      type: p.id as SourceType,
      icon: p.cardIcon,
      iconClass: p.cardIconClass,
      title: `Import from ${p.name}`,
      desc: p.description,
    })),
    {
      type: SourceType.Docker,
      icon: "/images/icons8-container.svg",
      title: "Deploy Docker image",
      desc: "Deploy from a public or private registry",
    },
    {
      type: SourceType.Database,
      icon: "/images/icons8-database.svg",
      title: "Provision a Database",
      desc: "Deploy a managed database instance",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">
        How would you like to deploy?
      </h3>
      <p className="mb-4 text-sm text-dash-text-faded">
        Import a repository, deploy an image, or provision a database.
      </p>
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
              <div className="text-sm font-medium text-dash-text-strong">
                {card.title}
              </div>
              <div className="mt-0.5 text-xs text-dash-text-faded">
                {card.desc}
              </div>
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
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">
        Connect your {provider.name} account
      </h3>
      <p className="mb-5 text-sm text-dash-text-faded">
        To import a repository, you need to connect your {provider.name} account
        to Brimble first.
      </p>

      <div className="rounded-[4px] border-[0.5px] border-dash-border p-5">
        <div className="flex flex-col items-center py-4">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-dash-bg-elevated">
            <Icon className="size-6 text-dash-text-body" />
          </div>
          <p className="mb-1 text-sm font-medium text-dash-text-strong">
            {provider.name} not connected
          </p>
          <p className="mb-5 max-w-[320px] text-center text-sm text-dash-text-faded">
            Allow Brimble to access your repositories so you can import and
            deploy them directly.
          </p>
          <GlossyButton
            variant="blue"
            onClick={onConnected}
            disabled={buttonDisabled}
          >
            {polling ? (
              <CircleNotch className="size-4 animate-spin" />
            ) : (
              buttonLabel
            )}
          </GlossyButton>
          {errorMessage ? (
            <p className="mt-3 text-center text-xs text-[#ef2f1f]">
              {errorMessage}
            </p>
          ) : checkingConnection ? (
            <p className="mt-3 text-center text-xs text-dash-text-faded">
              Checking your {provider.name} connection status…
            </p>
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
  onLoadRepos?: (input: { installationId?: number | string; q?: string }) => void;
  onSelect: (repo: GithubRepoListItem) => void;
}) {
  const { Icon: ProviderIcon } = provider;
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

      const preferred =
        accounts.find((a) => String(a.type ?? "").toLowerCase() !== "organization") ??
        accounts[0];

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

  const selectedOrg = accounts.find(
    (account) => String(account.installationId ?? "") === selectedInstallationId,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-4 text-sm font-medium text-dash-text-strong">
        Import from {provider.name}
      </h3>

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
                onClick={() => setOrgOpen(!orgOpen)}
                className={`flex items-center gap-2 ${inputClass} w-auto min-w-[200px]`}
              >
                {selectedOrg?.avatar ? (
                  <img
                    src={selectedOrg.avatar}
                    alt=""
                    className="size-5 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="size-5 shrink-0 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle at 62% 30%, #b8cffc, #94b6f8 25%, #6f9cf3 50%, #4b82ee 75%, #2769e9)",
                    }}
                  />
                )}
                <span className="flex-1 truncate text-left">
                  {selectedOrg?.name || selectedOrg?.username || "Select account"}
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-dash-text-faded" />
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
                          <img
                            src={account.avatar}
                            alt=""
                            className="size-5 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="size-5 shrink-0 rounded-full"
                            style={{
                              background:
                                "radial-gradient(circle at 62% 30%, #b8cffc, #94b6f8 25%, #6f9cf3 50%, #4b82ee 75%, #2769e9)",
                            }}
                          />
                        )}
                        <span className="truncate">
                          {account.name || account.username || "GitHub Account"}
                        </span>
                        {locked && (
                          <span className="ml-auto shrink-0 rounded bg-dash-bg px-1.5 py-0.5 text-[10px] font-medium text-dash-text-faded">
                            Upgrade
                          </span>
                        )}
                      </button>
                      );
                    })}
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
              <div className="px-4 py-8 text-center text-sm text-dash-text-faded">
                Loading repositories…
              </div>
            ) : repos.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-dash-text-faded">
                No repositories found.
              </div>
            ) : (
              repos.map((repo, i) => (
                <motion.div
                  key={repo.fullName}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.04 * i, ease }}
                  className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t-[0.5px] border-dash-border" : ""
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <img src="/icons/git-circle.svg" alt="" className="size-6 shrink-0" />
                    <span className="text-sm font-medium text-dash-text-strong">
                      {repo.name}
                    </span>
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
                  </div>
                  <DashButton
                    size="sm"
                    onClick={() => onSelect(repo)}
                    disabled={importingRepoFullName === repo.fullName}
                  >
                    {importingRepoFullName === repo.fullName ? "Importing…" : "Import"}
                  </DashButton>
                </motion.div>
              ))
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
  const [authExpanded, setAuthExpanded] = useState(
    Boolean(initialValue?.credentials?.username || initialValue?.credentials?.token),
  );

  useEffect(() => {
    setImage(initialValue?.imageUri ?? "");
    setUsername(initialValue?.credentials?.username ?? "");
    setToken(initialValue?.credentials?.token ?? "");
    setAuthExpanded(
      Boolean(initialValue?.credentials?.username || initialValue?.credentials?.token),
    );
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
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">
        Docker Image
      </h3>
      <p className="mb-4 text-sm text-dash-text-faded">
        Enter the image name including tag and optional registry.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (submitting) return;
          submitDockerImage();
        }}
      >
        <div>
          <label className="mb-1.5 block text-sm text-dash-text-body">
            Image name
          </label>
          <input
            type="text"
            placeholder="nginx:latest or ghcr.io/org/image:tag"
            value={image}
            onChange={(e) => {
              onImageChange?.();
              setImage(e.target.value);
            }}
            className={`w-full input-base ${imageError ? "input-focus-red" : "input-focus"
              } px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]`}
            autoFocus
          />
          {imageError ? (
            <p className="mt-2 text-xs text-[#ef4444]">{imageError}</p>
          ) : null}
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
            <span className="font-medium text-dash-text-strong">
              Private registry credentials
            </span>
            <motion.span
              animate={{ rotate: authExpanded ? 180 : 0 }}
              transition={{ duration: 0.2, ease }}
            >
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
                    <label className="mb-1.5 block text-sm text-dash-text-body">
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="octocat"
                      className={inputClass}
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm text-dash-text-body">
                      Token
                    </label>
                    <div className="relative">
                      <input
                        type={tokenVisible ? "text" : "password"}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Personal access token"
                        className={`${inputClass} pr-9`}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setTokenVisible((prev) => !prev)}
                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-[4px] p-1 text-dash-text-faded transition-colors hover:text-dash-text-strong"
                      >
                        {tokenVisible ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
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
          <p className="mt-3 text-xs text-[#f59e0b]">
            Provide both username and token to use private registry authentication.
          </p>
        ) : null}
        <div className="mt-5">
          <GlossyButton
            type="submit"
            variant="blue"
            fullWidth
            loading={submitting}
            loadingLabel="Validating image..."
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
  onSelect,
  onProvision,
}: {
  engines: DatabaseEngineOption[];
  selectedEngineId: string;
  loading?: boolean;
  regionOptions: RegionOption[];
  submitting?: boolean;
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
  function renderEngineIcon(engine: {
    name: string;
    imageUrl?: string;
  }) {
    const imageUrl = engine.imageUrl?.trim();
    if (!imageUrl) {
      return <Database className="size-5 text-dash-text-body" />;
    }

    if (imageUrl.startsWith("<svg")) {
      return (
        <span
          className="flex size-5 items-center justify-center [&>svg]:size-5"
          dangerouslySetInnerHTML={{ __html: imageUrl }}
          aria-hidden
        />
      );
    }

    return (
      <img
        src={imageUrl}
        alt=""
        className="size-5 object-contain"
        loading="lazy"
      />
    );
  }

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease }}
      >
        <h3 className="mb-1 text-sm font-medium text-dash-text-strong">Choose a database engine</h3>
        <p className="mb-4 text-sm text-dash-text-faded">Loading available databases...</p>
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

  const selectedEngine = engines.find((engine) => engine.id === selectedEngineId) ?? null;
  const getDropdownIconSrc = (value?: string) => {
    const raw = value?.trim();
    if (!raw) return undefined;
    if (raw.startsWith("<") || raw.includes("<svg")) {
      if (raw.includes("<svg")) {
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
      }
      return undefined;
    }
    if (
      raw.startsWith("http://") ||
      raw.startsWith("https://") ||
      raw.startsWith("/") ||
      raw.startsWith("data:image/")
    ) {
      return raw;
    }
    return undefined;
  };
  const engineOptions = engines.map((engine) => ({
    id: engine.id,
    label: engine.name,
    icon: getDropdownIconSrc(engine.imageUrl) || getDropdownIconSrc(engine.image),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">
        Provision a database
      </h3>
      <p className="mb-4 text-sm text-dash-text-faded">
        Select a database engine, then configure compute, storage, and access in one step.
      </p>
      <div className="rounded-[4px] border-[0.5px] border-dash-border p-4">
        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.08em] text-dash-text-faded">
          Database engine
        </label>
        <Dropdown
          value={selectedEngineId}
          options={engineOptions}
          onChange={onSelect}
          placeholder="Select a database engine"
          searchable
          searchPlaceholder="Search database engines..."
        />
        {selectedEngine && (
          <div className="mt-3 flex items-center gap-2 text-xs text-dash-text-faded">
            {renderEngineIcon(selectedEngine)}
            <span>
              {selectedEngine.protocol
                ? `${selectedEngine.protocol.toUpperCase()} database`
                : "Managed database service"}
              {selectedEngine.version ? ` • v${selectedEngine.version}` : ""}
            </span>
          </div>
        )}
      </div>

      {selectedEngine ? (
        <div className="mt-6">
          <Phase3DatabaseConfigure
            key={selectedEngine.id}
            engine={selectedEngine}
            regionOptions={regionOptions}
            submitting={submitting}
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
    </motion.div>
  );
}

/* ─── Phase 3: Database Configure ─── */

function CredentialRow({
  label,
  value,
  onChange,
  sensitive = false,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  sensitive?: boolean;
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
      <span className="shrink-0 font-family-mono text-xs text-dash-text-faded">
        {label}
      </span>
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
        {sensitive && (
          <button
            onClick={() => setRevealed(!revealed)}
            className="flex size-7 items-center justify-center rounded-[4px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
          >
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        )}
        <button
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
  onProvision,
}: {
  engine: DatabaseEngineOption;
  regionOptions: RegionOption[];
  submitting?: boolean;
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
  const [cpuIdx, setCpuIdx] = useState(() => {
    const recommendedCpu = engine.recommendations?.[0]?.compute?.cpu;
    const exactIndex = typeof recommendedCpu === "number" ? cpuSteps.indexOf(recommendedCpu) : -1;
    return exactIndex >= 0 ? exactIndex : 0;
  });
  const [memIdx, setMemIdx] = useState(() => {
    const recommendedMemory = engine.recommendations?.[0]?.compute?.memory;
    const exactIndex = typeof recommendedMemory === "number" ? memorySteps.indexOf(recommendedMemory) : -1;
    return exactIndex >= 0 ? exactIndex : 1;
  });
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
  const [envDrafts, setEnvDrafts] = useState<DatabaseEnvDraft[]>([]);

  const recommendation = engine.recommendations?.[0]?.compute;

  const { planKey } = usePlanGate();
  const pricing = usePricing();

  const costBreakdown = useMemo(
    () =>
      estimateComputeCost(
        { cpu: cpuSteps[cpuIdx], memory: memorySteps[memIdx], storage: Number(dbDiskSize) },
        planKey,
        pricing.metered,
      ),
    [cpuIdx, memIdx, dbDiskSize, planKey, pricing.metered],
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
      let value = "";

      if (lowerType.includes("user") || lowerKey.includes("user")) {
        value = `brimble_${generateMockCredential(6)}`;
      } else if (lowerType.includes("password") || lowerKey.includes("password") || lowerKey.includes("pass")) {
        value = generateSecureCredential(24);
      } else if (lowerType.includes("database") || lowerKey.includes("database") || lowerKey.endsWith("_db")) {
        value = dbName.replace(/-/g, "_");
      } else if (lowerType.includes("license") || lowerKey.includes("license")) {
        value = "yes";
      } else if (lowerType.includes("auth") || lowerKey.includes("auth")) {
        value = `neo4j/${generateSecureCredential(18)}`;
      }

      const sensitive =
        lowerType.includes("password") ||
        lowerKey.includes("password") ||
        lowerKey.includes("pass") ||
        lowerType.includes("auth");

      return {
        id: dbEnvNextId++,
        key,
        value,
        sensitive,
      };
    });
    setEnvDrafts(generated);
  }, [engine.id, dbName]);

  function updateEnvDraft(id: number, value: string) {
    setEnvDrafts((prev) => prev.map((row) => (row.id === id ? { ...row, value } : row)));
  }

  function addWhitelistIp() {
    setWhitelistIps((prev) => [...prev, { id: ipNextId++, value: "" }]);
  }

  function removeWhitelistIp(id: number) {
    setWhitelistIps((prev) => prev.filter((ip) => ip.id !== id));
  }

  function updateWhitelistIp(id: number, value: string) {
    setWhitelistIps((prev) =>
      prev.map((ip) => (ip.id === id ? { ...ip, value } : ip)),
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-4 text-sm font-medium text-dash-text-strong">Configure {engine.name}</h3>

      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm text-dash-text-body">
            Database name
          </label>
          <input
            type="text"
            value={dbName}
            onChange={(e) => setDbName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-dash-text-body">
            Region
          </label>
          <Dropdown
            value={region}
            options={regionOptions}
            onChange={setRegion}
          />
        </div>
      </div>

      {recommendation ? (
        <div className="mt-4 rounded-[4px] bg-[#f59e0b]/[0.06] px-3 py-2.5 dark:bg-[#f59e0b]/[0.08]">
          <p className="text-xs leading-relaxed text-dash-text-body">
            Recommended for {engine.name}: {recommendation.cpu ?? "?"} vCPU, {recommendation.memory ?? "?"} GB RAM, {recommendation.storage ?? "?"} GB storage.
          </p>
          <button
            type="button"
            className="mt-1 text-xs font-medium text-dash-text-strong hover:underline"
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
        <h4 className="mb-4 text-sm font-medium text-dash-text-strong">
          Compute
        </h4>
        <div className="flex flex-col gap-5">
          <ComputeSliderField
            label="CPU"
            value={cpuIdx}
            steps={cpuSteps}
            formatValue={formatCpu}
            onCommit={setCpuIdx}
          />
          <ComputeSliderField
            label="Memory"
            value={memIdx}
            steps={memorySteps}
            formatValue={formatMemory}
            onCommit={setMemIdx}
          />
          <DiskSizeSelect
            label="Storage"
            value={dbDiskSize}
            onChange={setDbDiskSize}
          />
        </div>
      </div>

      <hr className="my-6 border-dash-border-soft" />

      {/* Credentials */}
      <div>
        <h4 className="mb-3 text-sm font-medium text-dash-text-strong">
          Database credentials
        </h4>
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
            <h4 className="text-sm font-medium text-dash-text-strong">
              Public access
            </h4>
            <p className="mt-0.5 text-xs text-dash-text-faded">
              Allow connections from any IP address
            </p>
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
        <h4 className="text-sm font-medium text-dash-text-strong">
          Estimated Billing
        </h4>
        <p className="mt-0.5 text-xs text-dash-text-faded">
          Monthly cost based on your current plan
        </p>

        <div className="mt-3 flex flex-col">
          {costBreakdown.cpu.excess > 0 && (
            <div className="flex items-center justify-between py-1.5 text-xs text-dash-text-body">
              <span>CPU ({costBreakdown.cpu.excess} vCPU &times; {formatUsdMonthly(costBreakdown.cpu.rate)})</span>
              <span>{formatUsdMonthly(costBreakdown.cpu.cost)}</span>
            </div>
          )}
          {costBreakdown.memory.excess > 0 && (
            <div className="flex items-center justify-between py-1.5 text-xs text-dash-text-body">
              <span>Memory ({costBreakdown.memory.excess} GB &times; {formatUsdMonthly(costBreakdown.memory.rate)})</span>
              <span>{formatUsdMonthly(costBreakdown.memory.cost)}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-1.5 text-xs text-dash-text-body">
            <span>Storage ({costBreakdown.storage.amount} GB &times; {formatUsdMonthly(costBreakdown.storage.rate)})</span>
            <span>{formatUsdMonthly(costBreakdown.storage.cost)}</span>
          </div>
          <hr className="my-1.5 border-dash-border-soft" />
          <div className="flex items-center justify-between py-1.5 text-sm font-medium text-dash-text-strong">
            <span>Estimated total</span>
            <span>{formatUsdMonthly(costBreakdown.total)}/mo</span>
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
          disabled={!dbName.trim() || !region || submitting}
          onClick={() => {
            const hasInvalidIp = !publicAccess
              ? whitelistIps.some((ip) => ip.value.trim() && !isValidCidr(ip.value))
              : false;
            if (hasInvalidIp) {
              toast.error("Please fix invalid IP addresses before provisioning.");
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
              cpu: cpuSteps[cpuIdx],
              memory: memorySteps[memIdx],
              storage: Number(dbDiskSize),
              whitelistedIps: publicAccess
                ? ["0.0.0.0/0"]
                : whitelistIps.map((ip) => ip.value.trim()).filter(Boolean),
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

type Phase3DeployInput = {
  name: string;
  regionId: string;
  serviceType: string;
  authEnabled: boolean;
  branch?: string;
  rootDirectory: string;
  framework: string;
  preStartCommand: string;
  buildCommand: string;
  startCommand: string;
  outputDirectory: string;
  installCommand: string;
  envVars: Array<{ key: string; value: string }>;
  diskEnabled: boolean;
  diskSizeGb?: number;
  mountPath?: string;
};

function Phase3Configure({
  sourceType,
  sourceName,
  detectedFramework,
  frameworkOptions,
  regionOptions,
  branchOptions,
  deploying = false,
  saving = false,
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
  }>;
  regionOptions: RegionOption[];
  branchOptions?: string[];
  deploying?: boolean;
  saving?: boolean;
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

  const [projectName, setProjectName] = useState(defaultName);
  const [region, setRegion] = useState(regionOptions[0]?.id ?? "");
  const [branch, setBranch] = useState(branchOptions?.[0] ?? "main");
  const [rootDir, setRootDir] = useState("./");
  const [rootDirDrawerOpen, setRootDirDrawerOpen] = useState(false);
  const isGit = isGitSource(sourceType);
  const { planKey } = usePlanGate();
  const isFreePlan = planKey === "free";
  const serviceTypeOptions = useMemo(
    () => [
      {
        id: ServiceType.WebService,
        label: "Web Service",
        description:
          "Run server-side code that handles requests. Ideal for dynamic apps and APIs.",
        disabled: isFreePlan,
        asideText: isFreePlan ? "Upgrade to access" : undefined,
      },
      {
        id: ServiceType.Static,
        label: "Static Site",
        description:
          "Serve fixed content like HTML, CSS, JS, and images. No server-side code.",
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
  const fw = frameworkOptions.find((f) => f.id === framework) ?? frameworkOptions[0] ?? {
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
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [envExpanded, setEnvExpanded] = useState(false);
  const [diskEnabled, setDiskEnabled] = useState(false);
  const [diskSize, setDiskSize] = useState("10");
  const [mountPath, setMountPath] = useState("/mnt/data");
  const [serviceTypeManuallySelected, setServiceTypeManuallySelected] =
    useState(false);
  const [serviceType, setServiceType] = useState<string>(() =>
    getLegacyServiceType(sourceType, defaultFrameworkId),
  );
  const [mcpAuthEnabled, setMcpAuthEnabled] = useState(false);
  const selectedServiceTypeOption = useMemo(
    () => serviceTypeOptions.find((option) => option.id === serviceType),
    [serviceType, serviceTypeOptions],
  );
  const hideStorageSettings =
    isNoBuildFramework(framework) || serviceType === ServiceType.Static;
  const showMcpAuthToggle = serviceType === ServiceType.Mcp;

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
    const matchedFramework = detectedSlug
      ? frameworkOptions.find((f) => f.id === detectedSlug)
      : undefined;
    const fallbackFramework = matchedFramework ?? frameworkOptions[0];

    if (matchedFramework?.id) {
      setFramework(matchedFramework.id);
    } else if (fallbackFramework?.id) {
      setFramework(fallbackFramework.id);
    }

    setBuildCmd(
      detectedFramework?.buildCommand ??
      matchedFramework?.buildCmd ??
      fallbackFramework?.buildCmd ??
      "",
    );
    setStartCmd(
      detectedFramework?.startCommand ??
      matchedFramework?.start ??
      fallbackFramework?.start ??
      "",
    );
    setOutputDir(
      detectedFramework?.outputDirectory ??
      matchedFramework?.output ??
      fallbackFramework?.output ??
      "",
    );
    setInstallCmd(
      detectedFramework?.installCommand ??
      matchedFramework?.install ??
      fallbackFramework?.install ??
      "",
    );

    lastAppliedSourceRef.current = sourceName;
  }, [detectedFramework, frameworkOptions, isGit, sourceName]);

  function handleFrameworkChange(id: string) {
    setFramework(id);
    const newFw = frameworkOptions.find((f) => f.id === id);
    setBuildCmd(newFw?.buildCmd ?? "");
    setStartCmd(newFw?.start ?? "");
    setOutputDir(newFw?.output ?? "");
    setInstallCmd(newFw?.install ?? "");
  }

  const canBrowseRootDir =
    isGit && Boolean(repoBrowser?.repoName) && Boolean(branch?.trim());

  function addEnvVar() {
    setEnvVars((prev) => [...prev, { id: envNextId++, key: "", value: "" }]);
    setEnvExpanded(true);
  }

  function removeEnvVar(id: number) {
    setEnvVars((prev) => prev.filter((v) => v.id !== id));
  }

  function updateEnvVar(id: number, field: "key" | "value", val: string) {
    setEnvVars((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: val } : v))
    );
  }

  function handleEnvPaste(id: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
    if (lines.length < 2 && !text.includes("=")) return;
    e.preventDefault();
    const parsed: Array<{ key: string; value: string }> = [];
    for (const line of lines) {
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key) parsed.push({ key, value });
    }
    if (!parsed.length) return;
    setEnvVars((prev) => {
      const withoutCurrent = prev.filter((v) => v.id !== id || v.key || v.value);
      const newVars = parsed.map((p) => ({ id: envNextId++, ...p }));
      return [...withoutCurrent, ...newVars];
    });
    setEnvExpanded(true);
  }

  function buildDeployInput(): Phase3DeployInput | null {
    const cleanedEnvVars = envVars
      .map((v) => ({ key: v.key.trim(), value: v.value }))
      .filter((v) => v.key || v.value);

    const invalidEnv = cleanedEnvVars.find((v) => !v.key || !v.value);
    if (invalidEnv) {
      toast.error("Each environment variable must include both key and value.");
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
      startCommand: startCmd.trim(),
      outputDirectory: outputDir.trim(),
      installCommand: installCmd.trim(),
      envVars: cleanedEnvVars,
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
      <h3 className="mb-4 text-sm font-medium text-dash-text-strong">
        Configure Project
      </h3>

      {/* Project settings */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-dash-text-body">
              Project name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-dash-text-body">
              Region
            </label>
            <Dropdown
              value={region}
              options={regionOptions}
              onChange={setRegion}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-dash-text-body">
            Deployment type
          </label>
          <Dropdown
            value={serviceType}
            options={serviceTypeOptions.map((option) => ({
              id: option.id,
              label: option.label,
              disabled: option.disabled,
              asideText: option.asideText,
            }))}
            onChange={(nextServiceType) => {
              const nextOption = serviceTypeOptions.find(
                (option) => option.id === nextServiceType,
              );
              if (nextOption?.disabled) {
                return;
              }
              setServiceType(nextServiceType);
              setServiceTypeManuallySelected(true);
            }}
          />
          {selectedServiceTypeOption?.description && (
            <p className="mt-2 text-xs text-dash-text-extra-faded">
              {selectedServiceTypeOption.description}
            </p>
          )}
        </div>

        {isGit && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-dash-text-body">
                Branch
              </label>
              <Dropdown
                value={branch}
                options={(branchOptions?.length ? branchOptions : ["main"]).map((b) => ({ id: b, label: b }))}
                onChange={setBranch}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-dash-text-body">
                Root directory
              </label>
              <RootDirectoryTrigger
                value={rootDir || "./"}
                disabled={!canBrowseRootDir}
                onClick={() => {
                  if (!canBrowseRootDir) return;
                  setRootDirDrawerOpen(true);
                }}
              />
              <p className="mt-2 text-xs text-dash-text-extra-faded">
                Select the folder in your repository to deploy.
              </p>
            </div>
          </div>
        )}

        {showMcpAuthToggle && (
          <div>
            <div className="flex items-center justify-between rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-3 py-2.5">
              <div className="pr-4">
                <p className="text-sm font-medium text-dash-text-strong">
                  Enable MCP authentication
                </p>
                <p className="mt-1 text-xs text-dash-text-faded">
                  Require an API key in the <code>x-brimble-key</code> header for this MCP server.
                </p>
              </div>
              <ToggleSwitch
                checked={mcpAuthEnabled}
                onChange={setMcpAuthEnabled}
                size="sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <hr className="my-6 border-dash-border-soft" />

      {/* Build settings */}
      {isGit && (
        <>
          <h4 className="mb-4 text-sm font-medium text-dash-text-strong">
            Build Settings
          </h4>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm text-dash-text-body">
                Framework
                <span className="rounded-full bg-[#4879f8]/10 px-2 py-0.5 text-[11px] font-medium text-[#4879f8]">
                  Auto-detected
                </span>
              </label>
              <Dropdown
                value={framework}
                options={frameworkOptions.map((f) => ({
                  id: f.id,
                  label: f.name,
                  icon: f.icon,
                  iconClassName: f.iconClassName,
                }))}
                onChange={handleFrameworkChange}
              />
            </div>

            {!isNoBuildFramework(framework) && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm text-dash-text-body">
                    Build command
                  </label>
                  <input
                    type="text"
                    value={buildCmd}
                    onChange={(e) => setBuildCmd(e.target.value)}
                    placeholder="npm run build"
                    className={`${inputClass} font-family-mono text-[13px]`}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm text-dash-text-body">
                    Start command
                  </label>
                  <input
                    type="text"
                    value={startCmd}
                    onChange={(e) => setStartCmd(e.target.value)}
                    placeholder="npm run start"
                    className={`${inputClass} font-family-mono text-[13px]`}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm text-dash-text-body">
                      Output directory
                    </label>
                    <input
                      type="text"
                      value={outputDir}
                      onChange={(e) => setOutputDir(e.target.value)}
                      placeholder="dist"
                      className={`${inputClass} font-family-mono text-[13px]`}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm text-dash-text-body">
                      Install command
                    </label>
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

          {!isNoBuildFramework(framework) && (
            <hr className="my-6 border-dash-border-soft" />
          )}
        </>
      )}

      {!isGit && sourceType === SourceType.Docker && (
        <>
          <h4 className="mb-4 text-sm font-medium text-dash-text-strong">
            Runtime Settings
          </h4>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm text-dash-text-body">
                Pre-start command
              </label>
              <input
                type="text"
                value={preStartCmd}
                onChange={(e) => setPreStartCmd(e.target.value)}
                placeholder="e.g. node scripts/migrate.js"
                className={`${inputClass} font-family-mono text-[13px]`}
              />
              <p className="mt-2 text-xs text-dash-text-extra-faded">
                Optional. Runs before your container start command.
              </p>
            </div>
          </div>

          <hr className="my-6 border-dash-border-soft" />
        </>
      )}

      {/* Environment variables — hidden for no-build frameworks (HTML, Static) */}
      {!isNoBuildFramework(framework) && <div>
        <button
          onClick={() => setEnvExpanded(!envExpanded)}
          className="flex w-full items-center justify-between text-sm"
        >
          <span className="font-medium text-dash-text-strong">
            Environment Variables
          </span>
          <span className="flex items-center gap-2 text-xs text-dash-text-faded">
            {envVars.length} variable{envVars.length !== 1 ? "s" : ""}
            <motion.span
              animate={{ rotate: envExpanded ? 180 : 0 }}
              transition={{ duration: 0.2, ease }}
            >
              <ChevronDown className="size-3.5" />
            </motion.span>
          </span>
        </button>

        <AnimatePresence>
          {envExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex flex-col gap-2 px-px pb-px">
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
                      onChange={(e) =>
                        updateEnvVar(v.id, "value", e.target.value)
                      }
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
                Add variable
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>}

      {/* Persistent storage — hidden for static services and no-build frameworks */}
      {!hideStorageSettings && (<>
      <hr className="my-6 border-dash-border-soft" />

      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="size-4 text-dash-text-faded" />
            <span className="text-sm font-medium text-dash-text-strong">
              Persistent Storage
            </span>
          </div>
          <ToggleSwitch checked={diskEnabled} onChange={setDiskEnabled} size="sm" />
        </div>
        <p className="mt-1 ml-6 text-xs text-dash-text-faded">
          Attach a volume that persists across restarts and deployments.
        </p>

        <AnimatePresence>
          {diskEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0, overflow: "hidden" }}
              animate={{ opacity: 1, height: "auto", transitionEnd: { overflow: "visible" } }}
              exit={{ overflow: "hidden", opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease }}
            >
              <div className="mt-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 px-px pb-px sm:grid-cols-2">
                  <DiskSizeSelect
                    value={diskSize}
                    onChange={setDiskSize}
                  />
                  <div>
                    <label className="mb-1.5 block text-xs text-dash-text-faded">
                      Mount path
                    </label>
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
                    <span className="font-medium text-dash-text-strong">$0.25/GB per month.</span>{" "}
                    Data persists across container restarts and deployments. The volume mounts at{" "}
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
      </>)}

      {/* Save / Deploy actions */}
      <div className="mt-8">
        <div className="flex flex-col gap-2 sm:flex-row">
          <GlossyButton
            variant="white"
            className="sm:min-w-[190px]"
            loading={saving}
            loadingLabel="Saving..."
            disabled={deploying || saving || !projectName.trim() || !region}
            onClick={() => {
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
            disabled={deploying || saving || !projectName.trim() || !region}
            onClick={() => {
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
      </div>

      {isGit && (
        <RootDirectoryDrawer
          open={rootDirDrawerOpen}
          onOpenChange={setRootDirDrawerOpen}
          provider={sourceType === SourceType.Gitlab ? "gitlab" : "github"}
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
                setBuildCmd(
                  detectedFrameworkFromPath.buildCommand ??
                  matched.buildCmd ??
                  "",
                );
                setStartCmd(
                  detectedFrameworkFromPath.startCommand ??
                  matched.start ??
                  "",
                );
                setOutputDir(
                  detectedFrameworkFromPath.outputDirectory ??
                  matched.output ??
                  "",
                );
                setInstallCmd(
                  detectedFrameworkFromPath.installCommand ??
                  matched.install ??
                  "",
                );
              }
            }
          }}
        />
      )}
    </motion.div>
  );
}

/* ─── Main Page ─── */

function NewProjectPage() {
  const { canWrite } = useWorkspaceRole();
  const router = useRouter();
  const navigate = useNavigate({ from: "/projects/new" });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const workspace = useMemo(() => {
    const params = new URLSearchParams(searchStr || "");
    return params.get("workspace")?.trim() || undefined;
  }, [searchStr]);
  const environmentId = useMemo(() => {
    const params = new URLSearchParams(searchStr || "");
    return params.get("environmentId")?.trim() || undefined;
  }, [searchStr]);

  const listFrameworks = useServerFn(listFrameworksServerFn as any) as () => Promise<FrameworkOption[]>;
  const listRegions = useServerFn(listRegionsServerFn as any) as (args: {
    data?: { type?: "web" | "database"; enabled?: boolean; workspace?: string };
  }) => Promise<Region[]>;
  const listGithubAccounts = useServerFn(listGithubAccountsServerFn as any) as () => Promise<
    GithubAccount[] | { accounts?: GithubAccount[] }
  >;
  const getGithubInstallUrl = useServerFn(getGithubInstallUrlServerFn as any) as () => Promise<{ url: string }>;
  const listGithubRepos = useServerFn(listGithubReposServerFn as any) as (args: {
    data?: { q?: string; page?: number; limit?: number; installationId?: number | string };
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
    data?: { q?: string; page?: number; limit?: number; installationId?: number | string };
  }) => Promise<{ repositories: GithubRepoListItem[] }>;
  const getGitlabRepo = useServerFn(getGitlabRepoServerFn as any) as (args: {
    data: { repoName: string; installationId?: number | string };
  }) => Promise<RepositoryMetadata>;
  const createProject = useServerFn(createProjectServerFn as any) as (args: {
    data: Record<string, unknown>;
  }) => Promise<Project>;
  const listAvailableDatabases = useServerFn(listAvailableDatabasesServerFn as any) as () => Promise<DatabaseEngineOption[]>;
  const createDatabaseProject = useServerFn(createDatabaseProjectServerFn as any) as (args: {
    data: {
      workspace?: string;
      name: string;
      dbImage: string;
      configurations: { cpu: number; memory: number; storage: number; region: string };
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
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(
    new Set(),
  );
  const [frameworkOptions, setFrameworkOptions] = useState<
    Array<{ id: string; name: string; icon?: string; iconClassName?: string; buildCmd?: string; start?: string; output?: string; install?: string }>
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
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>(() =>
    regions.map((r) => ({ id: r, label: r })),
  );
  const [databaseRegionOptions, setDatabaseRegionOptions] = useState<RegionOption[]>(() =>
    regions.map((r) => ({ id: r, label: r })),
  );
  const [databaseEngineOptions, setDatabaseEngineOptions] = useState<DatabaseEngineOption[]>(() =>
    fallbackDbEngines.map((engine) => ({
      id: engine.id,
      name: engine.name,
      imageUrl: undefined,
      image: undefined,
      version: "latest",
      envs: [],
      isAvailable: true,
      isDefault: false,
      hasPort: true,
      port: engine.defaultPort,
      volumePath: undefined,
      protocol: undefined,
      recommendations: [],
    })),
  );
  const [databaseEnginesLoading, setDatabaseEnginesLoading] = useState(false);

  const [githubAccounts, setGithubAccounts] = useState<GithubAccount[]>([]);
  const [githubAccountsLoading, setGithubAccountsLoading] = useState(false);
  const [githubAccountsChecked, setGithubAccountsChecked] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GithubRepoListItem[]>([]);
  const [githubReposLoading, setGithubReposLoading] = useState(false);
  const [githubConnectOpening, setGithubConnectOpening] = useState(false);
  const [githubConnectPolling, setGithubConnectPolling] = useState(false);
  const [githubConnectError, setGithubConnectError] = useState<string | null>(null);
  const [importingRepoFullName, setImportingRepoFullName] = useState<string | null>(null);
  const [selectedGithubRepo, setSelectedGithubRepo] = useState<{
    repo: GithubRepoListItem;
    metadata: RepositoryMetadata;
  } | null>(null);
  const [selectedDockerSource, setSelectedDockerSource] =
    useState<DockerSourceSelection | null>(null);
  const [validatingDockerImage, setValidatingDockerImage] = useState(false);
  const [dockerImageValidationError, setDockerImageValidationError] = useState<string | null>(null);
  const [deployingProject, setDeployingProject] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [provisioningDatabase, setProvisioningDatabase] = useState(false);
  const githubReposRequestIdRef = useRef(0);
  const githubPollingIntervalRef = useRef<number | null>(null);
  const githubPollingTimeoutRef = useRef<number | null>(null);
  const githubPollingBaselineSignatureRef = useRef("");
  const githubAccountsSignature = useMemo(
    () => getGithubAccountsSignature(githubAccounts),
    [githubAccounts],
  );

  const [gitlabAccounts, setGitlabAccounts] = useState<GithubAccount[]>([]);
  const [gitlabAccountsLoading, setGitlabAccountsLoading] = useState(false);
  const [gitlabAccountsChecked, setGitlabAccountsChecked] = useState(false);
  const [gitlabRepos, setGitlabRepos] = useState<GithubRepoListItem[]>([]);
  const [gitlabReposLoading, setGitlabReposLoading] = useState(false);
  const [gitlabConnectOpening, setGitlabConnectOpening] = useState(false);
  const [gitlabConnectPolling, setGitlabConnectPolling] = useState(false);
  const [gitlabConnectError, setGitlabConnectError] = useState<string | null>(null);
  const [selectedGitlabRepo, setSelectedGitlabRepo] = useState<{
    repo: GithubRepoListItem;
    metadata: RepositoryMetadata;
  } | null>(null);
  const gitlabReposRequestIdRef = useRef(0);
  const gitlabPollingIntervalRef = useRef<number | null>(null);
  const gitlabPollingTimeoutRef = useRef<number | null>(null);
  const gitlabPollingBaselineSignatureRef = useRef("");
  const gitlabAccountsSignature = useMemo(
    () => getGithubAccountsSignature(gitlabAccounts),
    [gitlabAccounts],
  );

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
          })),
        );
      })
      .catch(() => {
        // Keep UI fallback options.
      });

    void listRegions({ data: { type: "web", enabled: true, workspace } })
      .then((items) => {
        if (!active || !Array.isArray(items) || items.length === 0) return;
        const mapped = items
          .filter((region) => region.enabled !== false)
          .map((region) => ({
            id: region.id,
            label: buildRegionLabel(region),
          }));
        if (mapped.length) {
          setRegionOptions(mapped);
        }
      })
      .catch(() => {
        // Keep UI fallback options.
      });

    void listRegions({ data: { type: "database", enabled: true, workspace } })
      .then((items) => {
        if (!active || !Array.isArray(items) || items.length === 0) return;
        const mapped = items
          .filter((region) => region.enabled !== false)
          .map((region) => ({
            id: region.id,
            label: buildRegionLabel(region),
          }));
        if (mapped.length) {
          setDatabaseRegionOptions(mapped);
        }
      })
      .catch(() => {
        // Keep UI fallback options.
      });

    setDatabaseEnginesLoading(true);
    void listAvailableDatabases()
      .then((items) => {
        if (!active || !Array.isArray(items) || items.length === 0) return;
        const sorted = [...items].sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return a.name.localeCompare(b.name);
        });
        setDatabaseEngineOptions(sorted);
      })
      .catch(() => {
        // Keep UI fallback options.
      })
      .finally(() => {
        if (active) {
          setDatabaseEnginesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [listFrameworks, listRegions, workspace]);

  useEffect(() => {
    return () => {
      if (githubPollingIntervalRef.current !== null) {
        window.clearInterval(githubPollingIntervalRef.current);
      }
      if (githubPollingTimeoutRef.current !== null) {
        window.clearTimeout(githubPollingTimeoutRef.current);
      }
      if (gitlabPollingIntervalRef.current !== null) {
        window.clearInterval(gitlabPollingIntervalRef.current);
      }
      if (gitlabPollingTimeoutRef.current !== null) {
        window.clearTimeout(gitlabPollingTimeoutRef.current);
      }
    };
  }, []);

  async function refreshGithubAccounts(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) {
        setGithubAccountsLoading(true);
      }
      const result = await listGithubAccounts();
      const items = Array.isArray(result) ? result : (result?.accounts ?? []);
      setGithubAccounts(items);
      setGithubAccountsChecked(true);
      if (items.length > 0) {
        setGithubConnectError(null);
        setConnectedProviders((prev) => {
          const next = new Set(prev);
          next.add("github");
          return next;
        });
      }
      return items;
    } catch (error) {
      setGithubAccountsChecked(true);
      if (!options?.silent) {
        toast.error(error instanceof Error ? error.message : "Failed to load GitHub accounts");
      }
      return [];
    } finally {
      if (!options?.silent) {
        setGithubAccountsLoading(false);
      }
    }
  }

  useEffect(() => {
    if (sourceType === SourceType.Github && phase >= 2 && githubAccounts.length === 0 && !githubAccountsLoading) {
      void refreshGithubAccounts({ silent: false });
    }
  }, [sourceType, phase]); // intentionally not depending on refresh function identity

  const loadGithubRepos = useCallback(async (input: {
    installationId?: number | string;
    q?: string;
  }) => {
    if (!input.installationId) {
      setGithubRepos([]);
      setGithubReposLoading(false);
      return;
    }

    const requestId = ++githubReposRequestIdRef.current;
    setGithubReposLoading(true);

    try {
      const result = await listGithubRepos({
        data: {
          installationId: input.installationId,
          q: input.q,
          page: 1,
          limit: 50,
        },
      });

      if (requestId !== githubReposRequestIdRef.current) {
        return;
      }

      setGithubRepos(Array.isArray(result?.repositories) ? result.repositories : []);
    } catch (error) {
      if (requestId !== githubReposRequestIdRef.current) {
        return;
      }
      setGithubRepos([]);
      toast.error(error instanceof Error ? error.message : "Failed to load repositories");
    } finally {
      if (requestId === githubReposRequestIdRef.current) {
        setGithubReposLoading(false);
      }
    }
  }, [listGithubRepos]);

  function stopGithubPolling() {
    if (githubPollingIntervalRef.current !== null) {
      window.clearInterval(githubPollingIntervalRef.current);
      githubPollingIntervalRef.current = null;
    }
    if (githubPollingTimeoutRef.current !== null) {
      window.clearTimeout(githubPollingTimeoutRef.current);
      githubPollingTimeoutRef.current = null;
    }
    setGithubConnectPolling(false);
  }

  async function handleGithubConnect() {
    setGithubConnectError(null);
    setGithubConnectOpening(true);

    try {
      const install = await getGithubInstallUrl();
      const installUrl = install?.url?.trim();
      if (!installUrl) {
        throw new Error("We could not start GitHub connection right now. Please refresh and try again.");
      }

      const popup = window.open(
        installUrl,
        "_blank",
        "width=900,height=760",
      );

      if (!popup) {
        throw new Error("Popup blocked. Please allow popups and try again.");
      }

      githubPollingBaselineSignatureRef.current = githubAccountsSignature;
      setGithubConnectPolling(true);
      void refreshGithubAccounts({ silent: true });

      if (githubPollingIntervalRef.current !== null) {
        window.clearInterval(githubPollingIntervalRef.current);
      }
      if (githubPollingTimeoutRef.current !== null) {
        window.clearTimeout(githubPollingTimeoutRef.current);
      }

      githubPollingIntervalRef.current = window.setInterval(() => {
        void refreshGithubAccounts({ silent: true });
      }, 3000);

      githubPollingTimeoutRef.current = window.setTimeout(() => {
        stopGithubPolling();
        setGithubConnectError("Timed out waiting for GitHub connection. Finish installation, then click refresh.");
      }, 90_000);
    } catch (error) {
      setGithubConnectError(
        error instanceof Error
          ? error.message
          : "We could not open the GitHub connection window. Please try again.",
      );
    } finally {
      setGithubConnectOpening(false);
    }
  }

  useEffect(() => {
    if (
      githubConnectPolling &&
      githubAccountsSignature.length > 0 &&
      githubAccountsSignature !== githubPollingBaselineSignatureRef.current
    ) {
      stopGithubPolling();
      toast.success("GitHub connected. Select a repository to continue.");
    }
  }, [githubAccountsSignature, githubConnectPolling]);

  async function refreshGitlabAccounts(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) {
        setGitlabAccountsLoading(true);
      }
      const result = await listGitlabAccounts();
      const items = Array.isArray(result) ? result : (result?.accounts ?? []);
      setGitlabAccounts(items);
      setGitlabAccountsChecked(true);
      if (items.length > 0) {
        setGitlabConnectError(null);
        setConnectedProviders((prev) => {
          const next = new Set(prev);
          next.add("gitlab");
          return next;
        });
      }
      return items;
    } catch (error) {
      setGitlabAccountsChecked(true);
      if (!options?.silent) {
        toast.error(error instanceof Error ? error.message : "Failed to load GitLab accounts");
      }
      return [];
    } finally {
      if (!options?.silent) {
        setGitlabAccountsLoading(false);
      }
    }
  }

  useEffect(() => {
    if (sourceType === SourceType.Gitlab && phase >= 2 && gitlabAccounts.length === 0 && !gitlabAccountsLoading) {
      void refreshGitlabAccounts({ silent: false });
    }
  }, [sourceType, phase]);

  const loadGitlabRepos = useCallback(async (input: {
    installationId?: number | string;
    q?: string;
  }) => {
    if (!input.installationId) {
      setGitlabRepos([]);
      setGitlabReposLoading(false);
      return;
    }

    const requestId = ++gitlabReposRequestIdRef.current;
    setGitlabReposLoading(true);

    try {
      const result = await listGitlabRepos({
        data: {
          installationId: input.installationId,
          q: input.q,
          page: 1,
          limit: 50,
        },
      });

      if (requestId !== gitlabReposRequestIdRef.current) {
        return;
      }

      setGitlabRepos(Array.isArray(result?.repositories) ? result.repositories : []);
    } catch (error) {
      if (requestId !== gitlabReposRequestIdRef.current) {
        return;
      }
      setGitlabRepos([]);
      toast.error(error instanceof Error ? error.message : "Failed to load repositories");
    } finally {
      if (requestId === gitlabReposRequestIdRef.current) {
        setGitlabReposLoading(false);
      }
    }
  }, [listGitlabRepos]);

  function stopGitlabPolling() {
    if (gitlabPollingIntervalRef.current !== null) {
      window.clearInterval(gitlabPollingIntervalRef.current);
      gitlabPollingIntervalRef.current = null;
    }
    if (gitlabPollingTimeoutRef.current !== null) {
      window.clearTimeout(gitlabPollingTimeoutRef.current);
      gitlabPollingTimeoutRef.current = null;
    }
    setGitlabConnectPolling(false);
  }

  async function handleGitlabConnect() {
    setGitlabConnectError(null);
    setGitlabConnectOpening(true);

    try {
      const deviceId = window.sessionStorage.getItem("brimble.oauth.device_id") ?? "";
      const connect = await getGitlabConnectUrl({
        data: {
          device: deviceId || undefined,
        },
      });
      const connectUrl = connect?.url?.trim();
      if (!connectUrl) {
        throw new Error("We could not start GitLab connection right now. Please refresh and try again.");
      }
      const popup = window.open(
        connectUrl,
        "_blank",
        "width=900,height=760",
      );

      if (!popup) {
        throw new Error("Popup blocked. Please allow popups and try again.");
      }

      gitlabPollingBaselineSignatureRef.current = gitlabAccountsSignature;
      setGitlabConnectPolling(true);
      void refreshGitlabAccounts({ silent: true });

      if (gitlabPollingIntervalRef.current !== null) {
        window.clearInterval(gitlabPollingIntervalRef.current);
      }
      if (gitlabPollingTimeoutRef.current !== null) {
        window.clearTimeout(gitlabPollingTimeoutRef.current);
      }

      gitlabPollingIntervalRef.current = window.setInterval(() => {
        void refreshGitlabAccounts({ silent: true });
      }, 3000);

      gitlabPollingTimeoutRef.current = window.setTimeout(() => {
        stopGitlabPolling();
        setGitlabConnectError("Timed out waiting for GitLab connection. Finish authorization, then click refresh.");
      }, 90_000);
    } catch (error) {
      setGitlabConnectError(
        error instanceof Error
          ? error.message
          : "We could not open the GitLab connection window. Please try again.",
      );
    } finally {
      setGitlabConnectOpening(false);
    }
  }

  useEffect(() => {
    if (
      gitlabConnectPolling &&
      gitlabAccountsSignature.length > 0 &&
      gitlabAccountsSignature !== gitlabPollingBaselineSignatureRef.current
    ) {
      stopGitlabPolling();
      toast.success("GitLab connected. Select a repository to continue.");
    }
  }, [gitlabAccountsSignature, gitlabConnectPolling]);

  function handleSourceTypeSelect(type: SourceType) {
    setSourceType(type);
    setSelectedGithubRepo(null);
    setSelectedGitlabRepo(null);
    setSelectedDockerSource(null);
    setDockerImageValidationError(null);
    setGithubRepos([]);
    setGitlabRepos([]);
    setGithubConnectError(null);
    setGitlabConnectError(null);
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
        setDockerImageValidationError(
          "Docker image is not valid. Check the image name/tag and registry credentials.",
        );
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
      const message =
        error instanceof Error ? error.message : "Failed to validate Docker image";
      const normalizedMessage = message.trim().toLowerCase();
      const isInvalidImageError =
        normalizedMessage.includes("invalid docker image") ||
        normalizedMessage.includes("image is invalid") ||
        normalizedMessage.includes("invalid image");

      if (isInvalidImageError) {
        setDockerImageValidationError(
          "Docker image is not valid. Check the image name/tag and registry credentials.",
        );
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
      setSelectedGithubRepo(null);
      setSelectedDockerSource(null);
      setDockerImageValidationError(null);
    } else if (target <= 2) {
      setSourceName("");
      if (sourceType === SourceType.Docker) {
        setDockerImageValidationError(null);
      }
      if (sourceType === SourceType.Github) {
        setSelectedGithubRepo(null);
      }
    }
  }

  async function handleGithubRepoSelect(repo: GithubRepoListItem) {
    setImportingRepoFullName(repo.fullName);
    try {
      const metadata = await getGithubRepo({
        data: {
          repoName: repo.fullName,
          installationId: repo.installationId,
        },
      });

      setSelectedGithubRepo({ repo, metadata });
      handleSourceSelect(metadata.fullName || repo.fullName);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import repository");
    } finally {
      setImportingRepoFullName(null);
    }
  }

  async function handleGitlabRepoSelect(repo: GithubRepoListItem) {
    setImportingRepoFullName(repo.fullName);
    try {
      const metadata = await getGitlabRepo({
        data: {
          repoName: repo.fullName,
          installationId: repo.installationId,
        },
      });

      setSelectedGitlabRepo({ repo, metadata });
      handleSourceSelect(metadata.fullName || repo.fullName);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import repository");
    } finally {
      setImportingRepoFullName(null);
    }
  }

  async function handleCreateProject(
    input: Phase3DeployInput,
    options: { deploy: boolean },
  ): Promise<boolean> {
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

    if (sourceType === SourceType.Github || sourceType === SourceType.Gitlab) {
      const selectedRepo = sourceType === SourceType.Github ? selectedGithubRepo : selectedGitlabRepo;
      const gitTag = sourceType === SourceType.Github ? "GITHUB" : "GITLAB";

      if (!selectedRepo?.repo || !selectedRepo?.metadata) {
        toast.error("Please select a repository first.");
        return false;
      }

      const branch =
        input.branch?.trim() ||
        selectedRepo.metadata.branches?.[0] ||
        selectedRepo.repo.branch ||
        "main";

      payload = {
        workspace,
        name: normalizedName,
        git: gitTag,
        branch,
        installationId:
          selectedRepo.metadata.installationId ??
          selectedRepo.repo.installationId,
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
          cpu: 1,
          memory: 1.5,
          storage: 7,
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
          cpu: 1,
          memory: 1.5,
          storage: 7,
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
      console.log(
        "[projects/new] createProject payload",
        debugMaskDeployPayload(payload),
      );
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
      await router.invalidate();
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
      toast.error(
        error instanceof Error
          ? error.message
          : deploy
            ? "Failed to deploy project"
            : "Failed to save project",
      );
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
      await router.invalidate();
      navigate({
        to: withWorkspaceQuery({
          pathname: `/projects/${encodeURIComponent(targetProjectId)}`,
          searchStr,
        }) as any,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to provision database");
    } finally {
      setProvisioningDatabase(false);
    }
  }

  const backToProjectsHref = useMemo(
    () => withWorkspaceQuery({ pathname: "/projects", searchStr }),
    [searchStr],
  );

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
          <h1 className="text-xl font-medium text-dash-text-strong">
            New Project
          </h1>
          <p className="mt-1 text-sm text-dash-text-faded">
            Import a repository, deploy an image, or provision a database.
          </p>
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
              <Phase1SourceType
                key="phase1"
                onSelect={handleSourceTypeSelect}
              />
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
              externalUrl={
                sourceType === SourceType.Github
                  ? `https://github.com/${sourceName}`
                  : sourceType === SourceType.Gitlab
                    ? `https://gitlab.com/${sourceName}`
                    : undefined
              }
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
                      onSelect={setSourceName}
                      onProvision={(payload) =>
                        handleProvisionDatabase(payload)
                      }
                    />
                  );
                }
                const provider = getGitProvider(sourceType);
                const isGithub = provider?.id === "github";
                const isGitlab = provider?.id === "gitlab";
                if (provider && !connectedProviders.has(provider.id)) {
                  return (
                    <Phase2GitConnect
                      key={`phase2-connect-${provider.id}`}
                      provider={provider}
                      onConnected={isGithub ? handleGithubConnect : isGitlab ? handleGitlabConnect : () => {
                        toast.message(`${provider.name} integration is not available yet.`);
                      }}
                      connecting={isGithub ? githubConnectOpening : isGitlab ? gitlabConnectOpening : false}
                      polling={isGithub ? githubConnectPolling : isGitlab ? gitlabConnectPolling : false}
                      checkingConnection={
                        isGithub
                          ? (!githubAccountsChecked || githubAccountsLoading)
                          : isGitlab
                            ? (!gitlabAccountsChecked || gitlabAccountsLoading)
                            : false
                      }
                      errorMessage={isGithub ? githubConnectError : isGitlab ? gitlabConnectError : null}
                    />
                  );
                }
                if (provider) {
                  return (
                    <Phase2GitRepoSelect
                      key={`phase2-repos-${provider.id}`}
                      provider={provider}
                      accounts={isGithub ? githubAccounts : isGitlab ? gitlabAccounts : []}
                      repos={isGithub ? githubRepos : isGitlab ? gitlabRepos : []}
                      accountsLoading={isGithub ? githubAccountsLoading : isGitlab ? gitlabAccountsLoading : false}
                      reposLoading={isGithub ? githubReposLoading : isGitlab ? gitlabReposLoading : false}
                      importingRepoFullName={importingRepoFullName}
                      onRefreshAccounts={isGithub ? () => void refreshGithubAccounts() : isGitlab ? () => void refreshGitlabAccounts() : undefined}
                      onConnectAccount={isGithub ? handleGithubConnect : isGitlab ? handleGitlabConnect : undefined}
                      onLoadRepos={isGithub ? loadGithubRepos : isGitlab ? loadGitlabRepos : undefined}
                      onSelect={isGithub ? handleGithubRepoSelect : isGitlab ? handleGitlabRepoSelect : () => {
                        toast.message(`${provider.name} repo import is not available yet.`);
                      }}
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
            {sourceType === SourceType.Database ? (
              (() => {
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
                    onProvision={(payload) =>
                      handleProvisionDatabase({
                        engineId: selectedEngine.id,
                        ...payload,
                      })
                    }
                  />
                );
              })()
            ) : (
              (() => {
                const activeRepo = sourceType === SourceType.Github
                  ? selectedGithubRepo
                  : sourceType === SourceType.Gitlab
                    ? selectedGitlabRepo
                    : null;
                return (
                  <Phase3Configure
                    key="phase3"
                    sourceType={sourceType}
                    sourceName={sourceName}
                    detectedFramework={activeRepo?.metadata.framework}
                    repoBrowser={
                      activeRepo
                        ? {
                          repoName:
                            activeRepo.metadata.fullName ||
                            activeRepo.repo.fullName,
                          installationId:
                            activeRepo.metadata.installationId ??
                            activeRepo.repo.installationId,
                        }
                        : undefined
                    }
                    frameworkOptions={frameworkOptions}
                    regionOptions={regionOptions}
                    branchOptions={
                      activeRepo
                        ? (activeRepo.metadata.branches?.length
                          ? activeRepo.metadata.branches
                          : activeRepo.repo.branch
                            ? [activeRepo.repo.branch]
                            : ["main"])
                        : undefined
                    }
                    deploying={deployingProject}
                    saving={savingProject}
                    onDeploy={handleDeployProject}
                    onSaveForLater={handleSaveProjectForLater}
                  />
                );
              })()
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
