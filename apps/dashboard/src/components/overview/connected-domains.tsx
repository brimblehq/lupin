import { Plus, ArrowUpRight } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { DashButton } from "../shared/dash-button";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";

export function ConnectedDomains({
  activeDomains = 0,
}: {
  activeDomains?: number;
}) {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  return (
    <div className="mb-8 flex rounded-[4px] border-[0.5px] border-dash-border py-2">
      {/* Left content */}
      <div className="flex flex-1 flex-col gap-3.5 px-3.5 py-3.5">
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-medium leading-5 tracking-[-0.03px] text-dash-text-strong">
            Connected domains
          </h2>
          <p className="text-sm font-light leading-[1.3] text-dash-text-faded">
            Get intuitive domain registration and management using Brimble
          </p>
        </div>
        <Link to={withWorkspaceQuery({ pathname: "/domains/buy", searchStr }) as any}>
          <DashButton className="w-fit">
            <Plus className="size-4" />
            Register a new domain
          </DashButton>
        </Link>
      </div>

      {/* Right stat */}
      <div className="hidden h-[122px] w-[169px] shrink-0 flex-col items-center justify-center border-l-[0.5px] border-dash-border pl-3.5 pr-2 sm:flex">
        <div className="flex flex-col gap-px">
          <span className="text-[56px] font-light leading-none tracking-[-0.09px] text-dash-text-strong">
            {activeDomains}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-light leading-[1.3] text-dash-text-faded">
              Active domains
            </span>
            <ArrowUpRight className="size-3 text-dash-text-faded" />
          </div>
        </div>
      </div>
    </div>
  );
}
