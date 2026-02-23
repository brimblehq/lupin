import type { ApiClient, ApiListResponse } from "./types";
import { notImplemented } from "./utils";

export interface Workspace {
  id: string;
  name: string;
  slug?: string;
  role?: "owner" | "admin" | "member" | "viewer";
}

export interface CreateWorkspaceInput {
  name: string;
  teamSize?: number;
}

export interface WorkspacesApi {
  list(): Promise<ApiListResponse<Workspace>>;
  getById(workspaceId: string): Promise<Workspace>;
  create(input: CreateWorkspaceInput): Promise<Workspace>;
  switchWorkspace(workspaceId: string): Promise<void>;
}

export function createWorkspacesApi(client: ApiClient): WorkspacesApi {
  void client;

  return {
    list: () => notImplemented<ApiListResponse<Workspace>>("workspaces", "list"),
    getById: () => notImplemented<Workspace>("workspaces", "getById"),
    create: () => notImplemented<Workspace>("workspaces", "create"),
    switchWorkspace: () => notImplemented<void>("workspaces", "switchWorkspace"),
  };
}
