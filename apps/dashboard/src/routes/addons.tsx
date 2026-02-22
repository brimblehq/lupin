import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/addons")({
  component: AddonsLayout,
});

function AddonsLayout() {
  return <Outlet />;
}
