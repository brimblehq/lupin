import { createServerFn } from "@tanstack/react-start";
import { createBackendApi } from "@/backend";
import type {
  GithubAccount,
  GithubRepoListResult,
  RepositoryMetadata,
  RepositoryRootDirResult,
} from "@/backend/repositories";
import config from "@/config";
import { getServerAccessToken } from "@/server/auth/cookies";

function getServerBackendApi() {
  return createBackendApi({
    baseUrl: config.apiUrl,
    getAccessToken: getServerAccessToken,
  });
}

export const getGithubRepoServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        repoName: string;
        installationId?: number | string;
      }
    | undefined;

  if (!payload?.repoName?.trim()) {
    throw new Error("Repository name is required");
  }

  return getServerBackendApi().repositories.getGithubRepo({
    repoName: payload.repoName.trim(),
    installationId: payload.installationId,
  }) as Promise<RepositoryMetadata>;
});

export const listGithubAccountsServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return getServerBackendApi().repositories.listGithubAccounts() as Promise<GithubAccount[]>;
});

export const listGithubReposServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        q?: string;
        page?: number;
        limit?: number;
        installationId?: number | string;
      }
    | undefined;

  return getServerBackendApi().repositories.listGithubRepos({
    q: payload?.q?.trim() || undefined,
    page: payload?.page,
    limit: payload?.limit,
    installationId: payload?.installationId,
  }) as Promise<GithubRepoListResult>;
});

export const getGithubRootDirServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        repoName: string;
        installationId?: number | string;
        branch: string;
        path?: string;
      }
    | undefined;

  if (!payload?.repoName?.trim()) {
    throw new Error("Repository name is required");
  }

  if (!payload?.branch?.trim()) {
    throw new Error("Branch is required");
  }

  return getServerBackendApi().repositories.getGithubRootDir({
    repoName: payload.repoName.trim(),
    installationId: payload.installationId,
    branch: payload.branch.trim(),
    path: payload.path?.trim() || undefined,
  }) as Promise<RepositoryRootDirResult>;
});
