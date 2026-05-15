import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ScalingPending } from "@/components/shared/route-pending";

export const Route = createFileRoute("/scaling")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  pendingComponent: ScalingPending,
  component: ScalingLayout,
});

function ScalingLayout() {
  return <Outlet />;
}
