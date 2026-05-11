import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";
import { GlossyButton } from "@/components/shared/glossy-button";
import { useProfileDrawer } from "@/contexts/profile-drawer-context";
import { ProfileTab } from "@/types/enums";
import { getWorkspaceTeamMembersServerFn } from "@/server/teams/actions";
import type { TeamDetails } from "@/backend/teams";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

export const Route = createFileRoute("/teams/$teamName/2fa-required")({
  component: TeamTwoFactorRequiredPage,
});

function TeamTwoFactorRequiredPage() {
  const { teamName } = Route.useParams();
  const router = useRouter();
  const navigate = useNavigate();
  const profileDrawer = useProfileDrawer();
  const getTeam = useServerFn(getWorkspaceTeamMembersServerFn as any) as (args: {
    data: { workspace: string };
  }) => Promise<TeamDetails | null>;

  const [displayName, setDisplayName] = useState<string>(teamName);

  useEffect(() => {
    let cancelled = false;
    void getTeam({ data: { workspace: teamName } })
      .then((team) => {
        if (cancelled) return;
        if (team?.name) setDisplayName(team.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getTeam, teamName]);

  return (
    <div className="flex min-h-[calc(100dvh-160px)] items-center justify-center px-6 py-10">
      <div className="w-full max-w-[420px] rounded-[10px] border-[0.5px] border-dash-border bg-dash-bg-elevated/40 p-8 text-center">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-[#f5a623]/10 text-[#f5a623]">
          <Lock className="size-5" />
        </div>
        <h1 className="text-[20px] font-semibold leading-[1.2] tracking-[-0.3px] text-dash-text-strong">
          2FA required to access {displayName}
        </h1>
        <p className="mt-2 text-sm leading-[1.5] text-dash-text-faded">
          {displayName} requires every member to have two-factor authentication enabled. Set up 2FA on your account to restore access.
        </p>

        <div className="mt-6 flex flex-col items-stretch gap-2.5">
          <GlossyButton
            fullWidth
            onClick={async () => {
              await navigate({ to: "/", search: {} });
              profileDrawer.open(ProfileTab.Security);
            }}
          >
            Set up 2FA
          </GlossyButton>
          <button
            type="button"
            onClick={() => {
              void navigate({ to: "/", search: { workspace: teamName } as any }).then(() => invalidateActiveMatches(router));
            }}
            className="text-xs font-medium text-dash-text-faded transition-colors hover:text-dash-text-strong"
          >
            I&apos;ve enabled 2FA — try again
          </button>
        </div>

        <div className="mt-6 border-t-[0.5px] border-dash-border-soft pt-4">
          <Link
            to="/"
            className="text-[11px] font-medium text-dash-text-extra-faded transition-colors hover:text-dash-text-faded"
          >
            Switch workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
