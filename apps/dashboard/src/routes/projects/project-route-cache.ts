import type { ProjectDetailRouteProject } from "./project-detail.types";

interface ProjectCacheEntry {
  data: ProjectDetailRouteProject;
  fetchedAt: number;
}

export const PROJECT_CACHE_TTL = 300_000;

export const projectCache = new Map<string, ProjectCacheEntry>();

export function getProjectCacheKey(projectId: string, workspace?: string): string {
  return `${projectId}:${workspace ?? ""}`;
}

export function markProjectCacheStale() {
  for (const [key, entry] of projectCache.entries()) {
    projectCache.set(key, { ...entry, fetchedAt: 0 });
  }
}

export function deleteProjectCacheEntries(projectIds: string[], workspace?: string) {
  const targetWorkspace = workspace?.trim() ?? "";
  const ids = new Set(
    projectIds
      .map((projectId) => projectId.trim().toLowerCase())
      .filter((projectId) => projectId.length > 0),
  );

  for (const key of projectCache.keys()) {
    const [cachedProjectId, cachedWorkspace = ""] = key.split(":");
    if (cachedWorkspace === targetWorkspace && ids.has(cachedProjectId.trim().toLowerCase())) {
      projectCache.delete(key);
    }
  }
}
