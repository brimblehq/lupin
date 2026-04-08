import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPasskeyFeatureStatusServerFn } from "@/server/auth/actions";
import { isPasskeySupported } from "@/lib/auth/passkey";

interface PasskeyFeatureState {
  ready: boolean;
  enabled: boolean;
  backendEnabled: boolean;
  browserSupported: boolean;
}

let cachedBackendEnabled: boolean | null = null;
let inflight: Promise<boolean> | null = null;

async function fetchBackendStatus(
  fn: () => Promise<{ enabled: boolean }>,
): Promise<boolean> {
  if (cachedBackendEnabled !== null) return cachedBackendEnabled;
  if (inflight) return inflight;
  inflight = fn()
    .then((result) => {
      cachedBackendEnabled = Boolean(result?.enabled);
      return cachedBackendEnabled;
    })
    .catch(() => {
      cachedBackendEnabled = false;
      return false;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function usePasskeyFeature(): PasskeyFeatureState {
  const getStatus = useServerFn(getPasskeyFeatureStatusServerFn as any) as () => Promise<{
    enabled: boolean;
  }>;
  const [state, setState] = useState<PasskeyFeatureState>(() => ({
    ready: cachedBackendEnabled !== null,
    enabled: false,
    backendEnabled: cachedBackendEnabled ?? false,
    browserSupported: isPasskeySupported(),
  }));

  useEffect(() => {
    let cancelled = false;
    void fetchBackendStatus(getStatus).then((backendEnabled) => {
      if (cancelled) return;
      const browserSupported = isPasskeySupported();
      setState({
        ready: true,
        backendEnabled,
        browserSupported,
        enabled: backendEnabled && browserSupported,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [getStatus]);

  return state;
}
