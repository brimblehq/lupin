import type { ApiClient, ApiListResponse } from "./types";
import { notImplemented } from "./utils";

export interface Deployment {
  id: string;
  projectId: string;
  status: "queued" | "building" | "ready" | "failed" | "canceled";
  branch?: string;
  commitSha?: string;
  createdAt?: string;
}

export interface CreateDeploymentInput {
  projectId: string;
  branch?: string;
  commitSha?: string;
}

export interface DeploymentsApi {
  list(projectId: string): Promise<ApiListResponse<Deployment>>;
  getById(deploymentId: string): Promise<Deployment>;
  create(input: CreateDeploymentInput): Promise<Deployment>;
  cancel(deploymentId: string): Promise<void>;
}

export function createDeploymentsApi(client: ApiClient): DeploymentsApi {
  void client;

  return {
    list: () => notImplemented<ApiListResponse<Deployment>>("deployments", "list"),
    getById: () => notImplemented<Deployment>("deployments", "getById"),
    create: () => notImplemented<Deployment>("deployments", "create"),
    cancel: () => notImplemented<void>("deployments", "cancel"),
  };
}
