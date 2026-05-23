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

export interface PlanSpecs {
  projectLimit: number | null; // null = unlimited
  webhookEnabled: boolean;
  customDomain: boolean;
  deployPrivateOrganization: boolean;
  autoscalingEnabled: boolean;
  sandboxEnabled: boolean;
  sandboxMaxCount: number;
  analytics: boolean;
  pullRequestPreview: boolean;
  buildMinutes: number;
  bandwidth: number;
  storage: number;
  concurrentBuilds: number;
  logRetention: number;
  supportLevel: string;
  dbMaxCpu: number | null;
  dbMaxMemory: number | null;
  dbMaxStorage: number | null;
}

export interface MeteredRates {
  cpuPerGbMonth: number;
  memoryPerGbMonth: number;
  storagePerGbMonth: number;
}

export interface Pricing {
  plans: PlanPrice[];
  team: TeamSpecs;
  overage: OverageRates;
  metered: MeteredRates;
  specs: Record<string, PlanSpecs>;
}
