import { useState, useRef, useEffect, useMemo } from "react";
import { MoreVertical, RefreshCw, AlertCircle, LifeBuoy, Pencil, ArrowRightLeft, Settings } from "lucide-react";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { FilterDropdown, type FilterOption } from "./filter-dropdown";
import { SearchFilterBar } from "./search-filter-bar";
import { Spinner } from "./spinner";
import { SimpleTooltip } from "./tooltip";
import { CheckCircle, Warning } from "@phosphor-icons/react";
import { FolderTrashIcon } from "./folder-trash-icon";
import { Modal, ModalHeader, ModalFooter, ModalCancelButton, ModalContinueButton } from "./modal";
import { WarningModal } from "./warning-modal";
import { Dropdown } from "./dropdown";
import { dashInputClassName } from "./dash-input";
import type { Workspace } from "@/backend/workspaces";
import { listWorkspacesServerFn } from "@/server/workspaces/actions";
import { transferDomainWorkspaceServerFn } from "@/server/domains/actions";
import { useStepUpTwoFactor } from "@/hooks/use-step-up-two-factor";
import { withStepUp } from "@/lib/auth/two-factor-step-up";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

export interface Domain {
  id?: string;
  projectId?: string;
  name: string;
  project?: string;
  status: "Active" | "Failed";
  addedAt: string;
  addedBy: string;
  active?: boolean;
  enabled?: boolean;
  isCustom?: boolean;
  isExpired?: boolean;
  purchased?: boolean;
  redirect?: {
    url?: string;
    status?: number;
  } | null;
}

const domainStatusOptions: FilterOption[] = [
  { label: "All", value: "All" },
  { label: "Active", value: "Active", dot: "#34d399" },
  { label: "Failed", value: "Failed", dot: "#fc391e" },
];

interface DomainMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}

