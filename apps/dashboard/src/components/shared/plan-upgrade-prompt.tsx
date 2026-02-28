import { useState } from "react";
import { Lock } from "lucide-react";
import { DashButton } from "./dash-button";
import { ChangePlanModal } from "./change-plan-modal";
import { usePlanGate } from "@/hooks/use-plan-gate";

const PLAN_DISPLAY: Record<string, string> = {
  free: "Free",
  hacker: "Hacker",
  developer: "Pro",
  team: "Team",
};

export function PlanUpgradePrompt({
  feature,
  description,
}: {
  feature: string;
  description?: string;
}) {
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const { planKey } = usePlanGate();
  const currentPlan = PLAN_DISPLAY[planKey] ?? "Free";

  return (
    <div className="flex max-w-[488px] flex-col items-start gap-3 rounded-lg border border-dash-border bg-dash-bg-elevated p-6">
      <div className="flex size-10 items-center justify-center rounded-full bg-dash-bg">
        <Lock className="size-4 text-dash-text-faded" />
      </div>
      <h3 className="text-sm font-medium leading-5 text-dash-text-strong">
        {feature} is not available on your current plan
      </h3>
      <p className="text-sm leading-5 text-dash-text-faded">
        {description ?? `Upgrade your plan to access ${feature.toLowerCase()}.`}
      </p>
      <DashButton onClick={() => setChangePlanOpen(true)}>
        Upgrade plan
      </DashButton>

      <ChangePlanModal
        open={changePlanOpen}
        onOpenChange={setChangePlanOpen}
        currentPlan={currentPlan}
      />
    </div>
  );
}
