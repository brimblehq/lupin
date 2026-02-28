import config from "@/config";
import type { Pricing } from "@/types/pricing";

export const DEFAULT_PRICING: Pricing = {
  plans: [
    { id: "free", name: "Free", amount: config.defaultPlanFreePrice, interval: "month" },
    { id: "hacker", name: "Hacker", amount: config.defaultPlanHackerPrice, interval: "month" },
    { id: "developer", name: "Pro", amount: config.defaultPlanProPrice, interval: "month" },
  ],
  team: {
    costPerMember: config.defaultTeamCostPerMember,
    costPerBuild: config.defaultTeamCostPerBuild,
    maxProjects: config.defaultTeamMaxProjects,
    bandwidthGb: config.defaultTeamBandwidthGb,
    defaultConcurrentBuilds: config.defaultTeamConcurrentBuilds,
    logRetentionDays: config.defaultTeamLogRetentionDays,
  },
  overage: {
    bandwidthPerGb: config.defaultOverageBandwidthPerGb,
    buildMinutesPerMin: config.defaultOverageBuildMinutesPerMin,
  },
};
