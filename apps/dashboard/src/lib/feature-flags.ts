import { useEffect, useState, type ReactNode } from "react";
import { getPostHogFeatureFlag, isPostHogDisabledByAppEnv, isPostHogEnabled, subscribePostHogFeatureFlag } from "@/lib/posthog";

export const FeatureFlags = {
  ENABLE_WEBHOOKS: "enable_webhooks",
  ENABLE_MCP_SERVERS: "enable_mcp_servers",
  ENABLE_AUTO_SCALING: "enable_auto_scaling",
  ENABLE_DOMAINS: "enable_domains",
  ENABLE_DEPLOYMENTS: "enable_deployments",
  ENABLE_DATABASES: "enable_databases",
  ENABLE_SANDBOX: "enable_sandbox",
  ENABLE_BUCKETS: "enable_buckets",
  ENABLE_WEB_ANALYTICS: "enable_web_analytics",
  ENABLE_AI_DEBUG: "enable_ai_debug",
  ENABLE_ANNOUNCEMENTS: "enable_announcements",
} as const;

export type FeatureFlagKey = (typeof FeatureFlags)[keyof typeof FeatureFlags];

function usePostHogFeatureFlag(flag: FeatureFlagKey): boolean | undefined {
  const [value, setValue] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!isPostHogEnabled) {
      setValue(undefined);
      return;
    }

    let mounted = true;

    void getPostHogFeatureFlag(flag).then((next) => {
      if (mounted) {
        setValue(next);
      }
    });

    const unsubscribe = subscribePostHogFeatureFlag(flag, (next) => {
      if (mounted) {
        setValue(next);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [flag]);

  return value;
}

export function useFeatureFlag(flag: FeatureFlagKey): boolean {
  const value = usePostHogFeatureFlag(flag);
  if (!isPostHogEnabled) return true;
  if (value === undefined) return true;
  return value === true;
}

export function useFeatureFlagStrict(flag: FeatureFlagKey): boolean {
  const value = usePostHogFeatureFlag(flag);
  if (isPostHogDisabledByAppEnv) return true;
  if (!isPostHogEnabled) return false;
  return value === true;
}

export function FeatureGate({ flag, children, fallback = null }: { flag: FeatureFlagKey; children: ReactNode; fallback?: ReactNode }) {
  const enabled = useFeatureFlag(flag);
  return enabled ? children : fallback;
}
