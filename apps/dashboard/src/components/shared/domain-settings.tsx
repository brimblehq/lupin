import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Plus, AlertCircle, ChevronDown, Pencil, RefreshCw, ArrowUpRight, Eye, EyeOff, X } from "lucide-react";
import { CheckCircle, FolderOpen, ShieldCheck, Warning } from "@phosphor-icons/react";
import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { FolderTrashIcon } from "./folder-trash-icon";
import { GlossyButton } from "./glossy-button";
import { Modal, ModalCancelButton, ModalContinueButton, ModalFooter, ModalHeader } from "./modal";
import { SimpleTooltip } from "./tooltip";
import { ToggleSwitch } from "./toggle-switch";
import { WarningModal } from "./warning-modal";
import { Dropdown } from "./dropdown";
import {
  createDomainDnsRecordServerFn,
  deleteDomainDnsRecordServerFn,
  listDomainProjectsServerFn,
  refreshDomainStatusServerFn,
  renewDomainSaleServerFn,
  setDomainNameserversServerFn,
  transferDomainServerFn,
  transferOutServerFn,
  updateDomainDnsRecordServerFn,
} from "@/server/domains/actions";
import { getPaymentMethodsServerFn } from "@/server/payments/actions";
import { useStepUpTwoFactor } from "@/hooks/use-step-up-two-factor";
import { withStepUp } from "@/lib/auth/two-factor-step-up";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

const dnsRecordTypes = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"];

export interface DnsRecord {
  id?: string;
  type: string;
  name: string;
  ttl: string;
  ttlSeconds?: number;
  value: string;
  isProxied?: boolean;
}

export interface DomainInfo {
  domainId: string;
  domainName: string;
  registrar: string;
  nameserversType: string;
  expirationDate: string;
  connectedProjectName?: string;
  connectedProjectId?: string;
  connectedProjectSlug?: string;
  dnsRecords: DnsRecord[];
  nameservers: string[];
  nameserverWarning?: string;
  purchased?: boolean;
  isExpired?: boolean;
  active?: boolean;
  expiresAt?: string;
  canTransferOut?: boolean;
  transferOutMessage?: string;
  renewalPrice?: number;
  renewalDuration?: number;
  autoRenewal?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const haptics = useHaptics();

  function handleCopy() {
    void navigator.clipboard.writeText(text);
    haptics.light();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button onClick={handleCopy} className="text-dash-text-body transition-colors hover:text-dash-text-strong" title="Copy">
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#34d399]">
          <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  );
}

