import { useEffect, useState } from "react";
import { createFileRoute, getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { ExternalLink, Copy, Check, ArrowUpRight, Terminal } from "lucide-react";
import { SimpleTooltip } from "../../../components/shared/tooltip";
import { StatusChip } from "../../../components/shared/status-chip";
import { getProjectScreenshotServerFn } from "@/server/projects/actions";
import { listFrameworksServerFn } from "@/server/frameworks/actions";
import { listDeploymentsServerFn } from "@/server/deployments/actions";
import type { DeploymentLog } from "@/backend/deployments";
import type { FrameworkOption } from "@/backend/frameworks";
import { useHaptics } from "@/hooks/use-haptics";
import { useProjectDeploymentLogsDrawer } from "@/contexts/project-deployment-logs-drawer-context";
import { formatRelativeTime } from "@/utils/dashboard";
import {
  isDatabaseProject as getIsDatabaseProject,
  isMcpProject as getIsMcpProject,
  isStaticProject as getIsStaticProject,
  isWebLikeProject,
} from "@/utils/project-capabilities";
import { RegionMap } from "@/components/project/region-map";
import { DbConnectionCard, DbQuickActionsCard } from "@/components/project/db-connection-sidebar";
import { redeployProjectServerFn } from "@/server/projects/actions";
import { useServerFn } from "@tanstack/react-start";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { WarningModal } from "@/components/shared/warning-modal";
import { ProjectOverviewPending } from "@/components/shared/route-pending";
import { invalidateActiveMatches } from "@/utils/router-invalidate";
import type { ListDeploymentsServerFnCaller } from "../project-detail.types";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Backend/service frameworks that don't produce browser screenshots */
const SERVICE_FRAMEWORKS = new Set(["other", "custom", "docker", "laravel", "php", "python", "golang", "ruby"]);

const parentRoute = getRouteApi("/projects/$projectId");

export const Route = createFileRoute("/projects/$projectId/")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  loader: async ({ context }) => {
    const project = (context as any).project;
    const workspace = (context as any).workspace as string | undefined;

    const isWebLike = isWebLikeProject(project);
    const framework = String(project?.framework ?? "").toLowerCase();
    const isService = SERVICE_FRAMEWORKS.has(framework);
    const needsScreenshot = isWebLike && !isService && !project?.screenshot && project?.id;

    const [deploymentsResult, screenshotResult, frameworksResult] = await Promise.allSettled([
      project?.id
        ? (listDeploymentsServerFn as unknown as ListDeploymentsServerFnCaller)({
            data: { projectId: project.id, workspace, page: 1, limit: 5 },
          })
        : Promise.resolve(null),
      needsScreenshot
        ? (getProjectScreenshotServerFn as unknown as (input: { data: { projectId: string } }) => Promise<string | null>)({
            data: { projectId: project.id },
          })
        : Promise.resolve(null),
      listFrameworksServerFn(),
    ]);

    const recentDeployments =
      deploymentsResult.status === "fulfilled" && deploymentsResult.value ? (deploymentsResult.value.items ?? []) : [];
    const screenshotUrl = project?.screenshot ?? (screenshotResult.status === "fulfilled" ? screenshotResult.value : null);
    const frameworks = frameworksResult.status === "fulfilled" ? frameworksResult.value : [];

    if (!isWebLike) {
      return { screenshotUrl: null, frameworks, recentDeployments };
    }

    if (isService) {
      return {
        screenshotUrl: null,
        isServiceFramework: true,
        frameworks,
        recentDeployments,
      };
    }

    return { screenshotUrl, frameworks, recentDeployments };
  },
  component: ProjectDetailPage,
  pendingComponent: ProjectOverviewPending,
});

