import { useEffect, useState } from "react";
import { createFileRoute, getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { debounce, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import {
  parsePositivePageSearchValue,
  parseTextSearchValue,
} from "@/utils/workspace-route-search";
import { useServerFn } from "@tanstack/react-start";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { DomainList, type Domain } from "../../../../components/shared/domain-list";
import { TabHeader } from "../../../../components/shared/tab-header";
import { NetworkSettingsDrawer } from "@/components/project/network-settings-drawer";
import { RateLimitDrawer } from "@/components/project/rate-limit-drawer";
import { ChangePlanModal } from "@/components/shared/change-plan-modal";
import { ProjectDomainsPending } from "@/components/shared/route-pending";
import { useStepUpTwoFactor } from "@/hooks/use-step-up-two-factor";
import { withStepUp } from "@/lib/auth/two-factor-step-up";
import { NumberPagination } from "../../../../components/shared/pagination";
import { AddDomainModal, type DomainValidationError } from "../../../../components/shared/add-domain-modal";
import { Route as RootRoute } from "@/routes/__root";
import type { DomainRecord, PaginatedDomainsResponse } from "@/backend/domains";
import type { PaginatedProjectsResponse } from "@/backend/projects";
import {
  createProjectDomainServerFn,
  deleteDomainServerFn,
  listDomainProjectsServerFn,
  listDomainsPageServerFn,
  refreshDomainStatusServerFn,
  searchDomainSaleServerFn,
  transferDomainServerFn,
  updateDomainServerFn,
} from "@/server/domains/actions";
import { formatRelativeTime } from "@/utils/dashboard";
import { shouldShowProjectDomainsTab } from "@/utils/project-capabilities";
import { usePlanGate } from "@/hooks/use-plan-gate";
import { PlanUpgradePrompt } from "@/components/shared/plan-upgrade-prompt";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

const parentRoute = getRouteApi("/projects/$projectId");

export const Route = createFileRoute("/projects/$projectId/domains/")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  validateSearch: (search: Record<string, unknown>) => {
    const next: { page?: number; workspace?: string; q?: string } = {};

    const page = parsePositivePageSearchValue(search.page);
    if (page !== undefined) next.page = page;

    const rawWorkspace = search.workspace;
    if (typeof rawWorkspace === "string" && rawWorkspace.trim()) {
      next.workspace = rawWorkspace.trim();
    }

    const q = parseTextSearchValue(search.q);
    if (q !== undefined) next.q = q;

    return next;
  },
  loaderDeps: ({ search }) => ({
    page: search.page ?? 1,
    workspace: search.workspace,
    q: search.q,
  }),
  loader: async ({ params, deps, context }) => {
    const workspace = deps.workspace ?? (context as any).workspace;

    const [domains, projects] = await Promise.all([
      (
        listDomainsPageServerFn as unknown as (input: {
          data: { page?: number; workspace?: string; projectName?: string; q?: string };
        }) => Promise<PaginatedDomainsResponse>
      )({
        data: {
          page: deps.page,
          workspace,
          projectName: params.projectId,
          q: deps.q,
        },
      }),
      (listDomainProjectsServerFn as unknown as (input: { data: { workspace?: string } }) => Promise<PaginatedProjectsResponse>)({
        data: { workspace },
      }).catch(
        () =>
          ({
            items: [],
            currentPage: 1,
            totalPages: 1,
          }) as PaginatedProjectsResponse,
      ),
    ]);

    const data = {
      domains,
      projects: projects.items.map((item) => ({
        id: item.id,
        name: item.name,
        serviceType: item.serviceType,
      })),
    };
    return data;
  },
  component: ProjectDomainsPage,
  pendingComponent: ProjectDomainsPending,
});

function validateDomain(url: string): DomainValidationError | null {
  const domain = url.trim().toLowerCase();
  if (!domain) {
    return null;
  }

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+$/.test(domain)) {
    return {
      type: "invalid",
      message: "Please enter a valid domain name.",
    };
  }

  return null;
}

function mapDomainStatus(domain: DomainRecord): Domain["status"] {
  if (domain.active) {
    return "Active";
  }

  if (domain.isCustom === false) {
    return "Active";
  }

  return "Failed";
}

