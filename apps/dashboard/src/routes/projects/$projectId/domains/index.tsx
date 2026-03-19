import { useEffect, useState } from "react";
import {
  createFileRoute,
  getRouteApi,
  useNavigate,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { hapticToast as toast } from "@/utils/haptic-toast";
import {
  DomainList,
  type Domain,
} from "../../../../components/shared/domain-list";
import { TabHeader } from "../../../../components/shared/tab-header";
import { NumberPagination } from "../../../../components/shared/pagination";
import {
  AddDomainModal,
  type DomainValidationError,
} from "../../../../components/shared/add-domain-modal";
import { Route as RootRoute } from "@/routes/__root";
import type { DomainRecord, PaginatedDomainsResponse } from "@/backend/domains";
import type { PaginatedProjectsResponse } from "@/backend/projects";
import {
  createProjectDomainServerFn,
  deleteDomainServerFn,
  listDomainProjectsServerFn,
  listDomainsPageServerFn,
  refreshDomainStatusServerFn,
  transferDomainServerFn,
  updateDomainServerFn,
} from "@/server/domains/actions";
import { formatRelativeTime } from "@/utils/dashboard";
import { shouldShowProjectDomainsTab } from "@/utils/project-capabilities";
import { usePlanGate } from "@/hooks/use-plan-gate";
import { PlanUpgradePrompt } from "@/components/shared/plan-upgrade-prompt";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";

const parentRoute = getRouteApi("/projects/$projectId");

export const Route = createFileRoute("/projects/$projectId/domains/")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  validateSearch: (search: Record<string, unknown>) => {
    const next: { page?: number; workspace?: string } = {};

    const rawPage = search.page;
    if (
      typeof rawPage === "number" &&
      Number.isFinite(rawPage) &&
      rawPage > 0
    ) {
      next.page = Math.floor(rawPage);
    } else if (typeof rawPage === "string") {
      const parsed = Number(rawPage);
      if (Number.isFinite(parsed) && parsed > 0) {
        next.page = Math.floor(parsed);
      }
    }

    const rawWorkspace = search.workspace;
    if (typeof rawWorkspace === "string" && rawWorkspace.trim()) {
      next.workspace = rawWorkspace.trim();
    }

    return next;
  },
  loader: async ({ context, location }) => {
    const project = (context as any).project;
    const workspace = (context as any).workspace;

    const searchParams = new URLSearchParams(location.searchStr || "");
    const rawPage = searchParams.get("page");

    let page = 1;
    if (rawPage) {
      const parsed = Number(rawPage);
      if (Number.isFinite(parsed) && parsed > 0) {
        page = Math.floor(parsed);
      }
    }

    const [domains, projects] = await Promise.all([
      (
        listDomainsPageServerFn as unknown as (input: {
          data: { page?: number; workspace?: string; projectName?: string };
        }) => Promise<PaginatedDomainsResponse>
      )({
        data: {
          page,
          workspace,
          projectName: project.name,
        },
      }),
      (
        listDomainProjectsServerFn as unknown as (input: {
          data: { workspace?: string };
        }) => Promise<PaginatedProjectsResponse>
      )({
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

function mapDomainToRow(
  domain: DomainRecord,
  fallbackProjectName: string,
): Domain {
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
  const search = Route.useSearch();
  const { project, workspace } = parentRoute.useLoaderData() as any;
  const { settingsSnapshot } = (RootRoute.useLoaderData() ?? {}) as any;
  const { customDomain } = usePlanGate();
  const { canWrite } = useWorkspaceRole();
  if (!shouldShowProjectDomainsTab(project)) {
    return (
      <div className="mx-auto flex max-w-[1000px] flex-col gap-4 py-8">
        <TabHeader title="Project domains">
          Domains are not available for this project type.
        </TabHeader>
      </div>
    );
  }

  if (!customDomain) {
    return (
      <div className="mx-auto flex max-w-[1000px] flex-col gap-4 py-8">
        <TabHeader title="Project domains">
          Connect your own domain to this project.
        </TabHeader>
        <PlanUpgradePrompt
          feature="Custom Domains"
          description="Upgrade to connect your own domain to this project."
        />
      </div>
    );
  }

  const { domains: domainsResult, projects } = Route.useLoaderData();
  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [rows, setRows] = useState<Domain[]>(() =>
    domainsResult.items.map((item) => mapDomainToRow(item, project.name)),
  );
  const navigate = useNavigate({ from: "/projects/$projectId/domains/" });
  const refreshDomainStatus = useServerFn(
    refreshDomainStatusServerFn as any,
  ) as (args: {
    data: { workspace?: string; domainName: string };
  }) => Promise<DomainRecord | null>;
  const createProjectDomain = useServerFn(
    createProjectDomainServerFn as any,
  ) as (args: {
    data: { workspace?: string; projectId?: string; name: string };
  }) => Promise<DomainRecord>;
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
    data: { workspace?: string; domainId: string; projectId?: string };
  }) => Promise<{ success: boolean }>;

  useEffect(() => {
    setRows(
      domainsResult.items.map((item) => mapDomainToRow(item, project.name)),
    );
  }, [domainsResult.items, project.name]);

  function handlePageChange(page: number) {
    if (
      page < 1 ||
      page === domainsResult.currentPage ||
      page > domainsResult.totalPages
    ) {
      return;
    }

    navigate({
      to: "/projects/$projectId/domains/",
      params: { projectId },
      search: {
        ...(search || {}),
        page: page === 1 ? undefined : page,
      },
    });
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
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to refresh domain status",
      );
    }
  }

  async function handleAddDomain(selectedProjectId: string, domainUrl: string) {
    const inlineError = validateDomain(domainUrl);
    if (inlineError) {
      toast.error(inlineError.message);
      return;
    }

    const normalized = domainUrl.trim().toLowerCase();
    const alreadyOwned = rows.some(
      (row) => row.name.toLowerCase() === normalized,
    );
    if (alreadyOwned) {
      toast.error("You already own this domain, try another one.");
      return;
    }

    try {
      const created = await createProjectDomain({
        data: {
          workspace,
          projectId: selectedProjectId,
          name: normalized,
        },
      });
      setRows((prev) => [mapDomainToRow(created, project.name), ...prev]);
      toast.success("Domain added successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add domain",
      );
    }
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
  }

  async function handleDeleteDomain(domain: Domain) {
    if (!domain.id) {
      throw new Error("Domain id is missing");
    }

    await deleteDomain({
      data: {
        workspace,
        domainId: domain.id,
        projectId: domain.projectId || project.id,
      },
    });

    setRows((prev) => prev.filter((row) => row.id !== domain.id));
    toast.success("Domain deleted successfully");
  }

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 py-8">
      <TabHeader title="Project domains">
        Manage all your domains on this project. You get a default
        ".brimble.app" domain with each project you deploy.
      </TabHeader>

      <DomainList
        domains={rows}
        basePath={`/projects/${projectId}/domains`}
        projects={projects}
        onAddDomain={canWrite ? () => setAddDomainOpen(true) : undefined}
        onRefreshDomain={handleRefreshDomain}
        onConfigureDomain={canWrite ? handleConfigureDomain : undefined}
        onDeleteDomain={canWrite ? handleDeleteDomain : undefined}
      />

      <div className="mt-2 flex justify-end">
        <NumberPagination
          currentPage={domainsResult.currentPage}
          totalPages={domainsResult.totalPages}
          onPageChange={handlePageChange}
        />
      </div>

      {canWrite && (
        <AddDomainModal
          open={addDomainOpen}
          onOpenChange={setAddDomainOpen}
          projects={[{ id: project.id, name: project.name }]}
          defaultRegistrantEmail={settingsSnapshot?.profile?.email ?? ""}
          paymentCards={settingsSnapshot?.billing?.cards ?? []}
          onValidate={validateDomain}
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
