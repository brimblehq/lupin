import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import type { GithubAccount, GithubRepoListItem, RepositoryMetadata } from "@/backend/repositories";

export interface GitProviderApi {
  listAccounts: () => Promise<GithubAccount[] | { accounts?: GithubAccount[] }>;
  getConnectUrl: (args: { data?: { device?: string } }) => Promise<{ url: string }>;
  listRepos: (args: {
    data?: { q?: string; page?: number; limit?: number; installationId?: number | string };
  }) => Promise<{ repositories: GithubRepoListItem[] }>;
  getRepo: (args: { data: { repoName: string; installationId?: number | string } }) => Promise<RepositoryMetadata>;
}

export interface UseGitProviderOptions {
  providerName: string;
  providerId: string;
  api: GitProviderApi;
  active: boolean;
  phase: number;
  onConnected: (providerId: string) => void;
  onRepoSelected: (name: string) => void;
}

export interface UseGitProviderResult {
  accounts: GithubAccount[];
  accountsLoading: boolean;
  accountsChecked: boolean;
  repos: GithubRepoListItem[];
  reposLoading: boolean;
  connectOpening: boolean;
  connectPolling: boolean;
  connectError: string | null;
  selectedRepo: { repo: GithubRepoListItem; metadata: RepositoryMetadata } | null;
  importingRepoFullName: string | null;
  refreshAccounts: (options?: { silent?: boolean }) => Promise<GithubAccount[]>;
  loadRepos: (input: { installationId?: number | string; q?: string }) => Promise<void>;
  handleConnect: () => Promise<void>;
  handleRepoSelect: (repo: GithubRepoListItem) => Promise<void>;
  reset: () => void;
}

function getAccountsSignature(accounts: GithubAccount[]): string {
  return accounts
    .map((a) => `${a.installationId ?? a.id ?? a.username ?? ""}`)
    .sort()
    .join(",");
}

