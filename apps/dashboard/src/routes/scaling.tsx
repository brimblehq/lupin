import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/scaling")({
  component: ScalingLayout,
});

function ScalingLayout() {
  return <Outlet />;
}
