import type { ApiClient } from "./types";

export interface UserOverviewBuildMinutes {
  total: number;
  used: number;
  purchased: number;
  included: number;
  cost: number;
  ownerType: string | null;
  ownerId: string | null;
  cycleStartAt: string | null;
  cycleEndAt: string | null;
  nextResetAt: string | null;
}

export interface UserOverviewPlanConfig {
  planType: string;
  amount: number;
  storage: number;
  cpu: number;
  memory: number;
  projectLimit: number;
  bandwidth: number;
  buildMinutes: number;
  buildTimeout: number;
}

export interface UserOverviewLlmTokens {
  used: number;
  total: number;
  cost: number;
}

export interface UserOverview {
  totalProject: number;
  totalDeployments: number;
  billableAmount: number;
  billableDate: string | null;
  analyticsEnabled: boolean;
  maxBandwidth: number;
  usedBandwidth: number;
  usedBandwidthInGB: number;
  usedBandwidthCost: number;
  buildMinutes: UserOverviewBuildMinutes;
  planConfiguration: UserOverviewPlanConfig | null;
  llmTokens: UserOverviewLlmTokens;
  developer_trial_started_at?: string | null;
  developer_trial_ends_at?: string | null;
}

export interface UserOverviewApi {
  get(input?: { teamId?: string }): Promise<UserOverview>;
}

interface UserOverviewResponse {
  data?: {
    data?: UserOverviewRoot;
  } & UserOverviewRoot;
}

interface UserOverviewRoot {
  totalProject: number;
  totalDeployments: number;
  billableAmount: number;
  billableDate: string | null;
  analyticsEnabled: boolean;
  maxBandwidth: number;
  usedBandwidth: number;
  usedBandwidthInGB: number;
  usedBandwithCost: number;
  buildMinutes: number;
  buildMinutesUsed: number;
  buildMinutesPurchased: number;
  buildMinutesIncluded: number;
  buildMinutesCost: number;
  buildMinutesOwnerType: string | null;
  buildMinutesOwnerId: string | null;
  buildMinutesCycleStartAt: string | null;
  buildMinutesCycleEndAt: string | null;
  buildMinutesNextResetAt: string | null;
  plan_configuration: {
    plan_type: string;
    amount: number;
    storage: number;
    cpu: number;
    memory: number;
    project_limit: number;
    bandwidth: number;
    build_minutes: number;
    build_timeout: number;
  } | null;
  llmTokens: {
    used: number;
    total: number;
    cost: number;
  };
  developer_trial_started_at?: string | null;
  developer_trial_ends_at?: string | null;
}

export function createUserOverviewApi(client: ApiClient): UserOverviewApi {
  return {
    async get(input) {
      const response = await client.request<UserOverviewResponse>("/auth/user/overview", {
        method: "GET",
        query: input?.teamId ? { team_id: input.teamId } : undefined,
      });

      const root = (response?.data?.data ?? response?.data) as UserOverviewRoot;
      const planConfig = root.plan_configuration;

      return {
        totalProject: root.totalProject,
        totalDeployments: root.totalDeployments,
        billableAmount: root.billableAmount,
        billableDate: root.billableDate,
        analyticsEnabled: root.analyticsEnabled,
        maxBandwidth: root.maxBandwidth,
        usedBandwidth: root.usedBandwidth,
        usedBandwidthInGB: root.usedBandwidthInGB,
        usedBandwidthCost: root.usedBandwithCost,
        buildMinutes: {
          total: root.buildMinutes,
          used: root.buildMinutesUsed,
          purchased: root.buildMinutesPurchased,
          included: root.buildMinutesIncluded,
          cost: root.buildMinutesCost,
          ownerType: root.buildMinutesOwnerType,
          ownerId: root.buildMinutesOwnerId,
          cycleStartAt: root.buildMinutesCycleStartAt,
          cycleEndAt: root.buildMinutesCycleEndAt,
          nextResetAt: root.buildMinutesNextResetAt,
        },
        planConfiguration: planConfig
          ? {
              planType: planConfig.plan_type,
              amount: planConfig.amount,
              storage: planConfig.storage,
              cpu: planConfig.cpu,
              memory: planConfig.memory,
              projectLimit: planConfig.project_limit,
              bandwidth: planConfig.bandwidth,
              buildMinutes: planConfig.build_minutes,
              buildTimeout: planConfig.build_timeout,
            }
          : null,
        llmTokens: root.llmTokens,
        developer_trial_started_at: root.developer_trial_started_at ?? null,
        developer_trial_ends_at: root.developer_trial_ends_at ?? null,
      };
    },
  };
}
