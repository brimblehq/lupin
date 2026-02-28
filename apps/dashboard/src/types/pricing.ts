export interface PlanPrice {
  id: string;
  name: string;
  amount: number;
  interval: string;
}

export interface TeamSpecs {
  costPerMember: number;
  costPerBuild: number;
  maxProjects: number;
  bandwidthGb: number;
  defaultConcurrentBuilds: number;
  logRetentionDays: number;
}

export interface OverageRates {
  bandwidthPerGb: number;
  buildMinutesPerMin: number;
}

export interface Pricing {
  plans: PlanPrice[];
  team: TeamSpecs;
  overage: OverageRates;
}
