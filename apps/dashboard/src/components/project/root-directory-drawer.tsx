import { useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronRight, GitBranch, Loader2 } from "lucide-react";
import type { RepositoryDirectoryEntry, RepositoryFrameworkDefaults } from "@/backend/repositories";
import {
  getBitbucketRootDirServerFn,
  getGithubRootDirServerFn,
  getGitlabRootDirServerFn,
} from "@/server/repositories/actions";

const HTTP_STATUS_PREFIX = /^\[HTTP (\d{3})\]\s*/;

function getHttpStatus(error: unknown): number | undefined {
  const err = error as { status?: unknown; message?: unknown; stack?: unknown } | null;
  if (typeof err?.status === "number") return err.status;
  if (typeof err?.message === "string") {
    const match = err.message.match(HTTP_STATUS_PREFIX);
    if (match) return Number(match[1]);
  }
  if (typeof err?.stack === "string") {
    const match = err.stack.match(HTTP_STATUS_PREFIX);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function getDirectoryLoadErrorMessage(error: unknown, provider: "github" | "gitlab" | "bitbucket"): string {
  const status = getHttpStatus(error);
  if (status === 404) {
    return provider === "github"
      ? "Connect your GitHub account to Brimble before browsing repositories."
      : "Connect your account to Brimble before browsing repositories.";
  }
  return "We couldn't fetch directories right now. Please try again in a moment.";
}

function DrawerShell({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const [topOffset, setTopOffset] = useState(0);
  const measured = useRef(false);

  useEffect(() => {
    if (open && !measured.current) {
      const topbar = document.querySelector("[data-topbar]");
      let offset = 0;
      if (topbar) {
        offset += topbar.getBoundingClientRect().height;
      }
      setTopOffset(offset);
      measured.current = true;
    }
    if (!open) {
      measured.current = false;
    }
  }, [open]);

  return (
    <Drawer.Root direction="right" open={open} onOpenChange={onOpenChange} noBodyStyles modal>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40" style={{ top: topOffset }} />
        <Drawer.Content
          className="fixed right-0 z-50 flex w-full max-w-[500px] flex-col border-l border-dash-border bg-dash-bg shadow-[-4px_0_24px_rgba(0,0,0,0.08)] outline-none"
          style={{ top: topOffset, height: `calc(100vh - ${topOffset}px)` }}
          aria-describedby={undefined}
        >
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="px-6 pb-4 pt-6">
              <Drawer.Title className="text-lg font-medium tracking-[-0.03px] text-dash-text-strong">{title}</Drawer.Title>
              {subtitle ? <p className="mt-1 text-sm font-light text-dash-text-extra-faded">{subtitle}</p> : null}
            </div>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function BranchDrawer({
  open,
  onOpenChange,
  branches,
  selectedBranch,
  onSelect,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: string[];
  selectedBranch?: string;
  onSelect: (branch: string) => void;
  loading?: boolean;
}) {
  return (
    <DrawerShell open={open} onOpenChange={onOpenChange} title="Choose branch" subtitle="Select the branch to deploy from your repository">
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-dash-text-faded">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading branches...
          </div>
        ) : branches.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-dash-text-faded">No branches available</div>
        ) : (
          <div className="space-y-2">
            {branches.map((branch) => {
              const isSelected = branch === selectedBranch;
              return (
                <button
                  key={branch}
                  type="button"
                  onClick={() => {
                    onSelect(branch);
                    onOpenChange(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-[6px] border px-4 py-3 text-left transition-colors ${
                    isSelected ? "border-[#4879f8] bg-[#4879f8]/[0.06]" : "border-dash-border hover:bg-dash-bg-elevated"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-[#4879f8]/10 text-[#4879f8]">
                      <GitBranch className="size-4" />
                    </div>
                    <span className="font-mono text-sm text-dash-text-strong">{branch}</span>
                  </div>
                  <div
                    className={`flex size-5 items-center justify-center rounded-full border ${
                      isSelected ? "border-[#4879f8] bg-[#4879f8]" : "border-dash-border"
                    }`}
                  >
                    {isSelected ? <div className="size-2 rounded-full bg-white" /> : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </DrawerShell>
  );
}

interface DirectoryNode {
  name: string;
  path: string;
  children?: DirectoryNode[];
}

function TreeConnector({ parentLeft, isLast }: { parentLeft: number; isLast: boolean }) {
  const r = 8;

  return (
    <>
      <div
        className="absolute top-0 w-px bg-dash-border"
        style={{
          left: parentLeft,
          height: isLast ? `calc(50% - ${r}px)` : "100%",
        }}
      />
      <div
        className="absolute border-b border-l border-dash-border"
        style={{
          left: parentLeft,
          top: `calc(50% - ${r}px)`,
          width: r + 6,
          height: r * 2,
          borderBottomLeftRadius: r,
        }}
      />
    </>
  );
}

function DirectoryRow({
  node,
  depth,
  selectedPath,
  currentPath,
  onSelect,
  isLast,
}: {
  node: DirectoryNode;
  depth: number;
  selectedPath: string;
  currentPath: string;
  onSelect: (node: DirectoryNode) => void;
  isLast?: boolean;
}) {
  const isSelected = selectedPath === node.path;
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const showChildren = hasChildren && node.path === currentPath;
  const isChild = depth > 0;
  const parentRadioCenter = 24 + (depth - 1) * 32 + 9;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onSelect(node)}
        className="relative flex w-full items-center gap-3 py-2.5 transition-colors hover:bg-dash-bg-elevated"
        style={{ paddingLeft: `${24 + depth * 32}px`, paddingRight: 16 }}
      >
        {isChild ? <TreeConnector parentLeft={parentRadioCenter} isLast={Boolean(isLast)} /> : null}

        <img src={isSelected ? "/icons/box.svg" : "/icons/box-inactive.svg"} alt="" className="size-[18px] shrink-0" />

        <img src="/icons/folder-open.svg" alt="" className="size-4 shrink-0" />
        <span className="flex-1 -ml-1 text-left text-sm text-dash-text-strong">{node.name}</span>

        {hasChildren ? <ChevronRight className="size-4 shrink-0 text-dash-text-extra-faded" /> : null}
      </button>

      {showChildren
        ? node.children!.map((child, index) => (
            <DirectoryRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              currentPath={currentPath}
              onSelect={onSelect}
              isLast={index === node.children!.length - 1}
            />
          ))
        : null}
    </div>
  );
}

interface RootDirectoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: "github" | "gitlab" | "bitbucket";
  repoName?: string;
  installationId?: number | string;
  branch?: string;
  selectedPath?: string;
  onSelect?: (payload: { path: string; framework?: RepositoryFrameworkDefaults }) => void;
}

export function RootDirectoryDrawer({
  open,
  onOpenChange,
  provider = "github",
  repoName,
  installationId,
  branch,
  selectedPath = "./",
  onSelect,
}: RootDirectoryDrawerProps) {
  type RootDirFn = (args: {
    data: {
      repoName: string;
      installationId?: number | string;
      branch: string;
      path?: string;
    };
  }) => Promise<{
    rootDir: RepositoryDirectoryEntry[];
    framework?: RepositoryFrameworkDefaults;
  }>;

  const getGithubRootDir = useServerFn(getGithubRootDirServerFn as any) as RootDirFn;
  const getGitlabRootDir = useServerFn(getGitlabRootDirServerFn as any) as RootDirFn;
  const getBitbucketRootDir = useServerFn(getBitbucketRootDirServerFn as any) as RootDirFn;
  const rootDirLoaders = {
    github: getGithubRootDir,
    gitlab: getGitlabRootDir,
    bitbucket: getBitbucketRootDir,
  };
  const getRootDir = rootDirLoaders[provider];
  const providerLabel = provider === "gitlab" ? "GitLab" : provider === "bitbucket" ? "Bitbucket" : "GitHub";

  const [currentPath, setCurrentPath] = useState<string>(selectedPath || "./");
  const [selectedNodePath, setSelectedNodePath] = useState<string>(selectedPath || "./");
  const [entries, setEntries] = useState<RepositoryDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [activeFramework, setActiveFramework] = useState<RepositoryFrameworkDefaults | undefined>(undefined);

  const cacheRef = useRef<Map<string, { entries: RepositoryDirectoryEntry[]; framework?: RepositoryFrameworkDefaults }>>(new Map());

  useEffect(() => {
    if (!open) {
      return;
    }
    setCurrentPath(selectedPath || "./");
    setSelectedNodePath(selectedPath || "./");
  }, [open, selectedPath]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!repoName || !branch) {
      setEntries([]);
      return;
    }

    const cacheKey = `${repoName}:${branch}:${currentPath}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setEntries(cached.entries);
      setActiveFramework(cached.framework);
      return;
    }

    let cancelled = false;

    async function loadDirs() {
      setLoading(true);
      setError("");
      try {
        let apiPath = currentPath;
        if (apiPath === "./" || apiPath === ".") {
          apiPath = "";
        }

        const result = await getRootDir({
          data: {
            repoName,
            installationId,
            branch,
            path: apiPath || undefined,
          },
        });

        if (cancelled) {
          return;
        }

        const dirs = (result.rootDir || []).filter((entry) => entry.type === "dir");
        cacheRef.current.set(cacheKey, { entries: dirs, framework: result.framework });
        setEntries(dirs);
        setActiveFramework(result.framework);
      } catch (err: any) {
        if (cancelled) {
          return;
        }
        setEntries([]);
        setActiveFramework(undefined);
        setError(getDirectoryLoadErrorMessage(err, provider));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDirs();

    return () => {
      cancelled = true;
    };
  }, [open, repoName, installationId, branch, currentPath, getRootDir, provider]);

  function handleGoBack() {
    if (!currentPath || currentPath === "./" || currentPath === ".") {
      onOpenChange(false);
      return;
    }

    const segments = currentPath.split("/").filter(Boolean);
    segments.pop();

    if (segments.length === 0) {
      setCurrentPath("./");
      return;
    }

    setCurrentPath(segments.join("/"));
  }

  function handleSelect(node: DirectoryNode) {
    setSelectedNodePath(node.path);

    onSelect?.({
      path: node.path || "./",
      framework: activeFramework,
    });

    if (node.path === currentPath) {
      onOpenChange(false);
      return;
    }

    setCurrentPath(node.path);
  }

  const currentNodeName = (() => {
    if (!currentPath || currentPath === "./" || currentPath === ".") {
      return "root";
    }

    const segments = currentPath.split("/").filter(Boolean);
    if (segments.length === 0) {
      return "root";
    }

    return segments[segments.length - 1];
  })();

  const treeNodes: DirectoryNode[] = [
    {
      name: currentNodeName,
      path: currentPath || "./",
      children: entries.map((entry) => ({
        name: entry.name,
        path: entry.path,
      })),
    },
  ];

  return (
    <DrawerShell open={open} onOpenChange={onOpenChange} title="Choose root direction" subtitle="Select directory to deploy">
      <div className="relative flex items-center gap-3 bg-dash-bg-elevated px-6 py-3">
        <div className="absolute bottom-0 left-[37px] h-3 w-px bg-dash-border" />
        <div className="flex size-8 items-center justify-center rounded-full border border-[#3e3e3e] bg-gradient-to-b from-[#666] to-[#1b1b1b] shadow-[0px_1px_1px_rgba(0,0,0,0.15)]">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="6" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
            <path d="M6 9v3a3 3 0 0 0 3 3" />
          </svg>
        </div>
        <span className="text-sm font-medium text-dash-text-strong">{providerLabel}</span>
      </div>

      <button
        type="button"
        onClick={handleGoBack}
        className="flex items-center gap-3 px-6 py-3 text-sm font-medium text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
      >
        <ArrowLeft className="size-4" />
        Go back
      </button>

      <div className="flex-1">
        {loading ? (
          <div className="flex h-24 items-center justify-center px-6 text-sm text-dash-text-faded">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading directories...
          </div>
        ) : error ? (
          <div className="px-6 py-4 text-sm text-dash-text-faded">{error}</div>
        ) : (
          treeNodes.map((node, index) => (
            <DirectoryRow
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedNodePath}
              currentPath={currentPath || "./"}
              onSelect={handleSelect}
              isLast={index === treeNodes.length - 1}
            />
          ))
        )}
      </div>
    </DrawerShell>
  );
}
