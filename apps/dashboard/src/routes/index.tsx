import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { WelcomeSection } from "../components/overview/welcome-section";
import { StatsRow } from "../components/overview/stats-row";
import { DeployedProjects } from "../components/overview/deployed-projects";
import { ConnectedDomains } from "../components/overview/connected-domains";
import { FeaturedIntegrations } from "../components/overview/featured-integrations";
import { TeamInviteModal } from "../components/shared/team-invite-modal";
import { OwnershipTransferModal } from "../components/shared/ownership-transfer-modal";
import { listHomeProjectsServerFn } from "@/server/projects/actions";
import { listFrameworksServerFn } from "@/server/frameworks/actions";
import type { FrameworkOption } from "@/backend/frameworks";
import { getHomeOverviewServerFn } from "@/server/overview/actions";
import { getHomeBandwidthServerFn } from "@/server/bandwidth/actions";
import { listRecommendedMcpTemplatesServerFn } from "@/server/mcp/actions";
import {
  checkTeamInvitationServerFn,
  acceptTeamInvitationServerFn,
  declineTeamInvitationServerFn,
  acceptOwnershipTransferServerFn,
  denyOwnershipTransferServerFn,
} from "@/server/teams/actions";
import { getActiveEnvironmentPreferenceServerFn, listProjectEnvironmentsServerFn } from "@/server/environments/actions";
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
import { resolveEnvironmentId } from "@/utils/environment-selection";
import { workspaceLoaderDeps } from "@/utils/workspace-route-search";
import { getRouteApi } from "@tanstack/react-router";

const rootRoute = getRouteApi("__root__");

export const Route = createFileRoute("/")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  validateSearch: (search: Record<string, unknown>): { workspace?: string; environmentId?: string; transferOwnership?: "1" } => {
    const base = workspaceLoaderDeps(search);
    const environmentId = typeof search.environmentId === "string" ? search.environmentId.trim() || undefined : undefined;
    const transferOwnership = search.transferOwnership === "1" ? "1" : undefined;
    return { ...base, environmentId, transferOwnership };
  },
  loaderDeps: ({ search }) => ({
    workspace: search.workspace,
    environmentId: search.environmentId,
    transferOwnership: search.transferOwnership,
  }),
  loader: async ({ deps }) => {
    const workspace = deps.workspace;
    const [environments, persistedEnvironmentId, mcpTemplatesResult, frameworksList] = await Promise.all([
      (listProjectEnvironmentsServerFn as unknown as (input: {
        data?: { workspace?: string };
      }) => Promise<Array<{ _id: string; isDefault?: boolean }>>)({
        data: { workspace },
      }).catch(() => []),
      (getActiveEnvironmentPreferenceServerFn as unknown as (input: { data?: { workspace?: string } }) => Promise<string | null>)({
        data: { workspace },
      }).catch(() => null),
      (listRecommendedMcpTemplatesServerFn as unknown as (input: {
        data?: { limit?: number; category?: string; officialOnly?: boolean; shuffle?: boolean };
      }) => Promise<McpServerListResult>)({
        data: { limit: 3, category: "development", officialOnly: true, shuffle: true },
      }).catch(() => ({ servers: [], pagination: {} }) as McpServerListResult),
      (listFrameworksServerFn as unknown as () => Promise<FrameworkOption[]>)().catch(() => [] as FrameworkOption[]),
    ]);
    const environmentId = resolveEnvironmentId({
      requestedEnvironmentId: deps.environmentId,
      preferredEnvironmentId: persistedEnvironmentId,
      environments,
    });

    const [projectsResult, overviewResult, bandwidthResult] = await Promise.all([
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
      }).catch(() => ({ results: [], total: 0 }) as BandwidthSummary),
    ]);

    const frameworkLogoMap = new Map<string, string>();
    for (const fw of frameworksList) {
      if (fw.slug && fw.logo) frameworkLogoMap.set(fw.slug.toLowerCase(), fw.logo);
    }

    return {
      projects: projectsResult.items,
      overview: overviewResult,
      bandwidth: bandwidthResult,
      featuredAddons: mcpTemplatesResult.servers.slice(0, 3).map(mapMcpTemplateToAddon),
      frameworkLogos: Object.fromEntries(frameworkLogoMap),
      workspace,
    };
  },
  component: DashboardHome,
});

