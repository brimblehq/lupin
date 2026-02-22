import { useState } from "react";
import { cn } from "@brimble/ui";
import { Link, useRouterState } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/use-theme";
import { UserProfileDrawer } from "../shared/user-profile-drawer";

const mainNav = [
  { label: "Home", icon: "/icons/home.svg", href: "/" },
  { label: "Projects", icon: "/icons/project.svg", href: "/projects" },
  { label: "Domains", icon: "/icons/domains.svg", href: "/domains" },
  { label: "Scaling", icon: "/icons/scaling.svg", href: "/scaling" },
];

const moreNav = [
  { label: "Documentation", icon: "/icons/documentation.svg", href: "/docs" },
  { label: "Discover", icon: "/icons/discover.svg", href: "/discover" },
  {
    label: "Addons",
    icon: "/icons/integrations.svg",
    href: "/addons",
  },
];

const navItemBase =
  "flex items-center gap-2 rounded px-2 py-1.5 text-sm tracking-[-0.09px] transition-colors text-dash-text-faded dark:text-dash-text-strong";

export function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <aside className="flex w-[185px] shrink-0 flex-col border-r border-dash-border-soft bg-dash-bg">
        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-6">
          <div className="flex flex-col gap-1">
            {mainNav.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={cn(
                    navItemBase,
                    isActive
                      ? "border border-dash-border-soft bg-dash-bg-elevated !text-dash-text-strong"
                      : "hover:bg-dash-bg-elevated"
                  )}
                >
                  <img src={item.icon} alt="" className="size-4 shrink-0 dark:invert dark:opacity-70" />
                  {item.label}
                </Link>
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
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.label}
                    to={item.href}
                    className={cn(
                      navItemBase,
                      isActive
                        ? "border border-dash-border-soft bg-dash-bg-elevated !text-dash-text-strong"
                        : "hover:bg-dash-bg-elevated"
                    )}
                  >
                    <img src={item.icon} alt="" className="size-4 shrink-0 dark:invert dark:opacity-70" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="flex shrink-0 flex-col gap-1 px-3 pb-4">
          <hr className="mb-4 border-dash-border-soft" />
          <button
            onClick={() => setProfileOpen(true)}
            className={cn(navItemBase, "w-full hover:bg-dash-bg-elevated")}
          >
            <img
              src="/icons/settings.svg"
              alt=""
              className="size-4 shrink-0 dark:invert dark:opacity-70"
            />
            Settings
          </button>
          <button
            onClick={() => setProfileOpen(true)}
            className={cn(navItemBase, "w-full hover:bg-dash-bg-elevated")}
          >
            <div
              className="size-4 shrink-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 62% 30%, #b8cffc, #94b6f8 25%, #6f9cf3 50%, #4b82ee 75%, #2769e9)",
              }}
            />
            <span className="truncate text-sm tracking-[-0.02px]">
              Kemdirim Akuju...
            </span>
          </button>
          <button
            onClick={toggleTheme}
            className={cn(navItemBase, "hover:bg-dash-bg-elevated")}
          >
            {theme === "dark" ? (
              <Sun className="size-4 shrink-0" />
            ) : (
              <Moon className="size-4 shrink-0" />
            )}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </aside>

      <UserProfileDrawer open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
