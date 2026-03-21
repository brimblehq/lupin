import { ArrowRight } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { getWorkspaceFromSearch } from "@/utils/topbar-navigation";
import { useLogoColor } from "@/hooks/use-logo-color";

export interface Addon {
  id: string;
  name: string;
  description: string;
  gradient: string;
  logo: string;
  logoBg: string;
  logoImageUrl?: string;
  installed?: boolean;
}

export function AddonCard({
  addon,
  onManage,
}: {
  addon: Addon;
  onManage?: () => void;
}) {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const workspace = getWorkspaceFromSearch({ searchStr });
  const logoColors = useLogoColor(addon.logoImageUrl);

  const gradientStyle = logoColors
    ? { background: `linear-gradient(to bottom, ${logoColors.from}, ${logoColors.to})` }
    : undefined;
  const logoBgColor = logoColors?.logoBg ?? addon.logoBg;

  return (
    <div className="flex h-full flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border-soft transition-shadow hover:shadow-[0px_2px_8px_rgba(0,0,0,0.06)]">
      {/* Gradient header with browser mockup + logo */}
      <div
        className={`relative h-[101px] overflow-clip border-b-[0.5px] border-dash-border ${logoColors ? "" : `bg-gradient-to-b ${addon.gradient}`}`}
        style={gradientStyle}
      >
        {/* Browser window mockup */}
        <div
          className="absolute top-4 h-[157px] w-[282px] overflow-clip rounded-[4px] border-[0.5px] border-dash-border-soft bg-dash-bg"
          style={{
            left: "calc(50% + 40px)",
            transform: "translateX(-50%)",
          }}
        >
          <div className="flex items-center gap-[3px] px-2.5 py-[6px]">
            <span className="size-[5px] rounded-full bg-dash-border" />
            <span className="size-[5px] rounded-full bg-dash-border" />
            <span className="size-[5px] rounded-full bg-dash-border" />
          </div>
          <div className="mx-[6px] h-px bg-dash-border-soft" />
        </div>

        {/* Circular logo */}
        <div
          className="absolute left-3.5 top-[58px] flex size-8 items-center justify-center rounded-full"
          style={{ backgroundColor: logoBgColor }}
        >
          {addon.logoImageUrl ? (
            <img
              src={addon.logoImageUrl}
              alt={`${addon.name} logo`}
              className="size-5 rounded-full object-cover"
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = "none";
                const fallback = el.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = "";
              }}
            />
          ) : null}
          <span className="text-xs text-white" style={addon.logoImageUrl ? { display: "none" } : undefined}>
            {addon.logo}
          </span>
        </div>
      </div>

      {/* Text content */}
      <div className="flex-1 px-3.5 pt-3 pb-2">
        <p className="text-sm font-medium leading-5 tracking-[-0.02px] text-dash-text-strong">
          {addon.name}
        </p>
        <p className="mt-0.5 line-clamp-5 text-sm font-light leading-[22px] tracking-[-0.02px] text-dash-text-faded">
          {addon.description}
        </p>
      </div>

      {/* Footer action */}
      <div className="border-t-[0.5px] border-dash-border-soft px-3.5 py-2">
        {addon.installed ? (
          <Link
            to="/addons/$addonId"
            params={{ addonId: addon.id }}
            search={workspace ? { workspace } : {}}
            onClick={onManage}
            className="flex items-center gap-1 text-sm font-light tracking-[-0.02px] text-dash-text-body transition-colors hover:text-dash-text-strong"
          >
            Manage addon
            <ArrowRight className="size-3" />
          </Link>
        ) : (
          <Link
            to="/addons/$addonId"
            params={{ addonId: addon.id }}
            search={workspace ? { workspace } : {}}
            className="flex items-center gap-1 text-sm font-light tracking-[-0.02px] text-dash-text-body transition-colors hover:text-dash-text-strong"
          >
            View details
            <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
