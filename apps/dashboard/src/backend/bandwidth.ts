import type { ApiClient } from "./types";
import { asRecord, pickNonEmptyString, pickNumber } from "./normalize";

export interface BandwidthPoint {
  date: string;
  transmit: number;
  total: number;
}

export interface BandwidthSummary {
  results: BandwidthPoint[];
  total: number;
}

export interface BandwidthApi {
  get(input?: { teamId?: string; environmentId?: string }): Promise<BandwidthSummary>;
}

function mapPoint(value: unknown): BandwidthPoint | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const date = pickNonEmptyString(row, "date");
  const transmit = pickNumber(row, "transmit");
  const total = pickNumber(row, "total");

  if (!date || transmit === undefined || total === undefined) {
    return null;
  }

  return { date, transmit, total };
}

export function createBandwidthApi(client: ApiClient): BandwidthApi {
  return {
    async get(input) {
      const environmentId = input?.environmentId?.trim() || undefined;
      const response = await client.request<any>("/core/v1/bandwidth", {
        method: "GET",
        headers: environmentId ? { "x-brimble-environment": environmentId } : undefined,
        query: {
          teamId: input?.teamId,
          environmentId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const data = asRecord(root) ?? {};
      const rawResults = Array.isArray(data.results) ? data.results : [];

      return {
        results: rawResults.map(mapPoint).filter((item): item is BandwidthPoint => item !== null),
        total: pickNumber(data, "total") ?? 0,
      };
    },
  };
}
