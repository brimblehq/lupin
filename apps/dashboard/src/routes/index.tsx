import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { WelcomeSection } from "../components/overview/welcome-section";
import { StatsRow } from "../components/overview/stats-row";
import { DeployedProjects } from "../components/overview/deployed-projects";
import { ConnectedDomains } from "../components/overview/connected-domains";
import { FeaturedIntegrations } from "../components/overview/featured-integrations";
import { TeamInviteModal } from "../components/shared/team-invite-modal";
import { listHomeProjectsServerFn } from "@/server/projects/actions";
import { getHomeOverviewServerFn } from "@/server/overview/actions";
import { getHomeBandwidthServerFn } from "@/server/bandwidth/actions";
import { listMcpTemplatesServerFn } from "@/server/mcp/actions";
import { checkTeamInvitationServerFn, acceptTeamInvitationServerFn, declineTeamInvitationServerFn } from "@/server/teams/actions";
import type { ApiListResponse } from "@/backend";
import type { Project as BackendProject } from "@/backend/projects";
import type { OverviewSummary } from "@/backend/overview";
import type { BandwidthSummary } from "@/backend/bandwidth";
import type { McpServerListResult } from "@/backend/mcp";
import type { SettingsSidebarSnapshot } from "@/backend/settings";
import type { PaymentMethod } from "@/backend/payments";
import type { TeamDetails, TeamInvitation } from "@/backend/teams";
import type { Workspace } from "@/backend/workspaces";
import type { Project as ProjectCardProject } from "../components/shared/project-card";
import { formatRelativeTime } from "@/utils/dashboard";
import { mapMcpTemplateToAddon } from "@/utils/discover-mcp";
import { workspaceLoaderDeps } from "@/utils/workspace-route-search";
import { getRouteApi } from "@tanstack/react-router";

const rootRoute = getRouteApi("__root__");

export const Route = createFileRoute("/")({
  staleTime: 30_000,
  preloadStaleTime: 30_000,
  validateSearch: (search: Record<string, unknown>): { workspace?: string; environmentId?: string } => {
    const base = workspaceLoaderDeps(search);
    const environmentId = typeof search.environmentId === "string" ? search.environmentId.trim() || undefined : undefined;
    return { ...base, environmentId };
  },
  loaderDeps: ({ search }) => ({
    workspace: search.workspace,
    environmentId: search.environmentId,
  }),
  loader: async ({ deps }) => {
    const workspace = deps.workspace;
    const environmentId = deps.environmentId && deps.environmentId !== "all" ? deps.environmentId : undefined;

    const [projectsResult, overviewResult, bandwidthResult, mcpTemplatesResult] = await Promise.all([
      (listHomeProjectsServerFn as unknown as (input: {
        data: { workspace?: string; environmentId?: string };
      }) => Promise<ApiListResponse<BackendProject>>)({
        data: { workspace, environmentId },
      }),
      (getHomeOverviewServerFn as unknown as (input: {
        data: { workspace?: string; environmentId?: string };
      }) => Promise<OverviewSummary>)({
        data: { workspace, environmentId },
      }),
      (getHomeBandwidthServerFn as unknown as (input: {
        data: { workspace?: string; environmentId?: string };
      }) => Promise<BandwidthSummary>)({
        data: { workspace, environmentId },
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
  const { settingsSnapshot, workspaces, paymentMethods: initialPaymentMethods, workspaceTeamMembers } = (rootRoute.useLoaderData() ?? {}) as {
    settingsSnapshot: SettingsSidebarSnapshot | null;
    workspaces: { items: Array<Workspace> };
    paymentMethods: PaymentMethod[] | null;
    workspaceTeamMembers: TeamDetails | null;
  };
  const router = useRouter();
  const navigate = useNavigate();
  const [inviteModalOpen, setInviteModalOpen] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLoadingAction, setInviteLoadingAction] = useState<"accept" | "decline">();
  const [invitationData, setInvitationData] = useState<TeamInvitation | null>(null);
  const planType = settingsSnapshot?.profile?.subscription?.planType;
  const workspaceSlug = search.workspace?.trim().toLowerCase();
  const loaderWorkspaceSlug = workspace?.trim().toLowerCase();
  const isWorkspaceSwitching = workspaceSlug !== (loaderWorkspaceSlug || undefined);
  const isTeamWorkspace = Boolean(
    workspaceSlug && workspaces?.items?.some((item) => item.slug === workspaceSlug),
  );

  useEffect(() => {
    if (!workspaceSlug || invitationData || isTeamWorkspace) return;
    let cancelled = false;
    (checkTeamInvitationServerFn as unknown as (input: {
      data: { workspace: string };
    }) => Promise<TeamInvitation>)({ data: { workspace: workspaceSlug } })
      .then((inv) => { if (!cancelled) setInvitationData(inv); })
      .catch(() => { if (!cancelled && !isTeamWorkspace) navigate({ to: "/", search: {} }); });
    return () => { cancelled = true; };
  }, [workspaceSlug, invitationData, isTeamWorkspace]);

  const visibleProjects = isWorkspaceSwitching ? [] : projects;
  const visibleOverview = isWorkspaceSwitching ? null : overview;
  const visibleBandwidth = isWorkspaceSwitching ? null : bandwidth;

  const deployedProjects: ProjectCardProject[] = visibleProjects.slice(0, 4).map((project) => ({
    name: project.name,
    slug: project.slug || project.name,
    id: project.id,
    status: project.status,
    serviceType: project.serviceType,
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

      {invitationData && (
        <TeamInviteModal
          open={inviteModalOpen}
          onOpenChange={(open) => {
            setInviteModalOpen(open);
            if (!open) navigate({ to: "/", search: {} });
          }}
          firstName={settingsSnapshot?.profile?.firstName ?? "there"}
          userAvatarUrl={settingsSnapshot?.profile?.avatarUrl}
          workspaceName={invitationData.team.name ?? workspaceSlug ?? "the team"}
          workspaceAvatarUrl={invitationData.team.avatar ?? workspaceTeamMembers?.avatarUrl}
          loading={inviteLoading}
          loadingAction={inviteLoadingAction}
          onAccept={async () => {
            const teamId = invitationData?.team.id;
            if (!teamId) return;
            setInviteLoading(true);
            setInviteLoadingAction("accept");
            try {
              await (acceptTeamInvitationServerFn as unknown as (input: {
                data: { teamId: string };
              }) => Promise<unknown>)({ data: { teamId } });
              toast.success("Invitation accepted! Welcome to the team.");
              setInviteModalOpen(false);
              await router.invalidate();
            } catch (err: any) {
              toast.error(err?.message || "Failed to accept invitation");
            } finally {
              setInviteLoading(false);
              setInviteLoadingAction(undefined);
            }
          }}
          onDecline={async () => {
            const teamId = invitationData?.team.id;
            if (!teamId) return;
            setInviteLoading(true);
            setInviteLoadingAction("decline");
            try {
              await (declineTeamInvitationServerFn as unknown as (input: {
                data: { teamId: string };
              }) => Promise<unknown>)({ data: { teamId } });
              toast.success("Invitation declined");
              setInviteModalOpen(false);
              await navigate({ to: "/" });
            } catch (err: any) {
              toast.error(err?.message || "Failed to decline invitation");
            } finally {
              setInviteLoading(false);
              setInviteLoadingAction(undefined);
            }
          }}
        />
      )}
    </div>
  );
}
