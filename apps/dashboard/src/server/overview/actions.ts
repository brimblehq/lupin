import { createServerFn } from "@tanstack/react-start";
import type { OverviewSummary } from "@/backend/overview";
import type { UserOverview } from "@/backend/user-overview";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";

export const getHomeOverviewServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as unknown as
    | {
        workspace?: string;
        environmentId?: string;
      }
    | undefined;
  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  const environmentId = payload?.environmentId?.trim();

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    return api.overview.get({
      teamId,
      environmentId: environmentId || undefined,
      useEnvironmentHeader: Boolean(environmentId),
    }) as Promise<OverviewSummary>;
  });
});

export const getUserOverviewServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { teamId?: string } | undefined;
  const teamId = payload?.teamId?.trim() || undefined;

  return withTokenRefresh(async (api) => {
    return api.userOverview.get({ teamId }) as Promise<UserOverview>;
  });
});
