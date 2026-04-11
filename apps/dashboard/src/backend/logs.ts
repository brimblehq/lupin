import type { ApiClient } from "./types";

export interface RequestLogEntry {
  status: number;
  url: string;
  browser: string;
  timestamp: string;
  hostname: string;
  project?: string;
  headers: Record<string, string>;
  query?: Record<string, string>;
  method: string;
  message: string;
}

export interface RequestLogsPage {
  items: RequestLogEntry[];
  totalLogs: number;
  totalPages: number;
  currentPage: number;
  hostnames: string[];
  statuses: string[];
  methods: string[];
}

export interface ListRequestLogsInput {
  page?: number;
  limit?: number;
  status?: string;
  methods?: string;
  hostname?: string;
  teamId?: string;
}

export interface LogTrendPoint {
  timestamp: number;
  value: number;
}

export interface LogTrendsRange {
  start: string;
  end: string;
  stepSeconds: number;
  interval: string;
}

export interface LogTrendsResponse {
  range: LogTrendsRange;
  query: { containerMatcher: string; search: string | null };
  series: {
    totalLogs: LogTrendPoint[];
    errorLogs: LogTrendPoint[];
    warningLogs: LogTrendPoint[];
    errorRate: LogTrendPoint[];
  };
  summary: {
    totalLogs: number;
    errorLogs: number;
    warningLogs: number;
    errorRate: number;
  };
}

export interface GetLogTrendsInput {
  from?: number;
  to?: number;
  step?: string;
  interval?: string;
  search?: string;
  container?: string;
}

export interface LogsApi {
  listRequestLogs(
    projectId: string,
    input?: ListRequestLogsInput,
  ): Promise<RequestLogsPage>;
  getLogTrends(
    projectId: string,
    input?: GetLogTrendsInput,
  ): Promise<LogTrendsResponse>;
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val === null || val === undefined) {
      continue;
    }
    result[key] = String(val);
  }
  return result;
}

function mapTrendPoints(raw: unknown): LogTrendPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any) => ({
    timestamp: Number(p?.timestamp ?? 0),
    value: Number(p?.value ?? 0),
  }));
}

function mapLogTrendsResponse(raw: any): LogTrendsResponse {
  const range = raw?.range ?? {};
  const series = raw?.series ?? {};
  const summary = raw?.summary ?? {};
  const query = raw?.query ?? {};
  return {
    range: {
      start: String(range.start ?? ""),
      end: String(range.end ?? ""),
      stepSeconds: Number(range.stepSeconds ?? 0),
      interval: String(range.interval ?? ""),
    },
    query: {
      containerMatcher: String(query.containerMatcher ?? ""),
      search: typeof query.search === "string" ? query.search : null,
    },
    series: {
      totalLogs: mapTrendPoints(series.totalLogs),
      errorLogs: mapTrendPoints(series.errorLogs),
      warningLogs: mapTrendPoints(series.warningLogs),
      errorRate: mapTrendPoints(series.errorRate),
    },
    summary: {
      totalLogs: Number(summary.totalLogs ?? 0),
      errorLogs: Number(summary.errorLogs ?? 0),
      warningLogs: Number(summary.warningLogs ?? 0),
      errorRate: Number(summary.errorRate ?? 0),
    },
  };
}

function mapRequestLogEntry(log: any): RequestLogEntry {
  return {
    status: Number(log?.status ?? 0),
    url: String(log?.url ?? ""),
    browser: String(log?.browser ?? ""),
    timestamp: String(log?.timestamp ?? ""),
    hostname: String(log?.hostname ?? log?.host ?? ""),
    project: typeof log?.project === "string" ? log.project : undefined,
    headers: toStringRecord(log?.headers),
    query:
      log?.query && typeof log.query === "object"
        ? toStringRecord(log.query)
        : undefined,
    method: String(log?.method ?? "").toUpperCase(),
    message: String(log?.message ?? log?.response ?? ""),
  };
}

export function createLogsApi(client: ApiClient): LogsApi {
  return {
    async listRequestLogs(projectId, input) {
      const response = await client.request<any>(
        `/core/v1/logs/requests/${encodeURIComponent(projectId)}`,
        {
          method: "GET",
          query: {
            page: input?.page,
            limit: input?.limit,
            status: input?.status,
            methods: input?.methods,
            hostname: input?.hostname,
            teamId: input?.teamId,
          },
        },
      );

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rawLogs: any[] = Array.isArray(root.logs) ? root.logs : [];
      const items: RequestLogEntry[] = rawLogs.map(mapRequestLogEntry);

      const hostnames = [
        ...new Set(items.map((item) => item.hostname).filter(Boolean)),
      ];
      const statuses = [
        ...new Set(items.map((item) => String(item.status)).filter(Boolean)),
      ];
      const methods = [
        ...new Set(items.map((item) => item.method).filter(Boolean)),
      ];

      return {
        items,
        totalLogs: Number(root.totalLogs ?? root.total ?? items.length ?? 0),
        totalPages: Number(root.totalPages ?? 1),
        currentPage: Number(root.currentPage ?? 1),
        hostnames,
        statuses,
        methods,
      };
    },
    async getLogTrends(projectId, input) {
      const response = await client.request<any>(
        `/core/v1/logs/trends/${encodeURIComponent(projectId)}`,
        {
          method: "GET",
          query: {
            from: input?.from,
            to: input?.to,
            step: input?.step,
            interval: input?.interval,
            search: input?.search?.trim() || undefined,
            container: input?.container?.trim() || undefined,
          },
        },
      );

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      return mapLogTrendsResponse(root);
    },
  };
}
