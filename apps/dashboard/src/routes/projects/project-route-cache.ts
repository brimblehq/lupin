import type { ProjectDetailRouteProject } from "./project-detail.types";

interface ProjectCacheEntry {
  data: ProjectDetailRouteProject;
  fetchedAt: number;
}

export const PROJECT_CACHE_TTL = 300_000;

export const projectCache = new Map<string, ProjectCacheEntry>();

export function markProjectCacheStale() {
  for (const [key, entry] of projectCache.entries()) {
    projectCache.set(key, { ...entry, fetchedAt: 0 });
  }
}
