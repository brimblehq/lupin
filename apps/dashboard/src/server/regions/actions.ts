import { createServerFn } from "@tanstack/react-start";
import { createBackendApi } from "@/backend";
import config from "@/config";
import { getServerAccessToken } from "@/server/auth/cookies";

function getServerBackendApi() {
  return createBackendApi({
    baseUrl: config.apiUrl,
    getAccessToken: getServerAccessToken,
  });
}

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

  const workspaceSlug =
    typeof payload?.workspace === "string"
      ? payload.workspace.trim().toLowerCase()
      : undefined;

  if (!teamId && workspaceSlug) {
    const teams = await getServerBackendApi().workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  return getServerBackendApi().regions.list({
    type: payload?.type,
    enabled: payload?.enabled,
    teamId,
  });
});
