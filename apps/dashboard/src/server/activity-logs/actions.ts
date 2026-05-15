import { createServerFn } from "@tanstack/react-start";
import type { ActivityLogsResponse } from "@/backend/activity-logs";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";

export const listActivityLogsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        page?: number;
        limit?: number;
        action?: string;
        context?: string;
      }
    | undefined;

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, payload?.workspace);

    return api.activityLogs.list({
      teamId,
      page: payload?.page,
      limit: payload?.limit,
      action: payload?.action,
      context: payload?.context,
    });
  });
});

export type { ActivityLogsResponse };
