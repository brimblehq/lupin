import { createServerFn } from "@tanstack/react-start";
import type { BandwidthSummary } from "@/backend/bandwidth";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";

export const getHomeBandwidthServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; environmentId?: string } | undefined;
  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  const environmentId = payload?.environmentId?.trim();

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);
    return api.bandwidth.get({ teamId, environmentId: environmentId || undefined }) as Promise<BandwidthSummary>;
  });
});
