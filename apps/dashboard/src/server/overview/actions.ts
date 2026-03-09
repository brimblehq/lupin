import { createServerFn } from "@tanstack/react-start";
import type { OverviewSummary } from "@/backend/overview";
import { withTokenRefresh } from "@/server/shared/backend";

export const getHomeOverviewServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as unknown as {
    workspace?: string;
    environmentId?: string;
  } | undefined;
  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  const environmentId = payload?.environmentId?.trim();

  return withTokenRefresh(async (api) => {
    let teamId: string | undefined;

    if (workspaceSlug) {
      const teams = await api.workspaces.list();
      const match = teams.items.find((item) => item.slug === workspaceSlug);
      if (match?.id) {
        teamId = match.id;
      }
    }

    return api.overview.get({
      teamId,
      environmentId: environmentId || undefined,
      useEnvironmentHeader: Boolean(environmentId),
    }) as Promise<OverviewSummary>;
  });
});
