import { useState } from "react";
import { Infinity } from "@phosphor-icons/react";
import { SUBSCRIPTION_PLAN_TYPE } from "@brimble/models/dist/enum";
import { AreaChart, Area, YAxis, ResponsiveContainer } from "recharts";
import { DashButton } from "../shared/dash-button";
import { ChangePlanModal } from "../shared/change-plan-modal";
import { usePlanGate } from "@/hooks/use-plan-gate";
import type { PaymentMethod } from "@/backend/payments";
import type { OverviewSummary } from "@/backend/overview";
import type { BandwidthSummary } from "@/backend/bandwidth";

function formatDurationSeconds(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  const rounded = Math.max(0, Math.round(value));
  if (rounded < 60) {
    return `${rounded} Second${rounded === 1 ? "" : "s"}`;
  }

  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  if (seconds === 0) {
    return `${minutes} Minute${minutes === 1 ? "" : "s"}`;
  }

  return `${minutes}m ${seconds}s`;
}

function formatBandwidthTotal(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "No usage data";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const decimals = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(decimals)}${units[unitIndex]} used`;
}

/* ─── Plan helpers ─── */

function getPlanInfo(planType?: string, isTeamWorkspace?: boolean) {
  if (isTeamWorkspace) {
    return { label: "TEAM", badgeBg: "bg-[#d4a017]", displayName: "Team", medalIcon: "/icons/medal.svg", nextPlan: null, unlimitedProjects: true };
  }

  const key = (planType ?? "").toUpperCase();

  if (key === SUBSCRIPTION_PLAN_TYPE.HackerPlan || key === "HACKER") {
    return { label: "HACKER", badgeBg: "bg-[#9ca3af]", displayName: "Hacker", medalIcon: "/icons/medal-silver.svg", nextPlan: "Pro", unlimitedProjects: false };
  }

  if (key === SUBSCRIPTION_PLAN_TYPE.DeveloperPlan || key === "PRO" || key === "PRO_PLAN") {
    return { label: "PRO", badgeBg: "bg-[#d4a017]", displayName: "Pro", medalIcon: "/icons/medal.svg", nextPlan: null, unlimitedProjects: true };
  }

  if (key === SUBSCRIPTION_PLAN_TYPE.TeamPlan || key === "TEAM") {
    return { label: "TEAM", badgeBg: "bg-[#d4a017]", displayName: "Team", medalIcon: "/icons/medal.svg", nextPlan: null, unlimitedProjects: true };
  }

  return { label: "FREE", badgeBg: "bg-[#cd7f32]", displayName: "Free", medalIcon: "/icons/medal-bronze.svg", nextPlan: "Hacker", unlimitedProjects: false };
}

export function StatsRow({
  overview,
  bandwidth,
  planType,
  isTeamWorkspace,
  initialPaymentMethods,
}: {
  overview?: OverviewSummary | null;
  bandwidth?: BandwidthSummary | null;
  planType?: string;
  isTeamWorkspace?: boolean;
  initialPaymentMethods?: PaymentMethod[] | null;
}) {
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const plan = getPlanInfo(planType, isTeamWorkspace);
  const { projectLimit: specProjectLimit } = usePlanGate();
  const canChangePlan = plan.label !== "TEAM";
  const hasUnlimitedProjects = isTeamWorkspace || specProjectLimit === null;
  const totalProjects = overview?.total?.project ?? 0;
  const bandwidthChartData =
    bandwidth?.results?.map((point) => ({
      value: typeof point.total === "number" && Number.isFinite(point.total) ? point.total : 0,
    })) ?? [];
  const chartData = bandwidthChartData.length > 0 ? bandwidthChartData : [{ value: 0 }];
  const latestBandwidthTotal =
    bandwidth?.results && bandwidth.results.length > 0
      ? bandwidth.results[bandwidth.results.length - 1]?.total
      : undefined;
  const bandwidthSummaryText = formatBandwidthTotal(latestBandwidthTotal);

  const deploymentRows = [
    {
      label: "Recent deployment",
      value: formatDurationSeconds(overview?.deploymentBuildTime?.recent),
    },
    {
      label: "Fastest deployment",
      value: formatDurationSeconds(overview?.deploymentBuildTime?.fastest),
    },
    {
      label: "Slowest deployment",
      value: formatDurationSeconds(overview?.deploymentBuildTime?.slowest),
    },
  ];

  return (
    <div className="mb-8 flex flex-col overflow-hidden rounded border-[0.5px] border-dash-border md:h-[160px] md:flex-row">
      {/* Bandwidth */}
      <div className="flex w-full shrink-0 flex-col border-b-[0.5px] border-dash-border md:w-[36%] md:border-b-0 md:border-r-[0.5px]">
        <div className="flex h-[30px] items-center border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-2">
          <span className="text-xs tracking-[-0.02px] text-dash-text-strong">
            Bandwidth
          </span>
        </div>
        <p className="px-2 pt-2 pb-3 text-xs uppercase tracking-[-0.02px] text-[#ff9b01]">
          {bandwidthSummaryText}
        </p>
        <div className="mt-auto h-[65px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={chartData}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
              <YAxis
                domain={[
                  0,
                  (max: number) => (typeof max === "number" && Number.isFinite(max) && max > 0 ? max : 1),
                ]}
                hide
              />
              <Area
                type="linear"
                dataKey="value"
                stroke="#ff9b00"
                strokeWidth={1}
                fill="rgba(255,155,0,0.30)"
                baseValue={0}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Deployment minutes */}
      <div className="flex w-full shrink-0 flex-col md:w-[34%]">
        <div className="flex h-[30px] items-center border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-2">
          <span className="text-xs tracking-[-0.02px] text-dash-text-strong">
            Deployment minutes
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-between gap-1 px-2 py-3.5 md:gap-0">
          {deploymentRows.map((row, i) => (
            <div key={row.label}>
              <div className="flex items-center justify-between text-sm leading-[1.3] text-dash-text-faded">
                <span>{row.label}</span>
                <span className="text-right">{row.value}</span>
              </div>
              {i < deploymentRows.length - 1 && (
                <hr className="mt-2 border-dash-border md:mt-1.5" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Total deployments */}
      <div className="flex flex-1 flex-col border-t-[0.5px] border-dash-border md:border-t-0 md:border-l-[0.5px]">
        <div className="flex h-[30px] items-center border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-2.5">
          <span className="text-xs tracking-[-0.02px] text-dash-text-strong">
            Total projects
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4 md:py-0">
          <div className="flex items-center gap-2.5">
            <p className="text-xl tracking-[-0.03px] text-dash-text-strong">
              {totalProjects}
              {hasUnlimitedProjects ? (
                <span className="text-dash-text-extra-faded">
                  /
                  <span className="ml-0.5 inline-flex align-middle">
                    <Infinity className="size-5" weight="light" aria-label="Unlimited" />
                  </span>
                </span>
              ) : (
                <span className="text-dash-text-extra-faded">/{specProjectLimit}</span>
              )}
            </p>
          </div>
          <DashButton
            onClick={() => {
              if (!canChangePlan) {
                return;
              }
              setChangePlanOpen(true);
            }}
            disabled={!canChangePlan}
            className={!canChangePlan ? "cursor-default opacity-100" : undefined}
            aria-disabled={!canChangePlan}
          >
            {plan.nextPlan ? `Get Brimble ${plan.nextPlan}` : `Brimble ${plan.displayName}`}
            <img src={plan.medalIcon} alt="" className="size-4" />
          </DashButton>
        </div>
      </div>

      <ChangePlanModal
        open={changePlanOpen}
        onOpenChange={setChangePlanOpen}
        currentPlan={plan.displayName}
        initialPaymentMethods={initialPaymentMethods}
      />
    </div>
  );
}
