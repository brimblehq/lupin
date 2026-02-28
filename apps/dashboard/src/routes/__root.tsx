import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { enforceRouteAuth } from "../lib/auth-guards";
import { getSettingsSidebarSnapshotServerFn } from "@/server/settings/actions";
import type { SettingsSidebarSnapshot } from "@/backend/settings";
import { getPaymentMethodsServerFn, getPaymentInvoicesServerFn } from "@/server/payments/actions";
import { getSubscriptionSpecsServerFn } from "@/server/pricing/actions";
import type { PaymentMethod } from "@/backend/payments";
import type { Pricing } from "@/types/pricing";
import { DEFAULT_PRICING } from "@/utils/default-pricing";
import { listWorkspacesServerFn } from "@/server/workspaces/actions";
import type { ApiListResponse } from "@/backend";
import type { Workspace } from "@/backend/workspaces";
import { listHomeProjectsServerFn } from "@/server/projects/actions";
import { getWorkspaceTeamMembersServerFn } from "@/server/teams/actions";
import { listTooltipMessagesServerFn } from "@/server/messages/actions";
import { listTagsServerFn } from "@/server/tags/actions";
import type { Project } from "@/backend/projects";
import type { TeamDetails } from "@/backend/teams";
import type { AppTooltipMessage } from "@/backend/messages";
import type { BackendTag } from "@/backend/tags";
import { useTagsStore } from "@/hooks/use-tags-store";

import appCss from "../styles.css?url";

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

