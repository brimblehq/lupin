import { useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ExternalLink, ChevronDown } from "lucide-react";
import { ToggleSwitch } from "../../components/shared/toggle-switch";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { AddonCard } from "../../components/shared/addon-card";
import { GlossyButton } from "../../components/shared/glossy-button";
import { startOauthPopup } from "@/lib/auth/oauth-popup";
import { buildTwoFactorChallengeUrl, extractTwoFactorChallenge } from "@/lib/auth/two-factor";
import type { McpServerListResult, McpServerTemplate } from "@/backend/mcp";
import type { GithubAccount, GithubAccountsResult } from "@/backend/repositories";
import { deployMcpTemplateServerFn, getMcpTemplateServerFn, listMcpTemplatesServerFn } from "@/server/mcp/actions";
import { listGithubAccountsServerFn } from "@/server/repositories/actions";
import { mapMcpTemplateToAddon, mapMcpTemplateToAddonDetail } from "@/utils/discover-mcp";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

export const Route = createFileRoute("/addons/$addonId")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  loader: async ({ params }) => {
    const template = await (getMcpTemplateServerFn as unknown as (input: { data: { id: string } }) => Promise<McpServerTemplate | null>)({
      data: { id: params.addonId },
    });

    const detail = template ? mapMcpTemplateToAddonDetail(template) : null;
    const category = template?.category;

    const relatedResult = await (
      listMcpTemplatesServerFn as unknown as (input: { data?: { limit?: number; category?: string } }) => Promise<McpServerListResult>
    )({
      data: {
        limit: 4,
        ...(category ? { category } : {}),
      },
    }).catch(() => ({ servers: [], pagination: {} }) as McpServerListResult);

    const currentId = template?.qualifiedName || template?.id || params.addonId;
    const relatedAddons = relatedResult.servers
      .filter((server) => (server.qualifiedName || server.id) !== currentId)
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
const TWO_FACTOR_REDIRECT_SIGNAL = "__TWO_FACTOR_REDIRECT__";

function ToolCard({
  tool,
}: {
  tool: { name: string; description?: string; requiredCount?: number; inputSchema?: Record<string, unknown> };
}) {
  const [expanded, setExpanded] = useState(false);
  const properties = (tool.inputSchema?.properties ?? {}) as Record<string, { type?: string; description?: string }>;
  const params = Object.entries(properties);
  const required = new Set(Array.isArray(tool.inputSchema?.required) ? (tool.inputSchema.required as string[]) : []);

  const shortDesc = tool.description?.split("\n")[0]?.slice(0, 120) || "";

  return (
    <div>
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between gap-3 py-2 text-left">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-sm text-dash-text-strong">{tool.name}</span>
          {shortDesc && !expanded && <p className="mt-0.5 truncate text-xs font-light text-dash-text-faded">{shortDesc}</p>}
        </div>
        <ChevronDown className={`size-3.5 shrink-0 text-dash-text-extra-faded transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-3 pt-1">
              {tool.description && (
                <p className="text-sm font-light leading-[1.45] text-dash-text-faded">{tool.description.split("\n")[0]}</p>
              )}
              {params.length > 0 && (
                <div className="mt-3 flex flex-col gap-1">
                  {params.map(([name, schema]) => (
                    <div key={name} className="flex items-baseline gap-2 py-1">
                      <code className="shrink-0 font-mono text-xs text-dash-text-body">{name}</code>
                      {schema.type && (
                        <span className="text-[10px] text-dash-text-extra-faded">
                          {Array.isArray(schema.type) ? schema.type.join(" | ") : schema.type}
                        </span>
                      )}
                      {required.has(name) && <span className="text-[10px] font-medium text-[#f5a623]">required</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function chooseGithubInstallation(accounts: GithubAccount[], workspace?: string) {
  if (!accounts.length) return null;

  if (workspace) {
    const orgAccount = accounts.find((account) => account.type === "Organization" && account.installationId !== undefined);
    if (orgAccount) return orgAccount;
  }

  const userAccount = accounts.find((account) => account.type === "User" && account.installationId !== undefined);
  if (userAccount) return userAccount;

  return accounts.find((account) => account.installationId !== undefined) ?? null;
}

function AddonDetailPage() {
  const { canWrite } = useWorkspaceRole();
  const router = useRouter();
  const navigate = useNavigate();
  const search = Route.useSearch() as { workspace?: string };
  const { detail, relatedAddons } = Route.useLoaderData();
  const [deploying, setDeploying] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(true);
  const listGithubAccounts = useServerFn(listGithubAccountsServerFn as any) as () => Promise<GithubAccountsResult>;
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

  async function ensureGithubAccounts() {
    let result = await listGithubAccounts();
    if (result.accounts.length > 0 && result.authenticated) return result.accounts;

    const oauth = await startOauthPopup("github");
    const challenge = extractTwoFactorChallenge(oauth);
    if (challenge) {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      window.location.assign(buildTwoFactorChallengeUrl(challenge, { next: nextPath }));
      throw new Error(TWO_FACTOR_REDIRECT_SIGNAL);
    }

    result = await listGithubAccounts();
    return result.accounts;
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
      await invalidateActiveMatches(router);
      await navigate({
        to: "/projects/$projectId",
        params: { projectId },
        search: search.workspace ? { workspace: search.workspace } : {},
      });
    } catch (error) {
      if (error instanceof Error && error.message === TWO_FACTOR_REDIRECT_SIGNAL) {
        return;
      }
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
        <div className={`relative h-[210px] w-full shrink-0 overflow-clip rounded-[8px] bg-gradient-to-b ${detail.gradient} lg:w-[437px]`}>
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
              <img
                src={detail.logoImageUrl}
                alt={`${detail.name} logo`}
                className="size-10 rounded-full object-cover"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = "none";
                  const fallback = el.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = "";
                }}
              />
            ) : null}
            <span className="text-2xl text-white" style={detail.logoImageUrl ? { display: "none" } : undefined}>
              {detail.logo}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-medium tracking-[-0.03px] text-dash-text-strong">{detail.name}</h1>
              {detail.verified ? <span className="rounded-full bg-[#e8f3ff] px-2 py-0.5 text-xs text-[#3975f6]">Verified</span> : null}
            </div>
            <p className="mt-2 text-sm font-light leading-[1.3] text-dash-text-faded">
              {detail.description}. Connect it to your Brimble project and streamline your workflow.
              {detail.source ? <span className="text-dash-text-extra-faded"> — via {detail.source}</span> : null}
            </p>
            {detail.tools.length > 0 ? (
              <p className="mt-2 text-sm font-light leading-[1.3] text-dash-text-faded">
                - Provides {detail.tools.length} tool{detail.tools.length === 1 ? "" : "s"}
              </p>
            ) : null}
            {detail.tools.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {detail.tools.slice(0, 3).map((tool) => (
                  <span key={tool.name} className="rounded-full bg-dash-bg-elevated px-2 py-1 text-xs text-dash-text-faded">
                    {tool.name}
                  </span>
                ))}
                {detail.tools.length > 3 && <span className="text-xs text-dash-text-extra-faded">+{detail.tools.length - 3}</span>}
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <ToggleSwitch checked={authEnabled} onChange={setAuthEnabled} />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-dash-text-strong">Enable Authentication</span>
              <span className="text-xs font-light text-dash-text-faded">
                Require an API key in the <code className="rounded bg-dash-bg-elevated px-1 font-mono text-[10px]">x-brimble-key</code>{" "}
                header to access this MCP server.
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canWrite && (
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
            )}
            {detail.githubUrl || detail.documentationUrl ? (
              <a
                href={detail.githubUrl || detail.documentationUrl}
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
        transition={{ duration: 0.3, delay: 0.15, ease }}
        className="flex flex-col gap-8"
      >
        <div className="flex-1">
          <h2 className="text-base font-medium tracking-[-0.03px] text-dash-text-strong">More details</h2>
          <p className="mt-3 text-sm font-light leading-[1.45] text-dash-text-faded">
            {detail.longDescription}
            {detail.source ? <span className="text-dash-text-extra-faded"> — via {detail.source}</span> : null}
          </p>

          {detail.tools.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium text-dash-text-strong">Tools ({detail.tools.length})</h3>
              <div className="divide-y divide-dash-border-soft">
                {detail.tools.map((tool) => (
                  <ToolCard key={tool.name} tool={tool} />
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <hr className="my-8 border-dash-border-soft" />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2, ease }}>
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
