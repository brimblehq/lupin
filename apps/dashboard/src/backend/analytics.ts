import type { ApiClient } from "./types";

export interface AnalyticsRecord {
  _id: string;
  project: string;
  provider: string;
  websiteId: string;
  shareId: string | null;
  domain: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  snippet: string;
}

export interface AnalyticsRange {
  startAt: number;
  endAt: number;
  unit: string;
  timezone?: string;
}

export interface AnalyticsSummaryMetric {
  value: number;
  prev: number;
}

export interface AnalyticsSummary {
  pageviews: AnalyticsSummaryMetric;
  visitors: AnalyticsSummaryMetric;
  visits: AnalyticsSummaryMetric;
  bounces: AnalyticsSummaryMetric;
  bounceRate: AnalyticsSummaryMetric;
  totaltime: AnalyticsSummaryMetric;
}

export interface AnalyticsSeriesPoint {
  x: string;
  y: number;
}

export interface AnalyticsPageviewSeries {
  pageviews: AnalyticsSeriesPoint[];
  sessions: AnalyticsSeriesPoint[];
}

export interface AnalyticsActive {
  visitors: number;
}

export interface AnalyticsBreakdownEntry {
  x: string;
  y: number;
}

export interface AnalyticsMetricsBreakdown {
  path: AnalyticsBreakdownEntry[];
  referrer: AnalyticsBreakdownEntry[];
  browser: AnalyticsBreakdownEntry[];
  os: AnalyticsBreakdownEntry[];
  device: AnalyticsBreakdownEntry[];
  country: AnalyticsBreakdownEntry[];
  region: AnalyticsBreakdownEntry[];
  city: AnalyticsBreakdownEntry[];
  event: AnalyticsBreakdownEntry[];
}

export interface AnalyticsEventEntry {
  x: string;
  t: string;
  y: number;
}

export interface AnalyticsPerformanceMetric {
  p75: number | null;
  samples: number;
}

export interface AnalyticsPerformance {
  lcp: AnalyticsPerformanceMetric;
  cls: AnalyticsPerformanceMetric;
  inp: AnalyticsPerformanceMetric;
  fcp: AnalyticsPerformanceMetric;
  ttfb: AnalyticsPerformanceMetric;
  avgLoadTime: number | null;
}

export interface AnalyticsPayload {
  websiteId: string;
  domain: string;
  snippet: string;
  range: AnalyticsRange;
  summary: AnalyticsSummary;
  pageviews: AnalyticsPageviewSeries;
  trafficByHour: number[][];
  active: AnalyticsActive;
  events: AnalyticsEventEntry[];
  metrics: AnalyticsMetricsBreakdown;
  performance: AnalyticsPerformance;
}

export interface AnalyticsGetInput {
  projectId: string;
  startAt: number;
  endAt: number;
  unit?: "hour" | "day" | "month" | "year";
  timezone?: string;
  type?: string;
}

export interface AnalyticsApi {
  enable(projectId: string): Promise<AnalyticsRecord>;
  disable(projectId: string): Promise<void>;
  get(input: AnalyticsGetInput): Promise<AnalyticsPayload>;
}

function unwrap<T = unknown>(payload: unknown): T {
  const root = payload as { data?: { data?: T } | T } | T | null;
  if (root && typeof root === "object" && "data" in (root as any)) {
    const inner = (root as any).data;
    if (inner && typeof inner === "object" && "data" in inner) {
      return inner.data as T;
    }
    return inner as T;
  }
  return root as T;
}

export function createAnalyticsApi(client: ApiClient): AnalyticsApi {
  return {
    async enable(projectId) {
      const response = await client.request(`/core/v1/analytics/${encodeURIComponent(projectId)}`, {
        method: "POST",
      });
      return unwrap<AnalyticsRecord>(response);
    },
    async disable(projectId) {
      await client.request(`/core/v1/analytics/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
      });
    },
    async get(input) {
      const query: Record<string, string | number | undefined> = {
        startAt: input.startAt,
        endAt: input.endAt,
      };
      if (input.unit) query.unit = input.unit;
      if (input.timezone) query.timezone = input.timezone;
      if (input.type) query.type = input.type;

      const response = await client.request(
        `/core/v1/analytics/${encodeURIComponent(input.projectId)}`,
        {
          method: "GET",
          query,
        },
      );
      return unwrap<AnalyticsPayload>(response);
    },
  };
}
