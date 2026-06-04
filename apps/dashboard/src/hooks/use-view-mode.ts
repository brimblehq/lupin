import { useEffect, useState } from "react";

export type ViewMode = "card" | "list";

function readStoredViewMode(storageKey: string, workspace: string | undefined): ViewMode {
  if (typeof window === "undefined") return "card";
  try {
    const raw = localStorage.getItem(`${storageKey}:${workspace ?? "__personal__"}`);
    return raw === "list" ? "list" : "card";
  } catch {
    return "card";
  }
}

function writeStoredViewMode(storageKey: string, workspace: string | undefined, mode: ViewMode) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${storageKey}:${workspace ?? "__personal__"}`, mode);
  } catch {
    return;
  }
}

/**
 * Card/list view preference, persisted to localStorage and scoped per workspace.
 * Defaults to "card" and degrades safely on the server.
 */
export function useViewMode(storageKey: string, workspace: string | undefined): [ViewMode, (mode: ViewMode) => void] {
  const [viewMode, setViewMode] = useState<ViewMode>("card");

  useEffect(() => {
    setViewMode(readStoredViewMode(storageKey, workspace));
  }, [storageKey, workspace]);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    writeStoredViewMode(storageKey, workspace, mode);
  };

  return [viewMode, changeViewMode];
}
