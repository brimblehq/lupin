import type { ApiClient, ApiListResponse } from "./types";
import { notImplemented } from "./utils";

export interface DomainRecord {
  id: string;
  name: string;
  projectId?: string;
  status?: "pending" | "verifying" | "active" | "failed";
}

export interface AddDomainInput {
  name: string;
  projectId?: string;
}

export interface DomainsApi {
  list(projectId?: string): Promise<ApiListResponse<DomainRecord>>;
  add(input: AddDomainInput): Promise<DomainRecord>;
  verify(domainId: string): Promise<DomainRecord>;
  remove(domainId: string): Promise<void>;
}

export function createDomainsApi(client: ApiClient): DomainsApi {
  void client;

  return {
    list: () => notImplemented<ApiListResponse<DomainRecord>>("domains", "list"),
    add: () => notImplemented<DomainRecord>("domains", "add"),
    verify: () => notImplemented<DomainRecord>("domains", "verify"),
    remove: () => notImplemented<void>("domains", "remove"),
  };
}
