import { createFileRoute } from "@tanstack/react-router";
import { WelcomeSection } from "../components/overview/welcome-section";
import { StatsRow } from "../components/overview/stats-row";
import { DeployedProjects } from "../components/overview/deployed-projects";
import { ConnectedDomains } from "../components/overview/connected-domains";
import { FeaturedIntegrations } from "../components/overview/featured-integrations";
import { listHomeProjectsServerFn } from "@/server/projects/actions";
import { getHomeOverviewServerFn } from "@/server/overview/actions";
import { getHomeBandwidthServerFn } from "@/server/bandwidth/actions";
import { listMcpTemplatesServerFn } from "@/server/mcp/actions";
import type { ApiListResponse } from "@/backend";
import type { Project as BackendProject } from "@/backend/projects";
import type { OverviewSummary } from "@/backend/overview";
import type { BandwidthSummary } from "@/backend/bandwidth";
import type { McpServerListResult } from "@/backend/mcp";
import type { SettingsSidebarSnapshot } from "@/backend/settings";
import type { PaymentMethod } from "@/backend/payments";
import type { Project as ProjectCardProject } from "../components/shared/project-card";
import { formatRelativeTime } from "@/utils/dashboard";
import { mapMcpTemplateToAddon } from "@/utils/discover-mcp";
import { workspaceLoaderDeps } from "@/utils/workspace-route-search";
import { getRouteApi } from "@tanstack/react-router";

const rootRoute = getRouteApi("__root__");

export const Route = createFileRoute("/")({
  staleTime: 30_000,
  preloadStaleTime: 30_000,
  validateSearch: (search: Record<string, unknown>) => workspaceLoaderDeps(search),
  loaderDeps: ({ search }) => workspaceLoaderDeps(search),
  loader: async ({ deps }) => {
    const workspace = deps.workspace;

    const [projectsResult, overviewResult, bandwidthResult, mcpTemplatesResult] = await Promise.all([
      (listHomeProjectsServerFn as unknown as (input: {
        data: { workspace?: string };
      }) => Promise<ApiListResponse<BackendProject>>)({
        data: { workspace },
      }),
      (getHomeOverviewServerFn as unknown as (input: {
        data: { workspace?: string };
      }) => Promise<OverviewSummary>)({
        data: { workspace },
      }),
      (getHomeBandwidthServerFn as unknown as (input: {
        data: { workspace?: string };
      }) => Promise<BandwidthSummary>)({
        data: { workspace },
      }).catch(() => ({ results: [], total: 0 } as BandwidthSummary)),
      (listMcpTemplatesServerFn as unknown as (input: {
        data?: { limit?: number };
      }) => Promise<McpServerListResult>)({
        data: { limit: 3 },
      }).catch(() => ({ servers: [], pagination: {} } as McpServerListResult)),
    ]);

    return {
      projects: projectsResult.items,
      overview: overviewResult,
      bandwidth: bandwidthResult,
      featuredAddons: mcpTemplatesResult.servers.slice(0, 3).map(mapMcpTemplateToAddon),
      workspace,
    };
  },
  component: DashboardHome,
});

function DashboardHome() {
  const search = Route.useSearch();
  const { projects, overview, bandwidth, featuredAddons, workspace } = Route.useLoaderData();
  const { settingsSnapshot, workspaces, paymentMethods: initialPaymentMethods } = rootRoute.useLoaderData() as {
    settingsSnapshot: SettingsSidebarSnapshot | null;
    workspaces: { items: Array<{ slug?: string }> };
    paymentMethods: PaymentMethod[] | null;
  };
  const planType = settingsSnapshot?.profile?.subscription?.planType;
  const workspaceSlug = search.workspace?.trim().toLowerCase();
  const loaderWorkspaceSlug = workspace?.trim().toLowerCase();
  const isWorkspaceSwitching = workspaceSlug !== (loaderWorkspaceSlug || undefined);
  const isTeamWorkspace = Boolean(
    workspaceSlug && workspaces?.items?.some((item) => item.slug === workspaceSlug),
  );
  const visibleProjects = isWorkspaceSwitching ? [] : projects;
  const visibleOverview = isWorkspaceSwitching ? null : overview;
  const visibleBandwidth = isWorkspaceSwitching ? null : bandwidth;

  const deployedProjects: ProjectCardProject[] = visibleProjects.slice(0, 4).map((project) => ({
    name: project.name,
    slug: project.slug || project.name,
    id: project.id,
    status: project.status,
    commitMessage: project.log?.message || "No recent activity",
    branch: project.repo?.branch || "main",
    updatedAt: formatRelativeTime(project.updatedAt),
    tags: project.tags,
  }));

  return (
    <div className="max-w-[1000px]">
      <WelcomeSection />
      <StatsRow
        overview={visibleOverview}
        bandwidth={visibleBandwidth}
        planType={planType}
        isTeamWorkspace={isTeamWorkspace}
        initialPaymentMethods={initialPaymentMethods}
      />
      <hr className="-mx-4 mb-10 border-dash-border-soft md:-ml-10 md:mr-0" />
      <DeployedProjects
        projects={deployedProjects}
        totalProjects={visibleOverview?.total?.project ?? visibleProjects.length}
        isTeamWorkspace={isTeamWorkspace}
      />
      <hr className="-mx-4 mb-10 border-dash-border-soft md:-ml-10 md:mr-0" />
      <ConnectedDomains activeDomains={overview?.total?.domain ?? 0} />
      <hr className="-mx-4 mb-10 border-dash-border-soft md:-ml-10 md:mr-0" />
      <FeaturedIntegrations addons={featuredAddons} workspace={workspace} />
    </div>
  );
}