export const Route = createRootRoute({
  staleTime: 60_000,
  preloadStaleTime: 60_000,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Brimble Dashboard" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
    ],
  }),
  beforeLoad: async ({ location }) => {
    await enforceRouteAuth(location.pathname, location.searchStr);
  },
  loader: async ({ location }) => {
    const isAuthRoute = /^\/(login|signup)$/.test(location.pathname);
    const knownPrefixes = /^\/(login|signup|projects|domains|addons|scaling|workspace)?(\/|$)/;
    const isCatchAll = location.pathname !== "/" && !knownPrefixes.test(location.pathname);

    if (isAuthRoute || isCatchAll) {
      return {
        settingsSnapshot: null as SettingsSidebarSnapshot | null,
        workspaces: { items: [] } as ApiListResponse<Workspace>,
        projectSwitcherProjects: null as ApiListResponse<Project> | null,
        onboardingProjects: null as ApiListResponse<Project> | null,
        workspaceTeamMembers: null as TeamDetails | null,
        tooltipMessages: null as AppTooltipMessage[] | null,
        tags: null as BackendTag[] | null,
        invoices: null as any,
        pricing: DEFAULT_PRICING as Pricing,
      };
    }

    const searchParams = new URLSearchParams(location.searchStr || "");
    const rawWorkspace = searchParams.get("workspace");
    let workspace: string | undefined;
    if (rawWorkspace && rawWorkspace.trim()) {
      workspace = rawWorkspace.trim();
    }

    const isProjectDetailsRoute =
      /^\/projects\/[^/]+(?:\/|$)/.test(location.pathname) &&
      !/^\/projects\/new(?:\/|$)/.test(location.pathname);

    const shouldPreloadWorkspaceTeamMembers = typeof window === "undefined";

    const [settingsSnapshot, workspaces, projectSwitcherProjects, onboardingProjects, workspaceTeamMembers, tooltipMessages, tags, paymentMethods, invoices, pricingResult] =
      await Promise.allSettled([
      (getSettingsSidebarSnapshotServerFn as unknown as (input: {
        data?: { workspace?: string };
      }) => Promise<SettingsSidebarSnapshot>)({
        data: { workspace },
      }),
      (listWorkspacesServerFn as unknown as () => Promise<ApiListResponse<Workspace>>)(),
      isProjectDetailsRoute
        ? (listHomeProjectsServerFn as unknown as (input: {
            data: { workspace?: string };
          }) => Promise<ApiListResponse<Project>>)({
            data: { workspace },
          })
        : Promise.resolve(null as ApiListResponse<Project> | null),
      (listHomeProjectsServerFn as unknown as (input: {
        data: { workspace?: string };
      }) => Promise<ApiListResponse<Project>>)({
        data: { workspace },
      }),
      shouldPreloadWorkspaceTeamMembers && workspace
        ? (getWorkspaceTeamMembersServerFn as unknown as (input: {
            data: { workspace: string };
          }) => Promise<TeamDetails>)({ data: { workspace } })
        : Promise.resolve(null as TeamDetails | null),
      (listTooltipMessagesServerFn as unknown as (input: {
        data?: { workspace?: string };
      }) => Promise<AppTooltipMessage[] | null>)({
        data: { workspace },
      }).catch(() => null as AppTooltipMessage[] | null),
      (listTagsServerFn as unknown as (input: {
        data: { workspace?: string };
      }) => Promise<BackendTag[]>)({
        data: { workspace },
      }),
      (getPaymentMethodsServerFn as unknown as () => Promise<PaymentMethod[]>)(),
      (getPaymentInvoicesServerFn as unknown as (input: { data?: { cursor?: string | null; per_page?: number } }) => Promise<any>)({
        data: { cursor: null, per_page: 10 },
      }),
      (getSubscriptionSpecsServerFn as unknown as () => Promise<Pricing>)(),
    ]);

    if (settingsSnapshot.status === "rejected") {
      console.error("[root loader] settings snapshot failed:", settingsSnapshot.reason);
    }
    if (workspaces.status === "rejected") {
      console.error("[root loader] workspaces failed:", workspaces.reason);
    }
    if (projectSwitcherProjects.status === "rejected") {
      console.error("[root loader] project switcher failed:", projectSwitcherProjects.reason);
    }
    if (onboardingProjects.status === "rejected") {
      console.error("[root loader] onboarding projects failed:", onboardingProjects.reason);
    }
    if (workspaceTeamMembers.status === "rejected") {
      console.error("[root loader] workspace team members failed:", workspaceTeamMembers.reason);
    }
    if (tooltipMessages.status === "rejected") {
      console.error("[root loader] tooltip messages failed:", tooltipMessages.reason);
    }
    if (tags.status === "rejected") {
      console.error("[root loader] tags failed:", tags.reason);
    }
    if (invoices.status === "rejected") {
      console.error("[root loader] invoices failed:", invoices.reason);
    }
    if (pricingResult.status === "rejected") {
      console.error("[root loader] pricing specs failed:", pricingResult.reason);
    }

    return {
      settingsSnapshot:
        settingsSnapshot.status === "fulfilled"
          ? settingsSnapshot.value
          : null as SettingsSidebarSnapshot | null,
      workspaces:
        workspaces.status === "fulfilled"
          ? workspaces.value
          : { items: [] } as ApiListResponse<Workspace>,
      projectSwitcherProjects:
        projectSwitcherProjects.status === "fulfilled"
          ? projectSwitcherProjects.value
          : null as ApiListResponse<Project> | null,
      onboardingProjects:
        onboardingProjects.status === "fulfilled"
          ? onboardingProjects.value
          : null as ApiListResponse<Project> | null,
      workspaceTeamMembers:
        workspaceTeamMembers.status === "fulfilled"
          ? workspaceTeamMembers.value
          : null as TeamDetails | null,
      tooltipMessages:
        tooltipMessages.status === "fulfilled"
          ? tooltipMessages.value
          : null as AppTooltipMessage[] | null,
      tags:
        tags.status === "fulfilled"
          ? tags.value
          : null as BackendTag[] | null,
      paymentMethods:
        paymentMethods.status === "fulfilled"
          ? paymentMethods.value
          : null as PaymentMethod[] | null,
      invoices:
        invoices.status === "fulfilled"
          ? invoices.value
          : null as any,
      pricing:
        pricingResult.status === "fulfilled"
          ? pricingResult.value
          : DEFAULT_PRICING as Pricing,
    };
  },
  component: RootComponent,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem('theme');var dark=t==='dark'||((!t)&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(dark){d.classList.add('dark')}else{d.classList.remove('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: chatwootBootstrapScript }} />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { settingsSnapshot, workspaces, projectSwitcherProjects, onboardingProjects, workspaceTeamMembers, tooltipMessages, tags, paymentMethods, invoices, pricing } =
    Route.useLoaderData();

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
    // Initial hydration can use root loader data.
    if (!hydrated) {
      if (tags) {
        hydrate(
          tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
          workspace,
        );
      } else {
        void fetchTags(workspace);
      }
      return;
    }

    // On workspace changes, fetch directly instead of trusting potentially stale root loader cache.
    if (storeWorkspace !== workspace) {
      void fetchTags(workspace);
    }
  }, [fetchTags, hydrate, hydrated, storeWorkspace, tags, workspace]);

  return (
    <DashboardLayout
      initialSettingsSnapshot={settingsSnapshot}
      initialWorkspaces={workspaces}
      initialProjectSwitcherProjects={projectSwitcherProjects}
      initialOnboardingProjects={onboardingProjects}
      initialWorkspaceTeamMembers={workspaceTeamMembers}
      initialTooltipMessages={tooltipMessages}
      initialPaymentMethods={paymentMethods}
      initialInvoices={invoices}
      initialPricing={pricing}
    >
      <Outlet />
    </DashboardLayout>
  );
}