function mapDomainToRow(domain: DomainRecord, fallbackProjectName: string): Domain {
  const addedAtSource = domain.updatedAt || domain.createdAt;
  const addedAt = `Added ${formatRelativeTime(addedAtSource)}`;

  let addedBy = "By Brimble";
  if (domain.createdByName) {
    addedBy = `By ${domain.createdByName}`;
  }

  return {
    id: domain.id,
    projectId: domain.projectId,
    name: domain.name,
    project: domain.projectName || fallbackProjectName,
    status: mapDomainStatus(domain),
    addedAt,
    addedBy,
    active: domain.active,
    enabled: domain.enabled,
    isCustom: domain.isCustom,
    isExpired: domain.isExpired,
    purchased: domain.purchased,
    redirect: domain.redirect,
  };
}

function ProjectDomainsPage() {
  const { projectId } = Route.useParams();
  const router = useRouter();
  const [{ q: searchQuery, page }, setSearchParams] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      page: parseAsInteger.withDefault(1),
    },
    {
      history: "replace",
      clearOnDefault: true,
    },
  );
  const { project, workspace } = parentRoute.useLoaderData() as any;
  const { settingsSnapshot } = (RootRoute.useLoaderData() ?? {}) as any;
  const { customDomain, rateLimitEnabled, planKey } = usePlanGate();
  const { canWrite } = useWorkspaceRole();
  const { domains: initialDomainsResult, projects } = Route.useLoaderData();
  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [networkSettingsOpen, setNetworkSettingsOpen] = useState(false);
  const [rateLimitOpen, setRateLimitOpen] = useState(false);
  const [rateLimitUpgradeOpen, setRateLimitUpgradeOpen] = useState(false);
  const [domainsResult, setDomainsResult] = useState<PaginatedDomainsResponse>(initialDomainsResult);
  const [rows, setRows] = useState<Domain[]>(() => initialDomainsResult.items.map((item) => mapDomainToRow(item, project.name)));
  const [isDomainsLoading, setIsDomainsLoading] = useState(false);
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const navigate = useNavigate({ from: "/projects/$projectId/domains/" });
  const listDomainsPage = useServerFn(listDomainsPageServerFn as any) as (args: {
    data: { page?: number; workspace?: string; projectName?: string; q?: string };
  }) => Promise<PaginatedDomainsResponse>;
  const refreshDomainStatus = useServerFn(refreshDomainStatusServerFn as any) as (args: {
    data: { workspace?: string; domainName: string };
  }) => Promise<DomainRecord | null>;
  const createProjectDomain = useServerFn(createProjectDomainServerFn as any) as (args: {
    data: { workspace?: string; id?: string; projectId?: string; name: string };
  }) => Promise<DomainRecord>;
  const searchDomainSale = useServerFn(searchDomainSaleServerFn as any) as (args: {
    data: { name: string };
  }) => Promise<Array<{ domainName: string; purchasable: boolean; purchasePrice?: number }>>;
  const updateDomain = useServerFn(updateDomainServerFn as any) as (args: {
    data: {
      workspace?: string;
      id: string;
      name?: string;
      redirect?: { url?: string; status?: number } | null;
    };
  }) => Promise<DomainRecord>;
  const transferDomain = useServerFn(transferDomainServerFn as any) as (args: {
    data: { workspace?: string; domainId: string; projectId: string };
  }) => Promise<{ success: boolean }>;
  const deleteDomain = useServerFn(deleteDomainServerFn as any) as (args: {
    data: { workspace?: string; domainId: string; projectId?: string; twoFactorToken?: string };
  }) => Promise<{ success: boolean }>;
  const { requestStepUp } = useStepUpTwoFactor();

  useEffect(() => {
    setDomainsResult(initialDomainsResult);
    setRows(initialDomainsResult.items.map((item) => mapDomainToRow(item, project.name)));
  }, [initialDomainsResult, project.name]);

  useEffect(() => {
    let cancelled = false;
    const nextPage = page > 0 ? page : 1;
    const nextQuery = searchQuery.trim() || undefined;

    setIsDomainsLoading(true);
    setLoadingPage(nextPage);

    void listDomainsPage({
      data: {
        page: nextPage === 1 ? undefined : nextPage,
        workspace,
        projectName: projectId,
        q: nextQuery,
      },
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        setDomainsResult(result);
        setRows(result.items.map((item) => mapDomainToRow(item, project.name)));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        toast.error("Unable to load project domains");
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setIsDomainsLoading(false);
        setLoadingPage(null);
      });

    return () => {
      cancelled = true;
    };
  }, [listDomainsPage, page, project.name, projectId, searchQuery, workspace]);

  if (!shouldShowProjectDomainsTab(project)) {
    return (
      <div className="mx-auto flex max-w-[1000px] flex-col gap-4 py-8">
        <TabHeader title="Domains & Networking">Domains are not available for this project type.</TabHeader>
      </div>
    );
  }

  if (!customDomain) {
    return (
      <div className="mx-auto flex max-w-[1000px] flex-col gap-4 py-8">
        <TabHeader title="Domains & Networking">Connect your own domain to this project.</TabHeader>
        <PlanUpgradePrompt feature="Custom Domains" description="Upgrade to connect your own domain to this project." />
      </div>
    );
  }

  function handlePageChange(page: number) {
    if (page < 1 || page === domainsResult.currentPage || page > domainsResult.totalPages) {
      return;
    }

    void setSearchParams({ page });
  }

  async function handleRefreshDomain(domain: Domain) {
    try {
      const next = await refreshDomainStatus({
        data: {
          workspace,
          domainName: domain.name,
        },
      });

      if (!next) {
        return;
      }

      const nextRow = mapDomainToRow(next, project.name);
      setRows((prev) =>
        prev.map((item) => {
          if (item.name === domain.name) {
            return {
              ...item,
              ...nextRow,
            };
          }
          return item;
        }),
      );

      if (nextRow.status === "Active") {
        toast.success(`${domain.name} is now active`);
      } else {
        toast.success("Domain status refreshed");
      }
      invalidateActiveMatches(router);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh domain status");
    }
  }

  async function handleAddDomain(selectedProjectId: string, domainUrl: string) {
    const inlineError = validateDomain(domainUrl);
    if (inlineError) {
      toast.error(inlineError.message);
      return;
    }

    const normalized = domainUrl.trim().toLowerCase();
    const alreadyOwned = rows.some((row) => row.name.toLowerCase() === normalized);
    if (alreadyOwned) {
      toast.error("You already own this domain, try another one.");
      return;
    }

    try {
      const created = await createProjectDomain({
        data: {
          workspace,
          id: selectedProjectId,
          name: normalized,
        },
      });
      setRows((prev) => [mapDomainToRow(created, project.name), ...prev]);
      toast.success("Domain added successfully");
      invalidateActiveMatches(router);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add domain");
    }
  }

  async function validateAddDomain(domainUrl: string): Promise<DomainValidationError | null> {
    const inlineError = validateDomain(domainUrl);
    if (inlineError) {
      return inlineError;
    }

    const normalized = domainUrl.trim().toLowerCase();
    const alreadyOwned = rows.some((row) => row.name.toLowerCase() === normalized);
    if (alreadyOwned) {
      return {
        type: "already-owned",
        message: "You already own this domain, try another one.",
      };
    }

    try {
      const saleResults = await searchDomainSale({
        data: { name: normalized },
      });

      const exactPurchasableMatch = saleResults.some(
        (item) => (item.domainName || "").toLowerCase() === normalized && item.purchasable === true,
      );

      if (exactPurchasableMatch) {
        return {
          type: "not-found",
          message: "Oops! This domain looks unregistered and unavailable to add directly.",
        };
      }
    } catch {
      return {
        type: "generic",
        message: "Unable to verify this domain right now. Please try again.",
      };
    }

    return null;
  }

  async function handleConfigureDomain(input: {
    domain: Domain;
    name: string;
    projectId?: string;
    redirect: { url: string; status: number } | null;
  }) {
    if (!input.domain.id) {
      throw new Error("Domain id is missing");
    }

    const updated = await updateDomain({
      data: {
        workspace,
        id: input.domain.id,
        name: input.name,
        redirect: input.redirect,
      },
    });

    const currentProjectId = input.domain.projectId || "";
    const nextProjectId = input.projectId || "";

    if (nextProjectId && nextProjectId !== currentProjectId) {
      await transferDomain({
        data: {
          workspace,
          domainId: input.domain.id,
          projectId: nextProjectId,
        },
      });
    }

    if (nextProjectId && nextProjectId !== project.id) {
      setRows((prev) => prev.filter((row) => row.id !== input.domain.id));
      toast.success("Domain moved to another project");
      invalidateActiveMatches(router);
      return;
    }

    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== input.domain.id) {
          return row;
        }

        const next = mapDomainToRow(updated, project.name);
        next.projectId = nextProjectId || next.projectId || project.id;
        next.project = project.name;
        next.redirect = input.redirect;
        return next;
      }),
    );

    toast.success("Domain settings updated");
    invalidateActiveMatches(router);
  }

  async function handleDeleteDomain(domain: Domain) {
    if (!domain.id) {
      throw new Error("Domain id is missing");
    }

    await withStepUp(
      (twoFactorToken) =>
        deleteDomain({
          data: {
            workspace,
            domainId: domain.id!,
            projectId: domain.projectId || project.id,
            twoFactorToken,
          },
        }),
      requestStepUp,
    );

    setRows((prev) => prev.filter((row) => row.id !== domain.id));
    toast.success("Domain deleted successfully");
    invalidateActiveMatches(router);
  }

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 py-8">
      <TabHeader title="Domains & Networking">
        Manage all your domains on this project. You get a default ".brimble.app" domain with each project you deploy.
      </TabHeader>

      <DomainList
        domains={rows}
        basePath={`/projects/${projectId}/domains`}
        projects={projects}
        searchQuery={searchQuery}
        onSearchQueryChange={(nextSearchQuery) => {
          void setSearchParams(
            {
              q: nextSearchQuery,
              page: 1,
            },
            {
              limitUrlUpdates: debounce(300),
            },
          );
        }}
        searchLoading={isDomainsLoading}
        onRefreshDomain={handleRefreshDomain}
        onConfigureDomain={canWrite ? handleConfigureDomain : undefined}
        onDeleteDomain={canWrite ? handleDeleteDomain : undefined}
      />

      <div className="mt-2 flex justify-end">
        <NumberPagination
          currentPage={domainsResult.currentPage}
          totalPages={domainsResult.totalPages}
          onPageChange={handlePageChange}
          isLoading={isDomainsLoading}
          loadingPage={loadingPage}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-dash-text-extra-faded">Network</h3>
        <div className="flex items-center justify-between gap-4 rounded-[4px] border-[0.5px] border-dash-border px-4 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-5 text-dash-text-strong">Edge cache, headers & firewall</p>
            <p className="mt-0.5 text-sm font-light leading-[1.3] text-dash-text-faded">
              Configure caching, security response headers, and edge firewall rules for this project.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNetworkSettingsOpen(true)}
            className="h-9 shrink-0 rounded-[6px] border-[0.5px] border-dash-border px-4 text-sm font-medium text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
          >
            Configure
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-dash-text-extra-faded">Rate limiting</h3>
        <div className="flex items-center justify-between gap-4 rounded-[4px] border-[0.5px] border-dash-border px-4 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-5 text-dash-text-strong">Rate limit rules</p>
            <p className="mt-0.5 text-sm font-light leading-[1.3] text-dash-text-faded">
              Set request limits per time window, with optional method and path matching.
            </p>
          </div>
          {rateLimitEnabled ? (
            <button
              type="button"
              onClick={() => setRateLimitOpen(true)}
              className="h-9 shrink-0 rounded-[6px] border-[0.5px] border-dash-border px-4 text-sm font-medium text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
            >
              Configure
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setRateLimitUpgradeOpen(true)}
              className="h-9 shrink-0 rounded-[6px] border-[0.5px] border-dash-border px-4 text-sm font-medium text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
            >
              Upgrade to access
            </button>
          )}
        </div>
      </div>

      <NetworkSettingsDrawer
        open={networkSettingsOpen}
        onOpenChange={setNetworkSettingsOpen}
        projectId={project.id}
        workspace={workspace}
      />
      <RateLimitDrawer open={rateLimitOpen} onOpenChange={setRateLimitOpen} projectId={project.id} workspace={workspace} />
      <ChangePlanModal open={rateLimitUpgradeOpen} onOpenChange={setRateLimitUpgradeOpen} currentPlan={planKey} />

      {canWrite && (
        <AddDomainModal
          open={addDomainOpen}
          onOpenChange={setAddDomainOpen}
          projects={[{ id: project.id, name: project.name }]}
          defaultRegistrantEmail={settingsSnapshot?.profile?.email ?? ""}
          paymentCards={settingsSnapshot?.billing?.cards ?? []}
          onValidate={validateAddDomain}
          onContinue={(selectedProjectId, domainUrl) => {
            void handleAddDomain(selectedProjectId, domainUrl);
          }}
          onRegisterDomain={(domainUrl) => {
            let to = `/domains/buy?q=${encodeURIComponent(domainUrl)}`;
            if (project.id) {
              to = `${to}&project=${encodeURIComponent(project.id)}`;
            }
            navigate({ to: to as any });
          }}
        />
      )}
    </div>
  );
}