function AddDnsRecordModal({
  open,
  onOpenChange,
  domainName,
  editingRecord,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domainName: string;
  editingRecord?: DnsRecord | null;
  onSubmit: (input: { name: string; type: string; value: string; ttl: string; isProxied: boolean }) => Promise<void>;
  submitting: boolean;
}) {
  const isEditing = !!editingRecord;
  const [name, setName] = useState(editingRecord?.name ?? "");
  const [type, setType] = useState(editingRecord?.type ?? "CNAME");
  const [typeOpen, setTypeOpen] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(editingRecord?.value ?? "");
  const [ttl, setTtl] = useState(editingRecord?.ttl ?? "");
  const [isProxied, setIsProxied] = useState(editingRecord?.isProxied ?? false);

  useEffect(() => {
    if (!open) return;
    setName(editingRecord?.name ?? "");
    setType(editingRecord?.type ?? "CNAME");
    setValue(editingRecord?.value ?? "");
    setTtl(editingRecord?.ttl ?? "");
    setIsProxied(editingRecord?.isProxied ?? false);
  }, [open, editingRecord]);

  useEffect(() => {
    if (!typeOpen) return;
    function handleClick(e: MouseEvent) {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setTypeOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [typeOpen]);

  const showProxyToggle = type === "A" || type === "CNAME";

  async function handleSubmit() {
    const nextName = name.trim();
    const nextType = type.trim().toUpperCase();
    const nextValue = value.trim();

    if (!nextName || !nextType || !nextValue) {
      toast.error("Type, name, and value are required");
      return;
    }

    await onSubmit({
      name: nextName,
      type: nextType,
      value: nextValue,
      ttl: ttl.trim(),
      isProxied: showProxyToggle ? isProxied : false,
    });
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={500} className="overflow-visible">
      <ModalHeader
        title={isEditing ? "Edit DNS Record" : "Add DNS Record"}
        description={isEditing ? `Update record for ${domainName}` : `Connect to ${domainName}`}
      />

      <div className="flex flex-col gap-4 overflow-visible px-6 pb-5 pt-4">
        <FormField label="Name" placeholder="Name" value={name} onChange={setName} />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.022px] text-dash-text-strong">Type</label>
          <div ref={typeRef} className="relative">
            <button
              type="button"
              onClick={() => setTypeOpen(!typeOpen)}
              className="input-base input-focus flex min-h-[46px] w-full items-center justify-between px-3 py-2.5 text-sm leading-6 text-dash-text-strong"
            >
              <span>{type || "Select type"}</span>
              <ChevronDown className={`size-4 text-dash-text-faded transition-transform duration-200 ${typeOpen ? "rotate-180" : ""}`} />
            </button>
            {typeOpen && (
              <div className="absolute left-0 top-[calc(100%+4px)] z-10 w-full overflow-clip rounded-[6px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_4px_16px_rgba(0,0,0,0.08)]">
                {dnsRecordTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setType(t);
                      setTypeOpen(false);
                    }}
                    className={`flex w-full items-center px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-dash-bg-elevated ${
                      t === type ? "font-medium text-dash-text-strong" : "font-light text-dash-text-faded"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <FormField label="Value" placeholder="Value" value={value} onChange={setValue} />
        <FormField label="TTL" placeholder="1 Hour" value={ttl} onChange={setTtl} />

        {showProxyToggle ? (
          <div className="flex flex-col gap-3 rounded-[6px] bg-dash-bg-elevated p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-dash-text-strong">Proxy</span>
                <span className="text-sm text-dash-text-faded">Route through Brimble for SSL and IP protection</span>
              </div>
              <ToggleSwitch checked={isProxied} onChange={setIsProxied} />
            </div>

            {isProxied ? (
              <p className="text-sm leading-6 text-dash-text-body">
                <span className="font-semibold">
                  {name.trim()
                    ? name.trim() === "@" || name.trim().endsWith(`.${domainName}`) || name.trim() === domainName
                      ? domainName
                      : `${name.trim()}.${domainName}`
                    : `[name].${domainName}`}
                </span>{" "}
                {type === "CNAME" ? "is an alias of" : "points to"}{" "}
                <span className="font-semibold">{value.trim() || (type === "CNAME" ? "[target]" : "[IP address]")}</span> and has its
                traffic proxied through Brimble.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <ModalFooter>
        <ModalCancelButton />
        <ModalContinueButton
          onClick={() => void handleSubmit()}
          disabled={submitting}
          loading={submitting}
          loadingLabel={isEditing ? "Saving..." : "Creating..."}
        >
          {isEditing ? "Save Changes" : "Add Record"}
        </ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}

function FormField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm leading-5 tracking-[-0.022px] text-dash-text-strong">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-base input-focus min-h-[46px] px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af] dark:placeholder:text-dash-text-extra-faded"
      />
    </div>
  );
}

const HOSTNAME_PATTERN = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function isValidHostname(value: string) {
  return HOSTNAME_PATTERN.test(value.trim());
}

function EditNameserversModal({
  open,
  onOpenChange,
  initialNameservers,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialNameservers: string[];
  onSubmit: (nameservers: string[]) => Promise<void>;
  submitting: boolean;
}) {
  const [entries, setEntries] = useState<{ id: number; value: string }[]>(() =>
    (initialNameservers.length >= 2 ? initialNameservers : [...initialNameservers, ""]).map((value, index) => ({
      id: index,
      value,
    })),
  );
  const idRef = useRef(entries.length);

  useEffect(() => {
    if (!open) return;
    const seed =
      initialNameservers.length >= 2 ? initialNameservers : [...initialNameservers, ...Array(2 - initialNameservers.length).fill("")];
    setEntries(seed.map((value, index) => ({ id: index, value })));
    idRef.current = seed.length;
  }, [open, initialNameservers]);

  const trimmed = entries.map((e) => e.value.trim().toLowerCase());
  const hasInvalid = trimmed.some((value) => value.length > 0 && !isValidHostname(value));
  const seenCounts = trimmed.reduce<Record<string, number>>((acc, value) => {
    if (!value) return acc;
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
  const duplicateValues = new Set(
    Object.entries(seenCounts)
      .filter(([, count]) => count > 1)
      .map(([value]) => value),
  );
  const hasDuplicate = duplicateValues.size > 0;
  const filled = trimmed.filter(Boolean);
  const uniqueFilled = Array.from(new Set(filled));
  const canSubmit = uniqueFilled.length >= 2 && !hasInvalid && !hasDuplicate && !submitting;

  function updateEntry(id: number, value: string) {
    setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, value } : entry)));
  }
  function addEntry() {
    idRef.current += 1;
    setEntries((prev) => [...prev, { id: idRef.current, value: "" }]);
  }
  function removeEntry(id: number) {
    setEntries((prev) => (prev.length <= 2 ? prev : prev.filter((entry) => entry.id !== id)));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    await onSubmit(uniqueFilled);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalHeader
        title="Edit nameservers"
        description="Point your domain to a different DNS provider. Changes can take up to 24 hours to propagate."
      />

      <div className="flex flex-col gap-3 px-6 pb-5 pt-4">
        {entries.map((entry, index) => {
          const value = entry.value.trim().toLowerCase();
          const invalid = value.length > 0 && !isValidHostname(value);
          const duplicate = !invalid && value.length > 0 && duplicateValues.has(value);
          const showError = invalid || duplicate;
          return (
            <div key={entry.id} className="flex flex-col gap-1.5">
              <label className="text-sm leading-5 tracking-[-0.022px] text-dash-text-strong">Nameserver {index + 1}</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`ns${index + 1}.example.com`}
                  value={entry.value}
                  onChange={(e) => updateEntry(entry.id, e.target.value)}
                  className={`input-base min-h-[46px] flex-1 px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af] dark:placeholder:text-dash-text-extra-faded ${
                    showError ? "input-error" : "input-focus"
                  }`}
                />
                {entries.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    className="rounded-[4px] p-2 text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
                    title="Remove nameserver"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              {invalid && <span className="text-xs text-[#e34935]">Enter a valid hostname (e.g. ns1.example.com).</span>}
              {duplicate && <span className="text-xs text-[#e34935]">This nameserver is already listed above.</span>}
            </div>
          );
        })}

        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-1.5 self-start text-sm font-medium text-[#3667ea] transition-opacity hover:opacity-80"
        >
          <Plus className="size-4" />
          Add nameserver
        </button>

        <p className="text-xs text-dash-text-faded">A minimum of 2 nameservers is required.</p>
      </div>

      <ModalFooter>
        <ModalCancelButton />
        <ModalContinueButton onClick={() => void handleSubmit()} disabled={!canSubmit} loading={submitting} loadingLabel="Saving...">
          Save changes
        </ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}

export function DomainSettings({ domain, backPath, workspace }: { domain: DomainInfo; backPath: string; workspace?: string }) {
  const [records, setRecords] = useState(domain.dnsRecords);
  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DnsRecord | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dnsSubmitting, setDnsSubmitting] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewDuration, setRenewDuration] = useState(domain.renewalDuration || 1);
  const [renewAutoRenew, setRenewAutoRenew] = useState(Boolean(domain.autoRenewal));
  const [transferOutOpen, setTransferOutOpen] = useState(false);
  const [transferChecklist, setTransferChecklist] = useState({
    unlocked: false,
    registrantEmailReady: false,
    understandDnsImpact: false,
  });
  const [transferStep, setTransferStep] = useState<"setup" | "auth-code">("setup");
  const [transferAuthCode, setTransferAuthCode] = useState<string>("");
  const [transferAuthCodeRevealed, setTransferAuthCodeRevealed] = useState(false);
  const [transferAuthLoading, setTransferAuthLoading] = useState(false);
  const [domainActive, setDomainActive] = useState(Boolean(domain.active));
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [nameservers, setNameservers] = useState<string[]>(domain.nameservers);
  const [editNameserversOpen, setEditNameserversOpen] = useState(false);
  const [savingNameservers, setSavingNameservers] = useState(false);
  const [linkProjectOpen, setLinkProjectOpen] = useState(false);
  const [linkProjectList, setLinkProjectList] = useState<{ id: string; name: string }[]>([]);
  const [linkProjectLoading, setLinkProjectLoading] = useState(false);
  const [linkProjectSelected, setLinkProjectSelected] = useState<string | null>(null);
  const [linkProjectSubmitting, setLinkProjectSubmitting] = useState(false);
  const haptics = useHaptics();
  const router = useRouter();

  const expiringSoon = (() => {
    if (domain.isExpired || !domain.expiresAt) return false;
    const expiry = new Date(domain.expiresAt);
    if (Number.isNaN(expiry.getTime())) return false;
    const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86_400_000);
    return daysLeft >= 0 && daysLeft <= 7;
  })();
  const refreshDomainStatus = useServerFn(refreshDomainStatusServerFn as any) as (args: {
    data: { workspace?: string; domainName: string };
  }) => Promise<{ active?: boolean } | null>;
  const createDnsRecord = useServerFn(createDomainDnsRecordServerFn as any) as (args: {
    data: {
      workspace?: string;
      domainName: string;
      record: { type: string; name: string; value: string; ttl?: number; isProxied?: boolean };
    };
  }) => Promise<{ id?: string; type: string; name: string; value: string; ttl?: number }>;
  const updateDnsRecord = useServerFn(updateDomainDnsRecordServerFn as any) as (args: {
    data: {
      workspace?: string;
      domainName: string;
      recordId: string;
      record: { type: string; name: string; value: string; ttl?: number; isProxied?: boolean };
    };
  }) => Promise<{ id?: string; type: string; name: string; value: string; ttl?: number }>;
  const deleteDnsRecord = useServerFn(deleteDomainDnsRecordServerFn as any) as (args: {
    data: { workspace?: string; domainName: string; recordId: string };
  }) => Promise<{ success: boolean }>;
  const renewDomain = useServerFn(renewDomainSaleServerFn as any) as (args: {
    data: { workspace?: string; domainId: string; duration?: number; autoRenew?: boolean };
  }) => Promise<{ success: boolean }>;
  const transferOut = useServerFn(transferOutServerFn as any) as (args: {
    data: { workspace?: string; domainName: string; twoFactorToken?: string };
  }) => Promise<{ domainName: string; authCode: string; unlocked: boolean }>;
  const { requestStepUp } = useStepUpTwoFactor();
  const transferToProject = useServerFn(transferDomainServerFn as any) as (args: {
    data: { workspace?: string; domainId: string; projectId: string };
  }) => Promise<{ success: boolean }>;
  const setDomainNameservers = useServerFn(setDomainNameserversServerFn as any) as (args: {
    data: { workspace?: string; domainId: string; nameservers: string[] };
  }) => Promise<{ nameservers?: string[] } | null>;

  async function handleOpenLinkProject() {
    setLinkProjectOpen(true);
    setLinkProjectLoading(true);
    try {
      const result = await (listDomainProjectsServerFn as any)({
        data: { workspace },
      });
      setLinkProjectList((result?.items ?? []).map((p: any) => ({ id: String(p.id ?? p._id), name: p.name ?? "" })));
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLinkProjectLoading(false);
    }
  }

  async function handleLinkProject() {
    if (!linkProjectSelected || linkProjectSubmitting) return;
    setLinkProjectSubmitting(true);
    try {
      await transferToProject({
        data: { workspace, domainId: domain.domainId, projectId: linkProjectSelected },
      });
      toast.success("Domain linked to project");
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message || "Failed to link domain to project");
    } finally {
      setLinkProjectSubmitting(false);
    }
  }

  useEffect(() => {
    setRecords(domain.dnsRecords);
  }, [domain.dnsRecords]);

  useEffect(() => {
    setNameservers(domain.nameservers);
  }, [domain.nameservers]);

  useEffect(() => {
    setDomainActive(Boolean(domain.active));
  }, [domain.active]);

  async function handleSaveNameservers(next: string[]) {
    if (savingNameservers) return;
    setSavingNameservers(true);
    try {
      const result = await setDomainNameservers({
        data: { workspace, domainId: domain.domainId, nameservers: next },
      });
      const updated = Array.isArray(result?.nameservers) && result.nameservers.length > 0 ? result.nameservers : next;
      setNameservers(updated);
      setEditNameserversOpen(false);
      toast.success("Nameservers updated. Changes can take up to 24 hours to propagate.");
      void invalidateActiveMatches(router);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update nameservers");
    } finally {
      setSavingNameservers(false);
    }
  }

  useEffect(() => {
    setRenewDuration(domain.renewalDuration || 1);
    setRenewAutoRenew(Boolean(domain.autoRenewal));
  }, [domain.renewalDuration, domain.autoRenewal, domain.domainId]);

  const upsertRecord = useCallback(
    (input: {
      record: {
        id?: string;
        type: string;
        name: string;
        value: string;
        ttl?: number;
        isProxied?: boolean;
      };
      ttlLabel: string;
      previousId?: string;
    }) => {
      setRecords((prev) => {
        const normalized: DnsRecord = {
          id: input.record.id,
          type: input.record.type,
          name: input.record.name,
          value: input.record.value,
          ttl: input.ttlLabel || "Auto",
          ttlSeconds: input.record.ttl,
          isProxied: input.record.isProxied,
        };

        const targetId = input.previousId ?? input.record.id;
        if (targetId) {
          const existingIndex = prev.findIndex((item) => item.id === targetId);
          if (existingIndex >= 0) {
            const next = [...prev];
            next[existingIndex] = normalized;
            return next;
          }
        }

        return [...prev, normalized];
      });
    },
    [],
  );

  const deleteRecord = useCallback(
    (index: number) => {
      const record = records[index];
      if (!record?.id) {
        toast.error("Unable to delete DNS record: missing record id");
        return;
      }

      setDeletingRecordId(record.id);
      setRecords((prev) => prev.filter((_, i) => i !== index));

      const deletePromise = deleteDnsRecord({
        data: {
          ...(workspace ? { workspace } : {}),
          domainName: domain.domainName,
          recordId: record.id,
        },
      });

      toast.promise(deletePromise, {
        loading: "Deleting DNS record…",
        success: "DNS record deleted",
        error: (error) => {
          setRecords((prev) => {
            const next = [...prev];
            next.splice(index, 0, record);
            return next;
          });
          return error instanceof Error ? error.message : "Failed to delete DNS record";
        },
      });

      void deletePromise.finally(() => {
        setDeletingRecordId(null);
      });
    },
    [records, deleteDnsRecord, workspace, domain.domainName],
  );

  const handleDnsSubmit = useCallback(
    async (input: { name: string; type: string; value: string; ttl: string; isProxied: boolean }) => {
      const previousRecord = editingRecord;
      const parsedTtl = Number(input.ttl);
      const ttl = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : (previousRecord?.ttlSeconds ?? 3600);

      try {
        setDnsSubmitting(true);

        if (previousRecord?.id) {
          const updated = await updateDnsRecord({
            data: {
              ...(workspace ? { workspace } : {}),
              domainName: domain.domainName,
              recordId: previousRecord.id,
              record: {
                type: input.type,
                name: input.name,
                value: input.value,
                ttl,
                isProxied: input.isProxied,
              },
            },
          });

          upsertRecord({
            record: updated,
            ttlLabel: input.ttl || previousRecord.ttl || "Auto",
            previousId: previousRecord.id,
          });
          toast.success("DNS record updated");
        } else {
          const created = await createDnsRecord({
            data: {
              ...(workspace ? { workspace } : {}),
              domainName: domain.domainName,
              record: {
                type: input.type,
                name: input.name,
                value: input.value,
                ttl,
                isProxied: input.isProxied,
              },
            },
          });

          upsertRecord({
            record: created,
            ttlLabel: input.ttl || "Auto",
          });
          toast.success("DNS record created");
        }

        setAddRecordOpen(false);
        setEditingRecord(null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save DNS record");
      } finally {
        setDnsSubmitting(false);
      }
    },
    [editingRecord, updateDnsRecord, workspace, domain.domainName, upsertRecord, createDnsRecord],
  );

  const renewalUnitPrice = Number(domain.renewalPrice ?? 0);
  const totalRenewalPrice = renewalUnitPrice * renewDuration;
  const canAutomaticallyTransfer = domain.canTransferOut !== false;
  const canContinueTransfer = transferChecklist.unlocked && transferChecklist.registrantEmailReady && transferChecklist.understandDnsImpact;

  async function handleCheckDnsStatus() {
    try {
      setRefreshingStatus(true);
      const result = await refreshDomainStatus({
        data: { workspace, domainName: domain.domainName },
      });
      const isActive = Boolean(result?.active);
      setDomainActive(isActive);
      if (isActive) {
        toast.success("DNS has propagated — your domain is active!");
      } else {
        toast("DNS hasn't propagated yet. This can take up to 48 hours.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check domain status");
    } finally {
      setRefreshingStatus(false);
    }
  }

  async function requestTransferAuthCode() {
    const result = await withStepUp(
      (twoFactorToken) => transferOut({ data: { workspace, domainName: domain.domainName, twoFactorToken } }),
      requestStepUp,
    );
    return result.authCode;
  }

  async function handleContinueTransfer() {
    try {
      setTransferAuthLoading(true);
      const authCode = await requestTransferAuthCode();
      setTransferAuthCode(authCode);
      setTransferAuthCodeRevealed(false);
      setTransferStep("auth-code");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load EPP/Auth code");
    } finally {
      setTransferAuthLoading(false);
    }
  }

  function resetTransferModalState() {
    setTransferStep("setup");
    setTransferAuthCode("");
    setTransferAuthCodeRevealed(false);
    setTransferAuthLoading(false);
    setTransferChecklist({
      unlocked: false,
      registrantEmailReady: false,
      understandDnsImpact: false,
    });
  }
  return (
    <div className="flex flex-col">
      {/* Sub-bar: Back + domain name + action icons */}
      <div className="flex items-center justify-between border-b-[0.5px] border-dash-border px-8 py-2">
        <div className="flex items-center gap-16">
          <Link to={backPath} className="text-sm text-dash-text-faded underline transition-colors hover:text-dash-text-strong">
            Back
          </Link>
          <a
            href={`https://${domain.domainName}`}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-1 text-sm font-medium text-dash-text-body transition-colors hover:text-dash-text-strong"
          >
            {domain.domainName}
            <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
        </div>
        <div className="flex items-center gap-4 px-3.5">
          {domain.purchased ? (
            <SimpleTooltip content="Purchased domains cannot be deleted" side="bottom">
              <span className="cursor-not-allowed opacity-40">
                <FolderTrashIcon className="size-4" />
              </span>
            </SimpleTooltip>
          ) : (
            <button onClick={() => setDeleteOpen(true)} className="transition-opacity hover:opacity-70">
              <FolderTrashIcon className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 py-8">
        {/* Domain info card */}
        <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <InfoColumn label="Registrar" value={domain.registrar} />
            <InfoColumn label="Nameservers" value={domain.nameserversType} />
            <InfoColumn label="Expiration date" value={domain.expirationDate} />
            <InfoColumn
              label="Connected project"
              value={
                domain.connectedProjectName ? (
                  <Link
                    to={
                      `${`/projects/${encodeURIComponent(
                        domain.connectedProjectSlug || domain.connectedProjectName || domain.connectedProjectId || "",
                      )}`}${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""}` as any
                    }
                    className="underline decoration-dash-border-soft underline-offset-2 transition-colors hover:text-dash-text-strong"
                  >
                    {domain.connectedProjectName}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      void handleOpenLinkProject();
                    }}
                    className="text-[#4879f8] underline-offset-2 transition-colors hover:underline"
                  >
                    Link to project
                  </button>
                )
              }
            />
          </div>
        </div>

        {/* Domain status banner — priority: expired > expiring soon > nameserver warning > DNS status */}
        {domain.isExpired ? (
          <div className="flex items-center gap-3 rounded-[4px] bg-[#fef2f2] px-4 py-3 dark:bg-[#2a1818]">
            <AlertCircle className="size-5 shrink-0 text-[#ef4444]" />
            <span className="text-sm text-dash-text-body">
              This domain has expired. DNS records cannot be managed until the domain is renewed.
            </span>
            <GlossyButton
              type="button"
              variant="red"
              onClick={() => setRenewOpen(true)}
              className="ml-auto h-8 shrink-0 rounded-[6px] px-2.5 text-xs"
            >
              Renew now
            </GlossyButton>
          </div>
        ) : expiringSoon ? (
          <div className="flex items-center gap-3 rounded-[4px] bg-[#fffbeb] px-4 py-3 dark:bg-[#2a2518]">
            <Warning size={20} weight="fill" className="shrink-0 text-[#f5a623]" />
            <span className="text-sm text-dash-text-body">
              This domain expires in less than 7 days. Renew it soon to avoid losing ownership.
            </span>
            <GlossyButton
              type="button"
              variant="black"
              onClick={() => setRenewOpen(true)}
              className="ml-auto h-8 shrink-0 rounded-[6px] px-2.5 text-xs"
            >
              Renew now
            </GlossyButton>
          </div>
        ) : domain.nameserverWarning ? null : domainActive ? (
          <div className="flex items-center gap-3 rounded-[4px] bg-[#f0fdf4] px-4 py-3 dark:bg-[#162317]">
            <CheckCircle className="size-5 shrink-0 text-[#34d399]" weight="fill" />
            <span className="text-sm text-dash-text-body">Domain is active — DNS has propagated and your settings are live.</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-[4px] bg-[#fffbeb] px-4 py-3 dark:bg-[#2a2518]">
            <AlertCircle className="size-5 shrink-0 text-[#e89c30]" />
            <span className="text-sm text-dash-text-body">DNS is still propagating. This can take up to 48 hours.</span>
            <button
              onClick={() => {
                void handleCheckDnsStatus();
              }}
              disabled={refreshingStatus}
              className="ml-auto flex shrink-0 items-center gap-1.5 rounded-[6px] border border-dash-border bg-dash-bg px-2.5 py-1.5 text-xs font-medium text-dash-text-body transition-colors hover:bg-dash-bg-elevated disabled:pointer-events-none disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${refreshingStatus ? "animate-spin" : ""}`} />
              {refreshingStatus ? "Checking..." : "Check status"}
            </button>
          </div>
        )}

        {/* DNS Records section */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-medium leading-5 tracking-[-0.026px] text-dash-text-body dark:text-white">DNS Records</h2>
              <p className="text-sm font-light leading-[1.3] text-dash-text-faded">
                Manage the domain name system for your domain "
                <a
                  href={`https://${domain.domainName}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-normal text-dash-text-body underline-offset-2 transition-colors hover:text-dash-text-strong hover:underline"
                >
                  {domain.domainName}
                </a>
                "
              </p>
            </div>
            {records.length > 0 &&
              (domain.isExpired ? (
                <SimpleTooltip content="DNS cannot be managed for expired domains" side="left">
                  <span className="flex w-fit shrink-0 cursor-not-allowed items-center gap-1 whitespace-nowrap rounded-[4px] border border-[#232931] bg-gradient-to-b from-[#545459] via-[#45454b] to-[#2d2d32] px-3 py-[5px] text-sm font-medium text-white opacity-50 shadow-[0px_1px_2px_rgba(18,18,23,0.05)]">
                    <Plus className="size-4" />
                    <span className="px-1">Add a New Record</span>
                  </span>
                </SimpleTooltip>
              ) : (
                <button
                  onClick={() => {
                    setEditingRecord(null);
                    setAddRecordOpen(true);
                  }}
                  className="flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-[4px] border border-[#232931] bg-gradient-to-b from-[#545459] via-[#45454b] to-[#2d2d32] px-3 py-[5px] text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-opacity hover:opacity-90"
                >
                  <Plus className="size-4" />
                  <span className="px-1">Add a New Record</span>
                </button>
              ))}
          </div>

          <hr className="border-dash-border" />
        </div>

        {/* DNS Records table */}
        <div className="flex flex-col gap-2">
          {/* Column headers — hidden on mobile */}
          {records.length > 0 && (
            <div className="hidden grid-cols-[92px_minmax(0,1fr)_84px_minmax(0,2fr)_76px] gap-2 px-3.5 sm:grid">
              <span className="text-xs font-medium leading-5 tracking-[-0.019px] text-dash-text-body">Type</span>
              <span className="text-xs font-medium leading-5 tracking-[-0.019px] text-dash-text-body">Name</span>
              <span className="whitespace-nowrap text-xs font-medium leading-5 tracking-[-0.019px] text-dash-text-body">TTL</span>
              <span className="text-xs font-medium leading-5 tracking-[-0.019px] text-dash-text-body">Value</span>
              <span className="w-[76px]" />
            </div>
          )}

          {/* DNS rows */}
          <div className="overflow-clip rounded-[2px] border-[0.5px] border-dash-border">
            {records.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 bg-dash-bg-elevated px-4 py-10 text-center">
                <FolderOpen size={36} weight="fill" className="text-dash-text-faded/45" />
                <p className="text-sm font-medium text-dash-text-body">No DNS records yet</p>
                <p className="max-w-[420px] text-xs leading-5 text-dash-text-faded">
                  Add your first DNS record to point <span className="font-mono">{domain.domainName}</span> to the service you want.
                </p>
                {domain.isExpired ? (
                  <p className="text-xs text-[#ef2f1f]">DNS records cannot be managed for expired domains.</p>
                ) : (
                  <GlossyButton
                    type="button"
                    variant="black"
                    onClick={() => {
                      setEditingRecord(null);
                      setAddRecordOpen(true);
                    }}
                    className="mt-2 h-8 rounded-[6px] px-2.5 text-xs"
                  >
                    <Plus className="size-3.5" />
                    Add first record
                  </GlossyButton>
                )}
              </div>
            ) : (
              records.map((record, i) => (
                <div
                  key={i}
                  className={`bg-dash-bg-elevated px-3.5 py-2.5 ${i < records.length - 1 ? "border-b-[0.5px] border-dash-border" : ""}`}
                >
                  {/* Desktop: grid layout */}
                  <div className="hidden items-center gap-2 sm:grid sm:grid-cols-[92px_minmax(0,1fr)_84px_minmax(0,2fr)_76px]">
                    <span className="min-w-0 whitespace-nowrap font-mono text-sm font-light leading-5 tracking-[-0.022px] text-dash-text-body">
                      <span className="flex items-center gap-1.5">
                        {record.type}
                        {record.isProxied && (
                          <SimpleTooltip
                            content={
                              <>
                                <CheckCircle size={13} weight="fill" className="text-[#34d399]" />
                                Proxied by Brimble
                              </>
                            }
                          >
                            <span className="text-[#4879f8]">
                              <ShieldCheck size={14} weight="fill" />
                            </span>
                          </SimpleTooltip>
                        )}
                      </span>
                    </span>
                    <span className="min-w-0 break-all font-mono text-sm font-light leading-5 tracking-[-0.022px] text-dash-text-body">
                      {record.name}
                    </span>
                    <span className="min-w-0 whitespace-nowrap font-mono text-sm font-light leading-5 tracking-[-0.022px] text-dash-text-body">
                      {record.ttl}
                    </span>
                    <span className="min-w-0 break-all whitespace-normal font-mono text-sm font-light leading-5 tracking-[-0.022px] text-dash-text-body">
                      {record.value}
                    </span>
                    <div className="flex items-center gap-2">
                      {domain.isExpired ? (
                        <SimpleTooltip content="DNS cannot be managed for expired domains">
                          <span className="cursor-not-allowed rounded-[4px] p-1 text-dash-text-faded opacity-50">
                            <Pencil className="size-3.5" />
                          </span>
                        </SimpleTooltip>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingRecord(record);
                            setAddRecordOpen(true);
                          }}
                          className="rounded-[4px] p-1 text-dash-text-faded transition-colors hover:bg-dash-bg hover:text-dash-text-body"
                          title="Edit record"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      )}
                      {domain.isExpired ? (
                        <SimpleTooltip content="DNS cannot be managed for expired domains">
                          <span className="cursor-not-allowed rounded-[4px] p-1 opacity-50">
                            <FolderTrashIcon className="size-3.5" />
                          </span>
                        </SimpleTooltip>
                      ) : (
                        <button
                          onClick={() => deleteRecord(i)}
                          disabled={deletingRecordId === record.id}
                          className="rounded-[4px] p-1 transition-opacity hover:opacity-70"
                          title="Delete record"
                        >
                          <FolderTrashIcon className="size-3.5" />
                        </button>
                      )}
                      <CopyButton text={record.value} />
                    </div>
                  </div>

                  {/* Mobile: stacked card layout */}
                  <div className="flex flex-col gap-2 sm:hidden">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-mono text-sm font-medium text-dash-text-strong">
                        {record.type}
                        {record.isProxied && (
                          <span className="text-[#4879f8]">
                            <ShieldCheck size={14} weight="fill" />
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {!domain.isExpired && (
                          <button
                            onClick={() => {
                              setEditingRecord(record);
                              setAddRecordOpen(true);
                            }}
                            className="rounded-[4px] p-1 text-dash-text-faded transition-colors hover:bg-dash-bg hover:text-dash-text-body"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                        {!domain.isExpired && (
                          <button
                            onClick={() => deleteRecord(i)}
                            disabled={deletingRecordId === record.id}
                            className="rounded-[4px] p-1 transition-opacity hover:opacity-70"
                          >
                            <FolderTrashIcon className="size-3.5" />
                          </button>
                        )}
                        <CopyButton text={record.value} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-dash-text-faded">
                      <div className="flex gap-2">
                        <span className="w-12 shrink-0 font-medium text-dash-text-body">Name</span>
                        <span className="min-w-0 break-all font-mono">{record.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="w-12 shrink-0 font-medium text-dash-text-body">Value</span>
                        <span className="min-w-0 break-all font-mono">{record.value}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="w-12 shrink-0 font-medium text-dash-text-body">TTL</span>
                        <span className="font-mono">{record.ttl}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Nameservers section */}
        <div className="mt-6 flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-base font-medium leading-5 tracking-[-0.026px] text-dash-text-body dark:text-white">Nameservers</h2>
              <p className="max-w-[720px] text-sm font-light leading-[1.3] text-dash-text-faded">
                {domain.purchased ? (
                  <>
                    <a
                      href={`https://${domain.domainName}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-normal text-dash-text-body underline-offset-2 transition-colors hover:text-dash-text-strong hover:underline"
                    >
                      {domain.domainName}
                    </a>{" "}
                    uses Brimble's nameservers by default so DNS just works. Prefer to manage DNS elsewhere (Cloudflare, Route 53, etc.)?
                    Click Change to point it at your own nameservers.
                  </>
                ) : (
                  <>
                    To use Brimble's nameservers, point{" "}
                    <a
                      href={`https://${domain.domainName}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-normal text-dash-text-body underline-offset-2 transition-colors hover:text-dash-text-strong hover:underline"
                    >
                      {domain.domainName}
                    </a>{" "}
                    at the values below from your registrar. You can disable this any time from the Domains page.
                  </>
                )}
              </p>
            </div>
            {domain.purchased && (
              <GlossyButton variant="black" type="button" onClick={() => setEditNameserversOpen(true)} className="shrink-0">
                Change
              </GlossyButton>
            )}
          </div>

          <hr className="border-dash-border" />
        </div>

        {/* Nameserver warning banner */}
        {domain.nameserverWarning && (
          <div className="flex items-center gap-3 rounded-[4px] bg-[#fff8f0] px-4 py-3 dark:bg-[#2a2118]">
            <AlertCircle className="size-5 shrink-0 text-[#e89c30]" />
            <span className="text-sm text-dash-text-body">{domain.nameserverWarning}</span>
          </div>
        )}

        {/* Nameservers table */}
        <div className="overflow-clip rounded-[2px] border-[0.5px] border-dash-border">
          {nameservers.map((ns, i) => (
            <div
              key={ns}
              className={`flex items-center justify-between bg-dash-bg-elevated px-3.5 py-2.5 ${
                i < nameservers.length - 1 ? "border-b-[0.5px] border-dash-border" : ""
              }`}
            >
              <span className="font-mono text-sm font-light leading-5 tracking-[-0.022px] text-dash-text-body">{ns}</span>
              <CopyButton text={ns} />
            </div>
          ))}
        </div>

        {domain.purchased && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-medium leading-5 tracking-[-0.026px] text-dash-text-body dark:text-white">
                  Transfer to another provider
                </h2>
                <p className="max-w-[720px] text-sm font-light leading-[1.3] text-dash-text-faded">
                  Move this domain to another registrar (for example from Brimble to Namecheap or GoDaddy). The transfer is finalized at the
                  destination provider.
                </p>
              </div>
              {domain.isExpired ? (
                <SimpleTooltip content="This domain can't be transferred because it has expired" side="left">
                  <span className="shrink-0">
                    <GlossyButton variant="black" type="button" disabled className="shrink-0 cursor-not-allowed opacity-50">
                      Start transfer
                    </GlossyButton>
                  </span>
                </SimpleTooltip>
              ) : (
                <GlossyButton variant="black" type="button" onClick={() => setTransferOutOpen(true)} className="shrink-0">
                  Start transfer
                </GlossyButton>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Nameservers Modal */}
      <EditNameserversModal
        open={editNameserversOpen}
        onOpenChange={setEditNameserversOpen}
        initialNameservers={nameservers}
        onSubmit={handleSaveNameservers}
        submitting={savingNameservers}
      />

      {/* Add DNS Record Modal */}
      <AddDnsRecordModal
        key={editingRecord ? `edit-${editingRecord.name}` : "add"}
        open={addRecordOpen}
        onOpenChange={(v) => {
          setAddRecordOpen(v);
          if (!v) setEditingRecord(null);
        }}
        domainName={domain.domainName}
        editingRecord={editingRecord}
        onSubmit={handleDnsSubmit}
        submitting={dnsSubmitting}
      />

      {/* Delete Domain Modal */}
      <Modal
        open={linkProjectOpen}
        onOpenChange={(open) => {
          setLinkProjectOpen(open);
          if (!open) {
            setLinkProjectSelected(null);
            setLinkProjectList([]);
          }
        }}
        width={420}
      >
        <ModalHeader title="Link to project" description="Select a project to connect this domain to" />
        <div className="scrollbar-subtle max-h-[280px] overflow-y-auto">
          {linkProjectLoading ? (
            <div className="flex h-20 items-center justify-center">
              <RefreshCw className="size-4 animate-spin text-dash-text-faded" />
            </div>
          ) : linkProjectList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <FolderOpen size={40} weight="fill" className="text-dash-text-faded/50 mb-2" />
              <span className="text-sm text-dash-text-faded">No projects found</span>
            </div>
          ) : (
            linkProjectList.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  if (linkProjectSelected !== project.id) {
                    haptics.selection();
                  }
                  setLinkProjectSelected(project.id);
                }}
                className={`flex w-full items-center gap-3 px-6 py-3 transition-colors hover:bg-dash-bg-elevated ${
                  linkProjectSelected === project.id ? "bg-dash-bg-elevated" : ""
                }`}
              >
                <img src="/icons/folder-open.svg" alt="" className="size-4 shrink-0" />
                <span className="flex-1 text-left text-sm text-dash-text-strong">{project.name}</span>
                {linkProjectSelected === project.id && (
                  <span className="flex size-[14px] items-center justify-center rounded-full bg-[#008cff] shadow-[0px_1px_2px_rgba(0,110,225,0.5),0px_0px_0px_1px_#006ee1]">
                    <span className="size-[6px] rounded-full bg-white" />
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <ModalFooter>
          <ModalCancelButton />
          <ModalContinueButton
            onClick={() => void handleLinkProject()}
            disabled={!linkProjectSelected || linkProjectSubmitting}
            loading={linkProjectSubmitting}
            loadingLabel="Linking..."
          >
            Link project
          </ModalContinueButton>
        </ModalFooter>
      </Modal>

      <WarningModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Domain"
        description={`Are you sure you want to delete "${domain.domainName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          // TODO: handle domain deletion
        }}
      />

      <Modal
        open={transferOutOpen}
        onOpenChange={(open) => {
          setTransferOutOpen(open);
          if (!open) {
            resetTransferModalState();
          }
        }}
        width={520}
      >
        <ModalHeader
          title={transferStep === "setup" ? "Transfer domain to another provider" : "EPP/Auth code"}
          description={
            transferStep === "setup"
              ? `Prepare transfer-out for ${domain.domainName}`
              : `Use this code when your new registrar asks for domain authorization`
          }
        />

        <div className="flex flex-col gap-4 px-6 py-5">
          {transferStep === "setup" ? (
            <>
              <div className="rounded-[8px] border border-dash-border bg-dash-bg-elevated px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs text-dash-text-faded">Current registrar</span>
                    <span className="text-sm font-medium text-dash-text-strong">{domain.registrar || "Brimble"}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs text-dash-text-faded">Domain</span>
                    <span className="text-sm font-medium text-dash-text-strong">{domain.domainName}</span>
                  </div>
                </div>
              </div>

              {canAutomaticallyTransfer ? (
                <>
                  <div className="rounded-[8px] border border-dash-border bg-dash-bg-elevated px-4 py-3">
                    <p className="text-sm font-medium text-dash-text-strong">Pre-transfer checklist</p>
                    <div className="mt-3 flex flex-col gap-3">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={transferChecklist.unlocked}
                          onChange={(e) => setTransferChecklist((prev) => ({ ...prev, unlocked: e.target.checked }))}
                          className="mt-0.5 size-4 rounded border-dash-border"
                        />
                        <span className="text-sm text-dash-text-body">
                          I have unlocked the domain for transfer (or I am ready to do so).
                        </span>
                      </label>
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={transferChecklist.registrantEmailReady}
                          onChange={(e) =>
                            setTransferChecklist((prev) => ({
                              ...prev,
                              registrantEmailReady: e.target.checked,
                            }))
                          }
                          className="mt-0.5 size-4 rounded border-dash-border"
                        />
                        <span className="text-sm text-dash-text-body">
                          I can access the registrant email to approve transfer verification emails.
                        </span>
                      </label>
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={transferChecklist.understandDnsImpact}
                          onChange={(e) =>
                            setTransferChecklist((prev) => ({
                              ...prev,
                              understandDnsImpact: e.target.checked,
                            }))
                          }
                          className="mt-0.5 size-4 rounded border-dash-border"
                        />
                        <span className="text-sm text-dash-text-body">
                          I understand DNS and renewal settings may be managed at the new registrar after transfer completes.
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-[8px] border border-dash-border bg-dash-bg px-4 py-3">
                    <p className="text-sm font-medium text-dash-text-strong">Authorization code (EPP)</p>
                    <p className="mt-1 text-xs leading-4 text-dash-text-faded">
                      Some providers ask for an EPP/Auth code during transfer. Click Continue to load the code for this domain.
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3 px-1 py-2">
                  <Warning size={18} weight="fill" className="mt-0.5 shrink-0 text-[#f5a623]" />
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-dash-text-strong">Automatic transfer is not available</p>
                    <p className="text-sm leading-5 text-dash-text-faded">
                      Automatic transfer isn't supported for this domain. Reach out at{" "}
                      <a href="mailto:hello@brimble.app" className="underline hover:text-dash-text-body">
                        hello@brimble.app
                      </a>{" "}
                      or use the support chat and a representative will help you complete the transfer.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="rounded-[8px] border border-dash-border bg-dash-bg-elevated px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs text-dash-text-faded">Domain</span>
                    <span className="text-sm font-medium text-dash-text-strong">{domain.domainName}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[8px] border border-dash-border bg-dash-bg-elevated px-4 py-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-dash-text-strong">EPP/Auth code</p>
                    <span className="rounded-[999px] border border-dash-border bg-dash-bg px-2 py-0.5 text-[11px] font-medium leading-4 text-dash-text-faded">
                      Keep private
                    </span>
                  </div>
                  {transferAuthCode ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setTransferAuthCodeRevealed((v) => !v)}
                        className="flex size-7 items-center justify-center rounded-[4px] text-dash-text-faded transition-colors hover:bg-dash-bg hover:text-dash-text-strong"
                        aria-label={transferAuthCodeRevealed ? "Hide EPP/Auth code" : "Show EPP/Auth code"}
                        aria-pressed={transferAuthCodeRevealed}
                      >
                        {transferAuthCodeRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                      <CopyButton text={transferAuthCode} />
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[6px] border-[0.5px] border-dash-border bg-gradient-to-b from-dash-bg to-dash-bg-elevated px-3 py-2.5 shadow-[inset_0px_1px_0px_rgba(255,255,255,0.03)]">
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-[#4879f8]" />
                    <code className="block min-w-0 break-all font-mono text-[13px] font-medium tracking-[0.01em] text-dash-text-strong">
                      {transferAuthCode
                        ? transferAuthCodeRevealed
                          ? transferAuthCode
                          : "•".repeat(Math.min(24, Math.max(8, transferAuthCode.length)))
                        : "Unavailable"}
                    </code>
                  </div>
                </div>

                <p className="mt-2.5 text-xs leading-4 text-dash-text-faded">
                  Paste this code at your new registrar when they request domain authorization.
                </p>
              </div>
            </>
          )}
        </div>

        <ModalFooter>
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ModalCancelButton />
              {transferStep === "setup" ? (
                <GlossyButton
                  variant="white"
                  onClick={() => {
                    const subject = encodeURIComponent(`Domain transfer support request: ${domain.domainName}`);
                    const body = encodeURIComponent(
                      `Hi Brimble team,\n\nI need help transferring ${domain.domainName} to another registrar.\nPlease share the required steps / EPP code.\n`,
                    );
                    window.location.href = `mailto:hello@brimble.app?subject=${subject}&body=${body}`;
                  }}
                  className="h-[34px] rounded-[4px] px-3.5 text-sm"
                >
                  Contact support
                </GlossyButton>
              ) : (
                <GlossyButton variant="white" onClick={() => setTransferStep("setup")} className="h-[34px] rounded-[4px] px-3.5 text-sm">
                  Back
                </GlossyButton>
              )}
            </div>
            {transferStep === "setup" && canAutomaticallyTransfer ? (
              <ModalContinueButton
                disabled={!canContinueTransfer}
                loading={transferAuthLoading}
                loadingLabel="Loading EPP code..."
                onClick={handleContinueTransfer}
              >
                Continue
              </ModalContinueButton>
            ) : transferStep === "auth-code" ? (
              <ModalContinueButton
                onClick={() => {
                  setTransferOutOpen(false);
                  resetTransferModalState();
                }}
              >
                Done
              </ModalContinueButton>
            ) : null}
          </div>
        </ModalFooter>
      </Modal>

      <WarningModal
        open={renewOpen}
        onOpenChange={setRenewOpen}
        title="Renew this domain?"
        description="Renewing the domain will restore DNS management after the registration is active again."
        confirmLabel={renewalUnitPrice > 0 ? `Pay $${totalRenewalPrice.toFixed(2)} now` : "Renew domain"}
        confirmLoadingLabel="Renewing domain..."
        confirmDisabled={!domain.domainId}
        onConfirm={async () => {
          try {
            const latestMethods = await getPaymentMethodsServerFn();
            const methods = Array.isArray(latestMethods) ? latestMethods : [];
            const latestDefaultMethod = methods.find((method: any) => method.is_default) ?? methods[0];
            if (!latestDefaultMethod?.id) {
              throw new Error("Add a payment method before renewing this domain.");
            }

            await renewDomain({
              data: {
                ...(workspace ? { workspace } : {}),
                domainId: domain.domainId,
                duration: renewDuration,
                autoRenew: renewAutoRenew,
              },
            });

            toast.success("Domain renewal submitted");
            window.location.reload();
          } catch (err: any) {
            toast.error(err?.message || "Failed to renew domain");
            throw err;
          }
        }}
      >
        <div className="flex flex-col gap-4 text-left">
          <div className="flex items-center justify-between rounded-[8px] border border-dash-border bg-dash-bg-elevated px-3 py-2">
            <span className="text-sm text-dash-text-faded">Domain</span>
            <span className="text-sm font-medium text-dash-text-strong">{domain.domainName}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-dash-text-faded">Renewal duration</label>
            <Dropdown
              value={String(renewDuration)}
              options={Array.from({ length: 10 }, (_, i) => ({
                id: String(i + 1),
                label: `${i + 1} year${i + 1 > 1 ? "s" : ""}${renewalUnitPrice > 0 ? ` — $${(renewalUnitPrice * (i + 1)).toFixed(2)}` : ""}`,
              }))}
              onChange={(val) => setRenewDuration(Number(val) || 1)}
              placeholder="Select duration..."
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-dash-text-body">Auto renewal</span>
              <span className="text-xs text-dash-text-faded">Renew automatically before expiration</span>
            </div>
            <ToggleSwitch checked={renewAutoRenew} onChange={setRenewAutoRenew} />
          </div>

          {renewalUnitPrice > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-dash-text-faded">Estimated total</span>
              <span className="font-medium text-dash-text-strong">${totalRenewalPrice.toFixed(2)}</span>
            </div>
          )}
        </div>
      </WarningModal>
    </div>
  );
}

function InfoColumn({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-sm font-light leading-[1.3] text-dash-text-faded">{label}</span>
      <span className="text-sm tracking-[-0.084px] text-dash-text-body">{value}</span>
    </div>
  );
}
