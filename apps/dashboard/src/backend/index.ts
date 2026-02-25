import { createAuthApi, type AuthApi } from "./auth";
import { createBandwidthApi, type BandwidthApi } from "./bandwidth";
import { createBackendClient, type BackendClient, type BackendClientConfig } from "./client";
import { createDeploymentsApi, type DeploymentsApi } from "./deployments";
import { createDomainsApi, type DomainsApi } from "./domains";
import { createProjectEnvironmentsApi, type ProjectEnvironmentsApi } from "./environments";
import { createFrameworksApi, type FrameworksApi } from "./frameworks";
import { createLogsApi, type LogsApi } from "./logs";
import { createMessagesApi, type MessagesApi } from "./messages";
import { createMcpApi, type McpApi } from "./mcp";
import { createObservabilityApi, type ObservabilityApi } from "./observability";
import { createOverviewApi, type OverviewApi } from "./overview";
import { createProjectsApi, type ProjectsApi } from "./projects";
import { createRepositoriesApi, type RepositoriesApi } from "./repositories";
import { createSettingsApi, type SettingsApi } from "./settings";
import { createTeamsApi, type TeamsApi } from "./teams";
import { createRegionsApi, type RegionsApi } from "./regions";
import { createScalingApi, type ScalingApi } from "./scaling";
import { createTagsApi, type TagsApi } from "./tags";
import { createWorkspacesApi, type WorkspacesApi } from "./workspaces";

export * from "./auth";
export * from "./bandwidth";
export * from "./client";
export * from "./deployments";
export * from "./domains";
export * from "./environments";
export * from "./errors";
export * from "./frameworks";
export * from "./logs";
export * from "./messages";
export * from "./mcp";
export * from "./observability";
export * from "./overview";
export * from "./projects";
export * from "./regions";
export * from "./repositories";
export * from "./settings";
export * from "./scaling";
export * from "./tags";
export * from "./teams";
export * from "./types";
export * from "./workspaces";

export interface BackendApi {
  client: BackendClient;
  auth: AuthApi;
  bandwidth: BandwidthApi;
  projects: ProjectsApi;
  repositories: RepositoriesApi;
  domains: DomainsApi;
  environments: ProjectEnvironmentsApi;
  frameworks: FrameworksApi;
  observability: ObservabilityApi;
  logs: LogsApi;
  messages: MessagesApi;
  mcp: McpApi;
  overview: OverviewApi;
  deployments: DeploymentsApi;
  workspaces: WorkspacesApi;
  settings: SettingsApi;
  teams: TeamsApi;
  regions: RegionsApi;
  scaling: ScalingApi;
  tags: TagsApi;
}

export function createBackendApi(config: BackendClientConfig): BackendApi {
  const client = createBackendClient(config);

  return {
    client,
    auth: createAuthApi(client),
    bandwidth: createBandwidthApi(client),
    projects: createProjectsApi(client),
    repositories: createRepositoriesApi(client),
    domains: createDomainsApi(client),
    environments: createProjectEnvironmentsApi(client),
    frameworks: createFrameworksApi(client),
    observability: createObservabilityApi(client),
    logs: createLogsApi(client),
    messages: createMessagesApi(client),
    mcp: createMcpApi(client),
    overview: createOverviewApi(client),
    deployments: createDeploymentsApi(client),
    workspaces: createWorkspacesApi(client),
    settings: createSettingsApi(client),
    teams: createTeamsApi(client),
    regions: createRegionsApi(client),
    scaling: createScalingApi(client),
    tags: createTagsApi(client),
  };
}