function DashboardHome() {
  const search = Route.useSearch();
  const { projects, overview, bandwidth, featuredAddons, frameworkLogos, workspace } = Route.useLoaderData();
  const {
    settingsSnapshot,
    workspaces,
    paymentMethods: initialPaymentMethods,
    workspaceTeamMembers,
    userOverview,
  } = (rootRoute.useLoaderData() ?? {}) as {
    settingsSnapshot: SettingsSidebarSnapshot | null;
    workspaces: { items: Array<Workspace> };
    paymentMethods: PaymentMethod[] | null;
    workspaceTeamMembers: TeamDetails | null;
    userOverview: import("@/backend/user-overview").UserOverview | null;
  };
  const router = useRouter();
  const navigate = useNavigate();
  const [inviteModalOpen, setInviteModalOpen] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLoadingAction, setInviteLoadingAction] = useState<"accept" | "decline">();
  const [invitationData, setInvitationData] = useState<TeamInvitation | null>(null);
  const [ownershipTransferOpen, setOwnershipTransferOpen] = useState(search.transferOwnership === "1");
  const [ownershipTransferLoading, setOwnershipTransferLoading] = useState(false);
  const [ownershipTransferLoadingAction, setOwnershipTransferLoadingAction] = useState<"accept" | "deny" | undefined>(undefined);
  const planType = settingsSnapshot?.profile?.subscription?.planType;
  const workspaceSlug = search.workspace?.trim().toLowerCase();
  const loaderWorkspaceSlug = workspace?.trim().toLowerCase();
  const isWorkspaceSwitching = workspaceSlug !== (loaderWorkspaceSlug || undefined);
  const isTeamWorkspace = Boolean(workspaceSlug && workspaces?.items?.some((item) => item.slug === workspaceSlug));

  useEffect(() => {
    if (!workspaceSlug || invitationData || isTeamWorkspace) return;
    let cancelled = false;
    (checkTeamInvitationServerFn as unknown as (input: { data: { workspace: string } }) => Promise<TeamInvitation>)({
      data: { workspace: workspaceSlug },
    })
      .then((inv) => {
        if (!cancelled) setInvitationData(inv);
      })
      .catch(() => {
        if (!cancelled && !isTeamWorkspace) navigate({ to: "/", search: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, invitationData, isTeamWorkspace]);

  useEffect(() => {
    setOwnershipTransferOpen(search.transferOwnership === "1");
  }, [search.transferOwnership]);

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
    domain: project.domain || project.previewUrl || project.domains?.[0]?.name,
    framework: project.framework?.toLowerCase(),
    frameworkLogo: project.framework ? (frameworkLogos as Record<string, string>)?.[project.framework.toLowerCase()] : undefined,
    dbImage: project.dbImage,
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
        userOverview={userOverview}
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
              await (acceptTeamInvitationServerFn as unknown as (input: { data: { teamId: string } }) => Promise<unknown>)({
                data: { teamId },
              });
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
              await (declineTeamInvitationServerFn as unknown as (input: { data: { teamId: string } }) => Promise<unknown>)({
                data: { teamId },
              });
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

      {workspaceSlug && (
        <OwnershipTransferModal
          open={ownershipTransferOpen}
          onOpenChange={(open) => {
            setOwnershipTransferOpen(open);
            if (!open) {
              navigate({
                to: "/",
                search: {
                  ...(workspaceSlug ? { workspace: workspaceSlug } : {}),
                  ...(search.environmentId ? { environmentId: search.environmentId } : {}),
                },
              });
            }
          }}
          workspaceName={workspaceTeamMembers?.name ?? workspaceSlug}
          loading={ownershipTransferLoading}
          loadingAction={ownershipTransferLoadingAction}
          onAccept={async () => {
            setOwnershipTransferLoading(true);
            setOwnershipTransferLoadingAction("accept");
            try {
              await (acceptOwnershipTransferServerFn as unknown as (input: { data: { workspace: string } }) => Promise<unknown>)({
                data: { workspace: workspaceSlug },
              });
              toast.success("Ownership transfer accepted.");
              setOwnershipTransferOpen(false);
              await navigate({
                to: "/",
                search: {
                  ...(workspaceSlug ? { workspace: workspaceSlug } : {}),
                  ...(search.environmentId ? { environmentId: search.environmentId } : {}),
                },
              });
              await router.invalidate();
            } catch (err: any) {
              const message = err?.message || "Failed to accept ownership transfer";
              if (/no pending ownership transfer found/i.test(message)) {
                toast.error("This ownership transfer request is no longer actionable.");
                setOwnershipTransferOpen(false);
                await navigate({
                  to: "/",
                  search: {
                    ...(workspaceSlug ? { workspace: workspaceSlug } : {}),
                    ...(search.environmentId ? { environmentId: search.environmentId } : {}),
                  },
                });
              } else {
                toast.error(message);
              }
            } finally {
              setOwnershipTransferLoading(false);
              setOwnershipTransferLoadingAction(undefined);
            }
          }}
          onDeny={async () => {
            setOwnershipTransferLoading(true);
            setOwnershipTransferLoadingAction("deny");
            try {
              await (denyOwnershipTransferServerFn as unknown as (input: { data: { workspace: string } }) => Promise<unknown>)({
                data: { workspace: workspaceSlug },
              });
              toast.success("Ownership transfer denied.");
              setOwnershipTransferOpen(false);
              await navigate({
                to: "/",
                search: {
                  ...(workspaceSlug ? { workspace: workspaceSlug } : {}),
                  ...(search.environmentId ? { environmentId: search.environmentId } : {}),
                },
              });
              await router.invalidate();
            } catch (err: any) {
              const message = err?.message || "Failed to deny ownership transfer";
              if (/no pending ownership transfer found/i.test(message)) {
                toast.error("This ownership transfer request is no longer actionable.");
                setOwnershipTransferOpen(false);
                await navigate({
                  to: "/",
                  search: {
                    ...(workspaceSlug ? { workspace: workspaceSlug } : {}),
                    ...(search.environmentId ? { environmentId: search.environmentId } : {}),
                  },
                });
              } else {
                toast.error(message);
              }
            } finally {
              setOwnershipTransferLoading(false);
              setOwnershipTransferLoadingAction(undefined);
            }
          }}
        />
      )}
    </div>
  );
}
