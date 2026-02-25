import type { ApiClient } from "./types";
import { asRecord, asString, asStringOrNumber, pickString } from "./normalize";

export interface GithubAccount {
  id?: string;
  name?: string;
  username?: string;
  avatar?: string;
  installationId?: number | string;
  type?: "User" | "Organization" | string;
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
  listGithubAccounts(): Promise<GithubAccount[]>;
  listGithubRepos(input?: {
    q?: string;
    page?: number;
    limit?: number;
    installationId?: number | string;
  }): Promise<GithubRepoListResult>;
  getGithubRepo(input: {
    repoName: string;
    installationId?: number | string;
  }): Promise<RepositoryMetadata>;
  getGithubRootDir(input: {
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
  };
}

export function createRepositoriesApi(client: ApiClient): RepositoriesApi {
  return {
    async listGithubAccounts() {
      const response = await client.request<any>("/core/v1/accounts/github", {
        method: "GET",
      });

      const root = response?.data?.data ?? response?.data ?? response ?? [];
      const items = Array.isArray(root) ? root : [];

      return items
        .map((item: unknown) => {
          const row = asRecord(item);
          if (!row) return null;
          const accountRow = asRecord(row.account) ?? asRecord(row.owner);
          const installationRow = asRecord(row.installation);

          return {
            id:
              pickString(row, "id", "_id") ??
              pickString(accountRow, "id", "_id"),
            name: pickString(row, "name") ?? pickString(accountRow, "name"),
            username:
              pickString(row, "username", "login") ??
              pickString(accountRow, "username", "login"),
            avatar:
              pickString(row, "avatar", "avatarUrl", "avatar_url") ??
              pickString(accountRow, "avatar", "avatarUrl", "avatar_url"),
            installationId:
              asStringOrNumber(row.installationId) ??
              asStringOrNumber(row.installation_id) ??
              asStringOrNumber(installationRow?.id),
            type: pickString(row, "type") ?? pickString(accountRow, "type"),
          } satisfies GithubAccount;
        })
        .filter((item): item is GithubAccount => item !== null);
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
      const rawRepositories = Array.isArray(root?.repositories)
        ? root.repositories
        : Array.isArray(root)
          ? root
          : [];

      const repositories = rawRepositories
        .map((item: unknown) => {
          const row = asRecord(item);
          if (!row) return null;

          const fullName = pickString(row, "full_name", "fullName");
          const name = pickString(row, "name") ?? fullName ?? "";
          if (!name || !fullName) return null;

          return {
            id:
              typeof row.id === "number" || typeof row.id === "string"
                ? row.id
                : undefined,
            name,
            fullName,
            private: Boolean(row.private),
            installationId:
              asStringOrNumber(row.installationId) ??
              asStringOrNumber(row.installation_id),
            branch: pickString(row, "branch", "default_branch"),
            language: pickString(row, "language"),
          } satisfies GithubRepoListItem;
        })
        .filter((item): item is GithubRepoListItem => item !== null);

      return {
        repositories,
        currentPage:
          typeof root?.currentPage === "number" ? root.currentPage : undefined,
        totalPages:
          typeof root?.totalPages === "number" ? root.totalPages : undefined,
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
        installationId:
          asStringOrNumber(rootRecord?.installationId) ??
          asStringOrNumber(input.installationId),
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
  };
}
