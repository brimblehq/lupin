import { createServerFn } from "@tanstack/react-start";
import { createBackendApi } from "@/backend";
import type { AppTooltipMessage } from "@/backend/messages";
import config from "@/config";
import { getServerAccessToken } from "@/server/auth/cookies";

function getServerBackendApi() {
  return createBackendApi({
    baseUrl: config.apiUrl,
    getAccessToken: getServerAccessToken,
  });
}

export const listTooltipMessagesServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        type?: "notifications";
        limit?: number;
        page?: number;
      }
    | undefined;

  const backend = getServerBackendApi();
  const workspaceSlug = payload?.workspace?.trim().toLowerCase();

  let subscriptionId: string | undefined;

  if (workspaceSlug) {
    try {
      const team = await backend.teams.getByName(workspaceSlug);
      subscriptionId = team.subscriptionId?.trim() || undefined;
    } catch {
      subscriptionId = undefined;
    }
  }

  if (!subscriptionId) {
    const profile = await backend.settings.getProfile();
    subscriptionId = profile.subscription?.id?.trim() || undefined;
  }

  if (!subscriptionId) {
    return null as AppTooltipMessage[] | null;
  }

  return backend.messages.listTooltipMessages({
    subscriptionId,
    type: payload?.type,
    limit: payload?.limit,
    page: payload?.page,
  }) as Promise<AppTooltipMessage[] | null>;
});

