import type { ApiClient } from "./types";
import { asNonEmptyString, asRecord } from "./normalize";

export interface AggregateMetricsPoint {
  date: string;
  memory: number;
  cpu: number;
  network: {
    bytesPerSecond: number | null;
  };
}

export interface ResponseTimeMetricsPoint {
  date: string;
  p90: number | null;
  p95: number | null;
  p99: number | null;
  avg: number | null;
}

export interface ResourceObservabilityMetrics {
  average: {
    memory: {
      totalInPercentage: number;
      size: number;
    };
    cpu: {
      totalInPercentage: number;
      size: number;
    };
    network: {
      value: number | null;
      bytesPerSecond: number | null;
    };
  };
  results: AggregateMetricsPoint[];
  responseTime?: {
    average: {
      p90: number | null;
      p95: number | null;
      p99: number | null;
      avg: number | null;
    };
    results: ResponseTimeMetricsPoint[];
  } | null;
}

export interface ObservabilityApi {
  getProjectMetrics(input: {
    projectId: string;
    hrsAgo?: number;
    container?: string;
    teamId?: string;
  }): Promise<ResourceObservabilityMetrics>;
  getSandboxMetrics(input: { sandboxId: string; hrsAgo?: number }): Promise<ResourceObservabilityMetrics>;
}

function parseNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function parseNullableNumber(value: unknown): number | null {
  return value == null ? null : parseNumber(value);
}

function parseDateString(value: unknown): string {
  return asNonEmptyString(value) ?? "";
}

function mapMetricsResponse(response: unknown): ResourceObservabilityMetrics {
  const root = (response as any)?.data?.data ?? (response as any)?.data ?? response ?? {};
  const rootRecord = asRecord(root);
  const responseTimeRecord = asRecord(rootRecord?.responseTime);
  const responseTimeAverageRecord = asRecord(responseTimeRecord?.average);
  const averageRecord = asRecord(rootRecord?.average);
  const averageMemoryRecord = asRecord(averageRecord?.memory);
  const averageCpuRecord = asRecord(averageRecord?.cpu);
  const averageNetworkRecord = asRecord(averageRecord?.network);

  const rawResults = Array.isArray(rootRecord?.results) ? rootRecord.results : [];
  const rawResponseTimeResults = Array.isArray(responseTimeRecord?.results) ? responseTimeRecord.results : [];

  const results: AggregateMetricsPoint[] = rawResults.map((point: any) => {
    const pointRecord = asRecord(point) ?? {};
    const networkRecord = asRecord(pointRecord.network);
    return {
      date: parseDateString(pointRecord.date),
      memory: parseNumber(pointRecord.memory),
      cpu: parseNumber(pointRecord.cpu),
      network: {
        bytesPerSecond: parseNullableNumber(networkRecord?.bytesPerSecond),
      },
    };
  });

  const responseTime = responseTimeRecord
    ? {
        average: {
          p90: parseNullableNumber(responseTimeAverageRecord?.p90),
          p95: parseNullableNumber(responseTimeAverageRecord?.p95),
          p99: parseNullableNumber(responseTimeAverageRecord?.p99),
          avg: parseNullableNumber(responseTimeAverageRecord?.avg),
        },
        results: rawResponseTimeResults.map((item: any) => {
          const row = asRecord(item) ?? {};
          return {
            date: parseDateString(row.date),
            p90: parseNullableNumber(row.p90),
            p95: parseNullableNumber(row.p95),
            p99: parseNullableNumber(row.p99),
            avg: parseNullableNumber(row.avg),
          };
        }),
      }
    : null;

  return {
    average: {
      memory: {
        totalInPercentage: parseNumber(averageMemoryRecord?.totalInPercentage),
        size: parseNumber(averageMemoryRecord?.size),
      },
      cpu: {
        totalInPercentage: parseNumber(averageCpuRecord?.totalInPercentage),
        size: parseNumber(averageCpuRecord?.size),
      },
      network: {
        value: parseNullableNumber(averageNetworkRecord?.value),
        bytesPerSecond: parseNullableNumber(averageNetworkRecord?.bytesPerSecond),
      },
    },
    results,
    responseTime,
  };
}

export function createObservabilityApi(client: ApiClient): ObservabilityApi {
  return {
    async getProjectMetrics(input) {
      const response = await client.request<any>(`/core/v1/projects/stats/${encodeURIComponent(input.projectId)}`, {
        method: "GET",
        query: {
          hrsAgo: input.hrsAgo,
          container: input.container,
          teamId: input.teamId,
        },
      });
      return mapMetricsResponse(response);
    },

    async getSandboxMetrics(input) {
      const response = await client.request<any>(`/core/v1/sandboxes/${encodeURIComponent(input.sandboxId)}/stats`, {
        method: "GET",
        query: {
          hoursAgo: input.hrsAgo,
        },
      });
      return mapMetricsResponse(response);
    },
  };
}
