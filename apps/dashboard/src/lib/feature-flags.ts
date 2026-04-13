import { useFeatureFlagEnabled } from "posthog-js/react";
import type { ReactNode } from "react";
import { isPostHogEnabled } from "@/lib/posthog";

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
} as const;

export type FeatureFlagKey = (typeof FeatureFlags)[keyof typeof FeatureFlags];

export function useFeatureFlag(flag: FeatureFlagKey): boolean {
  const value = useFeatureFlagEnabled(flag);
  if (!isPostHogEnabled) return true;
  if (value === undefined) return true;
  return value === true;
}

export function useFeatureFlagStrict(flag: FeatureFlagKey): boolean {
  const value = useFeatureFlagEnabled(flag);
  if (!isPostHogEnabled) return false;
  return value === true;
}

export function FeatureGate({
  flag,
  children,
  fallback = null,
}: {
  flag: FeatureFlagKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const enabled = useFeatureFlag(flag);
  return enabled ? children : fallback;
}
