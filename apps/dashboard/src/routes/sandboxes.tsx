import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { PageHeader } from "@/components/shared/page-header";
import { useHaptics } from "@/hooks/use-haptics";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";

export const Route = createFileRoute("/sandboxes")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  component: SandboxesLayout,
});

interface TabEntry {
  id: string;
  label: string;
  path: string;
}

const TABS: TabEntry[] = [
  { id: "sandboxes", label: "Sandboxes", path: "/sandboxes" },
  { id: "volumes", label: "Volumes", path: "/sandboxes/volumes" },
  { id: "snapshots", label: "Snapshots", path: "/sandboxes/snapshots" },
];

function isTabActive(pathname: string, path: string) {
  return pathname === path || pathname === `${path}/`;
}

function SandboxesLayout() {
  const haptics = useHaptics();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const showTabs = !pathname.startsWith("/sandboxes/new");

  if (!showTabs) {
    return <Outlet />;
  }

  return (
    <div className="max-w-[1000px]">
      <PageHeader title="Sandboxes" image="/icons/sandbox.svg">
        Spin up isolated AI sandboxes and manage their persistent storage. Configure resources, attach volumes, and interact with them in real time.
      </PageHeader>

      <div className="mb-6 -mx-4 border-b-[0.5px] border-dash-border-soft px-4 md:-mx-10 md:px-10">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => {
            const active = isTabActive(pathname, tab.path);
            return (
              <Link
                key={tab.id}
                to={withWorkspaceQuery({ pathname: tab.path, searchStr }) as any}
                preload="intent"
                onClick={() => haptics.selection()}
                className={`relative px-3 py-3 text-sm transition-colors ${
                  active ? "text-dash-text-strong" : "text-dash-text-faded hover:text-dash-text-body"
                }`}
              >
                {tab.label}
                {active ? (
                  <motion.span
                    layoutId="sandboxes-section-tab-underline"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="absolute inset-x-2 -bottom-px h-[2px] bg-[#4879f8]"
                  />
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>

      <Outlet />
    </div>
  );
}
