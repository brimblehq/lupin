import { cn } from "@brimble/ui";
import { useMemo } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { Desktop } from "@phosphor-icons/react";
import { useTheme } from "../../hooks/use-theme";
import { Theme } from "../../types/enums";
import { useHaptics } from "@/hooks/use-haptics";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import { useFeatureFlag, useFeatureFlagStrict, FeatureFlags } from "@/lib/feature-flags";
import { isPostHogEnabled } from "@/lib/posthog";
import { mainNav, moreNav } from "./sidebar-nav";

const navItemBase =
  "flex items-center gap-2 rounded px-2 py-1.5 text-sm tracking-[-0.09px] transition-colors text-dash-text-faded dark:text-dash-text-strong";

export function Sidebar({ onProfileOpenChange }: { onProfileOpenChange: (open: boolean) => void }) {
  const { theme, mode, cycleTheme } = useTheme();
  const haptics = useHaptics();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });

  const domainsEnabled = useFeatureFlag(FeatureFlags.ENABLE_DOMAINS);
  const scalingEnabled = useFeatureFlag(FeatureFlags.ENABLE_AUTO_SCALING);
  const bucketsEnabled = useFeatureFlag(FeatureFlags.ENABLE_BUCKETS);
  const sandboxEnabled = useFeatureFlag(FeatureFlags.ENABLE_SANDBOX);

  const bucketsStrict = useFeatureFlagStrict(FeatureFlags.ENABLE_BUCKETS);
  const sandboxStrict = useFeatureFlagStrict(FeatureFlags.ENABLE_SANDBOX);

  const flagValues: Record<string, boolean> = useMemo(
    () => ({
      [FeatureFlags.ENABLE_DOMAINS]: domainsEnabled,
      [FeatureFlags.ENABLE_AUTO_SCALING]: scalingEnabled,
      [FeatureFlags.ENABLE_BUCKETS]: bucketsEnabled,
      [FeatureFlags.ENABLE_SANDBOX]: sandboxEnabled,
    }),
    [domainsEnabled, scalingEnabled, bucketsEnabled, sandboxEnabled],
  );

  const strictFlagValues: Record<string, boolean> = useMemo(
    () => ({
      [FeatureFlags.ENABLE_BUCKETS]: bucketsStrict,
      [FeatureFlags.ENABLE_SANDBOX]: sandboxStrict,
    }),
    [bucketsStrict, sandboxStrict],
  );

  const filteredMainNav = useMemo(
    () =>
      mainNav
        .filter((item) => {
          if (item.flag && !item.comingSoon) return flagValues[item.flag] !== false;
          return true;
        })
        .map((item) => {
          if (item.comingSoon && item.flag && isPostHogEnabled && strictFlagValues[item.flag]) {
            return { ...item, comingSoon: false };
          }
          return item;
        }),
    [flagValues, strictFlagValues],
  );

  return (
    <>
      <aside className="flex w-[185px] shrink-0 flex-col border-r border-dash-border-soft bg-dash-bg">
        <nav className="scrollbar-hidden flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-6">
          <div className="flex flex-col gap-1">
            {filteredMainNav.map((item) => {
              if (item.comingSoon) {
                return (
                  <span key={item.label} className={cn(navItemBase, "cursor-not-allowed opacity-40")}>
                    <img
                      src={item.icon}
                      alt=""
                      className="size-4 shrink-0 dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80"
                    />
                    {item.label}
                    <span className="ml-auto rounded-full bg-dash-bg-elevated px-1.5 py-px text-[10px] font-medium text-dash-text-extra-faded">
                      Soon
                    </span>
                  </span>
                );
              }
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <button
                  key={item.label}
                  data-tour-item={item.tourId}
                  onClick={() => {
                    haptics.selection();
                    void navigate({
                      to: withWorkspaceQuery({
                        pathname: item.href,
                        searchStr,
                      }) as any,
                    });
                  }}
                  className={cn(
                    navItemBase,
                    "w-full",
                    isActive ? "bg-dash-bg-elevated !text-dash-text-strong" : "hover:bg-dash-bg-elevated",
                  )}
                >
                  <img
                    src={item.icon}
                    alt=""
                    className="size-4 shrink-0 dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80"
                  />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <div className="px-2 py-1.5">
              <span className="text-xs font-medium tracking-[-0.09px] text-dash-text-extra-faded">MORE</span>
            </div>
            <div className="flex flex-col gap-1">
              {moreNav.map((item) => {
                if (item.external) {
                  return (
                    <a
                      key={item.label}
                      data-tour-item={item.tourId}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => haptics.selection()}
                      className={cn(navItemBase, "hover:bg-dash-bg-elevated")}
                    >
                      <img
                        src={item.icon}
                        alt=""
                        className="size-4 shrink-0 dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80"
                      />
                      {item.label}
                    </a>
                  );
                }
                const isActive = pathname.startsWith(item.href);
                return (
                  <button
                    key={item.label}
                    data-tour-item={item.tourId}
                    onClick={() => {
                      haptics.selection();
                      void navigate({
                        to: withWorkspaceQuery({
                          pathname: item.href,
                          searchStr,
                        }) as any,
                      });
                    }}
                    className={cn(
                      navItemBase,
                      "w-full",
                      isActive
                        ? "border border-dash-border-soft bg-dash-bg-elevated !text-dash-text-strong dark:border-transparent"
                        : "hover:bg-dash-bg-elevated",
                    )}
                  >
                    <img
                      src={item.icon}
                      alt=""
                      className="size-4 shrink-0 dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80"
                    />
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
            {mode === Theme.System ? (
              <Desktop className="size-4 shrink-0" />
            ) : theme === "dark" ? (
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
