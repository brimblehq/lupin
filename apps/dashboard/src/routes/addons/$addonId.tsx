import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { ArrowLeft, Copy, Check, ExternalLink } from "lucide-react";
import { ToggleSwitch } from "../../components/shared/toggle-switch";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { AddonCard } from "../../components/shared/addon-card";
import { GlossyButton } from "../../components/shared/glossy-button";
import { startOauthPopup } from "@/lib/auth/oauth-popup";
import type { McpServerListResult, McpServerTemplate } from "@/backend/mcp";
import type { GithubAccount } from "@/backend/repositories";
import { finalizeOauthSessionServerFn } from "@/server/auth/actions";
import { deployMcpTemplateServerFn, getMcpTemplateServerFn, listMcpTemplatesServerFn } from "@/server/mcp/actions";
import { listGithubAccountsServerFn } from "@/server/repositories/actions";
import {
  mapMcpTemplateToAddon,
  mapMcpTemplateToAddonDetail,
} from "@/utils/discover-mcp";

export const Route = createFileRoute("/addons/$addonId")({
  staleTime: 30_000,
  preloadStaleTime: 30_000,
  loader: async ({ params }) => {
    const [template, relatedResult] = await Promise.all([
      (getMcpTemplateServerFn as unknown as (input: {
        data: { id: string };
      }) => Promise<McpServerTemplate | null>)({
        data: { id: params.addonId },
      }),
      (listMcpTemplatesServerFn as unknown as (input: {
        data?: { limit?: number };
      }) => Promise<McpServerListResult>)({
        data: { limit: 12 },
      }).catch(() => ({ servers: [], pagination: {} } as McpServerListResult)),
    ]);

    const detail = template ? mapMcpTemplateToAddonDetail(template) : null;
    const relatedAddons = relatedResult.servers
      .filter((server) => (detail ? (server.qualifiedName || server.id) !== params.addonId : true))
      .slice(0, 3)
      .map(mapMcpTemplateToAddon);

    return {
      detail,
      relatedAddons,
    };
  },
  component: AddonDetailPage,
});

const ease = [0.16, 1, 0.3, 1] as const;

