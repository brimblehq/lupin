import { usePricing } from "@/contexts/pricing-context";
import { usePlanType } from "@/contexts/plan-type-context";
import type { PlanSpecs } from "@/types/pricing";

const PLAN_TYPE_TO_SPEC_KEY: Record<string, string> = {
  FREE_PLAN: "free",
  HACKER_PLAN: "hacker",
  DEVELOPER_PLAN: "developer",
  PRO_PLAN: "developer",
  TEAM_PLAN: "team",
  free: "free",
  hacker: "hacker",
  developer: "developer",
  pro: "developer",
  team: "team",
  free_plan: "free",
  hacker_plan: "hacker",
  developer_plan: "developer",
  pro_plan: "developer",
  team_plan: "team",
};

export function usePlanGate(): PlanSpecs & { planKey: string } {
  const pricing = usePricing();
  const planType = usePlanType();

  const planKey = PLAN_TYPE_TO_SPEC_KEY[planType ?? ""] ?? "free";
  const specs = pricing.specs[planKey] ?? pricing.specs.free;

  return { ...specs, planKey };
}
