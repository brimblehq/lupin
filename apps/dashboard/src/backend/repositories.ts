import type { ApiClient } from "./types";
import { asRecord, asString, asStringOrNumber, pickNumber, pickString } from "./normalize";
import { BackendApiError } from "./errors";

export const CONNECT_EXPIRED_PREFIX = "CONNECT_EXPIRED:";
export const CONNECT_AUTH_REQUIRED_PREFIX = "CONNECT_AUTH_REQUIRED:";

function mapConnectError(error: unknown, providerName: string): never {
  if (error instanceof BackendApiError) {
    if (error.status === 400) {
      throw new Error(`${CONNECT_EXPIRED_PREFIX}Connection expired, please try again.`);
    }
    if (error.status === 401) {
      throw new Error(`${CONNECT_AUTH_REQUIRED_PREFIX}You need to sign in again to connect ${providerName}.`);
    }
  }
  throw error instanceof Error ? error : new Error(`We could not start ${providerName} connection right now. Please try again.`);
}

export interface GithubAccount {
  id?: string;
  name?: string;
  username?: string;
  avatar?: string;
  installationId?: number | string;
  type?: "User" | "Organization" | string;
}

export interface GithubAccountsResult {
  accounts: GithubAccount[];
  authenticated: boolean;
}

export interface GithubInstallUrlResult {
  url: string;
}

export interface GithubConnectUrlResult {
  url: string;
}

export interface GitlabConnectUrlResult {
  url: string;
}

export interface GithubRepoListItem {
  id?: number | string;
  name: string;
  fullName: string;
  private: boolean;
  installationId?: number | string;
  branch?: string;
  language?: string;
}

export interface GithubRepoListResult {
  repositories: GithubRepoListItem[];
  currentPage?: number;
  totalPages?: number;
}

export type GitlabAccount = GithubAccount;
export type GitlabAccountsResult = GithubAccountsResult;
export type GitlabRepoListItem = GithubRepoListItem;
export type GitlabRepoListResult = GithubRepoListResult;

export type BitbucketConnectUrlResult = GitlabConnectUrlResult;
export type BitbucketAccount = GithubAccount;
export type BitbucketAccountsResult = GithubAccountsResult;
export type BitbucketRepoListItem = GithubRepoListItem;
export type BitbucketRepoListResult = GithubRepoListResult;

export interface RepositoryMetadata {
  name?: string;
  fullName?: string;
  branch?: string;
  installationId?: number | string;
  branches: string[];
  framework?: RepositoryFrameworkDefaults;
}

export interface RepositoryFrameworkDefaults {
  slug?: string;
  name?: string;
  installCommand?: string;
  buildCommand?: string;
  startCommand?: string;
  outputDirectory?: string;
  logo?: string;
  port?: number;
  type?: string;
  tooltipMessage?: string;
}

export interface RepositoryDirectoryEntry {
  name: string;
  type: "dir" | "file";
  path: string;
  sha?: string;
  framework?: RepositoryFrameworkDefaults;
}

export interface RepositoryRootDirResult {
  rootDir: RepositoryDirectoryEntry[];
  framework?: RepositoryFrameworkDefaults;
}

export interface RepositoriesApi {
  getGithubInstallUrl(): Promise<GithubInstallUrlResult>;
  getGithubConnectUrl(input?: { device?: string }): Promise<GithubConnectUrlResult>;
  getGitlabConnectUrl(input?: { device?: string }): Promise<GitlabConnectUrlResult>;
  listGithubAccounts(): Promise<GithubAccountsResult>;
  listGithubRepos(input?: { q?: string; page?: number; limit?: number; installationId?: number | string }): Promise<GithubRepoListResult>;
  getGithubRepo(input: { repoName: string; installationId?: number | string }): Promise<RepositoryMetadata>;
  getGithubRootDir(input: {
    repoName: string;
    branch: string;
    installationId?: number | string;
    path?: string;
  }): Promise<RepositoryRootDirResult>;
  listGitlabAccounts(): Promise<GitlabAccountsResult>;
  listGitlabRepos(input?: { q?: string; page?: number; limit?: number; installationId?: number | string }): Promise<GitlabRepoListResult>;
  getGitlabRepo(input: { repoName: string; installationId?: number | string }): Promise<RepositoryMetadata>;
  getGitlabRootDir(input: {
    repoName: string;
    branch: string;
    installationId?: number | string;
    path?: string;
  }): Promise<RepositoryRootDirResult>;
  getBitbucketConnectUrl(input?: { device?: string }): Promise<BitbucketConnectUrlResult>;
  listBitbucketAccounts(): Promise<BitbucketAccountsResult>;
  listBitbucketRepos(input?: {
    q?: string;
    page?: number;
    limit?: number;
    installationId?: number | string;
  }): Promise<BitbucketRepoListResult>;
  getBitbucketRepo(input: { repoName: string; installationId?: number | string }): Promise<RepositoryMetadata>;
  getBitbucketRootDir(input: {
    repoName: string;
    branch: string;
    installationId?: number | string;
    path?: string;
  }): Promise<RepositoryRootDirResult>;
}

