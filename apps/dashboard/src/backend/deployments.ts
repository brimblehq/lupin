import type { ApiClient } from "./types";

export interface DeploymentLog {
  id: string;
  name: string;
  status: string;
  branch?: string;
  message?: string;
  commitLink?: string;
  pullRequestLink?: string;
  environment?: string;
  startTime?: string;
  endTime?: string;
  createdAt?: string;
  username?: string;
  avatar?: string;
  domain?: string;
}

export interface PaginatedDeploymentsResponse {
  items: DeploymentLog[];
  currentPage: number;
  totalPages: number;
  total?: number;
  environments: string[];
  statuses: string[];
}

export interface ListDeploymentsInput {
  page?: number;
  limit?: number;
  filterBy?: "createdAt" | "startTime" | "endTime" | "status";
  statuses?: string;
  environment?: string;
  start?: string;
  end?: string;
  search?: string;
  teamId?: string;
}

export interface DeploymentsApi {
  list(projectId: string, input?: ListDeploymentsInput): Promise<PaginatedDeploymentsResponse>;
  getById(projectId: string, logId: string): Promise<DeploymentLog | null>;
  redeploy(projectId: string, logId: string, input?: { teamId?: string }): Promise<{ id?: string }>;
  cancel(projectId: string, logId: string, input?: { teamId?: string }): Promise<void>;
  downloadLogs(projectId: string, logId: string, input?: { teamId?: string }): Promise<{ content: string; filename: string }>;
}

function mapDeploymentLog(log: any): DeploymentLog {
  return {
    id: log.id ?? log._id,
    name: log.name ?? "",
    status: String(log.status ?? "")
      .trim()
      .toLowerCase(),
    branch: log.branch,
    message: log.message,
    commitLink: log.commitLink ?? log.commit_link,
    pullRequestLink: log.pullRequestLink ?? log.pull_request_link ?? log.prLink ?? log.pr_link,
    environment: log.environment,
    startTime: log.startTime,
    endTime: log.endTime,
    createdAt: log.createdAt,
    username: log.username ?? log.user?.username,
    avatar: log.avatar ?? log.user?.avatar,
    domain: log.domain,
  };
}

export function createDeploymentsApi(client: ApiClient): DeploymentsApi {
  return {
    async list(projectId, input) {
      const response = await client.request<any>(`/core/v1/logs/search/${encodeURIComponent(projectId)}`, {
        method: "GET",
        query: {
          page: input?.page,
          limit: input?.limit,
          filterBy: input?.filterBy,
          statuses: input?.statuses,
          environment: input?.environment,
          start: input?.start,
          end: input?.end,
          search: input?.search?.trim() || undefined,
          teamId: input?.teamId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rawLogs = root.logs ?? root ?? [];
      const items = (Array.isArray(rawLogs) ? rawLogs : []).map(mapDeploymentLog);

      return {
        items,
        currentPage: root.currentPage ?? root.current_page ?? 1,
        totalPages: root.totalPages ?? root.total_pages ?? 1,
        total: root.total ?? root.count,
        environments: root.environments ?? ["PRODUCTION"],
        statuses: root.statuses ?? ["ACTIVE", "INPROGRESS", "FAILED", "CANCELLED", "PENDING"],
      };
    },

    async getById(projectId, logId) {
      const response = await client.request<any>(`/core/v1/logs/${encodeURIComponent(projectId)}/${encodeURIComponent(logId)}`, {
        method: "GET",
      });

      const root = response?.data?.data ?? response?.data ?? response;
      return root ? mapDeploymentLog(root) : null;
    },

    async redeploy(projectId, logId, input) {
      const response = await client.request<any>(`/core/v1/projects/${encodeURIComponent(projectId)}/redeploy`, {
        method: "POST",
        body: { logId },
        query: { teamId: input?.teamId },
      });
      const root = response?.data?.data ?? response?.data ?? response ?? {};
      return { id: root.id ?? root._id };
    },

    async cancel(projectId, logId, input) {
      await client.request<any>(`/core/v1/projects/cancel/${encodeURIComponent(projectId)}/${encodeURIComponent(logId)}`, {
        method: "POST",
        body: {},
        query: { teamId: input?.teamId },
      });
    },

    async downloadLogs(projectId, logId, input) {
      const url = `/core/v1/logs/download/${encodeURIComponent(projectId)}/${encodeURIComponent(logId)}`;
      const response = await client.request<string>(url, {
        method: "GET",
        query: { teamId: input?.teamId },
        headers: { Accept: "text/plain" },
      });

      const raw = (response as any)?.data ?? response ?? "";
      const content = typeof raw === "string" ? raw : JSON.stringify(raw);

      const disposition = (response as any)?.headers?.["content-disposition"] ?? "";
      const filenameMatch = disposition.match(/filename="?([^";\s]+)"?/);
      const filename = filenameMatch?.[1] || `deployment-${logId}.log`;

      return { content, filename };
    },
  };
}
