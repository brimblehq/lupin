import { createServerFn } from "@tanstack/react-start";
import { createBackendApi } from "@/backend";
import type { BandwidthSummary } from "@/backend/bandwidth";
import config from "@/config";
import { getServerAccessToken } from "@/server/auth/cookies";

function getServerBackendApi() {
  return createBackendApi({
    baseUrl: config.apiUrl,
    getAccessToken: getServerAccessToken,
  });
}

export const getHomeBandwidthServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string } | undefined;
  const workspaceSlug = payload?.workspace?.trim().toLowerCase();

  let teamId: string | undefined;

  if (workspaceSlug) {
    const workspaces = await getServerBackendApi().workspaces.list();
    const match = workspaces.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  return getServerBackendApi().bandwidth.get({ teamId }) as Promise<BandwidthSummary>;
});

