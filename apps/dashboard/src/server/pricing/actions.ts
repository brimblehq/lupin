import { createServerFn } from "@tanstack/react-start";
import { createBackendApi } from "@/backend";
import config from "@/config";
import { getServerAccessToken } from "@/server/auth/cookies";
import { DEFAULT_PRICING } from "@/utils/default-pricing";
import type { Pricing } from "@/types/pricing";

function getServerBackendApi() {
  return createBackendApi({
    baseUrl: config.apiUrl,
    getAccessToken: getServerAccessToken,
  });
}

export const getSubscriptionSpecsServerFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<Pricing> => {
  try {
    const api = getServerBackendApi();
    const res = await api.payments.getSubscriptionSpecs();
    return normalizePricing(res);
  } catch {
    return DEFAULT_PRICING;
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

  return { plans, team, overage };
}
