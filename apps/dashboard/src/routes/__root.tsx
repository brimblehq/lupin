import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { capturePostHog, initPostHog, isPostHogEnabled } from "@/lib/posthog";
import { useTheme } from "../hooks/use-theme";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { enforceRouteAuth } from "../lib/auth-guards";
import { getSettingsSidebarSnapshotServerFn } from "@/server/settings/actions";
import type { SettingsSidebarSnapshot } from "@/backend/settings";
import { getSubscriptionSpecsServerFn } from "@/server/pricing/actions";
import type { Pricing } from "@/types/pricing";
import { DEFAULT_PRICING } from "@/utils/default-pricing";
import { listWorkspacesServerFn } from "@/server/workspaces/actions";
import type { ApiListResponse } from "@/backend";
import type { Workspace } from "@/backend/workspaces";
import { listHomeProjectsServerFn } from "@/server/projects/actions";
import { listTagsServerFn } from "@/server/tags/actions";
import type { Project } from "@/backend/projects";
import type { BackendTag } from "@/backend/tags";
import { useTagsStore } from "@/hooks/use-tags-store";
import { getSubscriptionStatsServerFn } from "@/server/payments/actions";
import type { SubscriptionStats } from "@/backend/payments";
import { getUserOverviewServerFn } from "@/server/overview/actions";
import type { UserOverview } from "@/backend/user-overview";

import appCss from "../styles.css?url";
import marfaLatinWoff2 from "../assets/fonts/ABCMarfaVariableVF-latin.woff2?url";

const GA_MEASUREMENT_ID = "G-T6EZL8YJW7";

const chatwootBootstrapScript = `(function(d,t){
  try {
    if (window.__brimbleChatwootBooted) return;
    window.__brimbleChatwootBooted = true;
    var BASE_URL="https://app.chatwoot.com";
    var existing=d.getElementById("brimble-chatwoot-sdk");
    if (existing) return;
    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
    g.id="brimble-chatwoot-sdk";
    g.src=BASE_URL+"/packs/js/sdk.js";
    g.defer=true;
    g.async=true;
    s.parentNode.insertBefore(g,s);
    g.onload=function(){
      if (!window.chatwootSDK || !window.chatwootSDK.run) return;
      window.chatwootSDK.run({
        websiteToken:"mn5KENDDuZxcSc6bxFE5S3A9",
        baseUrl:BASE_URL
      });
    };
  } catch (e) {}
})(document,"script");`;

type RootLoaderData = {
  workspace?: string;
  settingsSnapshot?: SettingsSidebarSnapshot;
  workspaces: ApiListResponse<Workspace>;
  projectSwitcherProjects?: ApiListResponse<Project>;
  onboardingProjects?: ApiListResponse<Project>;
  tags?: BackendTag[];
  subscriptionStats?: SubscriptionStats;
  userOverview?: UserOverview;
  pricing: Pricing;
};

const DEFAULT_ROOT_LOADER_DATA: RootLoaderData = {
  workspaces: { items: [] },
  pricing: DEFAULT_PRICING,
};

function createRootLoaderData(overrides: Partial<RootLoaderData> = {}): RootLoaderData {
  return {
    ...DEFAULT_ROOT_LOADER_DATA,
    ...overrides,
  };
}

