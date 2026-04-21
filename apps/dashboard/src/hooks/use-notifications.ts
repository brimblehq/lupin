import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listNotificationsServerFn,
  markAllNotificationsSeenServerFn,
  markNotificationSeenServerFn,
} from "@/server/notifications/actions";
import type { MarkAllSeenResponse, NotificationListResponse } from "@/backend/notifications";
import { hapticToast as toast } from "@/utils/haptic-toast";

const BADGE_POLL_INTERVAL_MS = 10_000;
const PERSONAL_SCOPE = "__personal__";

const listFn = listNotificationsServerFn as unknown as (args: {
  data: { workspace?: string; page?: number; limit?: number };
}) => Promise<NotificationListResponse>;

const markSeenFn = markNotificationSeenServerFn as unknown as (args: {
  data: { workspace?: string; notificationId: string };
}) => Promise<{ ok: true }>;

const markAllSeenFn = markAllNotificationsSeenServerFn as unknown as (args: {
  data: { workspace?: string };
}) => Promise<MarkAllSeenResponse>;

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (scope: string, page: number, limit: number) => [...notificationKeys.all, "list", scope, page, limit] as const,
};

function scopeKey(workspace: string | undefined) {
  return workspace?.trim().toLowerCase() || PERSONAL_SCOPE;
}

export function useNotifications({
  workspace,
  page = 1,
  limit = 20,
}: { workspace?: string; page?: number; limit?: number } = {}) {
  return useQuery<NotificationListResponse>({
    queryKey: notificationKeys.list(scopeKey(workspace), page, limit),
    queryFn: () => listFn({ data: { workspace, page, limit } }),
    refetchInterval: BADGE_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

function updateListSnapshot(
  prev: NotificationListResponse | undefined,
  update: (snapshot: NotificationListResponse) => NotificationListResponse,
): NotificationListResponse | undefined {
  if (!prev) return prev;
  return update(prev);
}

export function useMarkNotificationSeen(workspace?: string) {
  const qc = useQueryClient();
  const scope = scopeKey(workspace);

  return useMutation({
    mutationFn: (notificationId: string) => markSeenFn({ data: { workspace, notificationId } }),
    onMutate: async (notificationId: string) => {
      await qc.cancelQueries({ queryKey: notificationKeys.all });

      const snapshots = qc.getQueriesData<NotificationListResponse>({ queryKey: [...notificationKeys.all, "list", scope] });

      for (const [key] of snapshots) {
        qc.setQueryData<NotificationListResponse>(key, (current) =>
          updateListSnapshot(current, (snapshot) => {
            const match = snapshot.items.find((n) => n.id === notificationId);
            if (!match || match.seen) return snapshot;
            return {
              ...snapshot,
              items: snapshot.items.map((n) => (n.id === notificationId ? { ...n, seen: true } : n)),
              unseenCount: Math.max(0, snapshot.unseenCount - 1),
            };
          }),
        );
      }

      return { snapshots };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, prev] of ctx.snapshots) {
          qc.setQueryData(key, prev);
        }
      }
      toast.error(err instanceof Error ? err.message : "Couldn't mark notification as seen");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsSeen(workspace?: string) {
  const qc = useQueryClient();
  const scope = scopeKey(workspace);

  return useMutation({
    mutationFn: () => markAllSeenFn({ data: { workspace } }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationKeys.all });

      const snapshots = qc.getQueriesData<NotificationListResponse>({ queryKey: [...notificationKeys.all, "list", scope] });

      for (const [key] of snapshots) {
        qc.setQueryData<NotificationListResponse>(key, (current) =>
          updateListSnapshot(current, (snapshot) => ({
            ...snapshot,
            items: snapshot.items.map((n) => (n.seen ? n : { ...n, seen: true })),
            unseenCount: 0,
          })),
        );
      }

      return { snapshots };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, prev] of ctx.snapshots) {
          qc.setQueryData(key, prev);
        }
      }
      toast.error(err instanceof Error ? err.message : "Couldn't mark all notifications as seen");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