function mapRepositoryFrameworkDefaults(value: unknown): RepositoryFrameworkDefaults | undefined {
  const row = asRecord(value);
  if (!row) return undefined;

  return {
    slug: pickString(row, "slug"),
    name: pickString(row, "name"),
    installCommand: pickString(row, "installCommand"),
    buildCommand: pickString(row, "buildCommand"),
    startCommand: pickString(row, "startCommand"),
    outputDirectory: pickString(row, "outputDirectory"),
    logo: pickString(row, "logo"),
    port: pickNumber(row, "port"),
    type: pickString(row, "type"),
    tooltipMessage: pickString(row, "tooltipMessage"),
  };
}

export function createRepositoriesApi(client: ApiClient): RepositoriesApi {
  return {
    async getGithubInstallUrl() {
      try {
        const response = await client.request<any>("/auth/github/install-url", {
          method: "GET",
        });

        const root = response?.data?.data ?? response?.data ?? response ?? {};
        const row = asRecord(root);
        const url = row ? pickString(row, "url") : undefined;

        if (!url) {
          throw new Error("We could not start GitHub installation right now. Please refresh and try again.");
        }

        return { url } satisfies GithubInstallUrlResult;
      } catch (error) {
        mapConnectError(error, "GitHub");
      }
    },
    async getGithubConnectUrl(input) {
      try {
        const response = await client.request<any>("/auth/github/connect-url", {
          method: "GET",
          query: {
            device: input?.device,
          },
        });

        const root = response?.data?.data ?? response?.data ?? response ?? {};
        const row = asRecord(root);
        const url = row ? pickString(row, "url") : undefined;

        if (!url) {
          throw new Error("We could not start GitHub connection right now. Please refresh and try again.");
        }

        return { url } satisfies GithubConnectUrlResult;
      } catch (error) {
        mapConnectError(error, "GitHub");
      }
    },
    async getGitlabConnectUrl(input) {
      try {
        const response = await client.request<any>("/auth/gitlab/connect-url", {
          method: "GET",
          query: {
            device: input?.device,
          },
        });

        const root = response?.data?.data ?? response?.data ?? response ?? {};
        const row = asRecord(root);
        const url = row ? pickString(row, "url") : undefined;

        if (!url) {
          throw new Error("We could not start GitLab connection right now. Please refresh and try again.");
        }

        return { url } satisfies GitlabConnectUrlResult;
      } catch (error) {
        mapConnectError(error, "GitLab");
      }
    },
    async listGithubAccounts() {
      const response = await client.request<any>("/core/v1/accounts/github", {
        method: "GET",
      });

      const root = response?.data?.data ?? response?.data ?? response ?? [];
      const rootRecord = asRecord(root);
      const authenticated = rootRecord?.authenticated === true;
      const items = Array.isArray(root)
        ? root
        : Array.isArray(rootRecord?.accounts)
          ? rootRecord.accounts
          : Array.isArray(rootRecord?.items)
            ? rootRecord.items
            : Array.isArray(rootRecord?.installations)
              ? rootRecord.installations
              : [];

      const mapped = items
        .map((item: unknown) => {
          const row = asRecord(item);
          if (!row) return null;
          const accountRow = asRecord(row.account) ?? asRecord(row.owner) ?? asRecord(row.organization);
          const installationRow = asRecord(row.installation) ?? asRecord(row.installationInfo);
          const installationId =
            asStringOrNumber(row.installationId) ??
            asStringOrNumber(row.installation_id) ??
            asStringOrNumber(row.id) ??
            asStringOrNumber(row._id) ??
            asStringOrNumber(installationRow?.id) ??
            asStringOrNumber(installationRow?._id);
          const username = pickString(row, "username", "login", "slug") ?? pickString(accountRow, "username", "login", "slug");

          return {
            id: pickString(row, "id", "_id") ?? pickString(accountRow, "id", "_id") ?? asString(installationId),
            name: pickString(row, "name") ?? pickString(accountRow, "name") ?? username,
            username,
            avatar: pickString(row, "avatar", "avatarUrl", "avatar_url") ?? pickString(accountRow, "avatar", "avatarUrl", "avatar_url"),
            installationId,
            type: pickString(row, "type", "target_type", "targetType") ?? pickString(accountRow, "type"),
          } satisfies GithubAccount;
        })
        .filter((item): item is GithubAccount => item !== null)
        .filter((item) => Boolean(item.installationId || item.username || item.name));

      const deduped = new Map<string, GithubAccount>();
      for (const account of mapped) {
        const key = String(account.installationId ?? "") || `${account.type ?? ""}:${account.id ?? account.username ?? account.name ?? ""}`;
        if (!key) continue;
        if (!deduped.has(key)) {
          deduped.set(key, account);
        }
      }

      return { accounts: [...deduped.values()], authenticated };
    },
    async listGithubRepos(input) {
      const response = await client.request<any>("/core/v1/repos/github", {
        method: "GET",
        query: {
          q: input?.q,
          page: input?.page,
          limit: input?.limit,
          installationId: input?.installationId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rawRepositories = Array.isArray(root?.repositories) ? root.repositories : Array.isArray(root) ? root : [];

      const repositories = rawRepositories
        .map((item: unknown) => {
          const row = asRecord(item);
          if (!row) return null;

          const fullName = pickString(row, "full_name", "fullName");
          const name = pickString(row, "name") ?? fullName ?? "";
          if (!name || !fullName) return null;

          return {
            id: typeof row.id === "number" || typeof row.id === "string" ? row.id : undefined,
            name,
            fullName,
            private: Boolean(row.private),
            installationId: asStringOrNumber(row.installationId) ?? asStringOrNumber(row.installation_id),
            branch: pickString(row, "branch", "default_branch"),
            language: pickString(row, "language"),
          } satisfies GithubRepoListItem;
        })
        .filter((item): item is GithubRepoListItem => item !== null);

      return {
        repositories,
        currentPage: typeof root?.currentPage === "number" ? root.currentPage : undefined,
        totalPages: typeof root?.totalPages === "number" ? root.totalPages : undefined,
      } satisfies GithubRepoListResult;
    },
    async getGithubRepo(input) {
      const response = await client.request<any>("/core/v1/repos/github/repo", {
        method: "GET",
        query: {
          repoName: input.repoName,
          installationId: input.installationId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rawBranches = Array.isArray(root?.branches) ? root.branches : [];

      const branches = rawBranches
        .map((branch: unknown) => {
          return asString(branch) ?? pickString(asRecord(branch), "name") ?? "";
        })
        .filter(Boolean);

      const rootRecord = asRecord(root);

      return {
        name: pickString(rootRecord, "name"),
        fullName: pickString(rootRecord, "full_name", "fullName"),
        branch: pickString(rootRecord, "branch", "default_branch"),
        installationId: asStringOrNumber(rootRecord?.installationId) ?? asStringOrNumber(input.installationId),
        branches,
        framework: mapRepositoryFrameworkDefaults(rootRecord?.framework),
      };
    },
    async getGithubRootDir(input) {
      const response = await client.request<any>("/core/v1/repos/github/rootDir", {
        method: "GET",
        query: {
          repoName: input.repoName,
          installationId: input.installationId,
          branch: input.branch,
          path: input.path,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rawDirs = Array.isArray(root?.rootDir) ? root.rootDir : [];

      const mappedDirs: RepositoryDirectoryEntry[] = rawDirs
        .map((entry: any) => {
          const row = asRecord(entry) ?? {};
          let type: "dir" | "file" = "file";
          if (row.type === "dir") {
            type = "dir";
          }

          return {
            name: pickString(row, "name") ?? "",
            type,
            path: pickString(row, "path") ?? "",
            sha: pickString(row, "sha"),
            framework: mapRepositoryFrameworkDefaults(row.framework),
          } satisfies RepositoryDirectoryEntry;
        })
        .filter((entry) => entry.name && entry.path);

      return {
        rootDir: mappedDirs,
        framework: mapRepositoryFrameworkDefaults(asRecord(root)?.framework),
      };
    },
    async listGitlabAccounts() {
      const response = await client.request<any>("/core/v1/accounts/gitlab", {
        method: "GET",
      });

      const root = response?.data?.data ?? response?.data ?? response ?? [];
      const rootRecord = asRecord(root);
      const authenticated = rootRecord?.authenticated === true;
      const items = Array.isArray(root)
        ? root
        : Array.isArray(rootRecord?.accounts)
          ? rootRecord.accounts
          : Array.isArray(rootRecord?.items)
            ? rootRecord.items
            : Array.isArray(rootRecord?.groups)
              ? rootRecord.groups
              : Array.isArray(rootRecord?.namespaces)
                ? rootRecord.namespaces
                : [];

      const mapped = items
        .map((item: unknown) => {
          const row = asRecord(item);
          if (!row) return null;
          const accountRow = asRecord(row.account) ?? asRecord(row.owner) ?? asRecord(row.namespace);
          const installationId =
            asStringOrNumber(row.groupId) ??
            asStringOrNumber(row.group_id) ??
            asStringOrNumber(row.installationId) ??
            asStringOrNumber(row.installation_id) ??
            asStringOrNumber(row.id) ??
            asStringOrNumber(row._id) ??
            asStringOrNumber(accountRow?.id) ??
            asStringOrNumber(accountRow?._id);
          const username =
            pickString(row, "username", "login", "slug", "path") ?? pickString(accountRow, "username", "login", "slug", "path");

          return {
            id: pickString(row, "id", "_id") ?? pickString(accountRow, "id", "_id") ?? asString(installationId),
            name: pickString(row, "name") ?? pickString(accountRow, "name") ?? username,
            username,
            avatar: pickString(row, "avatar", "avatarUrl", "avatar_url") ?? pickString(accountRow, "avatar", "avatarUrl", "avatar_url"),
            installationId,
            type: pickString(row, "type", "kind") ?? pickString(accountRow, "type", "kind"),
          } satisfies GitlabAccount;
        })
        .filter((item): item is GitlabAccount => item !== null)
        .filter((item) => Boolean(item.installationId || item.username || item.name));

      const deduped = new Map<string, GitlabAccount>();
      for (const account of mapped) {
        const key = String(account.installationId ?? "") || `${account.type ?? ""}:${account.id ?? account.username ?? account.name ?? ""}`;
        if (!key) continue;
        if (!deduped.has(key)) {
          deduped.set(key, account);
        }
      }

      return { accounts: [...deduped.values()], authenticated };
    },
    async listGitlabRepos(input) {
      const response = await client.request<any>("/core/v1/repos/gitlab", {
        method: "GET",
        query: {
          q: input?.q,
          page: input?.page,
          limit: input?.limit,
          groupId: input?.installationId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rawRepositories = Array.isArray(root?.repositories) ? root.repositories : Array.isArray(root) ? root : [];

      const repositories = rawRepositories
        .map((item: unknown) => {
          const row = asRecord(item);
          if (!row) return null;

          const fullName = pickString(row, "full_name", "fullName", "path_with_namespace") ?? pickString(row, "fullName");
          const name = pickString(row, "name") ?? fullName ?? "";
          if (!name || !fullName) return null;

          return {
            id: typeof row.id === "number" || typeof row.id === "string" ? row.id : undefined,
            name,
            fullName,
            private: Boolean(row.private ?? row.visibility === "private"),
            installationId:
              asStringOrNumber(row.groupId) ??
              asStringOrNumber(row.group_id) ??
              asStringOrNumber(row.installationId) ??
              asStringOrNumber(row.installation_id) ??
              asStringOrNumber(row.namespace_id),
            branch: pickString(row, "branch", "default_branch"),
            language: pickString(row, "language"),
          } satisfies GitlabRepoListItem;
        })
        .filter((item): item is GitlabRepoListItem => item !== null);

      return {
        repositories,
        currentPage: typeof root?.currentPage === "number" ? root.currentPage : undefined,
        totalPages: typeof root?.totalPages === "number" ? root.totalPages : undefined,
      } satisfies GitlabRepoListResult;
    },
    async getGitlabRepo(input) {
      const response = await client.request<any>("/core/v1/repos/gitlab/repo", {
        method: "GET",
        query: {
          repoName: input.repoName,
          groupId: input.installationId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rawBranches = Array.isArray(root?.branches) ? root.branches : [];

      const branches = rawBranches
        .map((branch: unknown) => {
          return asString(branch) ?? pickString(asRecord(branch), "name") ?? "";
        })
        .filter(Boolean);

      const rootRecord = asRecord(root);

      return {
        name: pickString(rootRecord, "name"),
        fullName: pickString(rootRecord, "full_name", "fullName", "path_with_namespace"),
        branch: pickString(rootRecord, "branch", "default_branch"),
        installationId:
          asStringOrNumber(rootRecord?.groupId) ??
          asStringOrNumber(rootRecord?.group_id) ??
          asStringOrNumber(rootRecord?.installationId) ??
          asStringOrNumber(input.installationId),
        branches,
        framework: mapRepositoryFrameworkDefaults(rootRecord?.framework),
      };
    },
    async getGitlabRootDir(input) {
      const response = await client.request<any>("/core/v1/repos/gitlab/rootDir", {
        method: "GET",
        query: {
          repoName: input.repoName,
          groupId: input.installationId,
          branch: input.branch,
          path: input.path,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rawDirs = Array.isArray(root?.rootDir) ? root.rootDir : [];

      const mappedDirs: RepositoryDirectoryEntry[] = rawDirs
        .map((entry: any) => {
          const row = asRecord(entry) ?? {};
          let type: "dir" | "file" = "file";
          if (row.type === "dir" || row.type === "tree") {
            type = "dir";
          }

          return {
            name: pickString(row, "name") ?? "",
            type,
            path: pickString(row, "path") ?? "",
            sha: pickString(row, "sha", "id"),
            framework: mapRepositoryFrameworkDefaults(row.framework),
          } satisfies RepositoryDirectoryEntry;
        })
        .filter((entry) => entry.name && entry.path);

      return {
        rootDir: mappedDirs,
        framework: mapRepositoryFrameworkDefaults(asRecord(root)?.framework),
      };
    },
    async getBitbucketConnectUrl(input) {
      try {
        const response = await client.request<any>("/auth/bitbucket/connect-url", {
          method: "GET",
          query: { device: input?.device },
        });

        const root = response?.data?.data ?? response?.data ?? response ?? {};
        const row = asRecord(root);
        const url = row ? pickString(row, "url") : undefined;

        if (!url) {
          throw new Error("We could not start Bitbucket connection right now. Please refresh and try again.");
        }

        return { url } satisfies BitbucketConnectUrlResult;
      } catch (error) {
        mapConnectError(error, "Bitbucket");
      }
    },
    async listBitbucketAccounts() {
      const response = await client.request<any>("/core/v1/accounts/bitbucket", {
        method: "GET",
      });

      const root = response?.data?.data ?? response?.data ?? response ?? [];
      const rootRecord = asRecord(root);
      const authenticated = rootRecord?.authenticated === true;
      const items = Array.isArray(root)
        ? root
        : Array.isArray(rootRecord?.accounts)
          ? rootRecord.accounts
          : Array.isArray(rootRecord?.items)
            ? rootRecord.items
            : Array.isArray(rootRecord?.workspaces)
              ? rootRecord.workspaces
              : [];

      const mapped = items
        .map((item: unknown) => {
          const row = asRecord(item);
          if (!row) return null;
          const accountRow = asRecord(row.account) ?? asRecord(row.owner) ?? asRecord(row.workspace);
          const installationId =
            asStringOrNumber(row.workspaceId) ??
            asStringOrNumber(row.workspace_id) ??
            asStringOrNumber(row.installationId) ??
            asStringOrNumber(row.installation_id) ??
            asStringOrNumber(row.uuid) ??
            asStringOrNumber(row.id) ??
            asStringOrNumber(row._id) ??
            asStringOrNumber(accountRow?.id) ??
            asStringOrNumber(accountRow?._id);
          const username = pickString(row, "username", "login", "slug") ?? pickString(accountRow, "username", "login", "slug");

          return {
            id: pickString(row, "id", "_id") ?? pickString(accountRow, "id", "_id") ?? asString(installationId),
            name: pickString(row, "name", "display_name") ?? pickString(accountRow, "name", "display_name") ?? username,
            username,
            avatar: pickString(row, "avatar", "avatarUrl", "avatar_url") ?? pickString(accountRow, "avatar", "avatarUrl", "avatar_url"),
            installationId,
            type: pickString(row, "type", "kind") ?? pickString(accountRow, "type", "kind"),
          } satisfies BitbucketAccount;
        })
        .filter((item): item is BitbucketAccount => item !== null)
        .filter((item) => Boolean(item.installationId || item.username || item.name));

      const deduped = new Map<string, BitbucketAccount>();
      for (const account of mapped) {
        const key = String(account.installationId ?? "") || `${account.type ?? ""}:${account.id ?? account.username ?? account.name ?? ""}`;
        if (!key) continue;
        if (!deduped.has(key)) {
          deduped.set(key, account);
        }
      }

      return { accounts: [...deduped.values()], authenticated };
    },
    async listBitbucketRepos(input) {
      const response = await client.request<any>("/core/v1/repos/bitbucket", {
        method: "GET",
        query: {
          q: input?.q,
          page: input?.page,
          limit: input?.limit,
          workspaceId: input?.installationId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rawRepositories = Array.isArray(root?.repositories)
        ? root.repositories
        : Array.isArray(root?.values)
          ? root.values
          : Array.isArray(root)
            ? root
            : [];

      const repositories = rawRepositories
        .map((item: unknown) => {
          const row = asRecord(item);
          if (!row) return null;

          const fullName = pickString(row, "full_name", "fullName");
          const name = pickString(row, "name", "slug") ?? fullName ?? "";
          if (!name || !fullName) return null;

          const mainBranch = asRecord(row.mainbranch);

          return {
            id: typeof row.id === "number" || typeof row.id === "string" ? row.id : undefined,
            name,
            fullName,
            private: Boolean(row.private ?? row.is_private),
            installationId:
              asStringOrNumber(row.workspaceId) ??
              asStringOrNumber(row.workspace_id) ??
              asStringOrNumber(row.installationId) ??
              asStringOrNumber(row.installation_id),
            branch: pickString(row, "branch", "default_branch") ?? pickString(mainBranch, "name"),
            language: pickString(row, "language"),
          } satisfies BitbucketRepoListItem;
        })
        .filter((item): item is BitbucketRepoListItem => item !== null);

      return {
        repositories,
        currentPage: typeof root?.currentPage === "number" ? root.currentPage : typeof root?.page === "number" ? root.page : undefined,
        totalPages: typeof root?.totalPages === "number" ? root.totalPages : undefined,
      } satisfies BitbucketRepoListResult;
    },
    async getBitbucketRepo(input) {
      const response = await client.request<any>("/core/v1/repos/bitbucket/repo", {
        method: "GET",
        query: {
          repoName: input.repoName,
          workspaceId: input.installationId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rawBranches = Array.isArray(root?.branches) ? root.branches : [];

      const branches = rawBranches
        .map((branch: unknown) => {
          return asString(branch) ?? pickString(asRecord(branch), "name") ?? "";
        })
        .filter(Boolean);

      const rootRecord = asRecord(root);
      const mainBranch = asRecord(rootRecord?.mainbranch);

      return {
        name: pickString(rootRecord, "name", "slug"),
        fullName: pickString(rootRecord, "full_name", "fullName"),
        branch: pickString(rootRecord, "branch", "default_branch") ?? pickString(mainBranch, "name"),
        installationId:
          asStringOrNumber(rootRecord?.workspaceId) ??
          asStringOrNumber(rootRecord?.workspace_id) ??
          asStringOrNumber(rootRecord?.installationId) ??
          asStringOrNumber(input.installationId),
        branches,
        framework: mapRepositoryFrameworkDefaults(rootRecord?.framework),
      };
    },
    async getBitbucketRootDir(input) {
      const response = await client.request<any>("/core/v1/repos/bitbucket/rootDir", {
        method: "GET",
        query: {
          repoName: input.repoName,
          workspaceId: input.installationId,
          branch: input.branch,
          path: input.path,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rawDirs = Array.isArray(root?.rootDir) ? root.rootDir : [];

      const mappedDirs: RepositoryDirectoryEntry[] = rawDirs
        .map((entry: any) => {
          const row = asRecord(entry) ?? {};
          let type: "dir" | "file" = "file";
          if (row.type === "dir" || row.type === "commit_directory") {
            type = "dir";
          }

          return {
            name: pickString(row, "name") ?? "",
            type,
            path: pickString(row, "path") ?? "",
            sha: pickString(row, "sha", "commit", "hash"),
            framework: mapRepositoryFrameworkDefaults(row.framework),
          } satisfies RepositoryDirectoryEntry;
        })
        .filter((entry) => entry.name && entry.path);

      return {
        rootDir: mappedDirs,
        framework: mapRepositoryFrameworkDefaults(asRecord(root)?.framework),
      };
    },
  };
}
