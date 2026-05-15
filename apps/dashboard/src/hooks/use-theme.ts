import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useServerFn } from "@tanstack/react-start";
import { updateSettingsThemeServerFn } from "@/server/settings/actions";
import { Theme } from "../types/enums";

const listeners = new Set<() => void>();
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";
const DASHBOARD_THEME_STORAGE_KEY = "theme";
const LEGACY_THEME_STORAGE_KEY = "brimble-theme";

function emitThemeChange() {
  for (const cb of listeners) cb();
}

function getStoredThemeMode(): Theme {
  if (typeof window === "undefined") {
    return Theme.Light;
  }

  try {
    const stored = window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY);
    if (stored === Theme.Light || stored === Theme.Dark || stored === Theme.System) {
      return stored;
    }

    const legacyStored = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (legacyStored === Theme.Light || legacyStored === Theme.Dark) {
      return legacyStored;
    }
  } catch {
    // no-op
  }

  return Theme.Light;
}

function toThemeMode(value: unknown): Theme | undefined {
  if (value === Theme.Light || value === Theme.Dark || value === Theme.System) {
    return value;
  }

  return undefined;
}

function resolveEffectiveTheme(
  mode: Theme,
  options: { allowSystemMatchMedia: boolean } = { allowSystemMatchMedia: true },
): Theme.Light | Theme.Dark {
  if (mode === Theme.Dark) {
    return Theme.Dark;
  }

  if (mode === Theme.Light) {
    return Theme.Light;
  }

  if (options.allowSystemMatchMedia && typeof window !== "undefined" && window.matchMedia(DARK_MEDIA_QUERY).matches) {
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
    window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, mode);
  } catch {
    // no-op
  }

  emitThemeChange();
}

function getSnapshot(): Theme {
  return getStoredThemeMode();
}

function getServerSnapshot(): Theme {
  return Theme.Light;
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

export function useTheme(serverTheme?: Theme | "light" | "dark" | "system" | null) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const updateTheme = useServerFn(updateSettingsThemeServerFn as any) as (args: {
    data: { theme: Theme };
  }) => Promise<{ ok: true }>;
  const [hasHydrated, setHasHydrated] = useState(false);
  const theme = useMemo(() => resolveEffectiveTheme(mode, { allowSystemMatchMedia: hasHydrated }), [mode, hasHydrated]);

  const persistTheme = useCallback(
    (nextTheme: Theme) => {
      void updateTheme({ data: { theme: nextTheme } }).catch(() => undefined);
    },
    [updateTheme],
  );

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    const normalizedServerTheme = toThemeMode(serverTheme);
    if (!normalizedServerTheme) {
      return;
    }
    applyTheme(normalizedServerTheme);
  }, [serverTheme]);

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      applyTheme(nextTheme);
      persistTheme(nextTheme);
    },
    [persistTheme],
  );

  const toggleTheme = useCallback(() => {
    const current = resolveEffectiveTheme(getStoredThemeMode());
    const nextTheme = current === Theme.Dark ? Theme.Light : Theme.Dark;
    applyTheme(nextTheme);
    persistTheme(nextTheme);
  }, [persistTheme]);

  const cycleTheme = useCallback(() => {
    const currentMode = getStoredThemeMode();
    if (currentMode === Theme.Light) {
      applyTheme(Theme.Dark);
      persistTheme(Theme.Dark);
      return;
    }

    if (currentMode === Theme.Dark) {
      applyTheme(Theme.System);
      persistTheme(Theme.System);
      return;
    }

    applyTheme(Theme.Light);
    persistTheme(Theme.Light);
  }, [persistTheme]);

  return { theme, mode, setTheme, toggleTheme, cycleTheme };
}
