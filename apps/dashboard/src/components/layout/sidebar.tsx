import { cn } from "@brimble/ui";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/use-theme";
import { Theme } from "../../types/enums";
import { useHaptics } from "@/hooks/use-haptics";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";

export const mainNav = [
  { label: "Home", icon: "/icons/home.svg", href: "/" },
  { label: "Projects", icon: "/icons/project.svg", href: "/projects" },
  { label: "Domains", icon: "/icons/domains.svg", href: "/domains" },
  { label: "Scaling", icon: "/icons/scaling.svg", href: "/scaling" },
  { label: "Buckets", icon: "/icons/bucket.svg", href: "#", comingSoon: true },
  { label: "Sandboxes", icon: "/icons/sandbox.svg", href: "#", comingSoon: true },
];

export const moreNav = [
  { label: "Documentation", icon: "/icons/documentation.svg", href: "https://docs.brimble.io", external: true },
  { label: "Discover", icon: "/icons/discover.svg", href: "/addons" },
];

const navItemBase =
  "flex items-center gap-2 rounded px-2 py-1.5 text-sm tracking-[-0.09px] transition-colors text-dash-text-faded dark:text-dash-text-strong";

export function Sidebar({
  profileOpen,
  onProfileOpenChange,
}: {
  profileOpen: boolean;
  onProfileOpenChange: (open: boolean) => void;
}) {
  const { theme, mode, cycleTheme } = useTheme();
  const haptics = useHaptics();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  return (
    <>
      <aside className="flex w-[185px] shrink-0 flex-col border-r border-dash-border-soft bg-dash-bg">
        <nav className="scrollbar-hidden flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-6">
          <div className="flex flex-col gap-1">
            {mainNav.map((item) => {
              if (item.comingSoon) {
                return (
                  <span
                    key={item.label}
                    className={cn(
                      navItemBase,
                      "cursor-default opacity-40"
                    )}
                  >
                    <img src={item.icon} alt="" className="size-4 shrink-0 dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80" />
                    {item.label}
                    <span className="ml-auto rounded-full bg-dash-bg-elevated px-1.5 py-px text-[10px] font-medium text-dash-text-extra-faded">
                      Soon
                    </span>
                  </span>
                );
              }
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    haptics.selection();
                    void navigate({
                      to: withWorkspaceQuery({ pathname: item.href, searchStr }) as any,
                    });
                  }}
                  className={cn(
                    navItemBase,
                    "w-full",
                    isActive
                      ? "border border-dash-border-soft bg-dash-bg-elevated !text-dash-text-strong dark:border-transparent"
                      : "hover:bg-dash-bg-elevated"
                  )}
                >
                  <img src={item.icon} alt="" className="size-4 shrink-0 dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <div className="px-2 py-1.5">
              <span className="text-xs font-medium tracking-[-0.09px] text-dash-text-extra-faded">
                MORE
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {moreNav.map((item) => {
                if (item.external) {
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => haptics.selection()}
                      className={cn(navItemBase, "hover:bg-dash-bg-elevated")}
                    >
                      <img src={item.icon} alt="" className="size-4 shrink-0 dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80" />
                      {item.label}
                    </a>
                  );
                }
                const isActive = pathname.startsWith(item.href);
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      haptics.selection();
                      void navigate({
                        to: withWorkspaceQuery({ pathname: item.href, searchStr }) as any,
                      });
                    }}
                    className={cn(
                      navItemBase,
                      "w-full",
                      isActive
                        ? "border border-dash-border-soft bg-dash-bg-elevated !text-dash-text-strong dark:border-transparent"
                        : "hover:bg-dash-bg-elevated"
                    )}
                  >
                    <img src={item.icon} alt="" className="size-4 shrink-0 dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="flex shrink-0 flex-col gap-1 px-3 pb-4">
          <hr className="mb-4 border-dash-border-soft" />
          <button
            onClick={() => {
              haptics.selection();
              onProfileOpenChange(true);
            }}
            className={cn(navItemBase, "w-full hover:bg-dash-bg-elevated")}
          >
            <img
              src="/icons/settings.svg"
              alt=""
              className="size-4 shrink-0 dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80"
            />
            Settings
          </button>
          <button
            onClick={() => {
              haptics.selection();
              cycleTheme();
            }}
            className={cn(navItemBase, "hover:bg-dash-bg-elevated")}
          >
            {theme === "dark" ? (
              <Sun className="size-4 shrink-0" />
            ) : (
              <Moon className="size-4 shrink-0" />
            )}
            {mode === Theme.System ? "System mode" : theme === Theme.Dark ? "Dark mode" : "Light mode"}
          </button>
        </div>
      </aside>

    </>
  );
}
