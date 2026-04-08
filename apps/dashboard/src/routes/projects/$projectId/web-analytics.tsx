import { useEffect, useState } from "react";
import {
  createFileRoute,
  getRouteApi,
  useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChartLineUp } from "@phosphor-icons/react";
import { TabHeader } from "../../../components/shared/tab-header";
import { shouldShowProjectWebAnalyticsTab } from "@/utils/project-capabilities";
import { AppAnalytics } from "./observability";
import { AppAnalyticsSkeleton } from "@/components/analytics/analytics-skeleton";
import { InstallTrackingModal } from "@/components/analytics/install-tracking-modal";
import {
  enableAnalyticsServerFn,
  getAnalyticsServerFn,
  type AnalyticsLoadResult,
  type EnableAnalyticsResult,
} from "@/server/analytics/actions";
import { friendlyAnalyticsError } from "@/lib/analytics-errors";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { usePlanGate } from "@/hooks/use-plan-gate";
import { ChangePlanModal } from "@/components/shared/change-plan-modal";

const PLAN_DISPLAY: Record<string, string> = {
  free: "Free",
  hacker: "Hacker",
  developer: "Pro",
  team: "Team",
};

const parentRoute = getRouteApi("/projects/$projectId");

const DEFAULT_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function SkeletonShell() {
  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-0">
      <AppAnalyticsSkeleton />
    </div>
  );
}

export const Route = createFileRoute("/projects/$projectId/web-analytics")({
  component: WebAnalyticsPage,
});

