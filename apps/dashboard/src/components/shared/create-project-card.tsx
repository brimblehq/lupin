import { getRouteApi, Link, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useHaptics } from "@/hooks/use-haptics";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import { getBuildDisabledMessage } from "@/utils/dashboard";
import { SimpleTooltip } from "./tooltip";
import type { SettingsSidebarSnapshot } from "@/backend/settings";

const rootRoute = getRouteApi("__root__");

interface CreateProjectCardProps {
  /** Extra classes on the outer wrapper */
  className?: string;
}

export function CreateProjectCard({ className }: CreateProjectCardProps) {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const haptics = useHaptics();
  const { canWrite } = useWorkspaceRole();
  const { settingsSnapshot } = (rootRoute.useLoaderData() ?? {}) as { settingsSnapshot: SettingsSidebarSnapshot | null };
  const profile = settingsSnapshot?.profile;
  const blockMessage = getBuildDisabledMessage(Boolean(profile?.buildDisabled), profile?.buildDisabledBy);

  if (!canWrite) return null;

  const cardClassName = `flex h-full min-h-[120px] items-center justify-center overflow-clip rounded-[4px] border-[0.5px] border-dash-border ${className ?? ""}`;
  const cardStyle = {
    backgroundImage:
      "repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(217,218,221,0.35) 10px, rgba(217,218,221,0.35) 11px)",
  };
  const buttonClassName =
    "flex items-center gap-2 rounded-lg border border-dash-border bg-dash-bg px-4 py-2 text-sm font-medium text-dash-text-body shadow-sm transition-colors hover:bg-dash-bg-elevated";

  if (blockMessage) {
    return (
      <div className={cardClassName} style={cardStyle}>
        <SimpleTooltip content={blockMessage}>
          <span className="inline-flex">
            <button type="button" disabled className={`${buttonClassName} cursor-not-allowed opacity-50 hover:bg-dash-bg`}>
              <Plus className="size-4" />
              Create new project
            </button>
          </span>
        </SimpleTooltip>
      </div>
    );
  }

  return (
    <div className={cardClassName} style={cardStyle}>
      <Link to={withWorkspaceQuery({ pathname: "/projects/new", searchStr }) as any} onClick={() => haptics.light()} className={buttonClassName}>
        <Plus className="size-4" />
        Create new project
      </Link>
    </div>
  );
}
