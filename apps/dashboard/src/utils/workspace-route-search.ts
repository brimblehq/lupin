export function parseWorkspaceSearchValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const next = value.trim();
  if (!next) {
    return undefined;
  }

  return next;
}

export function parseTextSearchValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const next = value.trim();
  if (!next) {
    return undefined;
  }

  return next;
}

export function parsePositivePageSearchValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return undefined;
}

export function workspaceLoaderDeps(search: Record<string, unknown>) {
  return {
    workspace: parseWorkspaceSearchValue(search.workspace),
  };
}

export function workspacePageLoaderDeps(search: Record<string, unknown>) {
  return {
    page: parsePositivePageSearchValue(search.page) ?? 1,
    workspace: parseWorkspaceSearchValue(search.workspace),
  };
}