function formatWebsiteLabel(value?: string) {
  if (!value) return undefined;
  return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function buildToolLines(detail: NonNullable<ReturnType<typeof Route.useLoaderData>["detail"]>) {
  const lines: Array<{ key: string; value: string }> = [];

  detail.tools.slice(0, 6).forEach((tool) => {
    lines.push({
      key: tool.name,
      value: tool.description || "Tool available",
    });
  });

  detail.connections.forEach((connection) => {
    if (connection.requiredFields.length === 0) return;
    connection.requiredFields.forEach((field) => {
      lines.push({
        key: `${connection.type.toUpperCase()}_${field}`,
        value: `Required ${connection.type} config field`,
      });
    });
  });

  return lines.slice(0, 8);
}

function CopyableRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const haptics = useHaptics();

  function handleCopy() {
    navigator.clipboard.writeText(`${label}: ${value}`);
    haptics.light();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 truncate font-mono text-[11px] leading-5 text-[#aadafa]">{label}</span>
      <button
        onClick={handleCopy}
        className="shrink-0 text-[#4a505c] transition-colors hover:text-[#9da3ae]"
      >
        {copied ? <Check className="size-3.5 text-[#28c840]" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

function chooseGithubInstallation(accounts: GithubAccount[], workspace?: string) {
  if (!accounts.length) return null;

  if (workspace) {
    const orgAccount = accounts.find(
      (account) => account.type === "Organization" && account.installationId !== undefined,
    );
    if (orgAccount) return orgAccount;
  }

  const userAccount = accounts.find(
    (account) => account.type === "User" && account.installationId !== undefined,
  );
  if (userAccount) return userAccount;

  return accounts.find((account) => account.installationId !== undefined) ?? null;
}

function AddonDetailPage() {
  const navigate = useNavigate();
  const search = Route.useSearch() as { workspace?: string };
  const { detail, relatedAddons } = Route.useLoaderData();
  const [deploying, setDeploying] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(true);
  const listGithubAccounts = useServerFn(listGithubAccountsServerFn as any) as () => Promise<GithubAccount[]>;
  const finalizeOauthSession = useServerFn(finalizeOauthSessionServerFn as any) as (args: {
    data: {
      accessToken: string;
      refreshToken?: string;
      user?: Record<string, unknown>;
    };
  }) => Promise<{ ok: true }>;
  const deployMcpTemplate = useServerFn(deployMcpTemplateServerFn as any) as (args: {
    data: {
      workspace?: string;
      template: string;
      templateName: string;
      installationId: string | number;
      authEnabled?: boolean;
    };
  }) => Promise<{ name?: string; slug?: string }>;

  if (!detail) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-dash-text-faded">Addon not found.</p>
          <Link
            to="/addons"
            search={search.workspace ? { workspace: search.workspace } : {}}
            className="mt-2 inline-flex items-center gap-1 text-sm text-[#4879f8] hover:underline"
          >
            <ArrowLeft className="size-3" />
            Back to addons
          </Link>
        </div>
      </div>
    );
  }

  const toolLines = buildToolLines(detail);
  const metadataRows = [
    { label: "Installs", value: detail.installsLabel },
    { label: "Developer", value: detail.developer },
    { label: "Category", value: detail.category },
    { label: "Language", value: detail.language || "-" },
    { label: "Website", value: formatWebsiteLabel(detail.website), href: detail.website },
    { label: "Documentation", value: detail.documentationUrl ? "Read" : undefined, href: detail.documentationUrl },
    { label: "Repository", value: detail.githubUrl ? "View" : undefined, href: detail.githubUrl },
  ].filter((row) => row.value);

  async function ensureGithubAccounts() {
    let accounts = await listGithubAccounts();
    if (accounts.length > 0) return accounts;

    const oauth = await startOauthPopup("github");
    await finalizeOauthSession({
      data: {
        accessToken: oauth.access_token,
        refreshToken: oauth.refresh_token,
        user: {
          id: oauth.id,
          email: oauth.email,
          username: oauth.username,
          firstName: oauth.first_name,
          lastName: oauth.last_name,
          company: oauth.company,
          onboarded: Boolean(oauth.onboard?.user),
        },
      },
    });

    accounts = await listGithubAccounts();
    return accounts;
  }

  async function handleDeployServer() {
    if (deploying) return;

    setDeploying(true);
    try {
      const accounts = await ensureGithubAccounts();
      const selectedAccount = chooseGithubInstallation(accounts, search.workspace);

      if (!selectedAccount?.installationId) {
        throw new Error("No GitHub installation found. Connect a GitHub account or organization.");
      }

      if (!detail.deployTemplateToken) {
        throw new Error("This MCP server is missing a qualified name and cannot be deployed.");
      }

      const project = await deployMcpTemplate({
        data: {
          workspace: search.workspace,
          template: detail.deployTemplateToken,
          templateName: detail.name,
          installationId: selectedAccount.installationId,
          authEnabled,
        },
      });

      const projectId = project.slug || project.name;
      if (!projectId) {
        throw new Error("MCP server deployment failed");
      }

      toast.success("MCP server deployment started");
      await navigate({
        to: "/projects/$projectId",
        params: { projectId },
        search: search.workspace ? { workspace: search.workspace } : {},
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to deploy MCP server");
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-10">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        <Link
          to="/addons"
          search={search.workspace ? { workspace: search.workspace } : {}}
          className="inline-flex items-center gap-1 text-sm text-dash-text-faded underline underline-offset-2 transition-colors hover:text-dash-text-strong"
        >
          Back
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease }}
        className="mt-5 flex flex-col gap-6 lg:flex-row lg:gap-8"
      >
        <div
          className={`relative h-[210px] w-full shrink-0 overflow-clip rounded-[8px] bg-gradient-to-b ${detail.gradient} lg:w-[437px]`}
        >
          <div
            className="absolute top-[26px] bottom-0 w-[388px] overflow-clip rounded-t-[4px] border-[0.5px] border-[#e6e5e5] border-b-0 bg-[#fbfbfb]"
            style={{ left: "calc(50% + 80.5px)", transform: "translateX(-50%)" }}
          >
            <div className="flex items-center gap-[3px] px-2.5 py-[6px]">
              <span className="size-[5px] rounded-full bg-[#d9d9d9]" />
              <span className="size-[5px] rounded-full bg-[#d9d9d9]" />
              <span className="size-[5px] rounded-full bg-[#d9d9d9]" />
            </div>
            <div className="mx-[6px] h-px bg-[#e6e5e5]" />
          </div>

          <div
            className="absolute left-[17px] top-[18px] flex size-[60px] items-center justify-center rounded-full"
            style={{ backgroundColor: detail.logoBg }}
          >
            {detail.logoImageUrl ? (
              <img src={detail.logoImageUrl} alt={`${detail.name} logo`} className="size-10 rounded-full object-cover" />
            ) : (
              <span className="text-2xl">{detail.logo}</span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-medium tracking-[-0.03px] text-dash-text-strong">{detail.name}</h1>
              {detail.verified ? (
                <span className="rounded-full bg-[#e8f3ff] px-2 py-0.5 text-xs text-[#3975f6]">Verified</span>
              ) : null}
            </div>
            <p className="mt-2 text-sm font-light leading-[1.3] text-dash-text-faded">
              {detail.description}. Connect it to your Brimble project and streamline your workflow.
            </p>
            {detail.tools.length > 0 ? (
              <p className="mt-2 text-sm font-light leading-[1.3] text-dash-text-faded">
                - Provides {detail.tools.length} tool{detail.tools.length === 1 ? "" : "s"}
              </p>
            ) : null}
            {detail.tools.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {detail.tools.slice(0, 3).map((tool) => (
                  <span
                    key={tool.name}
                    className="rounded-full bg-dash-bg-elevated px-2 py-1 text-xs text-dash-text-faded"
                  >
                    {tool.name}
                  </span>
                ))}
                {detail.tools.length > 3 && (
                  <span className="text-xs text-dash-text-extra-faded">
                    +{detail.tools.length - 3}
                  </span>
                )}
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <ToggleSwitch checked={authEnabled} onChange={setAuthEnabled} />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-dash-text-strong">
                Enable Authentication
              </span>
              <span className="text-xs font-light text-dash-text-faded">
                Require an API key in the <code className="rounded bg-dash-bg-elevated px-1 font-mono text-[10px]">x-brimble-key</code> header to access this MCP server.
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <GlossyButton
              className="min-w-[160px]"
              loading={deploying}
              loadingLabel="Deploying..."
              onClick={() => {
                void handleDeployServer();
              }}
            >
              Deploy server
            </GlossyButton>
            {detail.documentationUrl ? (
              <a
                href={detail.documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-[40px] items-center justify-center gap-1 rounded-[8px] border border-dash-border px-3.5 text-sm text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
              >
                View documentation
                <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
        </div>
      </motion.div>

      <hr className="my-8 border-dash-border-soft" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1, ease }}
        className="scrollbar-hidden flex gap-3.5 overflow-x-auto"
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[203px] w-[370px] shrink-0 rounded-[8px] bg-dash-bg-elevated dark:bg-[#29292a]"
          />
        ))}
      </motion.div>

      <hr className="my-8 border-dash-border-soft" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15, ease }}
        className="flex flex-col gap-8 lg:flex-row"
      >
        <div className="flex-1">
          <h2 className="text-base font-medium tracking-[-0.03px] text-dash-text-strong">More details</h2>
          <p className="mt-3 text-sm font-light leading-[1.45] text-dash-text-faded">{detail.longDescription}</p>

          {toolLines.length > 0 && (
            <div className="mt-6 overflow-clip rounded-[4px]">
              <div className="border-b border-[#394150] bg-[#212936] px-4 py-2">
                <span className="text-[11px] font-light text-[#9da3ae]">Tools & configuration hints</span>
              </div>
              <div className="flex flex-col gap-2 bg-[#121826] px-4 py-3">
                {toolLines.map((line, i) => (
                  <div key={`${line.key}-${i}`} className="flex items-center gap-3">
                    <span className="w-4 shrink-0 text-right font-mono text-[10px] text-[#4a505c]">{i + 1}</span>
                    <CopyableRow label={line.key} value={line.value} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-full shrink-0 rounded-[8px] border-[0.5px] border-dash-border-soft lg:w-[320px]">
          {metadataRows.map((row, i) => (
            <div
              key={row.label}
              className={`flex items-center justify-between px-3.5 py-3 ${i < metadataRows.length - 1 ? "border-b-[0.5px] border-dash-border-soft" : ""}`}
            >
              <span className="text-sm font-light text-dash-text-body">{row.label}</span>
              {row.href ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-light text-dash-text-faded transition-colors hover:text-dash-text-strong"
                >
                  {row.value}
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="text-sm font-light text-dash-text-faded">{row.value}</span>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      <hr className="my-8 border-dash-border-soft" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2, ease }}
      >
        <h2 className="mb-4 text-base font-medium tracking-[-0.03px] text-dash-text-strong">More like this</h2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {relatedAddons.map((addon) => (
            <AddonCard key={addon.id} addon={addon} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
