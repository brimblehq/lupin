import { useCallback, useMemo, useSyncExternalStore } from "react";
import { Theme } from "../types/enums";

const listeners = new Set<() => void>();
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function emitThemeChange() {
  for (const cb of listeners) cb();
}

function getStoredThemeMode(): Theme {
  if (typeof window === "undefined") {
    return Theme.System;
  }

  try {
    const stored = window.localStorage.getItem("theme");
    if (
      stored === Theme.Light ||
      stored === Theme.Dark ||
      stored === Theme.System
    ) {
      return stored;
    }
  } catch {
    // no-op
  }

  return Theme.System;
}

function resolveEffectiveTheme(mode: Theme): Theme.Light | Theme.Dark {
  if (mode === Theme.Dark) {
    return Theme.Dark;
  }

  if (mode === Theme.Light) {
    return Theme.Light;
  }

  if (typeof window !== "undefined" && window.matchMedia(DARK_MEDIA_QUERY).matches) {
    return Theme.Dark;
  }

  return Theme.Light;
}

function applyTheme(mode: Theme) {
  if (typeof document === "undefined") {
    return;
  }

  const effectiveTheme = resolveEffectiveTheme(mode);
  document.documentElement.classList.toggle("dark", effectiveTheme === Theme.Dark);

  try {
    window.localStorage.setItem("theme", mode);
  } catch {
    // no-op
  }

  emitThemeChange();
}

function getSnapshot(): Theme {
  return getStoredThemeMode();
}

function getServerSnapshot(): Theme {
  return Theme.System;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  let mediaQuery: MediaQueryList | null = null;
  let handleSystemChange: ((event: MediaQueryListEvent) => void) | null = null;

  if (typeof window !== "undefined") {
    mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);
    handleSystemChange = () => {
      if (getStoredThemeMode() !== Theme.System) {
        return;
      }

      applyTheme(Theme.System);
    };
    mediaQuery.addEventListener("change", handleSystemChange);
  }

  return () => {
    listeners.delete(cb);
    if (mediaQuery && handleSystemChange) {
      mediaQuery.removeEventListener("change", handleSystemChange);
    }
  };
}

export function useTheme() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const theme = useMemo(() => resolveEffectiveTheme(mode), [mode]);

  const setTheme = useCallback((t: Theme) => {
    applyTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    const current = resolveEffectiveTheme(getStoredThemeMode());
    applyTheme(current === Theme.Dark ? Theme.Light : Theme.Dark);
  }, []);

  const cycleTheme = useCallback(() => {
    const currentMode = getStoredThemeMode();
    if (currentMode === Theme.Light) {
      applyTheme(Theme.Dark);
      return;
    }

    if (currentMode === Theme.Dark) {
      applyTheme(Theme.System);
      return;
    }

    applyTheme(Theme.Light);
  }, []);

  return { theme, mode, setTheme, toggleTheme, cycleTheme };
}
