import { createServerFn } from "@tanstack/react-start";
import type { BandwidthSummary } from "@/backend/bandwidth";
import { withTokenRefresh } from "@/server/shared/backend";

export const getHomeBandwidthServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; environmentId?: string } | undefined;
  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  const environmentId = payload?.environmentId?.trim();

  return withTokenRefresh(async (api) => {
    let teamId: string | undefined;

    if (workspaceSlug) {
      const workspaces = await api.workspaces.list();
      const match = workspaces.items.find((item) => item.slug === workspaceSlug);
      if (match?.id) {
        teamId = match.id;
      }
    }

    return api.bandwidth.get({ teamId, environmentId: environmentId || undefined }) as Promise<BandwidthSummary>;
  });
});

