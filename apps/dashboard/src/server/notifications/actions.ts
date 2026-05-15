import { createServerFn } from "@tanstack/react-start";
import type { MarkAllSeenResponse, NotificationListResponse } from "@/backend/notifications";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";

interface ScopeInput {
  workspace?: string;
}

type ListInput = ScopeInput & { page?: number; limit?: number };
type MarkSeenInput = ScopeInput & { notificationId: string };

export const listNotificationsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as ListInput | undefined;
  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, payload?.workspace);
    return api.notifications.list({ teamId, page: payload?.page, limit: payload?.limit });
  });
});

export const markNotificationSeenServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as MarkSeenInput | undefined;
  const notificationId = payload?.notificationId?.trim();
  if (!notificationId) throw new Error("notificationId is required");

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, payload?.workspace);
    await api.notifications.markSeen({ notificationId, teamId });
    return { ok: true } as const;
  });
});

export const markAllNotificationsSeenServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as ScopeInput | undefined;
  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, payload?.workspace);
    return api.notifications.markAllSeen({ teamId });
  });
});

export type { NotificationListResponse, MarkAllSeenResponse };