export const Route = createRootRoute({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  loaderDeps: ({ search }) => ({
    workspace: (search as Record<string, unknown>).workspace ?? undefined,
  }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, maximum-scale=1",
      },
      { title: "Brimble Dashboard" },
    ],
    links: [
      {
        rel: "preload",
        href: marfaLatinWoff2,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        type: "image/png",
        href: "https://res.cloudinary.com/dgqfojhx4/image/upload/v1772279144/dashboard-assets/Icon_np5cdu.png",
      },
    ],
    scripts: [
      {
        src: "https://scripts.brimble.io/analytics/brimble.js",
        defer: true,
        "data-website-id": "48de2c0e-55ae-4397-8362-6d913a5c1e4e",
      },
    ],
  }),
  beforeLoad: async ({ location }) => {
    await enforceRouteAuth(location.pathname, location.searchStr);
  },
  loader: (async ({ location, deps }: any) => {
    const isAuthRoute = /^\/(login|signup|2fa)$/.test(location.pathname);
    const knownPrefixes = /^\/(login|signup|2fa|projects|domains|addons|scaling|workspace|teams)?(\/|$)/;
    const isCatchAll = location.pathname !== "/" && !knownPrefixes.test(location.pathname);

    if (isAuthRoute || isCatchAll) {
      return createRootLoaderData();
    }

    try {
      const rawWorkspace = deps.workspace;
      let workspace: string | undefined;
      if (rawWorkspace && typeof rawWorkspace === "string" && rawWorkspace.trim()) {
        workspace = rawWorkspace.trim();
      }

      const workspacesRequest = (listWorkspacesServerFn as unknown as () => Promise<ApiListResponse<Workspace>>)();

      const userOverviewRequest = (async () => {
        let teamId: string | undefined;

        if (workspace) {
          try {
            const availableWorkspaces = await workspacesRequest;
            const matchedWorkspace = availableWorkspaces.items.find((item) => item.slug === workspace);
            teamId = matchedWorkspace?.id || undefined;
          } catch {
            teamId = undefined;
          }
        }

        return (getUserOverviewServerFn as unknown as (input: { data?: { teamId?: string } }) => Promise<UserOverview>)({
          data: teamId ? { teamId } : {},
        });
      })();

      const [settingsSnapshot, workspaces, onboardingProjects, pricingResult, tags, subscriptionStats, userOverview] = await Promise.allSettled([
        (getSettingsSidebarSnapshotServerFn as unknown as (input: { data?: { workspace?: string } }) => Promise<SettingsSidebarSnapshot>)({
          data: { workspace },
        }),
        workspacesRequest,
        (listHomeProjectsServerFn as unknown as (input: { data: { workspace?: string } }) => Promise<ApiListResponse<Project>>)({
          data: { workspace },
        }),
        (getSubscriptionSpecsServerFn as unknown as () => Promise<Pricing>)(),
        (listTagsServerFn as unknown as (input: { data: { workspace?: string } }) => Promise<BackendTag[]>)({
          data: { workspace },
        }),
        (getSubscriptionStatsServerFn as unknown as (input: { data?: { workspace?: string } }) => Promise<SubscriptionStats>)({
          data: { workspace },
        }),
        userOverviewRequest,
      ]);

      return createRootLoaderData({
        workspace,
        settingsSnapshot: settingsSnapshot.status === "fulfilled" ? settingsSnapshot.value : undefined,
        workspaces: workspaces.status === "fulfilled" ? workspaces.value : DEFAULT_ROOT_LOADER_DATA.workspaces,
        projectSwitcherProjects: onboardingProjects.status === "fulfilled" ? (onboardingProjects.value as any) : undefined,
        onboardingProjects: onboardingProjects.status === "fulfilled" ? onboardingProjects.value : undefined,
        tags: tags.status === "fulfilled" ? tags.value : undefined,
        subscriptionStats: subscriptionStats.status === "fulfilled" ? subscriptionStats.value : undefined,
        userOverview: userOverview.status === "fulfilled" ? userOverview.value : undefined,
        pricing: pricingResult.status === "fulfilled" ? pricingResult.value : DEFAULT_PRICING,
      });
    } catch (err) {
      console.error("[root loader] unexpected error:", err);
      return createRootLoaderData();
    }
  }) as any,
  component: RootComponent,
  shellComponent: RootDocument,
});

const AUTH_ROUTE_PATTERN = /^\/(login|signup|2fa|passkey-recovery|reset-password)(\/|$)/;

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAuthRoute = AUTH_ROUTE_PATTERN.test(pathname);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {!isAuthRoute && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
            `,
              }}
            />
          </>
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem('theme');var legacy=localStorage.getItem('brimble-theme');if(t!=='light'&&t!=='dark'&&t!=='system'){t=(legacy==='light'||legacy==='dark')?legacy:null}var sys=(t==='system'||(!t));var dark=t==='dark'||(sys&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(dark){d.classList.add('dark')}else{d.classList.remove('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        {children}
        {!isAuthRoute && <script dangerouslySetInnerHTML={{ __html: chatwootBootstrapScript }} />}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useTheme();

  useEffect(() => {
    import("@/lib/client-geo").then((m) => m.getClientGeo());
  }, []);

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const {
    workspace: loaderWorkspace,
    settingsSnapshot,
    workspaces,
    projectSwitcherProjects,
    onboardingProjects,
    tags,
    subscriptionStats,
    userOverview,
    pricing,
  } = Route.useLoaderData() ?? ({} as any);

  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const workspace = (() => {
    const params = new URLSearchParams(searchStr || "");
    return params.get("workspace")?.trim() || null;
  })();

  const hydrate = useTagsStore((s) => s.hydrate);
  const hydrated = useTagsStore((s) => s._hydrated);
  const storeWorkspace = useTagsStore((s) => s._workspace);
  const fetchTags = useTagsStore((s) => s.fetchTags);

  useEffect(() => {
    if (!isPostHogEnabled) return;
    void initPostHog();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const gtagFn = (window as any).gtag as ((...args: Array<string | number | Date | Record<string, unknown>>) => void) | undefined;
    if (typeof gtagFn !== "function") {
      return;
    }

    gtagFn("event", "page_view", {
      page_path: pathname,
      page_title: document.title,
    });
  }, [pathname]);

  useEffect(() => {
    if (!isPostHogEnabled) return;
    if (typeof window === "undefined") return;
    capturePostHog("$pageview", { $current_url: window.location.href });
  }, [pathname]);

  useEffect(() => {
    // Initial hydration can use root loader data.
    if (!hydrated) {
      if (tags) {
        hydrate(
          tags.map((t: BackendTag) => ({
            id: t.id,
            name: t.name,
            color: t.color,
          })),
          workspace,
        );
      } else {
        void fetchTags(workspace);
      }
      return;
    }

    if (storeWorkspace !== workspace) {
      void fetchTags(workspace);
    }
  }, [fetchTags, hydrate, hydrated, storeWorkspace, tags, workspace]);

  return (
    <DashboardLayout
      initialWorkspaceSlug={loaderWorkspace}
      initialSettingsSnapshot={settingsSnapshot}
      initialWorkspaces={workspaces}
      initialProjectSwitcherProjects={projectSwitcherProjects}
      initialOnboardingProjects={onboardingProjects}
      initialSubscriptionStats={subscriptionStats ?? null}
      initialUserOverview={userOverview ?? null}
      initialPricing={pricing}
    >
      <Outlet />
    </DashboardLayout>
  );
}
