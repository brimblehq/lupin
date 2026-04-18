import type { ApiClient } from "./types";
import { asNonEmptyString, asRecord, pickNonEmptyString, pickNumber } from "./normalize";

export interface ReplicaInfo {
  id: string;
  container: string;
  shortName?: string;
}

export interface ReplicaMetrics {
  memory: number;
  cpu: number;
  network: {
    bytesPerSecond: number | null;
  };
}

export interface AggregateMetricsPoint {
  date: string;
  memory: number;
  cpu: number;
  network: {
    bytesPerSecond: number | null;
  };
}

export interface PerReplicaMetricsPoint {
  date: string;
  aggregate: ReplicaMetrics;
  replicas: Record<string, ReplicaMetrics>;
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
  replicas: ReplicaInfo[];
  replicaCount: number;
  results: AggregateMetricsPoint[] | PerReplicaMetricsPoint[];
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
    breakdown?: "per-replica";
    teamId?: string;
  }): Promise<ResourceObservabilityMetrics>;
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

export function createObservabilityApi(client: ApiClient): ObservabilityApi {
  return {
    async getProjectMetrics(input) {
      const response = await client.request<any>(`/core/v1/projects/stats/${encodeURIComponent(input.projectId)}`, {
        method: "GET",
        query: {
          hrsAgo: input.hrsAgo,
          container: input.container,
          breakdown: input.breakdown,
          teamId: input.teamId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rootRecord = asRecord(root);
      const responseTimeRecord = asRecord(rootRecord?.responseTime);
      const responseTimeAverageRecord = asRecord(responseTimeRecord?.average);
      const averageRecord = asRecord(rootRecord?.average);
      const averageMemoryRecord = asRecord(averageRecord?.memory);
      const averageCpuRecord = asRecord(averageRecord?.cpu);
      const averageNetworkRecord = asRecord(averageRecord?.network);

      const rawReplicas = Array.isArray(rootRecord?.replicas) ? rootRecord.replicas : [];
      const rawResults = Array.isArray(rootRecord?.results) ? rootRecord.results : [];
      const rawResponseTimeResults = Array.isArray(responseTimeRecord?.results) ? responseTimeRecord.results : [];

      const replicas: ReplicaInfo[] = rawReplicas
        .map((item: any) => {
          const row = asRecord(item) ?? {};
          const container = pickNonEmptyString(row, "container") ?? "";
          const id = String(row.id ?? row._id ?? container);
          if (!container) {
            return null;
          }

          return {
            id,
            container,
            shortName: pickNonEmptyString(row, "shortName", "short_name"),
          } satisfies ReplicaInfo;
        })
        .filter((item): item is ReplicaInfo => item !== null);

      const results = rawResults.map((point: any) => {
        const pointRecord = asRecord(point) ?? {};
        const aggregateRecord = asRecord(pointRecord.aggregate);
        if (aggregateRecord && pointRecord.replicas) {
          const aggregateNetwork = asRecord(aggregateRecord.network);
          return {
            date: parseDateString(pointRecord.date),
            aggregate: {
              memory: parseNumber(aggregateRecord.memory),
              cpu: parseNumber(aggregateRecord.cpu),
              network: {
                bytesPerSecond: parseNullableNumber(aggregateNetwork?.bytesPerSecond),
              },
            },
            replicas: pointRecord.replicas as Record<string, ReplicaMetrics>,
          } satisfies PerReplicaMetricsPoint;
        }

        const networkRecord = asRecord(pointRecord.network);
        return {
          date: parseDateString(pointRecord.date),
          memory: parseNumber(pointRecord.memory),
          cpu: parseNumber(pointRecord.cpu),
          network: {
            bytesPerSecond: parseNullableNumber(networkRecord?.bytesPerSecond),
          },
        } satisfies AggregateMetricsPoint;
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
        replicas,
        replicaCount: pickNumber(rootRecord, "replicaCount") ?? replicas.length,
        results,
        responseTime,
      };
    },
  };
}
