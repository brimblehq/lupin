import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, ChevronUp, Code2, Copy as CopyIcon, Eye, EyeOff, Lock, Search, X } from "lucide-react";
import { Info } from "@phosphor-icons/react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@brimble/ui";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { TabHeader } from "../../../components/shared/tab-header";
import { GlossyButton } from "../../../components/shared/glossy-button";
import { Tooltip } from "@/components/shared/tooltip";
import { Spinner } from "@/components/shared/spinner";
import type { EffectiveEnvironmentVariable, ProjectEnvironmentSnapshot, ProjectEnvironmentVariable } from "@/backend/environments";
import {
  addProjectEnvironmentVariablesServerFn,
  decryptProjectEnvironmentValuesServerFn,
  deleteProjectEnvironmentVariableServerFn,
  deleteEnvironmentVariableServerFn,
  getEnvironmentVariablesServerFn,
  getProjectEnvironmentDetailsServerFn,
  getProjectEnvironmentServerFn,
  listProjectEnvironmentTargetsServerFn,
  saveEnvironmentVariablesServerFn,
  updateEnvironmentVariableServerFn,
  updateProjectEnvironmentVariableServerFn,
} from "@/server/environments/actions";
import type { ProjectEnvironment } from "@/backend/environments";
import { redeployProjectServerFn } from "@/server/projects/actions";
import {
  canDeleteProjectEnv,
  canEditProjectEnvs,
  filterEnvironmentRows,
  formatEnvRowRelativeTime,
  fromEnvText,
  fromJsonText,
  getEnvironmentDescription,
  highlightEnvText,
  highlightJsonText,
  isDatabaseService,
  isNonEditableEnvName,
  sanitizeEnvironmentEntries,
  shouldShowEnvironmentTab,
  sortEnvironmentTargets,
  toEnvText,
  toJsonText,
  type EditableEnvRow,
  type RawEnvFormat,
  validateEnvironmentEntries,
} from "@/utils/project-environment";

const parentRoute = getRouteApi("/projects/$projectId");
const DEFAULT_TARGET = "PRODUCTION";

type LoaderData = {
  initialTarget: string;
  initialSnapshot: ProjectEnvironmentSnapshot;
  targets: string[];
};

export const Route = createFileRoute("/projects/$projectId/environment")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  loader: async ({ context }) => {
    const project = (context as any).project;
    const projectId = project?.id;

    const [snapshot, targets] = await Promise.all([
      (getProjectEnvironmentServerFn as any)({
        data: { projectId, target: DEFAULT_TARGET },
      }).catch(() => ({ envs: [] })),
      (listProjectEnvironmentTargetsServerFn as any)({
        data: { projectId },
      }).catch(() => [DEFAULT_TARGET]),
    ]);

    const data = {
      initialTarget: DEFAULT_TARGET,
      initialSnapshot: snapshot,
      targets: sortEnvironmentTargets(targets),
    } satisfies LoaderData;
    return data;
  },
  component: EnvironmentPage,
});

function createDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `draft-${Math.random().toString(36).slice(2)}`;
}

function HighlightedEditor({
  value,
  onChange,
  placeholder,
  format,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  format: RawEnvFormat;
  readOnly?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const syncScroll = useCallback(() => {
    if (!textareaRef.current || !preRef.current) {
      return;
    }

    preRef.current.scrollTop = textareaRef.current.scrollTop;
    preRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }, []);

  let highlighted = "";
  if (value) {
    if (format === "json") {
      highlighted = highlightJsonText(value);
    } else {
      highlighted = highlightEnvText(value);
    }
  }

  return (
    <div className="relative h-[260px] w-full rounded-[4px] border-[0.5px] border-[#d0d5dd] bg-dash-bg">
      <pre
        ref={preRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words px-3.5 py-3 font-mono text-sm leading-6 scrollbar-thin"
        dangerouslySetInnerHTML={{ __html: `${highlighted}\n` }}
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncScroll}
        readOnly={readOnly}
        placeholder={placeholder}
        spellCheck={false}
        className="relative h-full w-full resize-none bg-transparent px-3.5 py-3 font-mono text-sm leading-6 text-transparent caret-dash-text-strong outline-none placeholder:text-dash-text-extra-faded"
      />
    </div>
  );
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[4px] bg-[#f59e0b]/8 px-3.5 py-3">
      <Info className="mt-0.5 size-4 shrink-0 text-[#f59e0b]" weight="fill" />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-[#b37a10] dark:text-[#f59e0b]">Quick Tip</span>
        <span className="text-sm text-dash-text-body">{children}</span>
      </div>
    </div>
  );
}

function EnvRowsSkeleton() {
  return (
    <div className="px-4 pb-6 pt-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between border-b border-dash-border py-3 last:border-b-0">
          <div className="h-4 w-48 animate-pulse rounded bg-dash-bg-elevated" />
          <div className="h-4 w-32 animate-pulse rounded bg-dash-bg-elevated" />
        </div>
      ))}
    </div>
  );
}