function ProjectDetailPage() {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [restartingDb, setRestartingDb] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [screenshotLoadFailed, setScreenshotLoadFailed] = useState(false);
  const haptics = useHaptics();
  const router = useRouter();
  const { openDeploymentDrawer } = useProjectDeploymentLogsDrawer();
  const redeployProject = useServerFn(redeployProjectServerFn as any) as (args: {
    data: { projectId: string; workspace?: string };
  }) => Promise<{ id?: string; message?: string }>;

  useEffect(() => {
    function handleDeploymentUpdated() {
      invalidateActiveMatches(router);
    }
    window.addEventListener("brimble:deployment-updated", handleDeploymentUpdated);
    return () => window.removeEventListener("brimble:deployment-updated", handleDeploymentUpdated);
  }, [router]);
  const navigate = useNavigate();
  const { projectId } = Route.useParams();
  const { project } = parentRoute.useLoaderData() as any;
  const { screenshotUrl, isServiceFramework, frameworks, recentDeployments } = Route.useLoaderData() as {
    screenshotUrl: string | null;
    isServiceFramework?: boolean;
    frameworks?: FrameworkOption[];
    recentDeployments?: DeploymentLog[];
  };

  useEffect(() => {
    setScreenshotLoadFailed(false);
  }, [screenshotUrl]);

  const projectName = project?.name || projectId;
  const isDatabaseProject = getIsDatabaseProject(project);

  async function handleRestartDb() {
    if (restartingDb) return;
    setRestartingDb(true);
    try {
      await redeployProject({ data: { projectId } });
      toast.success("Database restart triggered");
      invalidateActiveMatches(router);
    } catch (error: any) {
      toast.error(typeof error?.message === "string" ? error.message : "Couldn't restart");
    } finally {
      setRestartingDb(false);
    }
  }
  function handleDownloadBackup() {
    if (!project?.backupUrl) return;
    const a = document.createElement("a");
    a.href = project.backupUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = `${projectName}-${Date.now().toString(36)}-backup.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const isStaticProject = getIsStaticProject(project);
  const isMcpProject = getIsMcpProject(project);
  const showPreviewBanner = isWebLikeProject(project);
  const showSitePasswordRow = isWebLikeProject(project);
  const showFrameworkRow = !isMcpProject;
  const showMcpAuthRow = isMcpProject;
  const showBuildCacheRow = !isDatabaseProject;
  const showComputeSizeRow = !isStaticProject;
  const liveUrl = project?.previewUrl || project?.domains?.[0]?.name || "";
  let liveHref = "";
  if (liveUrl) {
    if (liveUrl.startsWith("http")) {
      liveHref = liveUrl;
    } else {
      liveHref = `https://${liveUrl}`;
    }
  }
  const projectStatus = (project?.status || "UNKNOWN").toUpperCase();
  const statusCode = project?.statusCode;
  const regionText = project?.region || "Unknown";
  let passwordEnabledText = "No";
  if (typeof project?.passwordEnabled === "boolean") {
    if (project.passwordEnabled) {
      passwordEnabledText = "Yes";
    } else {
      passwordEnabledText = "No";
    }
  }

  let computeSizeText = "Not available";
  if (project?.specs) {
    const memory = project.specs.memory ? `${project.specs.memory}GB RAM` : null;
    const cpu = project.specs.cpu ? `${project.specs.cpu} CPU` : null;
    const storage = project.specs.storage ? `${project.specs.storage}GB Storage` : null;
    computeSizeText = [memory, cpu, storage].filter(Boolean).join(" • ") || "Not available";
  }

  const frameworkLabel = project?.framework || "Unknown";
  const matchedFramework = (frameworks ?? []).find((f) => f.slug === project?.framework);
  const frameworkLogo = matchedFramework?.logo;
  const repoSource = project?.repo?.git || "Git";
  const repoName = project?.repo?.name || repoSource;
  const isGitlab = repoSource.toLowerCase() === "gitlab";
  const isBitbucket = repoSource.toLowerCase() === "bitbucket";
  const repositoryHref = project?.gitLink || "";
  const lastUpdatedText = project?.updatedAt ? formatRelativeTime(project.updatedAt) : "unknown";
  let createdOnText = "Unknown";
  if (project?.createdAt) {
    const created = new Date(project.createdAt);
    if (!Number.isNaN(created.getTime())) {
      createdOnText = created.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }
  }
  const publicAccessText = project?.isPublicAccess ? "Yes" : "No";
  const mcpServerUrl = project?.domains?.[0]?.name ? `https://${project.domains[0].name}/mcp` : "";

  const deploymentRows: Array<{ url: string; date: string }> = (recentDeployments ?? []).map((dep) => ({
    url: dep.domain || dep.name || dep.id,
    date: dep.createdAt ? formatRelativeTime(dep.createdAt) : "",
  }));

  let domainRows: Array<{
    url: string;
    team: string;
    type: string;
    date: string;
  }> = [];
  if (project?.domains && project.domains.length > 0) {
    domainRows = project.domains.map((domain: any) => {
      let type = "Custom domain";

      const domainName = typeof domain?.name === "string" ? domain.name.toLowerCase() : "";
      const isBrimbleManagedDefault = domainName.endsWith(".brimble.app") || domainName.endsWith(".brimble.io");

      if (domain?.isDefault === true || domain?.isCustom === false || isBrimbleManagedDefault) {
        type = "default domain";
      }

      let date = "";
      if (domain.createdAt) {
        date = new Date(domain.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }

      const row = {
        url: domain.name,
        team: "",
        type,
        date,
      };
      return row;
    });
  }

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 py-8">
      {/* Project preview banner */}
      <div className="flex flex-col gap-4">
        {showPreviewBanner ? (
          <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
            {/* Gradient banner */}
            <div className="relative h-[232px] overflow-clip bg-gradient-to-b from-[#ea51bd] to-[#f1558a]">
              {/* Browser window mockup */}
              <div className="absolute inset-x-[3.38%] top-[27px] h-[236px] overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-white">
                <div className="flex h-[13px] items-center border-b-[0.5px] border-dash-border px-2 py-[6px]">
                  <div className="flex gap-1">
                    <span className="size-[4px] rounded-full bg-[#FF5F57]" />
                    <span className="size-[4px] rounded-full bg-[#FEBC2E]" />
                    <span className="size-[4px] rounded-full bg-[#28C840]" />
                  </div>
                </div>
                <div className="relative h-[222px] w-full bg-dash-bg-elevated">
                  {screenshotUrl && !screenshotLoadFailed ? (
                    <img
                      src={screenshotUrl}
                      alt={`${projectName} screenshot`}
                      className="h-full w-full object-cover object-top"
                      onError={() => setScreenshotLoadFailed(true)}
                    />
                  ) : isServiceFramework ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 bg-dash-bg">
                      <Terminal className="size-10 text-dash-text-extra-faded" />
                      <span className="text-sm font-light text-dash-text-faded">Service deployed successfully</span>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-light text-dash-text-faded">
                      No screenshot available yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Project name bar */}
            <div className="flex h-10 items-center justify-between border-t-[0.5px] border-dash-border bg-dash-bg-elevated px-3.5">
              <span className="text-sm leading-5 tracking-[-0.02px] text-dash-text-faded">{projectName}</span>
              <div className="flex items-center gap-2">
                {liveHref ? (
                  <a href={liveHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <span className="text-xs font-light leading-[18px] tracking-[-0.02px] text-dash-text-faded opacity-80">View live</span>
                    <ExternalLink className="size-4 text-dash-text-faded" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {isMcpProject ? (
          <div className="rounded-[4px] bg-dash-bg-elevated p-3.5">
            <p className="text-sm font-medium text-dash-text-strong">MCP Server</p>
            <p className="mt-1 text-sm font-light leading-[1.35] text-dash-text-faded">
              {mcpServerUrl ? (
                <>
                  You can access this MCP server at{" "}
                  <code className="rounded bg-dash-bg px-1.5 py-0.5 font-mono text-xs text-dash-text-strong">{mcpServerUrl}</code> and
                  connect over SSE.
                </>
              ) : (
                "Add a domain to access this MCP server over SSE at /mcp."
              )}
            </p>
            <div className="mt-3 flex items-center gap-2">
              {mcpServerUrl ? (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(mcpServerUrl);
                    haptics.light();
                    setCopiedIdx(-1);
                    setTimeout(() => setCopiedIdx(null), 2000);
                  }}
                  className="inline-flex items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-xs text-dash-text-body transition-colors hover:bg-dash-bg"
                >
                  {copiedIdx === -1 ? <Check className="size-3.5 text-[#13d282]" /> : <Copy className="size-3.5" />}
                  {copiedIdx === -1 ? "Copied" : "Copy MCP URL"}
                </button>
              ) : null}
              <a
                href="https://modelcontextprotocol.io/docs/concepts/transports#server-sent-events-sse"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#7ca2ff] hover:underline"
              >
                Learn MCP SSE
                <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </div>
        ) : null}

        {/* Meta / deployments cards */}
        <div
          className={
            isDatabaseProject
              ? "flex flex-col gap-4 lg:grid lg:grid-cols-[300px_1fr] lg:items-stretch lg:gap-4"
              : "flex flex-col gap-4 md:flex-row"
          }
        >
          {isDatabaseProject ? <DbConnectionCard connectionUri={project?.connectionUri} isActive={projectStatus === "ACTIVE"} /> : null}

          {/* Project meta card */}
          <div className="flex flex-1 flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
            <div className="flex h-10 items-center justify-between border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-3 text-sm tracking-[-0.02px]">
              <span className="text-dash-text-strong">Project meta</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 border-b-[0.5px] border-dash-border p-3.5">
                <img src="/icons/renew.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />
                <span className="text-sm font-light leading-[1.3] text-dash-text-faded">Last updated {lastUpdatedText}</span>
              </div>
              <div className="flex items-center justify-between border-b-[0.5px] border-dash-border p-3.5">
                <div className="flex items-center gap-2">
                  <img src="/icons/schedule.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />
                  <span className="text-sm font-light leading-[1.3] text-dash-text-faded">Created on</span>
                </div>
                <span className="font-mono text-[13px] leading-[1.4] text-dash-text-strong">{createdOnText}</span>
              </div>
              <div className="flex items-center justify-between border-b-[0.5px] border-dash-border p-3.5">
                <div className="flex items-center gap-2">
                  <img src="/icons/status.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />
                  <span className="text-sm font-light leading-[1.3] text-dash-text-faded">Project status</span>
                </div>
                <StatusChip status={projectStatus} />
              </div>
              {!isDatabaseProject ? (
                <div className="flex items-center justify-between border-b-[0.5px] border-dash-border p-3.5">
                  <div className="flex items-center gap-2">
                    <img src="/icons/status.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />
                    <span className="text-sm font-light leading-[1.3] text-dash-text-faded">Status code</span>
                  </div>
                  {typeof statusCode === "number" ? (
                    <span className="rounded-[4px] bg-[#13d282]/15 px-2 py-0.5 text-xs font-medium text-[#13d282]">{statusCode}</span>
                  ) : (
                    <span className="font-mono text-[13px] leading-[1.4] text-dash-text-strong">N/A</span>
                  )}
                </div>
              ) : null}
              <div className="flex items-center justify-between border-b-[0.5px] border-dash-border p-3.5">
                <div className="flex items-center gap-2">
                  <img src="/icons/region.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />
                  <span className="text-sm font-light leading-[1.3] text-dash-text-faded">Region</span>
                </div>
                <span className="font-mono text-[13px] leading-[1.4] text-dash-text-strong">{regionText}</span>
              </div>
              {showSitePasswordRow ? (
                <div className="flex items-center justify-between border-b-[0.5px] border-dash-border p-3.5">
                  <div className="flex items-center gap-2">
                    <img src="/icons/lock.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />
                    <span className="text-sm font-light leading-[1.3] text-dash-text-faded">Site password enabled</span>
                  </div>
                  <span className="font-mono text-[13px] leading-[1.4] text-dash-text-strong">{passwordEnabledText}</span>
                </div>
              ) : null}
              {showMcpAuthRow ? (
                <div className="flex items-center justify-between border-b-[0.5px] border-dash-border p-3.5">
                  <span className="text-sm font-light leading-[1.3] text-dash-text-faded">Authentication enabled</span>
                  <span className="font-mono text-[13px] leading-[1.4] text-dash-text-strong">{project?.authEnabled ? "Yes" : "No"}</span>
                </div>
              ) : null}
              {showBuildCacheRow ? (
                <div className="flex items-center justify-between border-b-[0.5px] border-dash-border p-3.5">
                  <span className="text-sm font-light leading-[1.3] text-dash-text-faded">Build cache enabled</span>
                  <span className="font-mono text-[13px] leading-[1.4] text-dash-text-strong">{project?.buildCacheEnabled ? "Yes" : "No"}</span>
                </div>
              ) : null}
              {showComputeSizeRow ? (
                <div className="flex items-center justify-between border-b-[0.5px] border-dash-border p-3.5">
                  <div className="flex items-center gap-2">
                    <img src="/icons/cpu.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />
                    <span className="text-sm font-light leading-[1.3] text-dash-text-faded">Compute size</span>
                  </div>
                  <span className="font-mono text-[13px] leading-[1.4] text-dash-text-strong">{computeSizeText}</span>
                </div>
              ) : null}
              {isDatabaseProject ? (
                <div className="flex items-center justify-between border-b-[0.5px] border-dash-border p-3.5">
                  <div className="flex items-center gap-2">
                    <img src="/icons/info.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />
                    <span className="text-sm font-light leading-[1.3] text-dash-text-faded">Public access</span>
                  </div>
                  <span className="font-mono text-[13px] leading-[1.4] text-dash-text-strong">{publicAccessText}</span>
                </div>
              ) : null}
              {showFrameworkRow ? (
                <div
                  className={`flex items-center justify-between p-3.5 ${!isDatabaseProject ? "border-b-[0.5px] border-dash-border" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={isDatabaseProject ? "/icons/container.svg" : "/icons/box.svg"}
                      alt=""
                      aria-hidden="true"
                      className="size-4 invert dark:invert-0"
                    />
                    <span className="text-sm font-light leading-[1.3] text-dash-text-faded">
                      {isDatabaseProject ? "Image" : "Framework"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] leading-[1.4] text-dash-text-strong">{frameworkLabel}</span>
                    {frameworkLogo ? (
                      frameworkLogo.trim().startsWith("<svg") || frameworkLogo.includes("<svg") ? (
                        <div
                          className="flex size-5 items-center justify-center [&>svg]:size-5"
                          dangerouslySetInnerHTML={{ __html: frameworkLogo }}
                        />
                      ) : (
                        <img src={frameworkLogo} alt={frameworkLabel} className="size-5" />
                      )
                    ) : null}
                  </div>
                </div>
              ) : null}
              {!isDatabaseProject ? (
                <div className="flex items-center justify-between p-3.5">
                  <div className="flex items-center gap-2">
                    <img src="/icons/git-circle.svg" alt="" aria-hidden="true" className="size-4" />
                    <span className="text-sm font-light leading-5 tracking-[-0.02px] text-dash-text-faded">Repository</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {repositoryHref ? (
                      <a href={repositoryHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                        <span className="font-mono text-sm leading-5 text-dash-text-strong">
                          From <span className="underline">{repoName}</span>
                        </span>
                        {isGitlab ? (
                          <div className="flex size-6 items-center justify-center rounded-full border border-[#e24329]/30 bg-gradient-to-b from-[#fca326] to-[#e24329] shadow-[0px_1px_1px_rgba(0,0,0,0.15)]">
                            <img src="/icons/gitlab.svg" alt="GitLab" className="size-3.5" />
                          </div>
                        ) : isBitbucket ? (
                          <div className="flex size-6 items-center justify-center rounded-full border border-[#2684ff]/30 bg-gradient-to-b from-[#2684ff] to-[#0052cc] shadow-[0px_1px_1px_rgba(0,0,0,0.15)]">
                            <img src="/icons/bitbucket.svg" alt="Bitbucket" className="size-3.5 text-white" />
                          </div>
                        ) : (
                          <div className="flex size-6 items-center justify-center rounded-full border border-[#3e3e3e] bg-gradient-to-b from-[#666] to-[#1b1b1b] shadow-[0px_1px_1px_rgba(0,0,0,0.15)]">
                            <svg width="9" height="9" viewBox="0 0 16 16" fill="white">
                              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                            </svg>
                          </div>
                        )}
                      </a>
                    ) : (
                      <>
                        <span className="font-mono text-sm leading-5 text-dash-text-strong">
                          From <span className="underline">{repoName}</span>
                        </span>
                        {isGitlab ? (
                          <div className="flex size-6 items-center justify-center rounded-full border border-[#e24329]/30 bg-gradient-to-b from-[#fca326] to-[#e24329] shadow-[0px_1px_1px_rgba(0,0,0,0.15)]">
                            <img src="/icons/gitlab.svg" alt="GitLab" className="size-3.5" />
                          </div>
                        ) : isBitbucket ? (
                          <div className="flex size-6 items-center justify-center rounded-full border border-[#2684ff]/30 bg-gradient-to-b from-[#2684ff] to-[#0052cc] shadow-[0px_1px_1px_rgba(0,0,0,0.15)]">
                            <img src="/icons/bitbucket.svg" alt="Bitbucket" className="size-3.5 text-white" />
                          </div>
                        ) : (
                          <div className="flex size-6 items-center justify-center rounded-full border border-[#3e3e3e] bg-gradient-to-b from-[#666] to-[#1b1b1b] shadow-[0px_1px_1px_rgba(0,0,0,0.15)]">
                            <svg width="9" height="9" viewBox="0 0 16 16" fill="white">
                              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                            </svg>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {isDatabaseProject ? (
            <DbQuickActionsCard
              hasBackup={Boolean(project?.backupUrl)}
              canRestart={projectStatus === "ACTIVE"}
              restarting={restartingDb}
              onDownloadBackup={handleDownloadBackup}
              onRestart={() => setRestartConfirmOpen(true)}
            />
          ) : null}

          {/* Backups card (database projects) */}
          {isDatabaseProject ? (
            <div className="flex flex-1 flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
              <div className="flex h-10 items-center justify-between border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-3 text-sm tracking-[-0.02px]">
                <span className="text-dash-text-strong">Manage Backups</span>
              </div>
              <div className="flex flex-col divide-y divide-dash-border">
                <div className="flex items-center justify-between px-3.5 py-3.5">
                  <div className="flex items-center gap-2">
                    <img src="/icons/storage.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />
                    <span className="text-sm font-light text-dash-text-faded">Backup size</span>
                  </div>
                  <span className="font-mono text-sm text-dash-text-strong">
                    {project?.backupSize != null ? formatBytes(project.backupSize) : "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3.5 py-3.5">
                  <div className="flex items-center gap-2">
                    <img src="/icons/schedule.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />
                    <span className="text-sm font-light text-dash-text-faded">Backup frequency</span>
                  </div>
                  <span className="font-mono text-sm text-dash-text-strong">Daily</span>
                </div>
                <div className="flex items-center justify-between px-3.5 py-3.5">
                  <div className="flex items-center gap-2">
                    <img src="/icons/download.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />
                    <span className="text-sm font-light text-dash-text-faded">Download backup</span>
                  </div>
                  {project?.backupUrl ? (
                    <a
                      href={project.backupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={`${projectName}-${Date.now().toString(36)}-backup.zip`}
                      className="font-mono text-sm text-[#4879f8] underline transition-colors hover:text-[#3a63d6]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Download Now
                    </a>
                  ) : (
                    <span className="font-mono text-sm text-dash-text-extra-faded">No backup available</span>
                  )}
                </div>
                <div className="flex items-center justify-between px-3.5 py-3.5">
                  <div className="flex items-center gap-2">
                    <img src="/icons/clock.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />
                    <span className="text-sm font-light text-dash-text-faded">Last backup</span>
                  </div>
                  <span className="font-mono text-sm text-dash-text-strong">
                    {project?.lastBackup ? formatRelativeTime(project.lastBackup) : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {isDatabaseProject ? <div className="hidden lg:block" /> : null}
          {isDatabaseProject ? <RegionMap regionText={regionText} /> : null}

          {/* Deployments card */}
          {!isDatabaseProject ? (
            <div className="flex flex-1 flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
              <div className="flex h-10 items-center justify-between border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-3 text-sm tracking-[-0.02px]">
                <span className="text-dash-text-strong">Deployments</span>
                <button
                  onClick={() =>
                    navigate({
                      to: `/projects/$projectId/deployment-history`,
                      params: { projectId },
                    })
                  }
                  className="text-dash-text-faded transition-colors hover:text-dash-text-strong"
                >
                  See all
                </button>
              </div>
              <div className="flex flex-col">
                {deploymentRows.length > 0 ? (
                  deploymentRows.map((dep, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const deployment = recentDeployments?.[i];
                        if (deployment) openDeploymentDrawer(deployment);
                      }}
                      className="relative cursor-pointer px-3.5 pb-3.5 pt-3 text-left transition-colors hover:bg-dash-bg-elevated"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative flex h-full w-[17px] shrink-0 items-center">
                          {i > 0 && <div className="absolute -top-3 left-[7.5px] h-3 w-px bg-dash-border" />}
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                            <circle cx="8" cy="8" r="2" stroke="#353535" strokeWidth="1.5" fill="none" />
                            <path d="M10 8h4" stroke="#353535" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M2 8h4" stroke="#353535" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                          {i < deploymentRows.length - 1 && <div className="absolute -bottom-3.5 left-[7.5px] h-3.5 w-px bg-dash-border" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-mono text-[13px] leading-[1.4] text-dash-text-strong">{dep.url}</span>
                          <span className="text-sm font-light leading-[1.4] tracking-[-0.28px] text-dash-text-faded">{dep.date}</span>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3.5 py-4 text-sm font-light text-dash-text-faded">No deployments available yet.</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {!isDatabaseProject ? (
        <>
          {/* Project domains section */}
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium leading-5 tracking-[-0.03px] text-dash-text-body dark:text-dash-text-strong">
                Project domains
              </h2>
              <p className="max-w-[560px] text-sm font-light leading-[1.3] text-dash-text-faded">
                Manage all your domains on this project. You get a default ".brimble.app" domain with each project you deploy.
              </p>
            </div>
            <hr className="border-dash-border" />
          </div>

          {/* Domain rows */}
          <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
            <table className="w-full border-collapse">
              <tbody>
                {domainRows.length > 0 ? (
                  domainRows.map((domain, i) => (
                    <tr key={i} className="h-[68px] border-b-[0.5px] border-dash-border bg-white last:border-b-0 dark:bg-dash-bg">
                      <td className="w-[40%] truncate px-3.5">
                        <a
                          href={`https://${domain.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group/link inline-flex items-center gap-1 font-mono text-[13px] leading-5 text-dash-text-strong transition-colors hover:text-dash-text-body"
                        >
                          <span className="group-hover/link:underline">{domain.url}</span>
                          <ArrowUpRight className="size-3 -translate-x-1 translate-y-0.5 opacity-0 transition-all duration-200 ease-out group-hover/link:translate-x-0 group-hover/link:translate-y-0 group-hover/link:opacity-100" />
                        </a>
                      </td>
                      <td className="w-[100px] px-3.5">
                        <SimpleTooltip
                          content={domain.type === "default domain" ? "Default Brimble domain" : "Custom domain added by you"}
                          side="top"
                          sideOffset={4}
                          delayDuration={150}
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`size-[6px] rounded-full ${domain.type === "default domain" ? "bg-[#e87b35]" : "bg-dash-text-strong"}`}
                            />
                            <span className="text-sm font-light text-dash-text-faded">
                              {domain.type === "default domain" ? "Default" : "Custom"}
                            </span>
                          </span>
                        </SimpleTooltip>
                      </td>
                      <td className="px-3.5 text-right">
                        <span className="text-sm text-dash-text-strong">{domain.team}</span>
                        <br />
                        <span className="text-sm font-light text-dash-text-faded">{domain.date}</span>
                      </td>
                      <td className="w-[50px] pr-3.5 text-right">
                        <SimpleTooltip content={copiedIdx === i ? "Copied!" : "Copy domain"} side="top" sideOffset={4} delayDuration={150}>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(domain.url);
                              haptics.light();
                              setCopiedIdx(i);
                              setTimeout(() => setCopiedIdx(null), 2000);
                            }}
                            className="inline-flex size-[34px] items-center justify-center rounded-[4px] border border-dash-border transition-colors hover:bg-dash-bg-elevated"
                          >
                            {copiedIdx === i ? (
                              <Check className="size-4 text-[#13d282]" />
                            ) : (
                              <Copy className="size-4 text-dash-text-extra-faded" />
                            )}
                          </button>
                        </SimpleTooltip>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="h-[68px] border-b-0 bg-white dark:bg-dash-bg">
                    <td colSpan={4} className="px-3.5 text-sm font-light text-dash-text-faded">
                      No domains attached to this project yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {isDatabaseProject ? (
        <WarningModal
          open={restartConfirmOpen}
          onOpenChange={setRestartConfirmOpen}
          title="Restart this database?"
          description={`${projectName} will be unavailable for a few moments while it restarts. Active connections will be dropped.`}
          confirmLabel="Restart database"
          cancelLabel="Cancel"
          confirmLoadingLabel="Restarting..."
          onConfirm={async () => {
            await handleRestartDb();
          }}
        />
      ) : null}
    </div>
  );
}
