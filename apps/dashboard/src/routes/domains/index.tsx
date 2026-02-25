import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "../../components/shared/page-header";
import { DomainList, type Domain } from "../../components/shared/domain-list";
import { NumberPagination } from "../../components/shared/pagination";
import {
  AddDomainModal,
  type DomainValidationError,
} from "../../components/shared/add-domain-modal";
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
import { parsePositivePageSearchValue, parseWorkspaceSearchValue, workspacePageLoaderDeps } from "@/utils/workspace-route-search";

export const Route = createFileRoute("/domains/")({
  staleTime: 30_000,
  preloadStaleTime: 30_000,
  validateSearch: (search: Record<string, unknown>) => {
    const next: { page?: number; workspace?: string } = {};
    const page = parsePositivePageSearchValue(search.page);
    const workspace = parseWorkspaceSearchValue(search.workspace);
    if (page) {
      next.page = page;
    }
    if (workspace) {
      next.workspace = workspace;
    }
    return next;
  },
  loaderDeps: ({ search }) => workspacePageLoaderDeps(search),
  loader: async ({ deps }) => {
    const page = deps.page;
    const workspace = deps.workspace;

    const [domainsResult, projectsResult] = await Promise.all([
      (listDomainsPageServerFn as unknown as (input: {
        data: { page?: number; workspace?: string };
      }) => Promise<PaginatedDomainsResponse>)({
        data: { page, workspace },
      }),
      (listDomainProjectsServerFn as unknown as (input: {
        data: { workspace?: string };
      }) => Promise<PaginatedProjectsResponse>)({
        data: { workspace },
      }).catch(() => ({
        items: [],
        currentPage: 1,
        totalPages: 1,
      } as PaginatedProjectsResponse)),
    ]);

    return {
      workspace,
      domains: domainsResult,
      projects: projectsResult.items.map((project) => ({
        id: project.id,
        name: project.name,
        serviceType: project.serviceType,
      })),
    };
  },
  component: DomainsPage,
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

function mapDomainToRow(domain: DomainRecord): Domain {
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
    project: domain.projectName,
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

function DomainsPage() {
  const search = Route.useSearch();
  const { domains: domainsResult, projects, workspace } = Route.useLoaderData();
  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [rows, setRows] = useState<Domain[]>(() =>
    domainsResult.items.map((item) => mapDomainToRow(item)),
  );
  const navigate = useNavigate({ from: "/domains/" });
  const refreshDomainStatus = useServerFn(refreshDomainStatusServerFn as any) as (args: {
    data: { workspace?: string; domainName: string };
  }) => Promise<DomainRecord | null>;
  const createProjectDomain = useServerFn(createProjectDomainServerFn as any) as (args: {
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
    setRows(domainsResult.items.map((item) => mapDomainToRow(item)));
  }, [domainsResult.items]);

  function handlePageChange(page: number) {
    if (page < 1 || page === domainsResult.currentPage || page > domainsResult.totalPages) {
      return;
    }

    navigate({
      to: "/domains/",
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

      const nextRow = mapDomainToRow(next);
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
      toast.error(error instanceof Error ? error.message : "Failed to refresh domain status");
    }
  }

  async function handleAddDomain(projectId: string, domainUrl: string) {
    const inlineError = validateDomain(domainUrl);
    if (inlineError) {
      toast.error(inlineError.message);
      return;
    }

    const normalized = domainUrl.trim().toLowerCase();
    const alreadyOwned = rows.some((domain) => domain.name.toLowerCase() === normalized);
    if (alreadyOwned) {
      toast.error("You already own this domain, try another one.");
      return;
    }

    try {
      const created = await createProjectDomain({
        data: {
          workspace,
          projectId,
          name: normalized,
        },
      });

      const createdRow = mapDomainToRow(created);
      setRows((prev) => [createdRow, ...prev]);
      toast.success("Domain added successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add domain");
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

    const linkedProject = projects.find((project) => project.id === nextProjectId);
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== input.domain.id) {
          return row;
        }

        const next = mapDomainToRow(updated);
        next.projectId = nextProjectId || next.projectId;
        if (linkedProject) {
          next.project = linkedProject.name;
        } else if (!nextProjectId) {
          next.project = undefined;
        }
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
        projectId: domain.projectId,
      },
    });

    setRows((prev) => prev.filter((row) => row.id !== domain.id));
    toast.success("Domain deleted successfully");
  }

  return (
    <div className="max-w-[1000px]">
      <PageHeader title="Domains" image="/images/lamp.svg">
        Manage your domains and DNS records in one place. Connect projects, configure records,
        and keep your routing organized across environments.
      </PageHeader>

      <DomainList
        domains={rows}
        basePath="/domains"
        projects={projects}
        onAddDomain={() => setAddDomainOpen(true)}
        onRefreshDomain={handleRefreshDomain}
        onConfigureDomain={handleConfigureDomain}
        onDeleteDomain={handleDeleteDomain}
      />

      <div className="mt-6 flex justify-end">
        <NumberPagination
          currentPage={domainsResult.currentPage}
          totalPages={domainsResult.totalPages}
          onPageChange={handlePageChange}
        />
      </div>

      <AddDomainModal
        open={addDomainOpen}
        onOpenChange={setAddDomainOpen}
        projects={projects}
        onValidate={validateDomain}
        onContinue={(projectId, domainUrl) => {
          void handleAddDomain(projectId, domainUrl);
        }}
        onRegisterDomain={() => {
          setAddDomainOpen(false);
          navigate({
            to: "/domains/buy",
            search: workspace ? { workspace } : {},
          });
        }}
      />
    </div>
  );
}
