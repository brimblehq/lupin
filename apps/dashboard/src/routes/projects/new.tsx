import { useState, useRef, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Github,
  Container,
  Search,
  ChevronDown,
  Plus,
  X,
  Check,
  Lock,
  Globe,
  Database,
  Eye,
  EyeOff,
  Copy,
  ShieldAlert,
  HardDrive,
} from "lucide-react";
import { GlossyButton } from "../../components/shared/glossy-button";
import { DashButton } from "../../components/shared/dash-button";
import { ToggleSwitch } from "../../components/shared/toggle-switch";
import { RangeSlider } from "../../components/shared/range-slider";

export const Route = createFileRoute("/projects/new")({
  component: NewProjectPage,
});

/* ─── Constants ─── */

const ease = [0.16, 1, 0.3, 1] as const;

const inputClass =
  "w-full rounded-[6px] bg-[#f9fafb] px-3 py-2.5 text-sm leading-6 text-dash-text-strong shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] outline-none placeholder:text-[#9ca3af] focus:shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08),0px_0px_0px_3px_rgba(72,121,248,0.15)] dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08),0px_0px_0px_3px_rgba(72,121,248,0.2)]";

/* ─── Icons ─── */

function BitbucketIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3.51 5.5h16.98a.5.5 0 0 1 .49.59l-2.45 14.24a1 1 0 0 1-.98.82H6.45a1 1 0 0 1-.98-.82L3.02 6.09a.5.5 0 0 1 .49-.59Z" />
      <path d="M9.5 5.5 8.8 14h6.4l-.7-8.5" />
    </svg>
  );
}

/* ─── Git Providers ─── */

type IconComponent = React.ComponentType<{ className?: string }>;

interface GitProvider {
  id: string;
  name: string;
  Icon: IconComponent;
  description: string;
  permissions: { label: string; desc: string }[];
}

const gitProviders: GitProvider[] = [
  {
    id: "github",
    name: "GitHub",
    Icon: Github,
    description: "Connect a repository from your GitHub account",
    permissions: [
      { label: "Read access to your repositories", desc: "Browse and import repos" },
      { label: "Webhook notifications", desc: "Auto-deploy on push" },
      { label: "Deploy keys", desc: "Securely clone private repos" },
    ],
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    Icon: BitbucketIcon,
    description: "Connect a repository from your Bitbucket workspace",
    permissions: [
      { label: "Read access to your repositories", desc: "Browse and import repos" },
      { label: "Webhook notifications", desc: "Auto-deploy on push" },
      { label: "Pipeline integration", desc: "Sync with Bitbucket Pipelines" },
    ],
  },
];

function getGitProvider(id: string): GitProvider | undefined {
  return gitProviders.find((p) => p.id === id);
}

function isGitSource(type: string): boolean {
  return gitProviders.some((p) => p.id === type);
}

type SourceType = "github" | "bitbucket" | "docker" | "database";
type Phase = 1 | 2 | 3;

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
  { id: "nextjs", name: "Next.js", buildCmd: "npm run build", output: ".next", install: "npm install" },
  { id: "vite", name: "Vite", buildCmd: "npm run build", output: "dist", install: "npm install" },
  { id: "remix", name: "Remix", buildCmd: "npm run build", output: "build", install: "npm install" },
  { id: "astro", name: "Astro", buildCmd: "npm run build", output: "dist", install: "npm install" },
  { id: "static", name: "Static", buildCmd: "", output: "public", install: "" },
  { id: "custom", name: "Custom", buildCmd: "", output: "", install: "" },
];

const regions = ["US East", "EU West", "Asia Pacific"];
const branches = ["main", "develop", "staging"];

/* ─── Database Config ─── */

interface DbEngine {
  id: string;
  name: string;
  description: string;
  defaultPort: number;
  envPrefix: string;
}

const dbEngines: DbEngine[] = [
  { id: "postgresql", name: "PostgreSQL", description: "Relational, ACID-compliant", defaultPort: 5432, envPrefix: "POSTGRES" },
  { id: "mysql", name: "MySQL", description: "Popular relational database", defaultPort: 3306, envPrefix: "MYSQL" },
  { id: "mongodb", name: "MongoDB", description: "Document-oriented NoSQL", defaultPort: 27017, envPrefix: "MONGO" },
  { id: "redis", name: "Redis", description: "In-memory key-value store", defaultPort: 6379, envPrefix: "REDIS" },
];

