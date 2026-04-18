import { createServerFn } from "@tanstack/react-start";
import type { LogTrendsResponse, RequestLogsPage } from "@/backend/logs";
import { withTokenRefresh } from "@/server/shared/backend";

export const listRequestLogsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        limit?: number;
        cursor?: string | null;
        direction?: "backward" | "forward";
        start?: string;
        end?: string;
        statuses?: string;
        methods?: string;
        search?: string;
        level?: string;
        sort?: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  return withTokenRefresh(async (api) => {
    return api.logs.listRequestLogs(projectId, {
      limit: payload?.limit,
      cursor: payload?.cursor,
      direction: payload?.direction,
      start: payload?.start,
      end: payload?.end,
      statuses: payload?.statuses,
      methods: payload?.methods,
      search: payload?.search,
      level: payload?.level,
      sort: payload?.sort,
    });
  });
});

export const getLogTrendsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        projectId: string;
        from?: number;
        to?: number;
        step?: string;
        interval?: string;
        search?: string;
        container?: string;
        query?: string;
      }
    | undefined;

  const projectId = payload?.projectId?.trim();
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  return withTokenRefresh(async (api) => {
    return api.logs.getLogTrends(projectId, {
      from: payload?.from,
      to: payload?.to,
      step: payload?.step,
      interval: payload?.interval,
      search: payload?.search,
      container: payload?.container,
      query: payload?.query,
    });
  });
});

export type { LogTrendsResponse, RequestLogsPage };
