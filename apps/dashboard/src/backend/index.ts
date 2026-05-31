import { createActivityLogsApi, type ActivityLogsApi } from "./activity-logs";
import { createAblyApi, type AblyApi } from "./ably";

import { createAnalyticsApi, type AnalyticsApi } from "./analytics";
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
import { createNotificationsApi, type NotificationsApi } from "./notifications";
import { createObservabilityApi, type ObservabilityApi } from "./observability";
import { createOverviewApi, type OverviewApi } from "./overview";
import { createPaymentsApi, type PaymentsApi } from "./payments";
import { createUserOverviewApi, type UserOverviewApi } from "./user-overview";
import { createProjectsApi, type ProjectsApi } from "./projects";
import { createRepositoriesApi, type RepositoriesApi } from "./repositories";
import { createSandboxesApi, type SandboxesApi } from "./sandboxes";

import { createSettingsApi, type SettingsApi } from "./settings";
import { createTeamsApi, type TeamsApi } from "./teams";
import { createRegionsApi, type RegionsApi } from "./regions";
import { createScalingApi, type ScalingApi } from "./scaling";
import { createTagsApi, type TagsApi } from "./tags";
import { createVolumesApi, type VolumesApi } from "./volumes";

import { createWorkspacesApi, type WorkspacesApi } from "./workspaces";
import { createStorageApi, type StorageApi } from "./storage";

export * from "./activity-logs";
export * from "./ably";

export * from "./analytics";
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
export * from "./notifications";
export * from "./observability";
export * from "./overview";
export * from "./payments";
export * from "./user-overview";
export * from "./projects";
export * from "./regions";
export * from "./repositories";
export * from "./sandboxes";

export * from "./settings";
export * from "./scaling";
export * from "./tags";
export * from "./teams";
export * from "./types";
export * from "./volumes";

export * from "./workspaces";
export * from "./storage";

export interface BackendApi {
  client: BackendClient;
  activityLogs: ActivityLogsApi;
  analytics: AnalyticsApi;
  auth: AuthApi;
  ably: AblyApi;

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
  notifications: NotificationsApi;
  overview: OverviewApi;
  payments: PaymentsApi;
  userOverview: UserOverviewApi;
  deployments: DeploymentsApi;
  workspaces: WorkspacesApi;
  settings: SettingsApi;
  teams: TeamsApi;
  regions: RegionsApi;
  sandboxes: SandboxesApi;

  scaling: ScalingApi;
  tags: TagsApi;
  volumes: VolumesApi;

  storage: StorageApi;
}

export function createBackendApi(config: BackendClientConfig): BackendApi {
  const client = createBackendClient(config);

  return {
    client,
    activityLogs: createActivityLogsApi(client),
    ably: createAblyApi(client),

    analytics: createAnalyticsApi(client),
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
    notifications: createNotificationsApi(client),
    overview: createOverviewApi(client),
    payments: createPaymentsApi(client),
    userOverview: createUserOverviewApi(client),
    deployments: createDeploymentsApi(client),
    workspaces: createWorkspacesApi(client),
    settings: createSettingsApi(client),
    teams: createTeamsApi(client),
    regions: createRegionsApi(client),
    sandboxes: createSandboxesApi(client),

    scaling: createScalingApi(client),
    tags: createTagsApi(client),
    volumes: createVolumesApi(client),

    storage: createStorageApi(client),
  };
}
