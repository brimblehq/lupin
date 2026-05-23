import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared/page-header";
import { PlanUpgradePrompt } from "@/components/shared/plan-upgrade-prompt";
import { FeatureFlags, useFeatureFlag } from "@/lib/feature-flags";
import { usePlanGate } from "@/hooks/use-plan-gate";

export const Route = createFileRoute("/sandboxes")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  component: SandboxesLayout,
});

function SandboxesLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { sandboxEnabled } = usePlanGate();
  const sandboxFeatureEnabled = useFeatureFlag(FeatureFlags.ENABLE_SANDBOX);
  const isListRoot = pathname === "/sandboxes" || pathname === "/sandboxes/";

  if (!sandboxEnabled || !sandboxFeatureEnabled) {
    return (
      <div className="max-w-[1000px]">
        <PageHeader title="Sandboxes" image="/images/leaves.svg">
          Spin up isolated AI sandboxes and manage their persistent storage. Configure resources, attach volumes, and interact with them in real time.
        </PageHeader>
        <hr className="-ml-4 mb-6 border-dash-border-soft md:-ml-10" />
        <PlanUpgradePrompt feature="Sandboxes" description="Upgrade your plan to spin up AI sandboxes." />
      </div>
    );
  }

  if (!isListRoot) {
    return <Outlet />;
  }

  return (
    <div className="max-w-[1000px]">
      <PageHeader title="Sandboxes" image="/images/leaves.svg">
        Spin up isolated AI sandboxes and manage their persistent storage. Configure resources, attach volumes, and interact with them in real time.
      </PageHeader>
      <Outlet />
    </div>
  );
}
