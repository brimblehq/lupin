import { createServerFn } from "@tanstack/react-start";
import { withTokenRefresh } from "@/server/shared/backend";
import { DEFAULT_PRICING } from "@/utils/default-pricing";
import type { Pricing, PlanSpecs } from "@/types/pricing";

const SPECS_TTL = 10 * 60_000; // 10 minutes
let specsCache: { data: Pricing; ts: number } | null = null;
type UnknownRecord = Record<string, unknown>;

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

function asRecord(value: unknown): UnknownRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as UnknownRecord;
}

function getNumber(record: UnknownRecord | undefined, key: string, fallback: number): number {
  return Number(record?.[key] ?? fallback);
}

function getString(record: UnknownRecord | undefined, key: string, fallback: string): string {
  return String(record?.[key] ?? fallback);
}

function normalizePricing(raw: unknown): Pricing {
  const root = asRecord(raw);
  if (!root) return DEFAULT_PRICING;

  const specs = asRecord(root.specifications);
  const prices = asRecord(root.pricing);

  if (!specs || !prices) return DEFAULT_PRICING;

  const hackerPrice = asRecord(prices.hacker);
  const developerPrice = asRecord(prices.developer);
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
      amount: getNumber(hackerPrice, "unit_amount", DEFAULT_PRICING.plans[1].amount),
      interval: getString(hackerPrice, "interval", "month"),
    },
    {
      id: "developer",
      name: "Pro",
      amount: getNumber(developerPrice, "unit_amount", DEFAULT_PRICING.plans[2].amount),
      interval: getString(developerPrice, "interval", "month"),
    },
  ];

  const teamSpec = asRecord(specs.team);
  const teamMemberPrice = asRecord(prices.team_member);
  const teamBuildPrice = asRecord(prices.team_build);
  const team = {
    costPerMember: getNumber(teamMemberPrice, "unit_amount", DEFAULT_PRICING.team.costPerMember),
    costPerBuild: getNumber(teamBuildPrice, "unit_amount", DEFAULT_PRICING.team.costPerBuild),
    maxProjects: getNumber(teamSpec, "project_limit", DEFAULT_PRICING.team.maxProjects),
    bandwidthGb: getNumber(teamSpec, "bandwidth", DEFAULT_PRICING.team.bandwidthGb),
    defaultConcurrentBuilds: getNumber(teamSpec, "concurrent_builds", DEFAULT_PRICING.team.defaultConcurrentBuilds),
    logRetentionDays: getNumber(teamSpec, "log_retention", DEFAULT_PRICING.team.logRetentionDays),
  };

  const overage = DEFAULT_PRICING.overage;
  const meteredPrices = asRecord(prices.metered);
  const cpuPerGbMonth = asRecord(meteredPrices?.cpu_per_gb_month);
  const memoryPerGbMonth = asRecord(meteredPrices?.memory_per_gb_month);
  const storagePerGbMonth = asRecord(meteredPrices?.storage_per_gb_month);

  const metered = {
    cpuPerGbMonth: getNumber(cpuPerGbMonth, "unit_amount", DEFAULT_PRICING.metered.cpuPerGbMonth),
    memoryPerGbMonth: getNumber(memoryPerGbMonth, "unit_amount", DEFAULT_PRICING.metered.memoryPerGbMonth),
    storagePerGbMonth: getNumber(storagePerGbMonth, "unit_amount", DEFAULT_PRICING.metered.storagePerGbMonth),
  };

  const specsMap: Record<string, PlanSpecs> = {};
  for (const key of ["free", "hacker", "developer", "team"] as const) {
    const planSpecs = asRecord(specs[key]);
    if (planSpecs) {
      specsMap[key] = normalizePlanSpecs(planSpecs, DEFAULT_PRICING.specs[key]);
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

function normalizePlanSpecs(raw: UnknownRecord, defaults?: PlanSpecs): PlanSpecs {
  // Returns null when the value is explicitly null / "unlimited" / -1, the
  // fallback when the value is undefined (i.e. backend hasn't supplied the
  // field yet), and the parsed number otherwise.
  const toNullableNumberWithFallback = (value: unknown, fallback: number | null | undefined): number | null => {
    if (value === undefined) return fallback ?? null;
    if (value === null || value === "unlimited" || value === -1) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : (fallback ?? null);
  };

  const sandbox = asRecord(raw.sandbox);
  const sandboxConcurrentLimit = getNumber(sandbox, "concurrent_limit", 0);
  const sandboxCpuHoursIncluded = getNumber(sandbox, "cpu_hours_included", 0);
  const sandboxMemoryGbHoursIncluded = getNumber(sandbox, "memory_gb_hours_included", 0);
  const sandboxMaxRuntimeMinutes = getNumber(sandbox, "max_runtime_minutes", 0);
  const sandboxMaxVcpuPerSandbox = getNumber(sandbox, "max_vcpu_per_sandbox", 0);
  const sandboxMaxMemoryGbPerSandbox = getNumber(sandbox, "max_memory_gb_per_sandbox", 0);
  const sandboxEnabledFlag = toBool(sandbox?.enabled, defaults?.sandboxEnabled ?? false);
  const sandboxEnabledByLimits =
    sandboxConcurrentLimit > 0 ||
    sandboxCpuHoursIncluded > 0 ||
    sandboxMemoryGbHoursIncluded > 0 ||
    sandboxMaxRuntimeMinutes > 0 ||
    sandboxMaxVcpuPerSandbox > 0 ||
    sandboxMaxMemoryGbPerSandbox > 0;

  return {
    projectLimit: raw.project_limit === -1 || raw.project_limit === "unlimited" ? null : Number(raw.project_limit ?? 3),
    webhookEnabled: toBool(raw.webhook_enabled),
    customDomain: toBool(raw.custom_domain),
    deployPrivateOrganization: toBool(raw.deploy_private_organization),
    autoscalingEnabled: toBool(raw.autoscaling_enabled),
    objectStorageEnabled: toBool(raw.object_storage_enabled, defaults?.objectStorageEnabled ?? false),
    sandboxEnabled: sandboxEnabledFlag || sandboxEnabledByLimits,
    sandboxMaxCount: getNumber(sandbox, "sandbox_max_count", defaults?.sandboxMaxCount ?? 0),
    analytics: toBool(raw.analytics),
    pullRequestPreview: toBool(raw.pull_request_preview),
    buildMinutes: getNumber(raw, "build_minutes", 0),
    bandwidth: getNumber(raw, "bandwidth", 0),
    storage: getNumber(raw, "storage", 0),
    concurrentBuilds: getNumber(raw, "concurrent_builds", 1),
    logRetention: getNumber(raw, "log_retention", 1),
    supportLevel: getString(raw, "support", "community"),
    dbMaxCpu: toNullableNumberWithFallback(raw.db_max_cpu, defaults?.dbMaxCpu),
    dbMaxMemory: toNullableNumberWithFallback(raw.db_max_memory, defaults?.dbMaxMemory),
    dbMaxStorage: toNullableNumberWithFallback(raw.db_max_storage, defaults?.dbMaxStorage),
  };
}
