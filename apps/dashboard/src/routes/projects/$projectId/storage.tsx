import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/$projectId/storage")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  component: ProjectStorageLayout,
});

function ProjectStorageLayout() {
  return <Outlet />;
}
