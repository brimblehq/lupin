import { usePricing } from "@/contexts/pricing-context";
import { usePlanType } from "@/contexts/plan-type-context";
import type { PlanSpecs } from "@/types/pricing";

const PLAN_TYPE_TO_SPEC_KEY = new Map([
  ["free", "free"],
  ["free_plan", "free"],
  ["hacker", "hacker"],
  ["hacker_plan", "hacker"],
  ["developer", "developer"],
  ["developer_plan", "developer"],
  ["pro", "developer"],
  ["pro_plan", "developer"],
  ["team", "team"],
  ["team_plan", "team"],
]);

export function resolvePlanKey(planType?: string): string {
  const raw = planType?.trim();
  if (!raw) {
    return "free";
  }

  const normalized = raw.replaceAll("-", "_").replaceAll(" ", "_");
  return PLAN_TYPE_TO_SPEC_KEY.get(normalized.toLowerCase()) ?? "free";
}

export function usePlanGate(planTypeOverride?: string): PlanSpecs & { planKey: string } {
  const pricing = usePricing();
  const contextPlanType = usePlanType();
  const planType = planTypeOverride ?? contextPlanType;

  const planKey = resolvePlanKey(planType);
  const specs = pricing.specs[planKey] ?? pricing.specs.free;

  return { ...specs, planKey };
}
