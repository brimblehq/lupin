/**
 * Billing plan constants and backend-to-UI mapping.
 *
 * Source of truth: DASHBOARD_BILLING_GUIDE.md
 */

import { SUBSCRIPTION_PLAN_TYPE, ROLES } from "@brimble/models/dist/enum";

/* ─── Backend → UI name mapping ─── */

export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  [SUBSCRIPTION_PLAN_TYPE.FreePlan]: "Free",
  [SUBSCRIPTION_PLAN_TYPE.HackerPlan]: "Hacker",
  [SUBSCRIPTION_PLAN_TYPE.DeveloperPlan]: "Pro",
  [SUBSCRIPTION_PLAN_TYPE.TeamPlan]: "Team",
};

export function getPlanDisplayName(backendName: string): string {
  return PLAN_DISPLAY_NAMES[backendName] ?? backendName;
}

/* ─── Personal plan pricing (monthly only) ─── */

export const PERSONAL_PLANS = [
  { name: "Free", backendKey: SUBSCRIPTION_PLAN_TYPE.FreePlan, price: 0, projects: 5, bandwidth: 10, concurrentBuilds: 0, logRetention: 3 },
  { name: "Hacker", backendKey: SUBSCRIPTION_PLAN_TYPE.HackerPlan, price: 7, projects: 10, bandwidth: 30, concurrentBuilds: 1, logRetention: 7 },
  { name: "Pro", backendKey: SUBSCRIPTION_PLAN_TYPE.DeveloperPlan, price: 19, projects: 150, bandwidth: 150, concurrentBuilds: 2, logRetention: 30 },
] as const;

/* ─── Team plan pricing ─── */

export const TEAM_COST_PER_MEMBER = 8;
export const TEAM_COST_PER_BUILD = 7.5;
export const TEAM_MAX_PROJECTS = 500;
export const TEAM_BANDWIDTH_GB = 500;
export const TEAM_CONCURRENT_BUILDS = 2;
export const TEAM_LOG_RETENTION_DAYS = 30;

export function calculateTeamCost(members: number, builds: number): number {
  return members * TEAM_COST_PER_MEMBER + builds * TEAM_COST_PER_BUILD;
}

/* ─── Overage rates ─── */

export const OVERAGE_BANDWIDTH_PER_GB = 0.25;
export const OVERAGE_BUILD_MINUTES_PER_MIN = 0.002;

/* ─── Team roles ─── */

export const TEAM_ROLES = [ROLES.CREATOR, ROLES.ADMINISTRATOR, ROLES.MEMBER] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/**
 * Roles available when inviting — Creator is assigned automatically to the
 * workspace creator, so it's excluded from invite dropdowns.
 */
export const INVITABLE_ROLES: TeamRole[] = [ROLES.ADMINISTRATOR, ROLES.MEMBER];
