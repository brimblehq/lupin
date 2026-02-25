import type { ApiClient } from "./types";

export interface OverviewTotals {
  project: number;
  domain: number;
  team: number;
}

export interface OverviewDeploymentBuildTime {
  recent: number | null;
  fastest: number | null;
  slowest: number | null;
}

export interface OverviewSummary {
  total: OverviewTotals;
  deploymentBuildTime: OverviewDeploymentBuildTime;
}

export interface OverviewApi {
  get(input?: { teamId?: string }): Promise<OverviewSummary>;
}

export function createOverviewApi(client: ApiClient): OverviewApi {
  return {
    async get(input) {
      const response = await client.request<any>("/core/v1/overview", {
        method: "GET",
        query: {
          teamId: input?.teamId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const totals = root?.total ?? root ?? {};
      const deploymentBuildTime = root?.deploymentBuildTime ?? {};

      const parseSeconds = (value: unknown): number | null =>
        typeof value === "number" && Number.isFinite(value) ? value : null;

      return {
        total: {
          project: typeof totals?.project === "number" ? totals.project : 0,
          domain: typeof totals?.domain === "number" ? totals.domain : 0,
          team: typeof totals?.team === "number" ? totals.team : 0,
        },
        deploymentBuildTime: {
          recent: parseSeconds(deploymentBuildTime?.recent),
          fastest: parseSeconds(deploymentBuildTime?.fastest),
          slowest: parseSeconds(deploymentBuildTime?.slowest),
        },
      };
    },
  };
}
