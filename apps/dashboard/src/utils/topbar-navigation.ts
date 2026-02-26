export function buildWorkspaceSwitchUrl(input: {
  pathname: string;
  searchStr?: string;
  workspaceSlug?: string;
}): string {
  const params = new URLSearchParams(input.searchStr || "");

  if (input.workspaceSlug) {
    params.set("workspace", input.workspaceSlug);
  } else {
    params.delete("workspace");
  }

  let nextPathname = input.pathname;

  if (/^\/projects\/[^/]+(?:\/|$)/.test(input.pathname)) {
    nextPathname = "/projects";
  }

  const nextSearch = params.toString();
  if (nextSearch) {
    return `${nextPathname}?${nextSearch}`;
  }

  return nextPathname;
}

export function getWorkspaceSearch(input: { searchStr?: string }): string {
  const params = new URLSearchParams(input.searchStr || "");
  const workspace = params.get("workspace");

  if (!workspace || !workspace.trim()) {
    return "";
  }

  const nextParams = new URLSearchParams();
  nextParams.set("workspace", workspace.trim());
  const query = nextParams.toString();

  if (!query) {
    return "";
  }

  return `?${query}`;
}

export function getWorkspaceFromSearch(input: {
  searchStr?: string;
}): string | undefined {
  const workspace = new URLSearchParams(input.searchStr || "")
    .get("workspace")
    ?.trim();
  return workspace || undefined;
}

export function withWorkspaceQuery(input: {
  pathname: string;
  searchStr?: string;
}): string {
  const workspaceSearch = getWorkspaceSearch({ searchStr: input.searchStr });
  if (!workspaceSearch) {
    return input.pathname;
  }

  return `${input.pathname}${workspaceSearch}`;
}

export function buildProjectSwitchUrl(input: {
  pathname: string;
  searchStr?: string;
  targetProjectId: string;
}): string {
  const targetProjectId = input.targetProjectId.trim();
  if (!targetProjectId) {
    return input.pathname;
  }

  const match = input.pathname.match(/^\/projects\/[^/]+(.*)$/);
  let suffix = "";

  if (match && typeof match[1] === "string") {
    suffix = match[1];
  }

  const nextPathname = `/projects/${encodeURIComponent(targetProjectId)}${suffix}`;
  const nextSearch = new URLSearchParams(input.searchStr || "").toString();

  if (nextSearch) {
    return `${nextPathname}?${nextSearch}`;
  }

  return nextPathname;
}
