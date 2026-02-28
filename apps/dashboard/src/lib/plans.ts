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

/* ─── Team roles ─── */

export const TEAM_ROLES = [ROLES.CREATOR, ROLES.ADMINISTRATOR, ROLES.MEMBER] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/**
 * Roles available when inviting — Creator is assigned automatically to the
 * workspace creator, so it's excluded from invite dropdowns.
 */
export const INVITABLE_ROLES: TeamRole[] = [ROLES.ADMINISTRATOR, ROLES.MEMBER];