function EnvAccordionRow({
  row,
  projectId,
  serviceType,
  isExpanded,
  isDecrypting,
  decryptedValue,
  canWrite,
  onUpdated,
  onDeleted,
  onRedeploy,
}: {
  row: ProjectEnvironmentVariable;
  projectId: string;
  serviceType?: string;
  isExpanded: boolean;
  isDecrypting: boolean;
  decryptedValue?: string;
  canWrite: boolean;
  onUpdated: (next: ProjectEnvironmentVariable) => void;
  onDeleted: (envId: string) => void;
  onRedeploy: (logId?: string) => Promise<void>;
}) {
  const updateEnv = useServerFn(updateProjectEnvironmentVariableServerFn as any) as (args: {
    data: { projectId: string; envId: string; name: string; value: string };
  }) => Promise<{ success: boolean }>;
  const deleteEnv = useServerFn(deleteProjectEnvironmentVariableServerFn as any) as (args: {
    data: { projectId: string; envId: string };
  }) => Promise<{ success: boolean }>;

  const haptics = useHaptics();
  const [name, setName] = useState(row.name);
  const [value, setValue] = useState(decryptedValue ?? row.value);
  const [showValue, setShowValue] = useState(false);
  const [valueCopied, setValueCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const authorName = row.isSystem ? "system" : row.user || "unknown";
  const authorDisplayName = row.isSystem ? "System" : row.user || "Unknown";

  useEffect(() => {
    setName(row.name);
    setShowValue(false);
  }, [row.id, row.name]);

  useEffect(() => {
    if (decryptedValue !== undefined) {
      setValue(decryptedValue);
    }
  }, [decryptedValue]);

  useEffect(() => {
    if (!isExpanded) {
      setShowValue(false);
    }
  }, [isExpanded]);

  const canEdit = canEditProjectEnvs(serviceType) && canWrite;
  const canDelete = canDeleteProjectEnv(serviceType) && canWrite;
  const databaseProject = isDatabaseService(serviceType);
  const disableNameInput = !canEdit || isNonEditableEnvName(row.name);
  const isDirty = name !== row.name || value !== row.value;

  function revealValue() {
    setShowValue((prev) => !prev);
  }

  async function saveRow() {
    if (!canEdit || saving) {
      return;
    }

    if (!name.trim() || !value.trim()) {
      toast.error("Please fill all the fields");
      return;
    }

    try {
      setSaving(true);
      await updateEnv({ data: { projectId, envId: row.id, name: name.trim(), value } });
      onUpdated({ ...row, name: name.trim(), value });
      toast("Variables updated successfully", {
        duration: 5000,
        action: {
          label: "Redeploy",
          onClick: () => {
            void onRedeploy();
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update variable");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow() {
    if (!canDelete || removing) {
      return;
    }

    try {
      setRemoving(true);
      await deleteEnv({ data: { projectId, envId: row.id } });
      onDeleted(row.id);
      toast("Variables deleted successfully", {
        duration: 5000,
        action: {
          label: "Redeploy",
          onClick: () => {
            void onRedeploy();
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete variable");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <AccordionItem value={row.id} className="border-b border-dash-border last:border-b-0 transition-none hover:bg-transparent">
      <AccordionTrigger className={`px-4 py-3 text-sm font-medium text-dash-text-strong hover:text-dash-text-strong [&[data-state=open]]:text-dash-text-strong ${isDecrypting ? "[&>svg]:hidden" : ""}`}>
        <span className="min-w-0 flex-1 truncate font-mono">{name}</span>
        <span className="hidden shrink-0 text-sm font-normal text-dash-text-faded sm:block">••••••••••••••••</span>
        {isDecrypting && <Spinner className="size-4 shrink-0" />}
      </AccordionTrigger>
      <AccordionContent className="text-sm text-dash-text-strong">
        <div className="bg-dash-bg-elevated px-4 pb-4 pt-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={disableNameInput}
              className="input-base input-focus h-[36px] w-full px-3 font-mono text-sm text-dash-text-strong disabled:opacity-60"
            />
            <div className="input-base input-focus-within relative flex h-[36px] items-center">
              <input
                type="text"
                autoComplete="off"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                readOnly={!canEdit}
                className={`h-full w-full bg-transparent px-3 pr-16 text-sm text-dash-text-strong outline-none ${!canEdit ? "cursor-default" : ""} ${!showValue ? "[text-security:disc] [-webkit-text-security:disc]" : ""}`}
              />
              <div className="absolute right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={revealValue}
                  className="shrink-0 text-dash-text-faded hover:text-dash-text-strong"
                >
                  {showValue ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(value);
                    haptics.light();
                    setValueCopied(true);
                    setTimeout(() => setValueCopied(false), 1500);
                  }}
                  className="shrink-0 text-dash-text-faded hover:text-dash-text-strong"
                >
                  {valueCopied ? <Check className="size-3.5 text-[#13d282]" /> : <CopyIcon className="size-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <Tooltip
                side="top"
                user={{
                  name: authorDisplayName,
                  role: row.isSystem ? "System" : "Environment variable author",
                  avatarUrl: row.avatar,
                  avatarFallback: authorDisplayName.slice(0, 2).toUpperCase(),
                }}
              >
                <span className="text-xs text-dash-text-faded">
                  {authorName} · {formatEnvRowRelativeTime(row.createdAt, row.updatedAt)}
                </span>
              </Tooltip>
            </div>

            <div className="flex items-center gap-2">
              {canEdit && (
                <GlossyButton
                  disabled={!isDirty || !name.trim() || !value.trim() || saving}
                  loading={saving}
                  loadingLabel="Saving..."
                  onClick={() => { void saveRow(); }}
                >
                  Save
                </GlossyButton>
              )}
              {canDelete && (
                <GlossyButton
                  variant="red"
                  disabled={removing}
                  loading={removing}
                  loadingLabel="Removing..."
                  onClick={() => { void deleteRow(); }}
                >
                  Remove
                </GlossyButton>
              )}
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function EnvLevelVarRow({
  variable,
  environmentId,
  workspace,
  canWrite,
  onUpdated,
  onDeleted,
}: {
  variable: EffectiveEnvironmentVariable;
  environmentId: string;
  workspace?: string;
  canWrite: boolean;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const haptics = useHaptics();
  const isInherited = variable.source === "inherited";
  const [name, setName] = useState(variable.name);
  const [value, setValue] = useState(variable.value);
  const [inheritable, setInheritable] = useState(variable.inheritable ?? false);
  const [showValue, setShowValue] = useState(false);
  const [valueCopied, setValueCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const updateVar = useServerFn(updateEnvironmentVariableServerFn as any) as (args: {
    data: { environmentId: string; variableId: string; workspace?: string; name: string; value: string; inheritable?: boolean };
  }) => Promise<{ success: boolean }>;
  const deleteVar = useServerFn(deleteEnvironmentVariableServerFn as any) as (args: {
    data: { environmentId: string; variableId: string; workspace?: string };
  }) => Promise<{ success: boolean }>;

  const isDirty = name !== variable.name || value !== variable.value || inheritable !== (variable.inheritable ?? false);

  async function saveRow() {
    if (saving || !variable.id) return;
    if (!name.trim() || !value.trim()) {
      toast.error("Please fill all the fields");
      return;
    }
    try {
      setSaving(true);
      await updateVar({
        data: { environmentId, variableId: variable.id, workspace, name: name.trim(), value, inheritable },
      });
      toast.success("Variable updated");
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update variable");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow() {
    if (removing || !variable.id) return;
    try {
      setRemoving(true);
      await deleteVar({ data: { environmentId, variableId: variable.id, workspace } });
      toast.success("Variable deleted");
      onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete variable");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="border-b border-dash-border last:border-b-0">
      <button
        type="button"
        onClick={() => !isInherited && setExpanded((prev) => !prev)}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm ${isInherited ? "cursor-default" : "hover:bg-dash-bg-elevated/50"}`}
      >
        <span className="min-w-0 flex-1 truncate font-mono text-dash-text-strong">{variable.name}</span>
        {isInherited ? (
          <span className="shrink-0 rounded-full bg-dash-bg-elevated px-2 py-0.5 text-xs text-dash-text-faded">
            Inherited{variable.sourceEnvironment ? ` from ${variable.sourceEnvironment}` : ""}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-[#4879f8]/10 px-2 py-0.5 text-xs text-[#4879f8]">Own</span>
        )}
        <span className="hidden shrink-0 text-sm font-normal text-dash-text-faded sm:block">
          {isInherited ? "" : "••••••••••••••••"}
        </span>
        {!isInherited && (
          expanded ? <ChevronUp className="size-4 shrink-0 text-dash-text-faded" /> : <ChevronDown className="size-4 shrink-0 text-dash-text-faded" />
        )}
      </button>

      {expanded && !isInherited && (
        <div className="bg-dash-bg-elevated px-4 pb-4 pt-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canWrite}
              className="input-base input-focus h-[36px] w-full px-3 font-mono text-sm text-dash-text-strong disabled:opacity-60"
            />
            <div className="input-base input-focus-within relative flex h-[36px] items-center">
              <input
                type="text"
                autoComplete="off"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                readOnly={!canWrite}
                className={`h-full w-full bg-transparent px-3 pr-16 text-sm text-dash-text-strong outline-none ${!canWrite ? "cursor-default" : ""} ${!showValue ? "[text-security:disc] [-webkit-text-security:disc]" : ""}`}
              />
              <div className="absolute right-2 flex items-center gap-1.5">
                <button type="button" onClick={() => setShowValue((p) => !p)} className="shrink-0 text-dash-text-faded hover:text-dash-text-strong">
                  {showValue ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(value);
                    haptics.light();
                    setValueCopied(true);
                    setTimeout(() => setValueCopied(false), 1500);
                  }}
                  className="shrink-0 text-dash-text-faded hover:text-dash-text-strong"
                >
                  {valueCopied ? <Check className="size-3.5 text-[#13d282]" /> : <CopyIcon className="size-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-dash-text-faded">
              <input
                type="checkbox"
                checked={inheritable}
                onChange={(e) => setInheritable(e.target.checked)}
                disabled={!canWrite}
                className="size-3.5 rounded border-dash-border accent-[#4879f8]"
              />
              Inheritable by child environments
            </label>
            {canWrite && (
              <div className="flex items-center gap-2">
                <GlossyButton
                  disabled={!isDirty || !name.trim() || !value.trim() || saving}
                  loading={saving}
                  loadingLabel="Saving..."
                  onClick={() => { void saveRow(); }}
                >
                  Save
                </GlossyButton>
                <GlossyButton
                  variant="red"
                  disabled={removing}
                  loading={removing}
                  loadingLabel="Removing..."
                  onClick={() => { void deleteRow(); }}
                >
                  Remove
                </GlossyButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EnvironmentLevelVarsSection({
  environmentId,
  workspace,
  canWrite,
}: {
  environmentId: string;
  workspace?: string;
  canWrite: boolean;
}) {
  const [envVars, setEnvVars] = useState<EffectiveEnvironmentVariable[]>([]);
  const [envName, setEnvName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [draftRows, setDraftRows] = useState<Array<{ id: string; name: string; value: string; inheritable: boolean }>>([]);
  const [savingDrafts, setSavingDrafts] = useState(false);

  const getEnvVars = useServerFn(getEnvironmentVariablesServerFn as any) as (args: {
    data: { environmentId: string; workspace?: string };
  }) => Promise<EffectiveEnvironmentVariable[]>;
  const saveEnvVars = useServerFn(saveEnvironmentVariablesServerFn as any) as (args: {
    data: { environmentId: string; workspace?: string; variables: Array<{ name: string; value: string; inheritable?: boolean }> };
  }) => Promise<EffectiveEnvironmentVariable[]>;
  const getEnvDetails = useServerFn(getProjectEnvironmentDetailsServerFn as any) as (args: {
    data: { environmentId: string; workspace?: string };
  }) => Promise<ProjectEnvironment>;

  async function fetchVars() {
    try {
      setLoading(true);
      const [vars, details] = await Promise.all([
        getEnvVars({ data: { environmentId, workspace } }),
        getEnvDetails({ data: { environmentId, workspace } }).catch(() => null),
      ]);
      setEnvVars(Array.isArray(vars) ? vars : []);
      if (details?.name) setEnvName(details.name);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchVars();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environmentId]);

  function addDraftRow() {
    setDraftRows((prev) => [...prev, { id: createDraftId(), name: "", value: "", inheritable: false }]);
  }

  function updateDraftRow(id: string, field: "name" | "value" | "inheritable", val: string | boolean) {
    setDraftRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: val } : row)));
  }

  function removeDraftRow(id: string) {
    setDraftRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleSaveDrafts() {
    if (savingDrafts) return;
    const nonEmpty = draftRows.filter((r) => r.name.trim() && r.value.trim());
    if (nonEmpty.length === 0) {
      toast.error("Add at least one variable with name and value");
      return;
    }
    try {
      setSavingDrafts(true);
      await saveEnvVars({
        data: {
          environmentId,
          workspace,
          variables: nonEmpty.map((r) => ({ name: r.name.trim(), value: r.value, inheritable: r.inheritable })),
        },
      });
      setDraftRows([]);
      toast.success("Environment variables saved");
      void fetchVars();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save variables");
    } finally {
      setSavingDrafts(false);
    }
  }

  const inheritedVars = envVars.filter((v) => v.source === "inherited");

  return (
    <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
      <div className="flex items-center gap-3 border-b-[0.5px] border-dash-border px-4 py-3.5">
        <h3 className="text-sm font-medium text-dash-text-strong">Environment Variables</h3>
        {envName && (
          <span className="rounded-full bg-[#4879f8]/10 px-2.5 py-0.5 text-xs font-medium text-[#4879f8]">
            {envName}
          </span>
        )}
        <span className="text-xs text-dash-text-faded">{envVars.length} variable{envVars.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="border-b-[0.5px] border-dash-border px-4 py-3">
        <p className="text-xs text-dash-text-faded">
          Shared across all projects in this environment.{" "}
          {inheritedVars.length > 0 ? "Inherited variables come from the parent environment and are read-only." : ""}
        </p>
      </div>

      {loading ? (
        <EnvRowsSkeleton />
      ) : (
        <>
          {envVars.length === 0 && draftRows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Lock className="mb-3 size-7 text-dash-text-extra-faded opacity-40" />
              <h3 className="mb-1 text-sm font-medium text-dash-text-strong">No environment-level variables</h3>
              <p className="max-w-[360px] text-sm text-dash-text-faded">
                Add variables that are shared across all projects in this environment.
              </p>
            </div>
          )}

          {envVars.length > 0 && (
            <div>
              {envVars.map((v) => (
                <EnvLevelVarRow
                  key={v.id ?? v.name}
                  variable={v}
                  environmentId={environmentId}
                  workspace={workspace}
                  canWrite={canWrite}
                  onUpdated={() => void fetchVars()}
                  onDeleted={() => void fetchVars()}
                />
              ))}
            </div>
          )}

          {canWrite && draftRows.length > 0 && (
            <div className="border-t border-dash-border px-4 py-4">
              <div className="flex flex-col gap-2">
                {draftRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => updateDraftRow(row.id, "name", e.target.value)}
                      placeholder="VARIABLE_NAME"
                      className="input-base input-focus h-[36px] w-full px-3 font-mono text-sm text-dash-text-strong placeholder:text-dash-text-extra-faded"
                    />
                    <input
                      type="text"
                      autoComplete="off"
                      value={row.value}
                      onChange={(e) => updateDraftRow(row.id, "value", e.target.value)}
                      placeholder="value"
                      className="input-base input-focus h-[36px] w-full px-3 text-sm text-dash-text-strong [text-security:disc] [-webkit-text-security:disc] placeholder:text-dash-text-extra-faded placeholder:[-webkit-text-security:none]"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-dash-text-faded" title="Inheritable by child environments">
                      <input
                        type="checkbox"
                        checked={row.inheritable}
                        onChange={(e) => updateDraftRow(row.id, "inheritable", e.target.checked)}
                        className="size-3.5 rounded border-dash-border accent-[#4879f8]"
                      />
                      Inherit
                    </label>
                    <button
                      type="button"
                      onClick={() => removeDraftRow(row.id)}
                      className="flex h-[36px] w-[36px] items-center justify-center rounded-[4px] text-dash-text-faded hover:text-red-400"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button type="button" onClick={addDraftRow} className="text-sm text-dash-text-faded hover:text-dash-text-strong">
                  + Add Another
                </button>
                <GlossyButton
                  disabled={savingDrafts}
                  loading={savingDrafts}
                  loadingLabel="Saving..."
                  onClick={() => { void handleSaveDrafts(); }}
                >
                  Save
                </GlossyButton>
              </div>
            </div>
          )}

          {canWrite && draftRows.length === 0 && (
            <div className="border-t border-dash-border px-4 py-3">
              <button type="button" onClick={addDraftRow} className="text-sm text-dash-text-faded hover:text-dash-text-strong">
                + Add Variable
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EnvironmentPage() {
  const { project, workspace } = parentRoute.useLoaderData() as any;
  const { initialTarget, initialSnapshot, targets: initialTargets } = Route.useLoaderData() as LoaderData;
  const { canWrite } = useWorkspaceRole();

  const projectId = project?.id as string | undefined;
  const serviceType = project?.serviceType as string | undefined;
  const framework = project?.framework as string | undefined;
  const projectEnvironmentId = project?.projectEnvironmentId as string | null | undefined;
  const canEdit = canEditProjectEnvs(serviceType) && canWrite;
  const databaseProject = isDatabaseService(serviceType);
  const envTabSupported = shouldShowEnvironmentTab(framework);

  const getEnvSnapshot = useServerFn(getProjectEnvironmentServerFn as any) as (args: {
    data: { projectId: string; target?: string };
  }) => Promise<ProjectEnvironmentSnapshot>;
  const listTargets = useServerFn(listProjectEnvironmentTargetsServerFn as any) as (args: {
    data: { projectId: string };
  }) => Promise<string[]>;
  const addEnvs = useServerFn(addProjectEnvironmentVariablesServerFn as any) as (args: {
    data: { projectId: string; target?: string; editor?: boolean; environments: Array<{ name: string; value: string }> };
  }) => Promise<ProjectEnvironmentSnapshot | null>;
  const decryptValues = useServerFn(decryptProjectEnvironmentValuesServerFn as any) as (args: {
    data: { environments: Array<{ name: string; value: string }> };
  }) => Promise<Array<{ name: string; value: string }>>;
  const redeployProject = useServerFn(redeployProjectServerFn as any) as (args: {
    data: { projectId: string; workspace?: string; logId?: string; startOnly?: boolean };
  }) => Promise<any>;

  const [search, setSearch] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(initialTarget);
  const [, setTargets] = useState(sortEnvironmentTargets(initialTargets));
  const [snapshotsByTarget, setSnapshotsByTarget] = useState<Record<string, ProjectEnvironmentSnapshot>>({
    [initialTarget]: initialSnapshot,
  });
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const [rawFormat, setRawFormat] = useState<RawEnvFormat>("env");
  const [rawText, setRawText] = useState("");
  const [rawLoading, setRawLoading] = useState(false);
  const [rawDirty, setRawDirty] = useState(false);
  const [savingRaw, setSavingRaw] = useState(false);
  const [draftRows, setDraftRows] = useState<EditableEnvRow[]>([{ id: createDraftId(), name: "", value: "" }]);
  const [savingDraftRows, setSavingDraftRows] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | undefined>(undefined);
  const [decryptingRowId, setDecryptingRowId] = useState<string | undefined>(undefined);
  const [decryptedCache, setDecryptedCache] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelectedTarget(initialTarget);
    setTargets(sortEnvironmentTargets(initialTargets));
    setSnapshotsByTarget({ [initialTarget]: initialSnapshot });
    setRawMode(false);
    setSearch("");
    setDecryptedCache({});
    setExpandedRowId(undefined);
  }, [initialTarget, initialSnapshot, initialTargets]);

  useEffect(() => {
    setDraftRows([{ id: createDraftId(), name: "", value: "" }]);
  }, [selectedTarget]);

  const currentSnapshot = snapshotsByTarget[selectedTarget] ?? { envs: [], deployId: undefined };
  const filteredRows = useMemo(() => filterEnvironmentRows(currentSnapshot.envs, search), [currentSnapshot.envs, search]);

  async function refreshTargets() {
    if (!projectId) {
      return;
    }

    try {
      const nextTargets = await listTargets({ data: { projectId } });
      setTargets(sortEnvironmentTargets(nextTargets));
    } catch {
      // Best effort refresh.
    }
  }

  async function loadEnvironmentTarget(target: string) {
    if (!projectId) {
      return;
    }

    try {
      setLoadingTarget(true);
      const snapshot = await getEnvSnapshot({ data: { projectId, target } });
      setSnapshotsByTarget((prev) => ({ ...prev, [target]: snapshot }));
      setDecryptedCache({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load environment variables");
    } finally {
      setLoadingTarget(false);
    }
  }

  async function handleRedeploy(logId?: string) {
    if (!projectId) {
      return;
    }

    try {
      await redeployProject({
        data: {
          projectId,
          workspace,
          logId,
          startOnly: true,
        },
      });
      toast.success("Redeploy started");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start redeploy");
    }
  }

  function addDraftRow() {
    setDraftRows((prev) => [...prev, { id: createDraftId(), name: "", value: "" }]);
  }

  function updateDraftRow(id: string, field: "name" | "value", nextValue: string) {
    setDraftRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: nextValue } : row)));
  }

  function removeDraftRow(id: string) {
    setDraftRows((prev) => {
      const next = prev.filter((row) => row.id !== id);
      if (next.length > 0) {
        return next;
      }
      return [{ id: createDraftId(), name: "", value: "" }];
    });
  }

  async function handleSaveDraftRows() {
    if (!projectId || savingDraftRows) {
      return;
    }

    const sanitized = sanitizeEnvironmentEntries(draftRows);
    const nonEmpty = sanitized.filter((row) => row.name || row.value);
    const validation = validateEnvironmentEntries(nonEmpty);

    if (!validation.valid) {
      toast.error(validation.message || "Invalid environment variables");
      return;
    }

    if (nonEmpty.length === 0) {
      toast.error("Add at least one variable before saving");
      return;
    }

    try {
      setSavingDraftRows(true);
      await addEnvs({
        data: {
          projectId,
          target: selectedTarget,
          environments: nonEmpty,
        },
      });
      await loadEnvironmentTarget(selectedTarget);

      setDraftRows([{ id: createDraftId(), name: "", value: "" }]);
      void refreshTargets();
      toast("Variables updated successfully", {
        duration: 5000,
        action: {
          label: "Redeploy",
          onClick: () => {
            void handleRedeploy(currentSnapshot.deployId);
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save environment variables");
    } finally {
      setSavingDraftRows(false);
    }
  }

  async function openRawEditor() {
    if (rawLoading) {
      return;
    }

    try {
      setRawLoading(true);
      const decrypted = await decryptValues({
        data: {
          environments: currentSnapshot.envs.map((env) => ({ name: env.name, value: env.value })),
        },
      });

      const decryptedMap = new Map(decrypted.map((item) => [item.name, item.value]));
      const merged = currentSnapshot.envs.map((env) => ({
        id: env.id,
        name: env.name,
        value: decryptedMap.get(env.name) ?? env.value,
      }));

      if (rawFormat === "json") {
        setRawText(toJsonText(merged));
      } else {
        setRawText(toEnvText(merged));
      }

      setRawMode(true);
      setRawDirty(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open raw editor");
    } finally {
      setRawLoading(false);
    }
  }

  function closeRawEditor() {
    setRawMode(false);
    setRawDirty(false);
  }

  function handleRawFormatChange(next: RawEnvFormat) {
    if (next === rawFormat) {
      return;
    }

    let parsed: EditableEnvRow[] = [];
    if (rawFormat === "json") {
      parsed = fromJsonText(rawText);
    } else {
      parsed = fromEnvText(rawText);
    }

    setRawFormat(next);

    if (parsed.length === 0) {
      if (next === "json") {
        setRawText("{\n  \n}");
      } else {
        setRawText("");
      }
      return;
    }

    if (next === "json") {
      setRawText(toJsonText(parsed));
    } else {
      setRawText(toEnvText(parsed));
    }
  }

  async function saveRawEditor() {
    if (!projectId || savingRaw || databaseProject) {
      return;
    }

    let parsedRows: EditableEnvRow[] = [];
    if (rawFormat === "json") {
      parsedRows = fromJsonText(rawText);
      if (rawText.trim() && parsedRows.length === 0) {
        toast.error("Invalid JSON format");
        return;
      }
    } else {
      parsedRows = fromEnvText(rawText);
    }

    const sanitized = sanitizeEnvironmentEntries(parsedRows);
    const validation = validateEnvironmentEntries(sanitized);
    if (!validation.valid) {
      toast.error(validation.message || "Invalid environment variables");
      return;
    }

    try {
      setSavingRaw(true);
      await addEnvs({
        data: {
          projectId,
          target: selectedTarget,
          editor: true,
          environments: sanitized,
        },
      });
      await loadEnvironmentTarget(selectedTarget);

      setRawMode(false);
      setRawDirty(false);
      void refreshTargets();
      toast("Variables updated successfully", {
        duration: 5000,
        action: {
          label: "Redeploy",
          onClick: () => {
            void handleRedeploy(currentSnapshot.deployId);
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update variables");
    } finally {
      setSavingRaw(false);
    }
  }

  function patchCurrentSnapshot(mutator: (current: ProjectEnvironmentSnapshot) => ProjectEnvironmentSnapshot) {
    setSnapshotsByTarget((prev) => {
      const current = prev[selectedTarget] ?? { envs: [], deployId: undefined };
      return {
        ...prev,
        [selectedTarget]: mutator(current),
      };
    });
  }

  async function refreshCurrentTarget() {
    await loadEnvironmentTarget(selectedTarget);
  }

  async function handleAccordionChange(nextValue: string) {
    if (!nextValue) {
      setExpandedRowId(undefined);
      return;
    }

    if (decryptedCache[nextValue] !== undefined) {
      setExpandedRowId(nextValue);
      return;
    }

    const row = currentSnapshot.envs.find((env) => env.id === nextValue);
    if (!row) {
      setExpandedRowId(nextValue);
      return;
    }

    try {
      setDecryptingRowId(nextValue);
      const decrypted = await decryptValues({
        data: { environments: [{ name: row.name, value: row.value }] },
      });
      const first = decrypted[0];
      const decryptedValue = first && typeof first.value === "string" ? first.value : row.value;

      setDecryptedCache((prev) => ({ ...prev, [nextValue]: decryptedValue }));
      setExpandedRowId(nextValue);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to decrypt value");
    } finally {
      setDecryptingRowId(undefined);
    }
  }

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4 py-8">
      <TabHeader title="Environment Variables">
        {getEnvironmentDescription(canEdit)}{" "}
        <a href="#" className="text-[#4879f8] underline">Learn more</a>
      </TabHeader>

      <hr className="border-dash-border" />

      {envTabSupported && projectEnvironmentId && (
        <EnvironmentLevelVarsSection
          environmentId={projectEnvironmentId}
          workspace={workspace}
          canWrite={canWrite}
        />
      )}

      {!envTabSupported && (
        <div className="rounded-[4px] border-[0.5px] border-dash-border px-4 py-5 text-sm text-dash-text-faded">
          Environment variables are not available for HTML projects.
        </div>
      )}

      {envTabSupported && (
        <>
          {databaseProject && (
            <InfoBanner>
              Connect to your database service using a private connection in the same region.
            </InfoBanner>
          )}

          <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
            <div className="flex flex-wrap items-center gap-3 border-b-[0.5px] border-dash-border px-3.5 py-3.5">
              <div className="flex min-w-[220px] flex-1 items-center gap-2">
                <Search className="size-5 shrink-0 text-dash-text-extra-faded" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search ENVs created..."
                  className="w-full bg-transparent text-sm text-dash-text-strong outline-none placeholder:text-dash-text-extra-faded"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (rawMode) {
                    closeRawEditor();
                  } else {
                    void openRawEditor();
                  }
                }}
                disabled={rawLoading}
                className={`flex h-[34px] items-center gap-2 rounded-[4px] border px-3.5 text-sm font-medium transition-colors ${
                  rawMode
                    ? "border-[#3964d5] bg-[#4879f8]/10 text-[#4879f8]"
                    : "border-[#e9ebec] text-dash-text-strong hover:bg-dash-bg-elevated"
                } disabled:opacity-60`}
              >
                {rawLoading ? <Spinner size="size-3.5" /> : <Code2 className="size-4" />}
                Raw Editor
              </button>

            </div>

            {rawMode ? (
              <div className="px-3.5 pb-6 pt-5">
                <div className="mb-3 flex w-fit items-center gap-1 rounded-[4px] border-[0.5px] border-dash-border p-0.5">
                  <button
                    type="button"
                    onClick={() => handleRawFormatChange("env")}
                    className={`rounded-[3px] px-3 py-1 text-xs font-medium ${rawFormat === "env" ? "bg-dash-bg-elevated text-dash-text-strong" : "text-dash-text-faded"}`}
                  >
                    .env
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRawFormatChange("json")}
                    className={`rounded-[3px] px-3 py-1 text-xs font-medium ${rawFormat === "json" ? "bg-dash-bg-elevated text-dash-text-strong" : "text-dash-text-faded"}`}
                  >
                    JSON
                  </button>
                </div>

                <HighlightedEditor
                  value={rawText}
                  onChange={(next) => {
                    setRawText(next);
                    setRawDirty(true);
                  }}
                  format={rawFormat}
                  readOnly={databaseProject || !canWrite}
                  placeholder={rawFormat === "json" ? '{\n  "API_KEY": "value"\n}' : 'API_KEY=value'}
                />

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeRawEditor}
                    className="rounded-[4px] border border-dash-border px-3 py-1.5 text-sm text-dash-text-body hover:bg-dash-bg-elevated"
                  >
                    Cancel
                  </button>
                  {!databaseProject && canWrite && (
                    <GlossyButton
                      disabled={!rawDirty || savingRaw}
                      loading={savingRaw}
                      loadingLabel="Updating..."
                      onClick={() => {
                        void saveRawEditor();
                      }}
                    >
                      Update
                    </GlossyButton>
                  )}
                </div>
              </div>
            ) : (
              <>
                {canEdit && (
                  <div className="border-b-[0.5px] border-dash-border px-4 py-4">
                    <div className="flex flex-col gap-2">
                      {draftRows.map((row) => (
                        <div key={row.id} className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_1fr_auto]">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(event) => updateDraftRow(row.id, "name", event.target.value)}
                            placeholder="APP_ENV"
                            className="input-base input-focus h-[36px] w-full px-3 font-mono text-sm text-dash-text-strong placeholder:text-dash-text-extra-faded"
                          />
                          <input
                            type="text"
                            autoComplete="off"
                            value={row.value}
                            onChange={(event) => updateDraftRow(row.id, "value", event.target.value)}
                            placeholder="value"
                            className="input-base input-focus h-[36px] w-full px-3 text-sm text-dash-text-strong [text-security:disc] [-webkit-text-security:disc] placeholder:text-dash-text-extra-faded placeholder:[-webkit-text-security:none]"
                          />
                          <button
                            type="button"
                            onClick={() => removeDraftRow(row.id)}
                            disabled={draftRows.length === 1}
                            className="flex h-[36px] w-[36px] items-center justify-center rounded-[4px] text-dash-text-faded hover:text-red-400 disabled:opacity-30"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={addDraftRow}
                        className="text-sm text-dash-text-faded hover:text-dash-text-strong"
                      >
                        + Add Another
                      </button>
                      <GlossyButton
                        disabled={savingDraftRows}
                        loading={savingDraftRows}
                        loadingLabel="Saving..."
                        onClick={() => {
                          void handleSaveDraftRows();
                        }}
                      >
                        Save
                      </GlossyButton>
                    </div>
                  </div>
                )}

                {loadingTarget ? (
                  <EnvRowsSkeleton />
                ) : (
                  <div className="pb-2">
                    {filteredRows.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Lock className="mb-3 size-8 text-dash-text-extra-faded opacity-40" />
                        <h3 className="mb-1 text-sm font-medium text-dash-text-strong">
                          {currentSnapshot.envs.length === 0 ? "No environment variables" : "No matching variables"}
                        </h3>
                        <p className="max-w-[360px] text-sm text-dash-text-faded">
                          {currentSnapshot.envs.length === 0
                            ? databaseProject
                              ? "No credentials are available for this deployment target yet."
                              : "Add environment variables to securely store API keys, database URLs, and other secrets."
                            : `No variables matching "${search}".`}
                        </p>
                      </div>
                    )}

                    {filteredRows.length > 0 && (
                      <Accordion
                        type="single"
                        collapsible
                        value={expandedRowId ?? ""}
                        onValueChange={(val: string) => { void handleAccordionChange(val); }}
                      >
                        {filteredRows.map((row) => (
                          <EnvAccordionRow
                            key={row.id}
                            row={row}
                            projectId={projectId || ""}
                            serviceType={serviceType}
                            isExpanded={expandedRowId === row.id}
                            isDecrypting={decryptingRowId === row.id}
                            decryptedValue={decryptedCache[row.id]}
                            canWrite={canWrite}
                            onRedeploy={handleRedeploy}
                            onUpdated={() => {
                              void refreshCurrentTarget();
                            }}
                            onDeleted={(envId) => {
                              setExpandedRowId(undefined);
                              patchCurrentSnapshot((current) => ({
                                ...current,
                                envs: current.envs.filter((item) => item.id !== envId),
                              }));
                              void refreshCurrentTarget();
                            }}
                          />
                        ))}
                      </Accordion>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
