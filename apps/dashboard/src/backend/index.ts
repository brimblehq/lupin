import { createAuthApi, type AuthApi } from "./auth";
import { createBackendClient, type BackendClient, type BackendClientConfig } from "./client";
import { createDeploymentsApi, type DeploymentsApi } from "./deployments";
import { createDomainsApi, type DomainsApi } from "./domains";
import { createProjectsApi, type ProjectsApi } from "./projects";
import { createWorkspacesApi, type WorkspacesApi } from "./workspaces";

export * from "./auth";
export * from "./client";
export * from "./deployments";
export * from "./domains";
export * from "./errors";
export * from "./projects";
export * from "./types";
export * from "./workspaces";

export interface BackendApi {
  client: BackendClient;
  auth: AuthApi;
  projects: ProjectsApi;
  domains: DomainsApi;
  deployments: DeploymentsApi;
  workspaces: WorkspacesApi;
}

export function createBackendApi(config: BackendClientConfig): BackendApi {
  const client = createBackendClient(config);

  return {
    client,
    auth: createAuthApi(client),
    projects: createProjectsApi(client),
    domains: createDomainsApi(client),
    deployments: createDeploymentsApi(client),
    workspaces: createWorkspacesApi(client),
  };
}