function EnableAnalyticsEmptyState({
  projectId,
  onEnabled,
}: {
  projectId: string;
  onEnabled?: () => void;
}) {
  const plan = usePlanGate();
  const enableAnalytics = useServerFn(
    enableAnalyticsServerFn as any,
  ) as (args: {
    data: { projectId: string };
  }) => Promise<EnableAnalyticsResult>;
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [serverSnippet, setServerSnippet] = useState<string | undefined>(
    undefined,
  );
  const [snippets, setSnippets] = useState<
    import("@/backend/analytics").AnalyticsSnippets | undefined
  >(undefined);
  const [siteId, setSiteId] = useState<string>("your-site-id");
  const [planLocked, setPlanLocked] = useState(false);

  const currentPlanLabel = PLAN_DISPLAY[plan.planKey] ?? "Free";

  async function handleEnable() {
    if (enabling) return;
    setEnabling(true);
    try {
      const result = await enableAnalytics({ data: { projectId } });
      if (result.ok) {
        setServerSnippet(result.data.snippet);
        setSnippets(result.data.snippets);
        setSiteId(result.data.websiteId);
        toast.success("Analytics enabled");
        onEnabled?.();
        return;
      }
      setPlanLocked(result.planLocked);
      toast.error(result.message);
    } catch (error) {
      const friendly = friendlyAnalyticsError(error);
      setPlanLocked(friendly.planLocked);
      toast.error(friendly.message);
    } finally {
      setEnabling(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-0">
      <TabHeader title="Web analytics">
        Track visitor activity, top pages, and traffic sources.
      </TabHeader>
      <div className="flex flex-col items-center gap-5 px-6 py-16 text-center">
        <ChartLineUp
          className="size-10 text-dash-text-extra-faded"
          weight="duotone"
        />
        <div className="flex max-w-[420px] flex-col gap-1.5">
          <h3 className="text-base font-medium text-dash-text-strong">
            Analytics not enabled
          </h3>
          <p className="text-sm font-light leading-[1.45] text-dash-text-faded">
            {planLocked
              ? "Web analytics is not supported on your plan. Upgrade to a higher plan to start tracking visitors on this project."
              : "Enable analytics for this project, then drop the tracking snippet into your site to start collecting data."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {planLocked ? (
            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className="rounded-[4px] border border-[#232931] bg-gradient-to-b from-[#545459] via-[#45454b] to-[#2d2d32] px-4 py-[7px] text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-opacity hover:opacity-90"
            >
              Upgrade plan
            </button>
          ) : (
            <button
              type="button"
              disabled={enabling}
              onClick={() => void handleEnable()}
              className="rounded-[4px] border border-[#232931] bg-gradient-to-b from-[#545459] via-[#45454b] to-[#2d2d32] px-4 py-[7px] text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {enabling ? "Enabling..." : "Enable analytics"}
            </button>
          )}
          {!planLocked && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg px-3 py-[7px] text-sm font-medium text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
            >
              Preview snippet
            </button>
          )}
        </div>
      </div>

      <InstallTrackingModal
        open={open}
        onOpenChange={setOpen}
        siteId={siteId}
        snippets={snippets}
        serverSnippet={serverSnippet}
        onEnable={planLocked ? undefined : handleEnable}
        enabling={enabling}
      />

      <ChangePlanModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlan={currentPlanLabel}
        defaultSelectedPlan="Pro"
      />
    </div>
  );
}

function PlanLockedCard({ message }: { message: string }) {
  const plan = usePlanGate();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const currentPlanLabel = PLAN_DISPLAY[plan.planKey] ?? "Free";

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-0">
      <TabHeader title="Web analytics">
        Track visitor activity, top pages, and traffic sources.
      </TabHeader>
      <div className="flex flex-col items-center gap-4 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-6 py-12 text-center">
        <h3 className="text-base font-medium text-dash-text-strong">
          Upgrade to enable analytics
        </h3>
        <p className="max-w-[420px] text-sm font-light text-dash-text-faded">
          {message}
        </p>
        <button
          type="button"
          onClick={() => setUpgradeOpen(true)}
          className="rounded-[4px] border border-[#232931] bg-gradient-to-b from-[#545459] via-[#45454b] to-[#2d2d32] px-4 py-[7px] text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-opacity hover:opacity-90"
        >
          Upgrade plan
        </button>
      </div>
      <ChangePlanModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlan={currentPlanLabel}
        defaultSelectedPlan="Pro"
      />
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  const router = useRouter();
  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-0">
      <TabHeader title="Web analytics">
        Track visitor activity, top pages, and traffic sources.
      </TabHeader>
      <div className="flex flex-col items-center gap-4 rounded-[4px] border-[0.5px] border-dash-border px-6 py-12 text-center">
        <p className="text-sm text-dash-text-body">{message}</p>
        <button
          type="button"
          onClick={() => void router.invalidate()}
          className="rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg px-3 py-[7px] text-xs font-medium text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function WebAnalyticsPage() {
  const { project } = parentRoute.useLoaderData() as { project?: any };
  const projectId = project?.id ?? "";
  const plan = usePlanGate();
  const cachedPlanSupportsAnalytics = plan.analytics !== false;

  const getAnalytics = useServerFn(getAnalyticsServerFn as any) as (args: {
    data: { projectId: string; startAt: number; endAt: number; unit?: string; timezone?: string };
  }) => Promise<AnalyticsLoadResult>;

  const [result, setResult] = useState<AnalyticsLoadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    const endAt = Date.now();
    const startAt = endAt - DEFAULT_DURATION_MS;
    void getAnalytics({
      data: {
        projectId,
        startAt,
        endAt,
        unit: "hour",
        timezone: browserTimezone(),
      },
    })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
      })
      .catch((error) => {
        if (cancelled) return;
        setResult({ state: "error", message: friendlyAnalyticsError(error).message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getAnalytics, projectId, refreshKey]);

  if (!shouldShowProjectWebAnalyticsTab(project)) {
    return (
      <div className="mx-auto flex max-w-[1000px] flex-col gap-4 px-4 py-8 sm:px-0">
        <TabHeader title="Web analytics">
          Web analytics is not available for this project type.
        </TabHeader>
      </div>
    );
  }

  if (loading || !result) {
    if (!cachedPlanSupportsAnalytics) {
      return (
        <EnableAnalyticsEmptyState
          projectId={projectId}
          onEnabled={() => setRefreshKey((k) => k + 1)}
        />
      );
    }
    return <SkeletonShell />;
  }

  if (result.state === "empty") {
    return (
      <EnableAnalyticsEmptyState
        projectId={projectId}
        onEnabled={() => setRefreshKey((k) => k + 1)}
      />
    );
  }
  if (result.state === "plan-locked") {
    return <PlanLockedCard message={result.message} />;
  }
  if (result.state === "error") {
    return <ErrorCard message={result.message} />;
  }

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-0">
      <AppAnalytics initial={result.data} projectId={projectId} />
    </div>
  );
}
