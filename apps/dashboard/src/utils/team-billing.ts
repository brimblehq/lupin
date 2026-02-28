import type { Pricing } from "@/types/pricing";

export function calculateTeamBilling(
  pricing: Pricing,
  teamSize: number,
  concurrentBuilds: number,
) {
  const seatsCost = teamSize * pricing.team.costPerMember;
  const buildsCost = concurrentBuilds * pricing.team.costPerBuild;
  return { seatsCost, buildsCost, total: seatsCost + buildsCost };
}
