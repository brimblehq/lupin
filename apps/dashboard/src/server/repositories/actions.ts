import { createServerFn } from "@tanstack/react-start";
import type {
  BitbucketAccountsResult,
  BitbucketConnectUrlResult,
  BitbucketRepoListResult,
  GithubAccountsResult,
  GithubConnectUrlResult,
  GithubInstallUrlResult,
  GithubRepoListResult,
  GitlabAccountsResult,
  GitlabConnectUrlResult,
  GitlabRepoListResult,
  RepositoryMetadata,
  RepositoryRootDirResult,
} from "@/backend/repositories";
import { withTokenRefresh } from "@/server/shared/backend";

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

  return withTokenRefresh((api) =>
    api.repositories.getGithubRepo({
      repoName: payload.repoName.trim(),
      installationId: payload.installationId,
    }),
  ) as Promise<RepositoryMetadata>;
});

export const getGithubInstallUrlServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return withTokenRefresh((api) => api.repositories.getGithubInstallUrl()) as Promise<GithubInstallUrlResult>;
});

export const getGithubConnectUrlServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { device?: string } | undefined;
  return withTokenRefresh((api) =>
    api.repositories.getGithubConnectUrl({
      device: payload?.device?.trim() || undefined,
    }),
  ) as Promise<GithubConnectUrlResult>;
});

export const getGitlabConnectUrlServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { device?: string } | undefined;
  return withTokenRefresh((api) =>
    api.repositories.getGitlabConnectUrl({
      device: payload?.device?.trim() || undefined,
    }),
  ) as Promise<GitlabConnectUrlResult>;
});

export const listGithubAccountsServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return withTokenRefresh((api) => api.repositories.listGithubAccounts()) as Promise<GithubAccountsResult>;
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

  return withTokenRefresh((api) =>
    api.repositories.listGithubRepos({
      q: payload?.q?.trim() || undefined,
      page: payload?.page,
      limit: payload?.limit,
      installationId: payload?.installationId,
    }),
  ) as Promise<GithubRepoListResult>;
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

  return withTokenRefresh((api) =>
    api.repositories.getGithubRootDir({
      repoName: payload.repoName.trim(),
      installationId: payload.installationId,
      branch: payload.branch.trim(),
      path: payload.path?.trim() || undefined,
    }),
  ) as Promise<RepositoryRootDirResult>;
});

export const listGitlabAccountsServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return withTokenRefresh((api) => api.repositories.listGitlabAccounts()) as Promise<GitlabAccountsResult>;
});

export const listGitlabReposServerFn = createServerFn({
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

  return withTokenRefresh((api) =>
    api.repositories.listGitlabRepos({
      q: payload?.q?.trim() || undefined,
      page: payload?.page,
      limit: payload?.limit,
      installationId: payload?.installationId,
    }),
  ) as Promise<GitlabRepoListResult>;
});

export const getGitlabRepoServerFn = createServerFn({
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

  return withTokenRefresh((api) =>
    api.repositories.getGitlabRepo({
      repoName: payload.repoName.trim(),
      installationId: payload.installationId,
    }),
  ) as Promise<RepositoryMetadata>;
});

export const getGitlabRootDirServerFn = createServerFn({
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

  return withTokenRefresh((api) =>
    api.repositories.getGitlabRootDir({
      repoName: payload.repoName.trim(),
      installationId: payload.installationId,
      branch: payload.branch.trim(),
      path: payload.path?.trim() || undefined,
    }),
  ) as Promise<RepositoryRootDirResult>;
});

export const getBitbucketConnectUrlServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { device?: string } | undefined;
  return withTokenRefresh((api) =>
    api.repositories.getBitbucketConnectUrl({
      device: payload?.device?.trim() || undefined,
    }),
  ) as Promise<BitbucketConnectUrlResult>;
});

export const listBitbucketAccountsServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return withTokenRefresh((api) => api.repositories.listBitbucketAccounts()) as Promise<BitbucketAccountsResult>;
});

export const listBitbucketReposServerFn = createServerFn({
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

  return withTokenRefresh((api) =>
    api.repositories.listBitbucketRepos({
      q: payload?.q?.trim() || undefined,
      page: payload?.page,
      limit: payload?.limit,
      installationId: payload?.installationId,
    }),
  ) as Promise<BitbucketRepoListResult>;
});

export const getBitbucketRepoServerFn = createServerFn({
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

  return withTokenRefresh((api) =>
    api.repositories.getBitbucketRepo({
      repoName: payload.repoName.trim(),
      installationId: payload.installationId,
    }),
  ) as Promise<RepositoryMetadata>;
});

export const getBitbucketRootDirServerFn = createServerFn({
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

  return withTokenRefresh((api) =>
    api.repositories.getBitbucketRootDir({
      repoName: payload.repoName.trim(),
      installationId: payload.installationId,
      branch: payload.branch.trim(),
      path: payload.path?.trim() || undefined,
    }),
  ) as Promise<RepositoryRootDirResult>;
});