export function useGitProvider({
  providerName,
  providerId,
  api,
  active,
  phase,
  onConnected,
  onRepoSelected,
}: UseGitProviderOptions): UseGitProviderResult {
  const [accounts, setAccounts] = useState<GithubAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsChecked, setAccountsChecked] = useState(false);
  const [repos, setRepos] = useState<GithubRepoListItem[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [connectOpening, setConnectOpening] = useState(false);
  const [connectPolling, setConnectPolling] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<{
    repo: GithubRepoListItem;
    metadata: RepositoryMetadata;
  } | null>(null);
  const [importingRepoFullName, setImportingRepoFullName] = useState<string | null>(null);

  const reposRequestIdRef = useRef(0);
  const pollingIntervalRef = useRef<number | null>(null);
  const pollingTimeoutRef = useRef<number | null>(null);
  const pollingBaselineSignatureRef = useRef("");

  const accountsSignature = useMemo(() => getAccountsSignature(accounts), [accounts]);

  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;
  const onRepoSelectedRef = useRef(onRepoSelected);
  onRepoSelectedRef.current = onRepoSelected;

  const refreshAccounts = useCallback(
    async (options?: { silent?: boolean }): Promise<GithubAccount[]> => {
      try {
        if (!options?.silent) {
          setAccountsLoading(true);
        }
        const result = await api.listAccounts();
        const items = Array.isArray(result) ? result : (result?.accounts ?? []);
        setAccounts(items);
        setAccountsChecked(true);
        if (items.length > 0) {
          setConnectError(null);
          onConnectedRef.current(providerId);
        }
        return items;
      } catch (error) {
        setAccountsChecked(true);
        if (!options?.silent) {
          toast.error(error instanceof Error ? error.message : `Failed to load ${providerName} accounts`);
        }
        return [];
      } finally {
        if (!options?.silent) {
          setAccountsLoading(false);
        }
      }
    },
    [api, providerName, providerId],
  );

  useEffect(() => {
    if (active && phase >= 2 && !accountsChecked && !accountsLoading) {
      void refreshAccounts({ silent: false });
    }
  }, [active, phase, accountsChecked, accountsLoading, refreshAccounts]);

  const loadRepos = useCallback(
    async (input: { installationId?: number | string; q?: string }) => {
      if (!input.installationId) {
        setRepos([]);
        setReposLoading(false);
        return;
      }

      const requestId = ++reposRequestIdRef.current;
      setReposLoading(true);

      try {
        const result = await api.listRepos({
          data: {
            installationId: input.installationId,
            q: input.q,
            page: 1,
            limit: 50,
          },
        });

        if (requestId !== reposRequestIdRef.current) return;
        setRepos(Array.isArray(result?.repositories) ? result.repositories : []);
      } catch (error) {
        if (requestId !== reposRequestIdRef.current) return;
        setRepos([]);
        toast.error(error instanceof Error ? error.message : "Failed to load repositories");
      } finally {
        if (requestId === reposRequestIdRef.current) {
          setReposLoading(false);
        }
      }
    },
    [api],
  );

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current !== null) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current !== null) {
      window.clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    setConnectPolling(false);
  }, []);

  const handleConnect = useCallback(async () => {
    setConnectError(null);
    setConnectOpening(true);

    try {
      const deviceId = window.sessionStorage.getItem("brimble.oauth.device_id") ?? "";
      const connect = await api.getConnectUrl({
        data: { device: deviceId || undefined },
      });
      const connectUrl = connect?.url?.trim();
      if (!connectUrl) {
        throw new Error(`We could not start ${providerName} connection right now. Please refresh and try again.`);
      }

      const popup = window.open(connectUrl, "_blank", "width=900,height=760");
      if (!popup) {
        throw new Error("Popup blocked. Please allow popups and try again.");
      }

      pollingBaselineSignatureRef.current = getAccountsSignature(accounts);
      setConnectPolling(true);
      void refreshAccounts({ silent: true });

      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
      }
      if (pollingTimeoutRef.current !== null) {
        window.clearTimeout(pollingTimeoutRef.current);
      }

      pollingIntervalRef.current = window.setInterval(() => {
        void refreshAccounts({ silent: true });
      }, 3000);

      pollingTimeoutRef.current = window.setTimeout(() => {
        stopPolling();
        setConnectError(`Timed out waiting for ${providerName} connection. Finish authorization, then click refresh.`);
      }, 90_000);
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : `We could not open the ${providerName} connection window. Please try again.`;

      if (rawMessage.startsWith("CONNECT_AUTH_REQUIRED:")) {
        toast.error("Please sign in again to continue.");
        const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.assign(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const cleanMessage = rawMessage.startsWith("CONNECT_EXPIRED:") ? "Connection expired, please try again." : rawMessage;

      setConnectError(cleanMessage);
    } finally {
      setConnectOpening(false);
    }
  }, [api, providerName, accounts, refreshAccounts, stopPolling]);

  useEffect(() => {
    if (connectPolling && accountsSignature.length > 0 && accountsSignature !== pollingBaselineSignatureRef.current) {
      stopPolling();
      toast.success(`${providerName} connected. Select a repository to continue.`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("brimble:git-connection-changed"));
      }
    }
  }, [accountsSignature, connectPolling, providerName, stopPolling]);

  const handleRepoSelect = useCallback(
    async (repo: GithubRepoListItem) => {
      setImportingRepoFullName(repo.fullName);
      try {
        const metadata = await api.getRepo({
          data: {
            repoName: repo.fullName,
            installationId: repo.installationId,
          },
        });

        setSelectedRepo({ repo, metadata });
        onRepoSelectedRef.current(metadata.fullName || repo.fullName);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to import repository");
      } finally {
        setImportingRepoFullName(null);
      }
    },
    [api],
  );

  const reset = useCallback(() => {
    stopPolling();
    setSelectedRepo(null);
    setRepos([]);
    setConnectError(null);
  }, [stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    accounts,
    accountsLoading,
    accountsChecked,
    repos,
    reposLoading,
    connectOpening,
    connectPolling,
    connectError,
    selectedRepo,
    importingRepoFullName,
    refreshAccounts,
    loadRepos,
    handleConnect,
    handleRepoSelect,
    reset,
  };
}
