import type { ApiClient, ApiListResponse } from "./types";
import { notImplemented } from "./utils";

export interface Project {
  id: string;
  name: string;
  slug: string;
  framework?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProjectInput {
  name: string;
  slug?: string;
  repositoryId?: string;
  framework?: string;
  rootDirectory?: string;
}

export interface UpdateProjectInput {
  name?: string;
  framework?: string;
  rootDirectory?: string;
}

export interface ProjectsApi {
  list(): Promise<ApiListResponse<Project>>;
  getById(projectId: string): Promise<Project>;
  create(input: CreateProjectInput): Promise<Project>;
  update(projectId: string, input: UpdateProjectInput): Promise<Project>;
  remove(projectId: string): Promise<void>;
}

export function createProjectsApi(client: ApiClient): ProjectsApi {
  void client;

  return {
    list: () => notImplemented<ApiListResponse<Project>>("projects", "list"),
    getById: () => notImplemented<Project>("projects", "getById"),
    create: () => notImplemented<Project>("projects", "create"),
    update: () => notImplemented<Project>("projects", "update"),
    remove: () => notImplemented<void>("projects", "remove"),
  };
}
