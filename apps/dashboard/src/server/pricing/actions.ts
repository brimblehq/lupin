import { createServerFn } from "@tanstack/react-start";
import { withTokenRefresh } from "@/server/shared/backend";
import { DEFAULT_PRICING } from "@/utils/default-pricing";
import type { Pricing, PlanSpecs } from "@/types/pricing";

const SPECS_TTL = 10 * 60_000; // 10 minutes
let specsCache: { data: Pricing; ts: number } | null = null;

export const getSubscriptionSpecsServerFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<Pricing> => {
  if (specsCache && Date.now() - specsCache.ts < SPECS_TTL) {
    return specsCache.data;
  }

  try {
    const res = await withTokenRefresh((api) => api.payments.getSubscriptionSpecs());
    const data = normalizePricing(res);
    specsCache = { data, ts: Date.now() };
    return data;
  } catch {
    return specsCache?.data ?? DEFAULT_PRICING;
  }
});

function normalizePricing(raw: any): Pricing {
  if (!raw || typeof raw !== "object") return DEFAULT_PRICING;

  const specs = raw.specifications;
  const prices = raw.pricing;

  if (!specs || !prices) return DEFAULT_PRICING;

  const plans = [
    {
      id: "free",
      name: "Free",
      amount: 0,
      interval: "month",
    },
    {
      id: "hacker",
      name: "Hacker",
      amount: Number(prices.hacker?.unit_amount ?? DEFAULT_PRICING.plans[1].amount),
      interval: String(prices.hacker?.interval ?? "month"),
    },
    {
      id: "developer",
      name: "Pro",
      amount: Number(prices.developer?.unit_amount ?? DEFAULT_PRICING.plans[2].amount),
      interval: String(prices.developer?.interval ?? "month"),
    },
  ];

  const teamSpec = specs.team;
  const team = {
    costPerMember: Number(prices.team_member?.unit_amount ?? DEFAULT_PRICING.team.costPerMember),
    costPerBuild: Number(prices.team_build?.unit_amount ?? DEFAULT_PRICING.team.costPerBuild),
    maxProjects: Number(teamSpec?.project_limit ?? DEFAULT_PRICING.team.maxProjects),
    bandwidthGb: Number(teamSpec?.bandwidth ?? DEFAULT_PRICING.team.bandwidthGb),
    defaultConcurrentBuilds: Number(teamSpec?.concurrent_builds ?? DEFAULT_PRICING.team.defaultConcurrentBuilds),
    logRetentionDays: Number(teamSpec?.log_retention ?? DEFAULT_PRICING.team.logRetentionDays),
  };

  const overage = DEFAULT_PRICING.overage;

  const metered = {
    cpuPerGbMonth: Number(prices.metered?.cpu_per_gb_month?.unit_amount ?? DEFAULT_PRICING.metered.cpuPerGbMonth),
    memoryPerGbMonth: Number(prices.metered?.memory_per_gb_month?.unit_amount ?? DEFAULT_PRICING.metered.memoryPerGbMonth),
    storagePerGbMonth: Number(prices.metered?.storage_per_gb_month?.unit_amount ?? DEFAULT_PRICING.metered.storagePerGbMonth),
  };

  const specsMap: Record<string, PlanSpecs> = {};
  for (const key of ["free", "hacker", "developer", "team"] as const) {
    if (specs[key]) {
      specsMap[key] = normalizePlanSpecs(specs[key], DEFAULT_PRICING.specs[key]);
    }
  }

  return { plans, team, overage, metered, specs: { ...DEFAULT_PRICING.specs, ...specsMap } };
}

/** Parse a value that may be a boolean, string "true"/"false", or number 0/1. */
function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function normalizePlanSpecs(raw: any, defaults?: PlanSpecs): PlanSpecs {
  // Returns null when the value is explicitly null / "unlimited" / -1, the
  // fallback when the value is undefined (i.e. backend hasn't supplied the
  // field yet), and the parsed number otherwise.
  const toNullableNumberWithFallback = (value: unknown, fallback: number | null | undefined): number | null => {
    if (value === undefined) return fallback ?? null;
    if (value === null || value === "unlimited" || value === -1) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : (fallback ?? null);
  };

  const sandbox = raw?.sandbox;
  const sandboxConcurrentLimit = Number(sandbox?.concurrent_limit ?? 0);
  const sandboxCpuHoursIncluded = Number(sandbox?.cpu_hours_included ?? 0);
  const sandboxMemoryGbHoursIncluded = Number(sandbox?.memory_gb_hours_included ?? 0);
  const sandboxMaxRuntimeMinutes = Number(sandbox?.max_runtime_minutes ?? 0);
  const sandboxMaxVcpuPerSandbox = Number(sandbox?.max_vcpu_per_sandbox ?? 0);
  const sandboxMaxMemoryGbPerSandbox = Number(sandbox?.max_memory_gb_per_sandbox ?? 0);
  const sandboxEnabledFlag = toBool(sandbox?.enabled, defaults?.sandboxEnabled ?? false);
  const sandboxEnabledByLimits =
    sandboxConcurrentLimit > 0 ||
    sandboxCpuHoursIncluded > 0 ||
    sandboxMemoryGbHoursIncluded > 0 ||
    sandboxMaxRuntimeMinutes > 0 ||
    sandboxMaxVcpuPerSandbox > 0 ||
    sandboxMaxMemoryGbPerSandbox > 0;

  return {
    projectLimit: raw?.project_limit === -1 || raw?.project_limit === "unlimited" ? null : Number(raw?.project_limit ?? 3),
    webhookEnabled: toBool(raw?.webhook_enabled),
    customDomain: toBool(raw?.custom_domain),
    deployPrivateOrganization: toBool(raw?.deploy_private_organization),
    autoscalingEnabled: toBool(raw?.autoscaling_enabled),
    sandboxEnabled: sandboxEnabledFlag || sandboxEnabledByLimits,
    sandboxMaxCount: Number(sandbox?.sandbox_max_count ?? defaults?.sandboxMaxCount ?? 0),
    analytics: toBool(raw?.analytics),
    pullRequestPreview: toBool(raw?.pull_request_preview),
    buildMinutes: Number(raw?.build_minutes ?? 0),
    bandwidth: Number(raw?.bandwidth ?? 0),
    storage: Number(raw?.storage ?? 0),
    concurrentBuilds: Number(raw?.concurrent_builds ?? 1),
    logRetention: Number(raw?.log_retention ?? 1),
    supportLevel: String(raw?.support ?? "community"),
    dbMaxCpu: toNullableNumberWithFallback(raw?.db_max_cpu, defaults?.dbMaxCpu),
    dbMaxMemory: toNullableNumberWithFallback(raw?.db_max_memory, defaults?.dbMaxMemory),
    dbMaxStorage: toNullableNumberWithFallback(raw?.db_max_storage, defaults?.dbMaxStorage),
  };
}
