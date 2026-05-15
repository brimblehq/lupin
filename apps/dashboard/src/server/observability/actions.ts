import { createServerFn } from "@tanstack/react-start";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";

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
    const teamId = await resolveTeamId(api, workspaceSlug);

    return api.observability.getProjectMetrics({
      projectId,
      teamId,
      hrsAgo: payload?.hrsAgo,
      container: payload?.container,
    });
  });
});
