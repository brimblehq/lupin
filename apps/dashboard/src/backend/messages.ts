import type { ApiClient } from "./types";
import { asRecord, pickNonEmptyString } from "./normalize";

export type AppMessageLevel = "info" | "warn" | "critical";
export type AppMessageType = "welcome" | "payment" | string;

export interface AppTooltipMessage {
  message: string;
  level: AppMessageLevel;
  type?: AppMessageType;
  route?: string;
  meta?: Record<string, unknown>;
}

export interface MessagesApi {
  listTooltipMessages(input: {
    subscriptionId?: string;
    type?: "notifications" | "announcement";
    limit?: number;
    page?: number;
  }): Promise<AppTooltipMessage[] | null>;
}

function mapMessage(value: unknown): AppTooltipMessage | null {
  const row = asRecord(value);
  if (!row) return null;

  const message = pickNonEmptyString(row, "message");
  const level = pickNonEmptyString(row, "level");
  if (!message || !level) return null;

  if (level !== "info" && level !== "warn" && level !== "critical") {
    return null;
  }

  return {
    message,
    level,
    type: pickNonEmptyString(row, "type"),
    route: pickNonEmptyString(row, "route"),
    meta: asRecord(row.meta),
  };
}

export interface AnnouncementContent {
  id: string;
  title: string;
  body: string;
  ctaLabel: string;
  route?: string;
  imageUrl?: string;
  imageAlt?: string;
  learnMoreUrl?: string;
}

export function parseAnnouncement(msg: AppTooltipMessage): AnnouncementContent | null {
  if (msg.type && msg.type !== "announcement") return null;

  const meta = msg.meta ?? {};

  const id = pickNonEmptyString(meta, "id");

  const title = pickNonEmptyString(meta, "title");

  if (!id || !title) return null;

  return {
    id,
    title,
    body: msg.message,
    ctaLabel: pickNonEmptyString(meta, "ctaLabel") ?? "Open",
    route: msg.route,
    imageUrl: pickNonEmptyString(meta, "imageUrl"),
    imageAlt: pickNonEmptyString(meta, "imageAlt"),
    learnMoreUrl: pickNonEmptyString(meta, "learnMoreUrl"),
  };
}

export function createMessagesApi(client: ApiClient): MessagesApi {
  return {
    async listTooltipMessages(input) {
      const subscriptionId = input.subscriptionId?.trim() || undefined;

      const response = await client.request<any>("/core/v1/tooltip-message", {
        method: "GET",
        query: {
          ...(subscriptionId ? { subscriptionId } : {}),
          type: input.type,
          limit: input.limit,
          page: input.page,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rootRecord = asRecord(root) ?? {};
      const rawMessages = rootRecord.messages;

      if (rawMessages === null || rawMessages === undefined) {
        return null;
      }

      if (!Array.isArray(rawMessages)) {
        return null;
      }

      return rawMessages.map(mapMessage).filter((item): item is AppTooltipMessage => item !== null);
    },
  };
}
