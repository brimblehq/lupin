import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/volumes")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  component: VolumesLayout,
});

function VolumesLayout() {
  return <Outlet />;
}
