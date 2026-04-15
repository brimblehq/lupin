import type { RepositoryDirectoryEntry, RepositoryRootDirResult } from "@/backend/repositories";

const COMMON_WATCH_PATTERNS = ["/**", "package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json"];
const WATCH_PATH_SCAN_MAX_DEPTH = 4;
const WATCH_PATH_SCAN_MAX_DIRECTORIES = 80;
const WATCH_PATH_SCAN_MAX_ENTRIES = 1200;
const WATCH_PATH_SCAN_MAX_EXTENSIONS_PER_DIRECTORY = 8;

export type RootDirFetchInput = {
  repoName: string;
  branch: string;
  installationId?: number | string;
  path?: string;
};

export type RootDirFetcher = (args: { data: RootDirFetchInput }) => Promise<RepositoryRootDirResult>;

function normalizeRepositoryPath(path?: string): string | undefined {
  if (!path) {
    return undefined;
  }

  const normalized = path.trim().replace(/^\/+/, "");
  if (!normalized || normalized === "." || normalized === "./") {
    return undefined;
  }

  return normalized;
}

function normalizeWatchPattern(pattern: string): string {
  const normalized = pattern.trim();
  if (!normalized) {
    return "/";
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function getFileExtension(fileName: string): string | undefined {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex >= fileName.length - 1) {
    return undefined;
  }

  const extension = fileName.slice(dotIndex + 1).toLowerCase();
  if (extension.length > 12 || !/^[a-z0-9]+$/.test(extension)) {
    return undefined;
  }

  return extension;
}

function hasDotDirectory(path: string, type: RepositoryDirectoryEntry["type"]): boolean {
  const segments = path.split("/").filter(Boolean);
  const directorySegments = type === "dir" ? segments : segments.slice(0, -1);
  return directorySegments.some((segment) => segment.startsWith("."));
}

export async function collectWatchPathEntries(
  fetchRootDir: RootDirFetcher,
  input: Omit<RootDirFetchInput, "path">,
  shouldContinue: () => boolean = () => true,
): Promise<RepositoryDirectoryEntry[]> {
  const queue: Array<{ path?: string; depth: number }> = [{ path: undefined, depth: 0 }];
  const queuedDirectories = new Set<string>();
  const seenEntries = new Set<string>();
  const collected: RepositoryDirectoryEntry[] = [];
  let scannedDirectories = 0;

  while (queue.length > 0) {
    if (!shouldContinue()) {
      break;
    }

    if (scannedDirectories >= WATCH_PATH_SCAN_MAX_DIRECTORIES || collected.length >= WATCH_PATH_SCAN_MAX_ENTRIES) {
      break;
    }

    const current = queue.shift();
    if (!current) {
      break;
    }

    scannedDirectories += 1;

    let result: RepositoryRootDirResult;
    try {
      result = await fetchRootDir({
        data: {
          ...input,
          path: current.path,
        },
      });
    } catch {
      continue;
    }

    const entries = Array.isArray(result.rootDir) ? result.rootDir : [];
    for (const entry of entries) {
      const normalizedPath = normalizeRepositoryPath(entry?.path);
      if (!normalizedPath) {
        continue;
      }
      if (hasDotDirectory(normalizedPath, entry.type)) {
        continue;
      }

      if (!seenEntries.has(normalizedPath)) {
        seenEntries.add(normalizedPath);
        collected.push({
          ...entry,
          path: normalizedPath,
        });
      }

      if (entry.type !== "dir") {
        continue;
      }

      if (current.depth + 1 >= WATCH_PATH_SCAN_MAX_DEPTH) {
        continue;
      }

      if (queuedDirectories.has(normalizedPath)) {
        continue;
      }

      queuedDirectories.add(normalizedPath);
      queue.push({ path: normalizedPath, depth: current.depth + 1 });
    }
  }

  return collected;
}

export function deriveWatchPathSuggestions(entries: RepositoryDirectoryEntry[]): string[] {
  const out = new Set<string>();
  const extensionPatternsByDir = new Map<string, Set<string>>();

  for (const entry of entries) {
    const normalizedPath = normalizeRepositoryPath(entry?.path);
    if (!normalizedPath) continue;
    if (hasDotDirectory(normalizedPath, entry.type)) continue;

    if (entry.type === "dir") {
      out.add(`/${normalizedPath}/**`);
    } else if (entry.type === "file") {
      out.add(`/${normalizedPath}`);

      const slashIndex = normalizedPath.lastIndexOf("/");
      const parentDir = slashIndex >= 0 ? normalizedPath.slice(0, slashIndex) : "";
      const fileName = slashIndex >= 0 ? normalizedPath.slice(slashIndex + 1) : normalizedPath;
      const extension = getFileExtension(fileName);
      if (!extension) {
        continue;
      }

      if (!extensionPatternsByDir.has(parentDir)) {
        extensionPatternsByDir.set(parentDir, new Set<string>());
      }

      const existing = extensionPatternsByDir.get(parentDir);
      if (!existing) {
        continue;
      }

      if (existing.size < WATCH_PATH_SCAN_MAX_EXTENSIONS_PER_DIRECTORY || existing.has(extension)) {
        existing.add(extension);
      }
    }
  }

  for (const [dirPath, extensions] of extensionPatternsByDir) {
    const basePath = dirPath ? `/${dirPath}` : "";
    for (const extension of extensions) {
      out.add(`${basePath}/**/*.${extension}`);
    }
  }

  for (const pattern of COMMON_WATCH_PATTERNS) {
    out.add(normalizeWatchPattern(pattern));
  }

  return Array.from(out).sort();
}