const cpuSteps = [0.25, 0.5, 1, 2, 4, 8];
const memorySteps = [256, 512, 1024, 2048, 4096, 8192, 16384];
const storageSteps = [1, 5, 10, 25, 50, 100, 256];

function formatCpu(val: number): string {
  if (val < 1) return `${val} vCPU (Shared)`;
  return `${val} vCPU`;
}

function formatMemory(mb: number): string {
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
}

function formatStorage(gb: number): string {
  return `${gb} GB`;
}

const diskSizes = [
  { id: "1", label: "1 GB ($0.25/month)" },
  { id: "5", label: "5 GB ($1.25/month)" },
  { id: "10", label: "10 GB ($2.50/month)" },
  { id: "25", label: "25 GB ($6.25/month)" },
  { id: "50", label: "50 GB ($12.50/month)" },
  { id: "100", label: "100 GB ($25/month)" },
];

function generateMockCredential(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

/* ─── Summary Chip ─── */

function SummaryChip({
  icon,
  label,
  onChangeClick,
}: {
  icon: React.ReactNode;
  label: string;
  onChangeClick: () => void;
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

/* ─── Dropdown (generic) ─── */

function Dropdown({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const selectedLabel = options.find((o) => o.id === value)?.label ?? value;

  return (
    <div className={`relative ${className ?? ""}`} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between ${inputClass}`}
      >
        <span>{selectedLabel}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease }}
        >
          <ChevronDown className="size-3.5 text-dash-text-faded" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease }}
            className="absolute left-0 top-full z-50 mt-1 w-full overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_2px_4px_-4px_rgba(0,0,0,0.07)]"
          >
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                className={`flex w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-dash-bg-elevated ${
                  opt.id === value ? "font-medium text-dash-text-strong" : "text-dash-text-faded"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Phase 1: Source Type ─── */

function Phase1SourceType({
  onSelect,
}: {
  onSelect: (type: SourceType) => void;
}) {
  const sourceCards: { type: SourceType; Icon: IconComponent; title: string; desc: string }[] = [
    ...gitProviders.map((p) => ({
      type: p.id as SourceType,
      Icon: p.Icon,
      title: `Import from ${p.name}`,
      desc: p.description,
    })),
    {
      type: "docker",
      Icon: Container,
      title: "Deploy Docker image",
      desc: "Deploy from a public or private registry",
    },
    {
      type: "database",
      Icon: Database,
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
            onClick={() => onSelect(card.type)}
            className="group flex flex-col gap-3 rounded-[4px] border-[0.5px] border-dash-border p-5 text-left transition-all hover:border-dash-text-faded hover:bg-dash-bg-elevated"
          >
            <card.Icon className="size-5 text-dash-text-body" />
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
}: {
  provider: GitProvider;
  onConnected: () => void;
}) {
  const { Icon } = provider;

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
          <GlossyButton variant="blue" onClick={onConnected}>
            Connect {provider.name}
          </GlossyButton>
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
  onSelect,
}: {
  provider: GitProvider;
  onSelect: (repoName: string) => void;
}) {
  const { Icon: ProviderIcon } = provider;
  const [org, setOrg] = useState(mockOrgs[0].id);
  const [search, setSearch] = useState("");
  const [orgOpen, setOrgOpen] = useState(false);
  const orgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) setOrgOpen(false);
    }
    if (orgOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [orgOpen]);

  const selectedOrg = mockOrgs.find((o) => o.id === org)!;
  const filtered = mockRepos.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
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

      {/* Org switcher + search */}
      <div className="flex items-center gap-2">
        <div className="relative" ref={orgRef}>
          <button
            onClick={() => setOrgOpen(!orgOpen)}
            className={`flex items-center gap-2 ${inputClass} w-auto min-w-[200px]`}
          >
            <div
              className="size-5 shrink-0 rounded-full"
              style={{ background: selectedOrg.avatar }}
            />
            <span className="flex-1 truncate text-left">{selectedOrg.name}</span>
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
                {mockOrgs.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => { setOrg(o.id); setOrgOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
                  >
                    <div
                      className="size-5 shrink-0 rounded-full"
                      style={{ background: o.avatar }}
                    />
                    {o.name}
                  </button>
                ))}
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
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-dash-text-faded">
            No repositories found.
          </div>
        ) : (
          filtered.map((repo, i) => (
            <motion.div
              key={repo.name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.04 * i, ease }}
              className={`flex items-center justify-between px-4 py-3 ${
                i > 0 ? "border-t-[0.5px] border-dash-border" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <ProviderIcon className="size-4 text-dash-text-faded" />
                <span className="text-sm font-medium text-dash-text-strong">
                  {repo.name}
                </span>
                {repo.visibility === "private" ? (
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
              <DashButton size="sm" onClick={() => onSelect(repo.name)}>
                Import
              </DashButton>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}

/* ─── Phase 2: Docker Image ─── */

function Phase2Docker({
  onSubmit,
}: {
  onSubmit: (imageName: string) => void;
}) {
  const [image, setImage] = useState("");

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
      <div>
        <label className="mb-1.5 block text-sm text-dash-text-body">
          Image name
        </label>
        <input
          type="text"
          placeholder="nginx:latest or ghcr.io/org/image:tag"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          className={inputClass}
          autoFocus
        />
        <p className="mt-2 text-xs text-dash-text-extra-faded">
          Supports Docker Hub, GitHub Container Registry, and custom registries.
        </p>
      </div>
      <div className="mt-5">
        <GlossyButton
          variant="blue"
          fullWidth
          onClick={() => {
            if (image.trim()) onSubmit(image.trim());
          }}
          disabled={!image.trim()}
        >
          Continue
        </GlossyButton>
      </div>
    </motion.div>
  );
}

/* ─── Phase 2: Database Engine Select ─── */

function Phase2DbEngine({
  onSelect,
}: {
  onSelect: (engineId: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease }}
    >
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">
        Choose a database engine
      </h3>
      <p className="mb-4 text-sm text-dash-text-faded">
        Select the engine that best fits your application's needs.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {dbEngines.map((engine, i) => (
          <motion.button
            key={engine.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 * i, ease }}
            onClick={() => onSelect(engine.id)}
            className="group flex flex-col gap-3 rounded-[4px] border-[0.5px] border-dash-border p-5 text-left transition-all hover:border-dash-text-faded hover:bg-dash-bg-elevated"
          >
            <Database className="size-5 text-dash-text-body" />
            <div>
              <div className="text-sm font-medium text-dash-text-strong">
                {engine.name}
              </div>
              <div className="mt-0.5 text-xs text-dash-text-faded">
                {engine.description}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
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
  const [revealed, setRevealed] = useState(!sensitive);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-3">
      <span className="w-[140px] shrink-0 font-family-mono text-xs text-dash-text-faded">
        {label}
      </span>
      <input
        type={sensitive && !revealed ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 truncate border-0 bg-transparent font-family-mono text-sm text-dash-text-body outline-none placeholder:text-dash-text-extra-faded"
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
  engineId,
}: {
  engineId: string;
}) {
  const engine = dbEngines.find((e) => e.id === engineId)!;
  const [dbName, setDbName] = useState(`${engine.id}-db-${generateMockCredential(4)}`);
  const [region, setRegion] = useState("US East");
  const [cpuIdx, setCpuIdx] = useState(2);
  const [memIdx, setMemIdx] = useState(2);
  const [storIdx, setStorIdx] = useState(2);
  const [publicAccess, setPublicAccess] = useState(false);
  const [whitelistIps, setWhitelistIps] = useState<{ id: number; value: string }[]>([]);

  const [credentials, setCredentials] = useState(() => ({
    host: `${engine.id}-${generateMockCredential(8)}.brimble.db`,
    port: String(engine.defaultPort),
    user: `brimble_${generateMockCredential(6)}`,
    password: generateMockCredential(24),
    database: dbName.replace(/-/g, "_"),
  }));

  function updateCredential(field: keyof typeof credentials, val: string) {
    setCredentials((prev) => ({ ...prev, [field]: val }));
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
      <h3 className="mb-4 text-sm font-medium text-dash-text-strong">
        Configure {engine.name}
      </h3>

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
            options={regions.map((r) => ({ id: r, label: r }))}
            onChange={setRegion}
          />
        </div>
      </div>

      <hr className="my-6 border-dash-border-soft" />

      {/* Compute resources */}
      <div>
        <h4 className="mb-4 text-sm font-medium text-dash-text-strong">
          Compute
        </h4>
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm text-dash-text-body">CPU</label>
              <span className="text-sm font-medium text-dash-text-strong">
                {formatCpu(cpuSteps[cpuIdx])}
              </span>
            </div>
            <RangeSlider
              value={cpuIdx}
              onChange={setCpuIdx}
              min={0}
              max={cpuSteps.length - 1}
              step={1}
              hideValue
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm text-dash-text-body">Memory</label>
              <span className="text-sm font-medium text-dash-text-strong">
                {formatMemory(memorySteps[memIdx])}
              </span>
            </div>
            <RangeSlider
              value={memIdx}
              onChange={setMemIdx}
              min={0}
              max={memorySteps.length - 1}
              step={1}
              hideValue
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm text-dash-text-body">Storage</label>
              <span className="text-sm font-medium text-dash-text-strong">
                {formatStorage(storageSteps[storIdx])}
              </span>
            </div>
            <RangeSlider
              value={storIdx}
              onChange={setStorIdx}
              min={0}
              max={storageSteps.length - 1}
              step={1}
              hideValue
            />
          </div>
        </div>
      </div>

      <hr className="my-6 border-dash-border-soft" />

      {/* Credentials */}
      <div>
        <h4 className="mb-3 text-sm font-medium text-dash-text-strong">
          Credentials
        </h4>
        <div className="rounded-[4px] border-[0.5px] border-dash-border p-4">
          <div className="flex flex-col gap-2.5">
            <CredentialRow label={`${engine.envPrefix}_HOST`} value={credentials.host} onChange={(v) => updateCredential("host", v)} sensitive />
            <CredentialRow label={`${engine.envPrefix}_PORT`} value={credentials.port} onChange={(v) => updateCredential("port", v)} />
            <CredentialRow label={`${engine.envPrefix}_USER`} value={credentials.user} onChange={(v) => updateCredential("user", v)} sensitive />
            <CredentialRow label={`${engine.envPrefix}_PASSWORD`} value={credentials.password} onChange={(v) => updateCredential("password", v)} sensitive />
            <CredentialRow label={`${engine.envPrefix}_DB`} value={credentials.database} onChange={(v) => updateCredential("database", v)} sensitive />
          </div>
        </div>
        <p className="mt-2 text-xs text-dash-text-extra-faded">
          Credentials are auto-generated but can be customised. Store them securely — they won't be shown again after provisioning.
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
              <div className="mt-4">
                <label className="mb-1.5 block text-xs text-dash-text-faded">
                  IP Whitelist
                </label>
                <div className="flex flex-col gap-2">
                  {whitelistIps.map((ip) => (
                    <div key={ip.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="0.0.0.0/0"
                        value={ip.value}
                        onChange={(e) => updateWhitelistIp(ip.id, e.target.value)}
                        className={`${inputClass} flex-1 font-family-mono text-[13px]`}
                      />
                      <button
                        onClick={() => removeWhitelistIp(ip.id)}
                        className="flex size-7 items-center justify-center rounded-[4px] text-dash-text-faded transition-colors hover:text-dash-text-strong"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addWhitelistIp}
                  className="mt-2 flex items-center gap-1.5 text-sm text-[#4879f8] transition-colors hover:text-[#3a6ae6]"
                >
                  <Plus className="size-3.5" />
                  Add IP address
                </button>
                {whitelistIps.length === 0 && (
                  <p className="mt-2 text-xs text-dash-text-extra-faded">
                    No IPs whitelisted. Only Brimble internal services will have access.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Provision button */}
      <div className="mt-8">
        <GlossyButton
          variant="blue"
          fullWidth
          disabled={!dbName.trim()}
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

function Phase3Configure({
  sourceType,
  sourceName,
}: {
  sourceType: SourceType;
  sourceName: string;
}) {
  const defaultName = sourceName.split(":")[0].split("/").pop() ?? sourceName;

  const [projectName, setProjectName] = useState(defaultName);
  const [region, setRegion] = useState("US East");
  const [branch, setBranch] = useState("main");
  const isGit = isGitSource(sourceType);
  const [framework, setFramework] = useState(isGit ? "nextjs" : "custom");
  const fw = frameworks.find((f) => f.id === framework)!;
  const [buildCmd, setBuildCmd] = useState(fw.buildCmd);
  const [outputDir, setOutputDir] = useState(fw.output);
  const [installCmd, setInstallCmd] = useState(fw.install);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [envExpanded, setEnvExpanded] = useState(false);
  const [diskEnabled, setDiskEnabled] = useState(false);
  const [diskSize, setDiskSize] = useState("10");
  const [mountPath, setMountPath] = useState("/mnt/data");

  function handleFrameworkChange(id: string) {
    setFramework(id);
    const newFw = frameworks.find((f) => f.id === id)!;
    setBuildCmd(newFw.buildCmd);
    setOutputDir(newFw.output);
    setInstallCmd(newFw.install);
  }

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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-dash-text-body">
              Region
            </label>
            <Dropdown
              value={region}
              options={regions.map((r) => ({ id: r, label: r }))}
              onChange={setRegion}
            />
          </div>
          {isGit && (
            <div>
              <label className="mb-1.5 block text-sm text-dash-text-body">
                Branch
              </label>
              <Dropdown
                value={branch}
                options={branches.map((b) => ({ id: b, label: b }))}
                onChange={setBranch}
              />
            </div>
          )}
        </div>
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
                options={frameworks.map((f) => ({ id: f.id, label: f.name }))}
                onChange={handleFrameworkChange}
              />
            </div>

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
          </div>

          <hr className="my-6 border-dash-border-soft" />
        </>
      )}

      {/* Environment variables */}
      <div>
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
              <div className="mt-3 flex flex-col gap-2">
                {envVars.map((v) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="KEY"
                      value={v.key}
                      onChange={(e) => updateEnvVar(v.id, "key", e.target.value)}
                      className={`${inputClass} flex-1 font-family-mono text-[13px] uppercase`}
                    />
                    <input
                      type="text"
                      placeholder="value"
                      value={v.value}
                      onChange={(e) =>
                        updateEnvVar(v.id, "value", e.target.value)
                      }
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
      </div>

      {/* Persistent storage */}
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs text-dash-text-faded">
                      Disk size
                    </label>
                    <Dropdown
                      value={diskSize}
                      options={diskSizes}
                      onChange={setDiskSize}
                    />
                  </div>
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

                <div className="rounded-[4px] bg-[#4879f8]/[0.04] px-3 py-2.5 dark:bg-[#4879f8]/[0.08]">
                  <p className="text-xs leading-relaxed text-dash-text-body">
                    <span className="font-medium text-[#4879f8]">$0.25/GB per month.</span>{" "}
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

      {/* Deploy button */}
      <div className="mt-8">
        <GlossyButton variant="blue" fullWidth>
          Deploy Project
        </GlossyButton>
      </div>
    </motion.div>
  );
}

/* ─── Main Page ─── */

function NewProjectPage() {
  const [phase, setPhase] = useState<Phase>(1);
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(
    new Set(),
  );

  function handleSourceTypeSelect(type: SourceType) {
    setSourceType(type);
    setPhase(2);
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
    } else if (target <= 2) {
      setSourceName("");
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-[680px]">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/projects"
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
                if (sourceType === "database") return <Database className="size-3" />;
                return <Container className="size-3" />;
              })()}
              label={(() => {
                const provider = getGitProvider(sourceType);
                if (provider) return provider.name;
                if (sourceType === "database") return "Database";
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
              icon={sourceType === "database" ? <Database className="size-3" /> : <Check className="size-3" />}
              label={sourceType === "database" ? (dbEngines.find((e) => e.id === sourceName)?.name ?? sourceName) : sourceName}
              onChangeClick={() => handleChangePhase(2)}
            />
          </div>
        ) : (
          phase === 2 &&
          sourceType && (
            <AnimatePresence mode="wait">
              {(() => {
                if (sourceType === "database") {
                  return (
                    <Phase2DbEngine
                      key="phase2-db-engine"
                      onSelect={handleSourceSelect}
                    />
                  );
                }
                const provider = getGitProvider(sourceType);
                if (provider && !connectedProviders.has(provider.id)) {
                  return (
                    <Phase2GitConnect
                      key={`phase2-connect-${provider.id}`}
                      provider={provider}
                      onConnected={() =>
                        setConnectedProviders((prev) => new Set(prev).add(provider.id))
                      }
                    />
                  );
                }
                if (provider) {
                  return (
                    <Phase2GitRepoSelect
                      key={`phase2-repos-${provider.id}`}
                      provider={provider}
                      onSelect={handleSourceSelect}
                    />
                  );
                }
                return (
                  <Phase2Docker key="phase2-docker" onSubmit={handleSourceSelect} />
                );
              })()}
            </AnimatePresence>
          )
        )}

        {/* Phase 3 */}
        {phase === 3 && sourceType && sourceName && (
          <AnimatePresence mode="wait">
            {sourceType === "database" ? (
              <Phase3DatabaseConfigure
                key="phase3-db"
                engineId={sourceName}
              />
            ) : (
              <Phase3Configure
                key="phase3"
                sourceType={sourceType}
                sourceName={sourceName}
              />
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
