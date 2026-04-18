import { createServerFn } from "@tanstack/react-start";
import { withTokenRefresh } from "@/server/shared/backend";

export const getProjectObservabilityMetricsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        workspace?: string;
        hrsAgo?: number;
        container?: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  return withTokenRefresh(async (api) => {
    const workspaceSlug = payload?.workspace?.trim().toLowerCase();
    let teamId: string | undefined;

    if (workspaceSlug) {
      const teams = await api.workspaces.list();
      const match = teams.items.find((item) => item.slug === workspaceSlug);
      if (match?.id) {
        teamId = match.id;
      }
    }

    return api.observability.getProjectMetrics({
      projectId,
      teamId,
      hrsAgo: payload?.hrsAgo,
      container: payload?.container,
    });
  });
});
