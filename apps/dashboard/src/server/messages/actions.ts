import { createServerFn } from "@tanstack/react-start";
import type { AppTooltipMessage } from "@/backend/messages";
import { withTokenRefresh } from "@/server/shared/backend";

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

  return withTokenRefresh(async (api) => {
    const workspaceSlug = payload?.workspace?.trim().toLowerCase();

    let subscriptionId: string | undefined;

    if (workspaceSlug) {
      try {
        const team = await api.teams.getByName(workspaceSlug);
        subscriptionId = team.subscriptionId?.trim() || undefined;
      } catch {
        subscriptionId = undefined;
      }
    }

    if (!subscriptionId) {
      const profile = await api.settings.getProfile();
      subscriptionId = profile.subscription?.id?.trim() || undefined;
    }

    return api.messages.listTooltipMessages({
      subscriptionId,
      type: payload?.type,
      limit: payload?.limit,
      page: payload?.page,
    }) as Promise<AppTooltipMessage[] | null>;
  });
});
