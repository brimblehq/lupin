import type { ApiClient } from "./types";

export type NotificationLevel = "info" | "warning" | "error" | "success";

export interface NotificationItem {
  id: string;
  message: string;
  level: NotificationLevel;
  route?: string;
  seen: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  page: number;
  limit: number;
  total: number;
  unseenCount: number;
}

export interface MarkAllSeenResponse {
  modifiedCount: number;
}

export interface ListNotificationsInput {
  teamId?: string;
  page?: number;
  limit?: number;
}

export interface MarkNotificationSeenInput {
  notificationId: string;
  teamId?: string;
}

export interface MarkAllNotificationsSeenInput {
  teamId?: string;
}

export interface NotificationsApi {
  list(input?: ListNotificationsInput): Promise<NotificationListResponse>;
  markSeen(input: MarkNotificationSeenInput): Promise<void>;
  markAllSeen(input?: MarkAllNotificationsSeenInput): Promise<MarkAllSeenResponse>;
}

interface ApiEnvelope<T> {
  data: T;
}

export function createNotificationsApi(client: ApiClient): NotificationsApi {
  return {
    async list(input) {
      const response = await client.request<ApiEnvelope<NotificationListResponse>>("/core/v1/notifications", {
        method: "GET",
        query: {
          teamId: input?.teamId,
          page: input?.page,
          limit: input?.limit,
        },
      });
      return response.data;
    },

    async markSeen(input) {
      await client.request(`/core/v1/notifications/${encodeURIComponent(input.notificationId)}/seen`, {
        method: "PATCH",
        query: { teamId: input.teamId },
      });
    },

    async markAllSeen(input) {
      const response = await client.request<ApiEnvelope<MarkAllSeenResponse>>("/core/v1/notifications/seen-all", {
        method: "PATCH",
        query: { teamId: input?.teamId },
      });
      return response.data;
    },
  };
}
