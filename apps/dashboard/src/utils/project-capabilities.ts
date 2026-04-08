import type { Project } from "@/backend/projects";
import { ServiceType } from "@brimble/models/dist/enum";

const GIT_SOURCE_TYPES = new Set([
  "github",
  "gitlab",
  "bitbucket",
  "GITHUB",
  "GITLAB",
  "BITBUCKET",
]);

function normalize(value?: string): string {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeProjectServiceType(value?: string): string {
  return normalize(value);
}

export function isDatabaseProject(project?: Pick<Project, "serviceType"> | null): boolean {
  return normalizeProjectServiceType(project?.serviceType) === ServiceType.Database;
}

export function isStaticProject(project?: Pick<Project, "serviceType"> | null): boolean {
  return normalizeProjectServiceType(project?.serviceType) === ServiceType.Static;
}

export function isWorkerProject(project?: Pick<Project, "serviceType"> | null): boolean {
  return normalizeProjectServiceType(project?.serviceType) === ServiceType.Worker;
}

export function isMcpProject(project?: Pick<Project, "serviceType"> | null): boolean {
  return normalizeProjectServiceType(project?.serviceType) === ServiceType.Mcp;
}

export function isWebServiceProject(project?: Pick<Project, "serviceType"> | null): boolean {
  return normalizeProjectServiceType(project?.serviceType) === ServiceType.WebService;
}

export function isWebLikeProject(project?: Pick<Project, "serviceType"> | null): boolean {
  return isWebServiceProject(project) || isStaticProject(project);
}

export function isDeployableServiceProject(project?: Pick<Project, "serviceType"> | null): boolean {
  return (
    isWebServiceProject(project) ||
    isStaticProject(project) ||
    isWorkerProject(project) ||
    isMcpProject(project)
  );
}

export function isGitBackedRepoGit(gitType?: string): boolean {
  return GIT_SOURCE_TYPES.has(String(gitType ?? "").trim());
}

export function isGitBackedProject(project?: Pick<Project, "repo"> | null): boolean {
  return isGitBackedRepoGit(project?.repo?.git);
}

export function isDockerSourceProject(project?: Pick<Project, "repo" | "framework"> | null): boolean {
  const gitType = normalize(project?.repo?.git);
  const framework = normalize(project?.framework);
  return gitType === "docker" || framework === "docker";
}

export function shouldShowProjectDomainsTab(project?: Pick<Project, "serviceType"> | null): boolean {
  if (isDatabaseProject(project) || isWorkerProject(project)) {
    return false;
  }

  return true;
}

export function shouldShowProjectObservabilityTab(project?: Pick<Project, "serviceType"> | null): boolean {
  return !isStaticProject(project);
}

export function shouldShowProjectWebAnalyticsTab(project?: Pick<Project, "serviceType"> | null): boolean {
  return isWebLikeProject(project);
}

export function shouldShowProjectEnvironmentTab(project?: Pick<Project, "framework" | "serviceType"> | null): boolean {
  const framework = normalize(project?.framework);
  if (framework === "html") {
    return false;
  }

  return true;
}

export function shouldShowProjectVisitSite(project?: Pick<Project, "serviceType"> | null): boolean {
  return isWebLikeProject(project);
}

export function canRedeployProject(project?: Pick<Project, "serviceType"> | null): boolean {
  return !isDatabaseProject(project);
}

export function shouldShowDeploymentHistoryTab(project?: Pick<Project, "serviceType"> | null): boolean {
  return !isDatabaseProject(project);
}

export function shouldShowProjectLogsTab(project?: Pick<Project, "serviceType"> | null): boolean {
  if (isStaticProject(project)) {
    return false;
  }

  return true;
}

export function shouldShowBuildCacheToggle(
  project?: Pick<Project, "serviceType"> | null,
): boolean {
  if (isDatabaseProject(project) || isStaticProject(project)) {
    return false;
  }

  return true;
}

export function shouldShowMcpAuthToggle(project?: Pick<Project, "serviceType"> | null): boolean {
  return isMcpProject(project);
}

export function shouldShowBranchRootFrameworkFields(
  project?: Pick<Project, "repo"> | null,
): boolean {
  return isGitBackedProject(project);
}

export function shouldShowDockerSourceFields(
  project?: Pick<Project, "repo" | "framework"> | null,
): boolean {
  return !isGitBackedProject(project as any) || isDockerSourceProject(project);
}

export function shouldShowBuildSection(project?: Pick<Project, "serviceType"> | null): boolean {
  return !isDatabaseProject(project);
}

export function shouldShowHealthCheckField(project?: Pick<Project, "serviceType"> | null): boolean {
  if (isDatabaseProject(project) || isWorkerProject(project) || isStaticProject(project)) {
    return false;
  }

  return true;
}

export function shouldShowScalingGroupField(project?: Pick<Project, "serviceType"> | null): boolean {
  if (isDatabaseProject(project) || isStaticProject(project) || isWorkerProject(project)) {
    return false;
  }

  return true;
}

export function shouldShowPersistentStorageField(project?: Pick<Project, "serviceType"> | null): boolean {
  if (isStaticProject(project)) {
    return false;
  }

  return true;
}

export function getConfigurationDescription(project?: Pick<Project, "serviceType"> | null): string {
  if (isDatabaseProject(project)) {
    return "Manage your database settings, access controls, and compute resources.";
  }

  if (isWorkerProject(project)) {
    return "Manage your worker service settings, including branch, root directory, and deployment configuration.";
  }

  return "Manage your project settings and deployment configuration.";
}
