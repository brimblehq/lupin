import { createServerFn } from "@tanstack/react-start";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";

export const listRegionsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        type?: "web" | "database";
        enabled?: boolean;
        teamId?: string;
        workspace?: string;
      }
    | undefined;

  let teamId = payload?.teamId;

  const workspaceSlug = typeof payload?.workspace === "string" ? payload.workspace.trim().toLowerCase() : undefined;

  return withTokenRefresh(async (api) => {
    if (!teamId && workspaceSlug) {
      teamId = await resolveTeamId(api, workspaceSlug);
    }

    return api.regions.list({
      type: payload?.type,
      enabled: payload?.enabled,
      teamId,
    });
  });
});