function DomainActionsMenu({ items }: { items: DomainMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="text-dash-text-faded transition-colors hover:text-dash-text-strong">
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[160px] overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_4px_12px_rgba(0,0,0,0.08)]">
          {items.map((item, index) => {
            const showDivider = Boolean(item.danger) && index > 0;

            return (
              <div key={item.id}>
                {showDivider ? <hr className="my-1 border-dash-border-soft" /> : null}
                <button
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-dash-bg-elevated ${
                    item.danger ? "text-red-500" : "text-dash-text-body"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Transfer Domain Modal ─── */

const PERSONAL_DESTINATION_ID = "__personal__";

function TransferDomainModal({ open, onOpenChange, domain }: { open: boolean; onOpenChange: (open: boolean) => void; domain: Domain }) {
  const router = useRouter();
  const searchStr = useRouterState({ select: (state) => state.location.searchStr });
  const currentWorkspaceSlug = useMemo(() => {
    const params = new URLSearchParams(searchStr || "");
    return params.get("workspace")?.trim() || undefined;
  }, [searchStr]);
  const sourceIsTeam = Boolean(currentWorkspaceSlug);

  const listWorkspaces = useServerFn(listWorkspacesServerFn as any) as () => Promise<{ items: Workspace[] }>;
  const transferDomainWorkspace = useServerFn(transferDomainWorkspaceServerFn as any) as (args: {
    data: { domainId: string; targetTeamId?: string | null; twoFactorToken?: string };
  }) => Promise<{ success: true }>;
  const { requestStepUp } = useStepUpTwoFactor();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [destinationId, setDestinationId] = useState("");

  const destinationOptions = useMemo(() => {
    const options: Array<{ id: string; label: string }> = [];

    if (sourceIsTeam) {
      options.push({ id: PERSONAL_DESTINATION_ID, label: "Personal workspace" });
    }

    for (const ws of workspaces) {
      if (!ws.id) continue;
      if (ws.slug && ws.slug === currentWorkspaceSlug) continue;
      const role = (ws.role ?? "").toLowerCase();
      if (role !== "creator" && role !== "administrator") continue;
      options.push({ id: ws.id, label: ws.name || ws.slug || ws.id });
    }

    return options;
  }, [workspaces, currentWorkspaceSlug, sourceIsTeam]);

  useEffect(() => {
    if (!open) {
      setDestinationId("");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        setLoadingWorkspaces(true);
        const response = await listWorkspaces();
        if (cancelled) return;
        setWorkspaces(Array.isArray(response?.items) ? response.items : []);
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Failed to load workspaces");
      } finally {
        if (!cancelled) setLoadingWorkspaces(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, listWorkspaces]);

  useEffect(() => {
    if (!open || !destinationOptions.length) return;
    const stillAvailable = destinationOptions.some((opt) => opt.id === destinationId);
    if (!stillAvailable) {
      setDestinationId(destinationOptions[0]?.id ?? "");
    }
  }, [open, destinationOptions, destinationId]);

  async function handleTransfer() {
    const domainId = domain.id?.trim();
    if (!domainId) {
      toast.error("Domain id is missing");
      return;
    }
    if (!destinationId) {
      toast.error("Please select a destination workspace");
      return;
    }

    const targetTeamId = destinationId === PERSONAL_DESTINATION_ID ? null : destinationId;

    try {
      setTransferring(true);
      await withStepUp(
        (twoFactorToken) => transferDomainWorkspace({ data: { domainId, targetTeamId, twoFactorToken } }),
        requestStepUp,
      );
      toast.success("Domain moved successfully");
      onOpenChange(false);
      await invalidateActiveMatches(router);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to transfer domain");
    } finally {
      setTransferring(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalHeader title="Transfer Domain" description={`Move ${domain.name} to another workspace`} />
      <div className="flex flex-col gap-4 px-6 pb-5 pt-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.022px] text-dash-text-strong">Domain</label>
          <div className="rounded-[6px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-3 py-2.5 text-sm text-dash-text-body">
            {domain.name}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.022px] text-dash-text-strong">Destination workspace</label>
          <Dropdown
            value={destinationId}
            options={destinationOptions}
            onChange={setDestinationId}
            placeholder={loadingWorkspaces ? "Loading workspaces..." : "Select workspace..."}
          />
          {!loadingWorkspaces && destinationOptions.length === 0 ? (
            <p className="text-xs leading-5 text-dash-text-faded">
              No workspaces available. You must be a creator or administrator of the target team.
            </p>
          ) : null}
        </div>
        <p className="text-xs leading-[1.5] text-dash-text-faded">
          DNS records and settings move with the domain. Access is granted to the destination workspace immediately.
        </p>
      </div>
      <ModalFooter>
        <ModalCancelButton />
        <ModalContinueButton
          onClick={handleTransfer}
          disabled={!destinationId || transferring}
          loading={transferring}
          loadingLabel="Transferring..."
        >
          Transfer
        </ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}

/* ─── Edit Domain Modal ─── */

const redirectOptions = [
  { id: "301", label: "301 Permanent Redirect" },
  { id: "302", label: "302 Found" },
  { id: "307", label: "307 Temporary Redirect" },
  { id: "308", label: "308 Permanent Redirect" },
];

function isValidRedirectUrl(url: string) {
  try {
    if (!url) {
      return true;
    }

    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname;
    if (!hostname.includes(".")) {
      return false;
    }

    if (hostname.startsWith(".") || hostname.endsWith(".")) {
      return false;
    }

    const tld = hostname.split(".").pop();
    if (!tld || tld.length === 0) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function getDomainProjectLabel(domain: Domain) {
  return domain.project?.trim() || "";
}

function hasAssignedProject(domain: Domain) {
  return Boolean(getDomainProjectLabel(domain) || domain.projectId);
}

function EditDomainModal({
  open,
  onOpenChange,
  domain,
  projectOptions,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: Domain;
  projectOptions: Array<{ id: string; label: string }>;
  onSave?: (input: { domain: Domain; name: string; projectId?: string; redirect: { url: string; status: number } | null }) => Promise<void>;
}) {
  let initialProject = "";
  if (domain.projectId) {
    initialProject = domain.projectId;
  } else {
    const matchedProject = projectOptions.find((p) => p.label === domain.project);
    if (matchedProject) {
      initialProject = matchedProject.id;
    }
  }
  const [project, setProject] = useState(initialProject);
  const [redirectStatus, setRedirectStatus] = useState<string>(() => {
    if (typeof domain.redirect?.status === "number") {
      return String(domain.redirect.status);
    }
    return "307";
  });
  const [redirectUrl, setRedirectUrl] = useState(() => domain.redirect?.url ?? "");
  const [redirectUrlError, setRedirectUrlError] = useState("");
  const [saving, setSaving] = useState(false);

  const inputClass = `${dashInputClassName} dark:placeholder:text-dash-text-extra-faded`;

  async function handleSave() {
    if (redirectUrl && !isValidRedirectUrl(redirectUrl)) {
      setRedirectUrlError("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    setRedirectUrlError("");
    const nextRedirect = redirectUrl.trim()
      ? {
          url: redirectUrl.trim(),
          status: Number(redirectStatus),
        }
      : null;

    if (!onSave) {
      onOpenChange(false);
      return;
    }

    try {
      setSaving(true);
      await onSave({
        domain,
        name: domain.name,
        projectId: project || undefined,
        redirect: nextRedirect,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update domain");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalHeader title="Edit Domain" description={`Update settings for ${domain.name}`} />
      <div className="flex flex-col gap-4 px-6 pb-5 pt-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.022px] text-dash-text-strong">Domain name</label>
          <input
            type="text"
            value={domain.name}
            placeholder="example.com"
            className={`${inputClass} cursor-not-allowed opacity-80`}
            readOnly
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.022px] text-dash-text-strong">Linked project</label>
          <Dropdown
            value={project}
            options={projectOptions}
            onChange={setProject}
            placeholder="Select a project..."
            searchable
            searchPlaceholder="Search projects..."
          />
        </div>
        <div className="mt-1 flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.022px] text-dash-text-strong">Redirect status</label>
          <Dropdown value={redirectStatus} options={redirectOptions} onChange={setRedirectStatus} placeholder="Select redirect status..." />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm leading-5 tracking-[-0.022px] text-dash-text-strong">Redirect URL</label>
            {redirectUrl ? (
              <button
                type="button"
                onClick={() => {
                  setRedirectUrl("");
                  setRedirectUrlError("");
                }}
                className="text-xs text-dash-text-faded underline hover:text-dash-text-strong"
              >
                Clear
              </button>
            ) : null}
          </div>
          <input
            type="url"
            value={redirectUrl}
            onChange={(e) => {
              setRedirectUrl(e.target.value);
              if (redirectUrlError) {
                setRedirectUrlError("");
              }
            }}
            onBlur={() => {
              if (redirectUrl && !isValidRedirectUrl(redirectUrl)) {
                setRedirectUrlError("Please enter a valid URL (e.g., https://example.com)");
              } else {
                setRedirectUrlError("");
              }
            }}
            placeholder="https://example.com"
            className={inputClass}
          />
          {redirectUrlError ? (
            <p className="text-xs text-[#fc391e]">{redirectUrlError}</p>
          ) : (
            <p className="text-xs text-dash-text-faded">Optional. Leave empty to disable redirect.</p>
          )}
        </div>
      </div>
      <ModalFooter>
        <ModalCancelButton />
        <ModalContinueButton onClick={handleSave} disabled={Boolean(redirectUrlError) || saving} loading={saving} loadingLabel="Saving...">
          Save Changes
        </ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}

export function DomainList({
  domains,
  basePath,
  projects = [],
  searchQuery: searchQueryProp,
  onSearchQueryChange,
  searchLoading = false,
  onRefreshDomain,
  onConfigureDomain,
  onDeleteDomain,
}: {
  domains: Domain[];
  basePath?: string;
  projects?: Array<{ id: string; name: string; serviceType?: string }>;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  searchLoading?: boolean;
  onRefreshDomain?: (domain: Domain) => Promise<void>;
  onConfigureDomain?: (input: {
    domain: Domain;
    name: string;
    projectId?: string;
    redirect: { url: string; status: number } | null;
  }) => Promise<void>;
  onDeleteDomain?: (domain: Domain) => Promise<void>;
}) {
  const navigate = useNavigate();
  const searchStr = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const { canEditWorkspace } = useWorkspaceRole();
  const [searchQueryInternal, setSearchQueryInternal] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [transferringDomain, setTransferringDomain] = useState<Domain | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<Domain | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const searchQuery = searchQueryProp ?? searchQueryInternal;
  const setSearchQuery = onSearchQueryChange ?? setSearchQueryInternal;
  const projectDropdownOptions = projects
    .filter((project) => project.serviceType !== "database")
    .map((project) => ({
      id: project.id,
      label: project.name,
    }));

  async function handleRefresh(domain: Domain) {
    setRefreshing((prev) => new Set(prev).add(domain.name));
    try {
      if (onRefreshDomain) {
        await onRefreshDomain(domain);
      }
    } finally {
      setRefreshing((prev) => {
        const next = new Set(prev);
        next.delete(domain.name);
        return next;
      });
    }
  }

  const filtered = domains.filter((d) => statusFilter === "All" || d.status === statusFilter);

  const failedDomains = filtered.filter((d) => d.status === "Failed");
  const expiredDomains = filtered.filter((d) => d.status === "Active" && d.isExpired);
  const activeDomains = filtered.filter((d) => d.status === "Active" && !d.isExpired);

  let workspaceSuffix = "";
  if (searchStr) {
    const params = new URLSearchParams(searchStr);
    const workspace = params.get("workspace");
    if (workspace && workspace.trim()) {
      workspaceSuffix = `?workspace=${encodeURIComponent(workspace.trim())}`;
    }
  }

  function canManageDns(domain: Domain) {
    const isCustom = Boolean(domain.isCustom);
    if (!isCustom) {
      return false;
    }

    return domain.name.split(".").length === 2;
  }

  function getDomainDetailsPath(domain: Domain) {
    if (!basePath) {
      return null;
    }

    if (!canManageDns(domain)) {
      return null;
    }

    return `${basePath}/${encodeURIComponent(domain.name)}${workspaceSuffix}`;
  }

  function actionsFor(domain: Domain) {
    const isCustom = Boolean(domain.isCustom);
    const domainDetailsPath = getDomainDetailsPath(domain);
    const items: DomainMenuItem[] = [];

    if (domainDetailsPath) {
      items.push({
        id: "manage-dns",
        label: "Manage DNS",
        icon: <Settings className="size-3.5" />,
        onClick: () => {
          void navigate({ to: domainDetailsPath as string });
        },
      });
    }

    items.push({
      id: "configure",
      label: "Configure",
      icon: <Pencil className="size-3.5" />,
      onClick: () => setEditingDomain(domain),
    });

    const canTransferWorkspace = isCustom && !domain.purchased && !domain.projectId && canEditWorkspace;
    if (canTransferWorkspace) {
      items.push({
        id: "transfer",
        label: "Transfer domain",
        icon: <ArrowRightLeft className="size-3.5" />,
        onClick: () => setTransferringDomain(domain),
      });
    }

    if (isCustom) {
      items.push({
        id: "delete",
        label: domain.purchased ? "Remove domain" : "Delete domain",
        icon: <FolderTrashIcon className="size-3.5" />,
        danger: true,
        onClick: () => {
          setDeleteConfirmName("");
          setDeletingDomain(domain);
        },
      });
    }

    return {
      items,
    };
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search + Filter bar + Add Domain */}
      <div className="flex items-center gap-3">
        <SearchFilterBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search domains"
          loading={searchLoading}
          className="flex-1"
          rightSlot={<FilterDropdown value={statusFilter} onChange={setStatusFilter} options={domainStatusOptions} />}
        />

        {/* Add Domain button hidden for now */}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-[4px] bg-dash-bg-elevated/40">
          <div className="flex size-8 items-center justify-center rounded-full bg-dash-bg-elevated text-dash-text-faded">
            <LifeBuoy className="size-4" />
          </div>
          <span className="text-sm text-dash-text-faded">{domains.length === 0 ? "No domains yet" : "No domains found"}</span>
        </div>
      )}

      {/* Failed domains (each in its own card) */}
      {failedDomains.map((domain, i) => {
        const actions = actionsFor(domain);
        const domainDetailsPath = getDomainDetailsPath(domain);
        const isAssigned = hasAssignedProject(domain);
        return (
          <div key={`failed-${i}`} className="overflow-visible rounded-[4px] border-[0.5px] border-dash-border">
            <table className="w-full border-collapse">
              <tbody>
                <tr className="h-[68px] bg-dash-bg">
                  <td className="py-2 pl-3.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        {domainDetailsPath ? (
                          <Link
                            to={domainDetailsPath}
                            className="text-sm tracking-[-0.084px] text-dash-text-body transition-colors hover:text-dash-text-strong hover:underline"
                          >
                            {domain.name}
                          </Link>
                        ) : (
                          <span className="text-sm tracking-[-0.084px] text-dash-text-body">{domain.name}</span>
                        )}
                        {domain.purchased && (
                          <SimpleTooltip
                            content={
                              <>
                                <CheckCircle size={13} weight="fill" className="text-[#34d399]" />
                                Purchased from Brimble
                              </>
                            }
                            side="right"
                          >
                            <span className="text-[#4879f8]">
                              <CheckCircle size={14} weight="fill" />
                            </span>
                          </SimpleTooltip>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isAssigned && (
                          <span className="inline-flex items-center rounded-full bg-[#f5a623]/10 px-2 py-0.5 text-[11px] font-medium leading-none text-[#c48418] dark:bg-[#f5a623]/15 dark:text-[#f5a623]">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="w-auto py-2 sm:w-[140px]">
                    <div className="flex items-center gap-1.5">
                      <span className="size-[6px] shrink-0 rounded-full bg-[#fc391e]" />
                      <span className="text-sm font-light leading-5 tracking-[-0.02px] text-dash-text-body">Failed</span>
                    </div>
                  </td>
                  <td className="w-[180px] py-2 text-right">
                    <button
                      onClick={() => void handleRefresh(domain)}
                      disabled={refreshing.has(domain.name)}
                      className="inline-flex items-center gap-2 rounded-[4px] border border-dash-border bg-dash-bg px-3.5 py-1 shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:opacity-60"
                    >
                      {refreshing.has(domain.name) ? (
                        <Spinner className="text-dash-text-body" />
                      ) : (
                        <RefreshCw className="size-4 text-dash-text-body" />
                      )}
                      <span className="text-sm font-medium text-dash-text-body">
                        {refreshing.has(domain.name) ? "Refreshing" : "Refresh"}
                      </span>
                    </button>
                  </td>
                  <td className="w-10 pr-3.5 text-right">
                    <DomainActionsMenu {...actions} />
                  </td>
                </tr>
              </tbody>
            </table>
            {/* Error banner */}
            <div className="flex items-center justify-between border-t-[0.5px] border-dash-border bg-dash-bg-elevated px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-5 shrink-0 text-[#fc391e]" />
                <span className="text-sm font-light leading-[18px] tracking-[-0.02px] text-dash-text-body">
                  Domain waiting for DNS propagation (this can take a while) or DNS misconfigured.
                </span>
              </div>
              {domainDetailsPath ? (
                <Link
                  to={domainDetailsPath}
                  className="shrink-0 text-sm tracking-[-0.02px] text-dash-text-body underline hover:text-dash-text-strong"
                >
                  Change settings
                </Link>
              ) : (
                <button
                  onClick={() => setEditingDomain(domain)}
                  className="shrink-0 text-sm tracking-[-0.02px] text-dash-text-body underline hover:text-dash-text-strong"
                >
                  Change settings
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Expired domains (each in its own card) */}
      {expiredDomains.map((domain, i) => {
        const actions = actionsFor(domain);
        const domainDetailsPath = getDomainDetailsPath(domain);
        const isAssigned = hasAssignedProject(domain);
        return (
          <div key={`expired-${i}`} className="overflow-visible rounded-[4px] border-[0.5px] border-dash-border">
            <table className="w-full border-collapse">
              <tbody>
                <tr className="h-[68px] bg-dash-bg">
                  <td className="py-2 pl-3.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        {domainDetailsPath ? (
                          <Link
                            to={domainDetailsPath}
                            className="text-sm tracking-[-0.084px] text-dash-text-body transition-colors hover:text-dash-text-strong hover:underline"
                          >
                            {domain.name}
                          </Link>
                        ) : (
                          <span className="text-sm tracking-[-0.084px] text-dash-text-body">{domain.name}</span>
                        )}
                        {domain.purchased && (
                          <SimpleTooltip
                            content={
                              <>
                                <CheckCircle size={13} weight="fill" className="text-[#34d399]" />
                                Purchased from Brimble
                              </>
                            }
                            side="right"
                          >
                            <span className="text-[#4879f8]">
                              <CheckCircle size={14} weight="fill" />
                            </span>
                          </SimpleTooltip>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isAssigned && (
                          <span className="inline-flex items-center rounded-full bg-[#f5a623]/10 px-2 py-0.5 text-[11px] font-medium leading-none text-[#c48418] dark:bg-[#f5a623]/15 dark:text-[#f5a623]">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="w-auto py-2 sm:w-[140px]">
                    <div className="flex items-center gap-1.5">
                      <span className="size-[6px] shrink-0 rounded-full bg-[#f5a623]" />
                      <span className="text-sm font-light leading-5 tracking-[-0.02px] text-dash-text-body">Expired</span>
                    </div>
                  </td>
                  <td className="w-[180px] py-2">
                    <div className="flex flex-col gap-1 text-right">
                      <span className="text-sm tracking-[-0.084px] text-dash-text-body">{domain.addedAt}</span>
                      <span className="text-sm font-light leading-[1.3] text-dash-text-extra-faded">{domain.addedBy}</span>
                    </div>
                  </td>
                  <td className="w-10 pr-3.5 text-right">
                    <DomainActionsMenu {...actions} />
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t-[0.5px] border-dash-border bg-dash-bg-elevated px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <Warning size={20} weight="fill" className="shrink-0 text-[#f5a623]" />
                <span className="text-sm font-light leading-[18px] tracking-[-0.02px] text-dash-text-body">
                  This domain has expired. Renew it to keep your site online and avoid losing ownership.
                </span>
              </div>
              {domainDetailsPath ? (
                <Link
                  to={domainDetailsPath}
                  className="shrink-0 text-sm tracking-[-0.02px] text-dash-text-body underline hover:text-dash-text-strong"
                >
                  Renew domain
                </Link>
              ) : null}
            </div>
          </div>
        );
      })}

      {/* Active domains (grouped in one card) */}
      {activeDomains.length > 0 && (
        <div className="overflow-visible rounded-[4px] border-[0.5px] border-dash-border">
          <table className="w-full border-collapse">
            <tbody>
              {activeDomains.map((domain, i) => {
                const actions = actionsFor(domain);
                const domainDetailsPath = getDomainDetailsPath(domain);
                const projectLabel = getDomainProjectLabel(domain);
                const isAssigned = hasAssignedProject(domain);
                return (
                  <tr
                    key={`active-${i}`}
                    className={`h-[68px] ${i < activeDomains.length - 1 ? "border-b-[0.5px] border-dash-border" : ""}`}
                  >
                    <td className="py-2 pl-3.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          {domainDetailsPath ? (
                            <Link
                              to={domainDetailsPath}
                              className="text-sm tracking-[-0.084px] text-dash-text-body transition-colors hover:text-dash-text-strong hover:underline"
                            >
                              {domain.name}
                            </Link>
                          ) : (
                            <span className="text-sm tracking-[-0.084px] text-dash-text-body">{domain.name}</span>
                          )}
                          {domain.purchased && (
                            <SimpleTooltip
                              content={
                                <>
                                  <CheckCircle size={13} weight="fill" className="text-[#34d399]" />
                                  Purchased from Brimble
                                </>
                              }
                              side="right"
                            >
                              <span className="text-[#4879f8]">
                                <CheckCircle size={14} weight="fill" />
                              </span>
                            </SimpleTooltip>
                          )}
                        </div>
                        {projectLabel ? (
                          <span className="text-sm font-light leading-[1.3] text-dash-text-extra-faded">{projectLabel}</span>
                        ) : !isAssigned ? (
                          <span className="inline-flex w-fit items-center rounded-full bg-[#f5a623]/10 px-2 py-0.5 text-[11px] font-medium leading-none text-[#c48418] dark:bg-[#f5a623]/15 dark:text-[#f5a623]">
                            Unassigned
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="w-auto py-2 sm:w-[140px]">
                      <div className="flex items-center gap-1.5">
                        <span className="size-[6px] shrink-0 rounded-full bg-[#34d399]" />
                        <span className="text-sm font-light leading-5 tracking-[-0.02px] text-dash-text-body">Active</span>
                      </div>
                    </td>
                    <td className="hidden w-[180px] py-2 sm:table-cell">
                      <div className="flex flex-col gap-1 text-right">
                        <span className="text-sm tracking-[-0.084px] text-dash-text-body">{domain.addedAt}</span>
                        <span className="text-sm font-light leading-[1.3] text-dash-text-extra-faded">{domain.addedBy}</span>
                      </div>
                    </td>
                    <td className="w-10 pr-3.5 text-right">
                      <DomainActionsMenu {...actions} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Transfer Domain Modal */}
      {transferringDomain && (
        <TransferDomainModal
          key={`transfer-${transferringDomain.name}`}
          open={!!transferringDomain}
          onOpenChange={(v) => {
            if (!v) setTransferringDomain(null);
          }}
          domain={transferringDomain}
        />
      )}

      {/* Edit Domain Modal */}
      {editingDomain && (
        <EditDomainModal
          key={editingDomain.name}
          open={!!editingDomain}
          onOpenChange={(v) => {
            if (!v) setEditingDomain(null);
          }}
          domain={editingDomain}
          projectOptions={projectDropdownOptions}
          onSave={async (input) => {
            if (!onConfigureDomain) {
              return;
            }
            await onConfigureDomain(input);
          }}
        />
      )}

      {/* Delete Domain Modal */}
      <WarningModal
        open={!!deletingDomain}
        onOpenChange={(v) => {
          if (!v) setDeletingDomain(null);
        }}
        title="Delete Domain"
        description={`Are you sure you want to delete "${deletingDomain?.name}"? This action cannot be undone. All DNS records and settings for this domain will be permanently removed.`}
        confirmLabel="Delete"
        confirmDisabled={deleteConfirmName !== deletingDomain?.name || deleting}
        onConfirm={async () => {
          if (!deletingDomain) {
            return;
          }

          if (!onDeleteDomain) {
            setDeletingDomain(null);
            return;
          }

          try {
            setDeleting(true);
            await onDeleteDomain(deletingDomain);
            setDeletingDomain(null);
            setDeleteConfirmName("");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete domain");
            throw error;
          } finally {
            setDeleting(false);
          }
        }}
        confirmLoadingLabel="Deleting..."
      >
        <div className="flex flex-col gap-2 text-left">
          <label className="text-sm leading-5 text-dash-text-faded">
            Type <span className="font-medium text-dash-text-strong">{deletingDomain?.name}</span> to confirm
          </label>
          <input
            type="text"
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
            placeholder={deletingDomain?.name}
            className="w-full rounded-[6px] bg-[#f9fafb] px-3 py-2.5 text-sm leading-6 text-dash-text-strong shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] outline-none placeholder:text-[#9ca3af] focus:shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08),0px_0px_0px_3px_rgba(225,41,29,0.15)] dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08),0px_0px_0px_3px_rgba(225,41,29,0.15)]"
          />
        </div>
      </WarningModal>
    </div>
  );
}
