import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, ChevronUp, Code2, Copy as CopyIcon, Lock, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Info, Eye, EyeSlash } from "@phosphor-icons/react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@brimble/ui";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { TabHeader } from "../../../components/shared/tab-header";
import { EnvironmentPending } from "@/components/shared/route-pending";
import { GlossyButton } from "../../../components/shared/glossy-button";
import { Tooltip, SimpleTooltip } from "@/components/shared/tooltip";
import { Spinner } from "@/components/shared/spinner";
import type { EffectiveEnvironmentVariable, ProjectEnvironmentSnapshot, ProjectEnvironmentVariable } from "@/backend/environments";
import {
  addProjectEnvironmentVariablesServerFn,
  decryptProjectEnvironmentValuesServerFn,
  deleteProjectEnvironmentVariableServerFn,
  deleteEnvironmentVariableServerFn,
  getEnvironmentVariablesServerFn,
  getProjectEnvironmentServerFn,
  listProjectEnvironmentTargetsServerFn,
  saveEnvironmentVariablesServerFn,
  updateEnvironmentVariableServerFn,
  updateProjectEnvironmentVariableServerFn,
} from "@/server/environments/actions";
import { redeployProjectServerFn, listHomeProjectsServerFn } from "@/server/projects/actions";
import {
  formatEnvRowRelativeTime,
  fromEnvText,
  fromJsonText,
  getEnvironmentDescription,
  highlightEnvText,
  highlightJsonText,
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
import { isDatabaseProject as getIsDatabaseProject } from "@/utils/project-capabilities";
import { markDeploymentHistoryForRefresh } from "@/utils/deployment-history-refresh";
import {
  hasReferenceTrigger,
  highlightReferences,
  type ReferenceValidationContext,
} from "@/utils/env-references";
import type { ProjectOption, ProjectVarOption, SharedVarOption } from "@/components/project/env-reference-autocomplete";
import { ReferenceHighlightInput } from "@/components/project/reference-highlight-input";
import { ReferenceCountBadge, ReferenceWarnings } from "@/components/project/env-reference-widgets";

const parentRoute = getRouteApi("/projects/$projectId");
const DEFAULT_TARGET = "PRODUCTION";

function isProjectLevelVariable(row: ProjectEnvironmentVariable): boolean {
  return Boolean(row.envId) && row.source !== "environment";
}

type SharedSource = "own" | "inherited";

type EnvRowMeta = {
  isShared: boolean;
  encrypted: boolean;
  sharedVarId?: string;
  sharedSource?: SharedSource;
  sharedSourceEnvironment?: string;
};

type MergedEnvRow = ProjectEnvironmentVariable & {
  meta: EnvRowMeta;
};

function getEnvActivityLabel(input: { authoredAtLabel: string; isShared?: boolean; sharedSource?: SharedSource }): string {
  const { authoredAtLabel, isShared, sharedSource } = input;
  if (authoredAtLabel !== "Unknown") {
    return authoredAtLabel;
  }
  if (!isShared) {
    return "Unknown";
  }
  if (sharedSource === "inherited") {
    return "Inherited variable";
  }
  return "Shared variable";
}

type LoaderData = {
  initialTarget: string;
  initialSnapshot: ProjectEnvironmentSnapshot;
  targets: string[];
  initialEnvLevelVars: EffectiveEnvironmentVariable[];
  initialEnvLevelVarsKey: string | null;
};

export const Route = createFileRoute("/projects/$projectId/environment")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  loader: async ({ context }) => {
    const project = (context as any).project;
    const projectId = project?.id;
    const workspace = (context as any).workspace as string | undefined;
    const projectEnvironmentId = project?.projectEnvironmentId as string | null | undefined;
    const inheritEnvironmentVars = project?.inheritEnvironmentVars as boolean | undefined;
    const sharedLayerEnabled = Boolean(projectEnvironmentId) && inheritEnvironmentVars !== false;

    const [snapshot, targets, envLevelResult] = await Promise.all([
      (getProjectEnvironmentServerFn as any)({
        data: { projectId, target: DEFAULT_TARGET },
      }).catch(() => ({ envs: [] })),
      (listProjectEnvironmentTargetsServerFn as any)({
        data: { projectId },
      }).catch(() => [DEFAULT_TARGET]),
      sharedLayerEnabled && projectEnvironmentId
        ? (getEnvironmentVariablesServerFn as any)({
            data: { environmentId: projectEnvironmentId, workspace },
          })
            .then((vars: unknown) => ({
              loaded: true,
              vars: Array.isArray(vars) ? (vars as EffectiveEnvironmentVariable[]) : [],
            }))
            .catch(() => ({
              loaded: false,
              vars: [] as EffectiveEnvironmentVariable[],
            }))
        : Promise.resolve({
            loaded: true,
            vars: [] as EffectiveEnvironmentVariable[],
          }),
    ]);

    const data = {
      initialTarget: DEFAULT_TARGET,
      initialSnapshot: snapshot,
      targets: sortEnvironmentTargets(targets),
      initialEnvLevelVars: envLevelResult.vars,
      initialEnvLevelVarsKey:
        sharedLayerEnabled && projectEnvironmentId && envLevelResult.loaded
          ? `${projectEnvironmentId}:${workspace ?? ""}`
          : null,
    } satisfies LoaderData;
    return data;
  },
  component: EnvironmentPage,
  pendingComponent: EnvironmentPending,
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
    <div className="relative h-[420px] w-full rounded-[4px] border-[0.5px] border-[#d0d5dd] bg-dash-bg">
      <pre
        ref={preRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words px-3.5 py-3 font-mono text-xs leading-5 scrollbar-hidden"
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
        className="scrollbar-hidden relative h-full w-full resize-none overflow-auto bg-transparent px-3.5 py-3 font-mono text-xs leading-5 text-transparent caret-dash-text-strong outline-none placeholder:text-dash-text-extra-faded"
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
  databaseProject,
  isExpanded,
  isDecrypting,
  decryptedValue,
  canWrite,
  isShared,
  sharedVarId,
  sharedSource,
  sharedSourceEnvironment,
  sharedEncrypted,
  environmentId,
  workspace,
  selectedTarget,
  onUpdated,
  onDeleted,
  onRedeploy,
}: {
  row: ProjectEnvironmentVariable;
  projectId: string;
  databaseProject: boolean;
  isExpanded: boolean;
  isDecrypting: boolean;
  decryptedValue?: string;
  canWrite: boolean;
  isShared?: boolean;
  sharedVarId?: string;
  sharedSource?: SharedSource;
  sharedSourceEnvironment?: string;
  sharedEncrypted?: boolean;
  environmentId?: string;
  workspace?: string;
  selectedTarget?: string;
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
  const updateSharedVar = useServerFn(updateEnvironmentVariableServerFn as any) as (args: {
    data: {
      environmentId: string;
      variableId: string;
      workspace?: string;
      name: string;
      value: string;
      inheritable?: boolean;
    };
  }) => Promise<{ success: boolean }>;
  const deleteSharedVar = useServerFn(deleteEnvironmentVariableServerFn as any) as (args: {
    data: { environmentId: string; variableId: string; workspace?: string };
  }) => Promise<{ success: boolean }>;
  const saveEnvLevelVars = useServerFn(saveEnvironmentVariablesServerFn as any) as (args: {
    data: {
      environmentId: string;
      workspace?: string;
      variables: Array<{ name: string; value: string; inheritable?: boolean }>;
    };
  }) => Promise<EffectiveEnvironmentVariable[]>;
  const decryptValues = useServerFn(decryptProjectEnvironmentValuesServerFn as any) as (args: {
    data: { environments: Array<{ name: string; value: string }> };
  }) => Promise<Array<{ name: string; value: string }>>;
  const addEnvs = useServerFn(addProjectEnvironmentVariablesServerFn as any) as (args: {
    data: {
      projectId: string;
      target?: string;
      environments: Array<{ name: string; value: string }>;
    };
  }) => Promise<ProjectEnvironmentSnapshot | null>;

  const haptics = useHaptics();
  const [name, setName] = useState(row.name);
  const [value, setValue] = useState(decryptedValue ?? row.value);
  const [showValue, setShowValue] = useState(false);
  const [valueCopied, setValueCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [sharedToggle, setSharedToggle] = useState(isShared ?? false);
  const authorName = row.isSystem ? "system" : row.user || (isShared ? "Environment" : "unknown");
  const authorDisplayName = row.isSystem ? "System" : row.user || (isShared ? "Environment" : "Unknown");
  const authoredAtLabel = formatEnvRowRelativeTime(row.createdAt, row.updatedAt);
  const activityLabel = getEnvActivityLabel({
    authoredAtLabel,
    isShared,
    sharedSource,
  });

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

  const canEdit = !databaseProject && canWrite;
  const canShowDelete = !databaseProject && canWrite;
  const canPerformDelete = !isShared || sharedSource !== "inherited";
  const deleteDisabledReason =
    isShared && sharedSource === "inherited"
      ? sharedSourceEnvironment
        ? `Inherited from ${sharedSourceEnvironment}. Delete in source environment.`
        : "Inherited variable. Delete in source environment."
      : undefined;
  const projectVariableId = row.envId;
  const sharedVariableId = sharedVarId;
  const disableNameInput = !canEdit || isNonEditableEnvName(row.name);
  const isDirty = name !== row.name || value !== row.value || sharedToggle !== (isShared ?? false);

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

      if (sharedToggle && !isShared && environmentId) {
        // Moving from project → shared: save to env-level, delete from project
        await saveEnvLevelVars({
          data: {
            environmentId,
            workspace,
            variables: [{ name: name.trim(), value }],
          },
        });
        await deleteEnv({ data: { projectId, envId: projectVariableId! } });
      } else if (!sharedToggle && isShared && environmentId) {
        // Moving from shared → project: save to project, delete from env-level
        await addEnvs({
          data: {
            projectId,
            target: selectedTarget,
            environments: [{ name: name.trim(), value }],
          },
        });
        if (sharedVariableId && sharedSource !== "inherited") {
          await deleteSharedVar({
            data: { environmentId, variableId: sharedVariableId, workspace },
          });
        } else {
          toast("Project variable saved. Shared source variable was not deleted because varId is unavailable.");
        }
      } else if (sharedToggle && environmentId) {
        if (sharedVariableId) {
          // Shared variable with explicit ID: update via PATCH
          await updateSharedVar({
            data: {
              environmentId,
              variableId: sharedVariableId,
              workspace,
              name: name.trim(),
              value,
            },
          });
        } else {
          await saveEnvLevelVars({
            data: {
              environmentId,
              workspace,
              variables: [{ name: name.trim(), value }],
            },
          });
        }
      } else {
        // Project-level update
        await updateEnv({
          data: {
            projectId,
            envId: projectVariableId!,
            name: name.trim(),
            value,
          },
        });
      }

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
    if (!canShowDelete || !canPerformDelete || removing) {
      return;
    }

    try {
      setRemoving(true);
      let deletedSharedVarId: string | undefined = sharedVariableId;
      if (isShared && environmentId) {
        if (sharedSource === "inherited") {
          return;
        }

        if (!deletedSharedVarId) {
          let valueForLookup = decryptedValue ?? row.value;
          if (sharedEncrypted) {
            const decrypted = await decryptValues({
              data: {
                environments: [{ name: row.name, value: valueForLookup }],
              },
            });
            valueForLookup = decrypted?.[0]?.value ?? valueForLookup;
          }

          const resolved = await saveEnvLevelVars({
            data: {
              environmentId,
              workspace,
              variables: [{ name: row.name, value: valueForLookup }],
            },
          });

          deletedSharedVarId = resolved.find(
            (entry) => entry.source !== "inherited" && entry.name.trim().toUpperCase() === row.name.trim().toUpperCase(),
          )?.id;

          if (!deletedSharedVarId) {
            throw new Error("Unable to resolve shared variable id for deletion.");
          }
        }

        await deleteSharedVar({
          data: { environmentId, variableId: deletedSharedVarId, workspace },
        });
      } else {
        await deleteEnv({ data: { projectId, envId: projectVariableId! } });
      }
      const deletedIdentifier = isShared ? (deletedSharedVarId ?? row.id) : (projectVariableId ?? row.id);
      onDeleted(deletedIdentifier);
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
      <AccordionTrigger
        className={`px-4 py-2.5 text-xs font-medium text-dash-text-strong hover:text-dash-text-faded [&[data-state=open]]:text-dash-text-strong ${isDecrypting ? "[&>svg:last-child]:hidden" : ""}`}
      >
        <span className="min-w-0 flex-1 truncate font-mono">{name}</span>
        {isShared && <span className="shrink-0 rounded-full bg-[#4879f8]/10 px-2 py-0.5 text-xs text-[#4879f8]">Shared</span>}
        <ReferenceCountBadge value={decryptedValue ?? row.value} />
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
              {showValue && hasReferenceTrigger(value) && (
                <pre
                  aria-hidden
                  className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-3 pr-16 font-mono text-sm italic leading-[36px] text-dash-text-strong"
                  dangerouslySetInnerHTML={{ __html: highlightReferences(value) }}
                />
              )}
              <input
                type="text"
                autoComplete="off"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                readOnly={!canEdit}
                className={`h-full w-full bg-transparent px-3 pr-16 text-sm outline-none ${!canEdit ? "cursor-default" : ""} ${
                  !showValue
                    ? "text-dash-text-strong [text-security:disc] [-webkit-text-security:disc]"
                    : hasReferenceTrigger(value)
                      ? "font-mono italic text-transparent caret-dash-text-strong [&::selection]:bg-dash-syntax/25 [&::selection]:text-transparent"
                      : "text-dash-text-strong"
                }`}
              />
              <div className="absolute right-2 flex items-center gap-1.5">
                <button type="button" onClick={revealValue} className="shrink-0 text-dash-text-faded hover:text-dash-text-strong">
                  {showValue ? <EyeSlash className="size-3.5" /> : <Eye className="size-3.5" />}
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
            <div className="flex min-w-0 items-center gap-3">
              <Tooltip
                side="top"
                user={{
                  name: authorDisplayName,
                  role: row.isSystem ? "System" : "Secret author",
                  avatarUrl: row.avatar,
                  avatarFallback: authorDisplayName.slice(0, 2).toUpperCase(),
                }}
              >
                <span className="text-xs text-dash-text-faded">
                  {authorName} · {activityLabel}
                </span>
              </Tooltip>
              {isShared && sharedSource === "inherited" && (
                <span className="text-xs text-dash-text-faded">
                  Inherited
                  {sharedSourceEnvironment
                    ? ` from ${sharedSourceEnvironment}. Delete in source environment.`
                    : ". Delete in source environment."}
                </span>
              )}
              {environmentId && canEdit && (
                <SimpleTooltip content="Share this variable across all projects in your workspace" side="top">
                  <button type="button" onClick={() => setSharedToggle((prev) => !prev)} className="flex items-center gap-1.5">
                    <span
                      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                        sharedToggle ? "bg-[#4879f8]" : "bg-dash-border"
                      }`}
                    >
                      <span
                        className={`inline-block size-3 rounded-full bg-white transition-transform ${
                          sharedToggle ? "translate-x-3.5" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                    <span className={`text-xs ${sharedToggle ? "text-[#4879f8]" : "text-dash-text-extra-faded"}`}>Shared</span>
                  </button>
                </SimpleTooltip>
              )}
            </div>

            <div className="flex items-center gap-2">
              {canEdit && (
                <GlossyButton
                  disabled={!isDirty || !name.trim() || !value.trim() || saving}
                  loading={saving}
                  loadingLabel="Saving..."
                  onClick={() => {
                    void saveRow();
                  }}
                >
                  Save
                </GlossyButton>
              )}
              {canShowDelete &&
                (deleteDisabledReason ? (
                  <SimpleTooltip content={deleteDisabledReason} side="top">
                    <span>
                      <GlossyButton variant="red" disabled>
                        Remove
                      </GlossyButton>
                    </span>
                  </SimpleTooltip>
                ) : (
                  <GlossyButton
                    variant="red"
                    disabled={removing}
                    loading={removing}
                    loadingLabel="Removing..."
                    onClick={() => {
                      void deleteRow();
                    }}
                  >
                    Remove
                  </GlossyButton>
                ))}
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// @ts-expect-error — kept for reference; rendering removed in favour of unified env list
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    data: {
      environmentId: string;
      variableId: string;
      workspace?: string;
      name: string;
      value: string;
      inheritable?: boolean;
    };
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
        data: {
          environmentId,
          variableId: variable.id,
          workspace,
          name: name.trim(),
          value,
          inheritable,
        },
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
      await deleteVar({
        data: { environmentId, variableId: variable.id, workspace },
      });
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
            Inherited
            {variable.sourceEnvironment ? ` from ${variable.sourceEnvironment}` : ""}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-[#4879f8]/10 px-2 py-0.5 text-xs text-[#4879f8]">Own</span>
        )}
        <span className="hidden shrink-0 text-sm font-normal text-dash-text-faded sm:block">{isInherited ? "" : "••••••••••••••••"}</span>
        {!isInherited &&
          (expanded ? (
            <ChevronUp className="size-4 shrink-0 text-dash-text-faded" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-dash-text-faded" />
          ))}
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
                <button
                  type="button"
                  onClick={() => setShowValue((p) => !p)}
                  className="shrink-0 text-dash-text-faded hover:text-dash-text-strong"
                >
                  {showValue ? <EyeSlash className="size-3.5" /> : <Eye className="size-3.5" />}
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
                  onClick={() => {
                    void saveRow();
                  }}
                >
                  Save
                </GlossyButton>
                <GlossyButton
                  variant="red"
                  disabled={removing}
                  loading={removing}
                  loadingLabel="Removing..."
                  onClick={() => {
                    void deleteRow();
                  }}
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

function EnvironmentPage() {
  const { project, workspace } = parentRoute.useLoaderData() as any;
  const router = useRouter();
  const {
    initialTarget,
    initialSnapshot,
    targets: initialTargets,
    initialEnvLevelVars,
    initialEnvLevelVarsKey,
  } = Route.useLoaderData() as LoaderData;
  const { canWrite } = useWorkspaceRole();

  const projectId = project?.id as string | undefined;
  const framework = project?.framework as string | undefined;
  const projectEnvironmentId = project?.projectEnvironmentId as string | null | undefined;
  const inheritEnvironmentVars = project?.inheritEnvironmentVars as boolean | undefined;
  const sharedLayerEnabled = Boolean(projectEnvironmentId) && inheritEnvironmentVars !== false;
  const databaseProject = getIsDatabaseProject(project);
  const canEdit = !databaseProject && canWrite;
  const envTabSupported = shouldShowEnvironmentTab(framework);

  const getEnvSnapshot = useServerFn(getProjectEnvironmentServerFn as any) as (args: {
    data: { projectId: string; target?: string };
  }) => Promise<ProjectEnvironmentSnapshot>;
  const listTargets = useServerFn(listProjectEnvironmentTargetsServerFn as any) as (args: {
    data: { projectId: string };
  }) => Promise<string[]>;
  const addEnvs = useServerFn(addProjectEnvironmentVariablesServerFn as any) as (args: {
    data: {
      projectId: string;
      target?: string;
      editor?: boolean;
      environments: Array<{ name: string; value: string }>;
    };
  }) => Promise<ProjectEnvironmentSnapshot | null>;
  const decryptValues = useServerFn(decryptProjectEnvironmentValuesServerFn as any) as (args: {
    data: { environments: Array<{ name: string; value: string }> };
  }) => Promise<Array<{ name: string; value: string }>>;
  const redeployProject = useServerFn(redeployProjectServerFn as any) as (args: {
    data: {
      projectId: string;
      workspace?: string;
      logId?: string;
      startOnly?: boolean;
    };
  }) => Promise<any>;
  const getEnvLevelVars = useServerFn(getEnvironmentVariablesServerFn as any) as (args: {
    data: { environmentId: string; workspace?: string };
  }) => Promise<EffectiveEnvironmentVariable[]>;
  const saveEnvLevelVars = useServerFn(saveEnvironmentVariablesServerFn as any) as (args: {
    data: {
      environmentId: string;
      workspace?: string;
      variables: Array<{ name: string; value: string; inheritable?: boolean }>;
    };
  }) => Promise<EffectiveEnvironmentVariable[]>;
  const listSiblingProjects = useServerFn(listHomeProjectsServerFn as any) as (args: {
    data: { workspace?: string };
  }) => Promise<{ items: Array<{ id: string; slug: string; name: string }> }>;

  type DraftRowWithShared = EditableEnvRow & { shared?: boolean };

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
  const [draftRows, setDraftRows] = useState<DraftRowWithShared[]>([{ id: createDraftId(), name: "", value: "", shared: false }]);
  const [hiddenDraftIds, setHiddenDraftIds] = useState<Set<string>>(new Set());
  const [savingDraftRows, setSavingDraftRows] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | undefined>(undefined);
  const [decryptingRowId, setDecryptingRowId] = useState<string | undefined>(undefined);
  const [decryptedCache, setDecryptedCache] = useState<Record<string, string>>({});
  const [envLevelVars, setEnvLevelVars] = useState<EffectiveEnvironmentVariable[]>(initialEnvLevelVars);
  const [siblingProjects, setSiblingProjects] = useState<ProjectOption[]>([]);
  const projectVarsCache = useRef(new Map<string, ProjectVarOption[]>());
  const projectVarsBySlug = useRef(new Map<string, Set<string>>());
  const hydratedEnvLevelVarsKeyRef = useRef<string | null>(initialEnvLevelVarsKey);

  useEffect(() => {
    setSelectedTarget(initialTarget);
    setTargets(sortEnvironmentTargets(initialTargets));
    setSnapshotsByTarget({ [initialTarget]: initialSnapshot });
    setRawMode(false);
    setSearch("");
    setDecryptedCache({});
    setExpandedRowId(undefined);
    setEnvLevelVars(initialEnvLevelVars);
    hydratedEnvLevelVarsKeyRef.current = initialEnvLevelVarsKey;
  }, [initialTarget, initialSnapshot, initialTargets, initialEnvLevelVars, initialEnvLevelVarsKey]);

  useEffect(() => {
    setDraftRows([{ id: createDraftId(), name: "", value: "", shared: false }]);
  }, [selectedTarget]);

  const fetchEnvLevelVars = useCallback(async () => {
    if (!projectEnvironmentId || !sharedLayerEnabled) {
      setEnvLevelVars([]);
      return;
    }
    const vars = await getEnvLevelVars({
      data: { environmentId: projectEnvironmentId, workspace },
    }).catch(() => []);
    setEnvLevelVars(Array.isArray(vars) ? vars : []);
  }, [projectEnvironmentId, sharedLayerEnabled, workspace, getEnvLevelVars]);

  useEffect(() => {
    const envLevelVarsKey = projectEnvironmentId && sharedLayerEnabled ? `${projectEnvironmentId}:${workspace ?? ""}` : null;
    if (envLevelVarsKey && hydratedEnvLevelVarsKeyRef.current === envLevelVarsKey) {
      hydratedEnvLevelVarsKeyRef.current = null;
      return;
    }

    void fetchEnvLevelVars();
  }, [fetchEnvLevelVars, projectEnvironmentId, sharedLayerEnabled, workspace]);

  useEffect(() => {
    let cancelled = false;
    listSiblingProjects({ data: { workspace } })
      .then((result) => {
        if (cancelled) return;
        const items = Array.isArray(result?.items) ? result.items : [];
        const currentSlug = project?.slug as string | undefined;
        setSiblingProjects(
          items.filter((p) => p.id && p.slug && p.slug !== currentSlug).map((p) => ({ id: p.id, slug: p.slug, name: p.name })),
        );
      })
      .catch(() => {
        if (!cancelled) setSiblingProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [listSiblingProjects, workspace, project?.slug]);

  const getProjectVars = useCallback(
    async (target: ProjectOption): Promise<ProjectVarOption[]> => {
      const lookupKey = target.id || target.slug;
      const cached = projectVarsCache.current.get(lookupKey);
      if (cached) return cached;
      try {
        const snapshot = await getEnvSnapshot({ data: { projectId: lookupKey, target: "PRODUCTION" } });
        const vars = Array.isArray(snapshot?.envs) ? snapshot.envs.map((e) => ({ name: e.name })).filter((v) => v.name) : [];
        projectVarsCache.current.set(lookupKey, vars);
        projectVarsBySlug.current.set(target.slug, new Set(vars.map((v) => v.name)));
        return vars;
      } catch {
        return [];
      }
    },
    [getEnvSnapshot],
  );

  const autocompleteSharedVars = useMemo<SharedVarOption[]>(
    () => envLevelVars.filter((v) => v.name).map((v) => ({ name: v.name, sourceEnvironment: v.sourceEnvironment })),
    [envLevelVars],
  );

  const autocompleteConfig = useMemo(
    () => ({
      sharedVars: autocompleteSharedVars,
      sharedDisabled: !sharedLayerEnabled,
      siblingProjects,
      getProjectVars,
    }),
    [autocompleteSharedVars, sharedLayerEnabled, siblingProjects, getProjectVars],
  );

  const validationContext = useMemo<ReferenceValidationContext>(
    () => ({
      sharedVars: new Set(autocompleteSharedVars.map((v) => v.name)),
      sharedDisabled: !sharedLayerEnabled,
      siblingSlugs: new Set(siblingProjects.map((p) => p.slug)),
      projectVarsCache: projectVarsBySlug.current,
      currentProjectSlug: project?.slug as string | undefined,
    }),
    [autocompleteSharedVars, sharedLayerEnabled, siblingProjects, project?.slug],
  );

  const currentSnapshot = snapshotsByTarget[selectedTarget] ?? {
    envs: [],
    deployId: undefined,
  };

  const mergedRows = useMemo<MergedEnvRow[]>(() => {
    const sharedByName = new Map<string, EffectiveEnvironmentVariable>();
    for (const variable of envLevelVars) {
      sharedByName.set(variable.name.trim().toUpperCase(), variable);
    }

    const projectRows = currentSnapshot.envs.filter(isProjectLevelVariable).map((env) => ({
      ...env,
      meta: {
        isShared: false,
        encrypted: true,
      },
    }));
    const sharedRowsFromApi = (sharedLayerEnabled ? envLevelVars : []).map((v) => ({
      id: v.id ?? `shared:${v.name}`,
      name: v.name,
      value: v.value,
      user: v.user || (v.source === "inherited" ? (v.sourceEnvironment ?? "Environment") : "Environment"),
      avatar: v.avatar,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      meta: {
        isShared: true,
        encrypted: false,
        sharedVarId: v.id,
        sharedSource: v.source,
        sharedSourceEnvironment: v.sourceEnvironment,
      },
    }));

    const namesFromSharedApi = new Set(sharedRowsFromApi.map((row) => row.name.trim().toUpperCase()));

    const sharedRowsFromLegacyList = (sharedLayerEnabled ? currentSnapshot.envs : [])
      .filter((env) => env.source === "environment" && !namesFromSharedApi.has(env.name.trim().toUpperCase()))
      .map((env) => {
        const sharedMeta = sharedByName.get(env.name.trim().toUpperCase());
        return {
          ...env,
          meta: {
            isShared: true,
            encrypted: true,
            sharedVarId: sharedMeta?.id,
            sharedSource: sharedMeta?.source,
            sharedSourceEnvironment: sharedMeta?.sourceEnvironment,
          },
        };
      });

    return [...sharedRowsFromApi, ...sharedRowsFromLegacyList, ...projectRows];
  }, [currentSnapshot.envs, envLevelVars, sharedLayerEnabled]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return mergedRows;
    const q = search.toLowerCase();
    return mergedRows.filter((row) => row.name.toLowerCase().includes(q));
  }, [mergedRows, search]);

  const editableProjectRows = useMemo(() => currentSnapshot.envs.filter(isProjectLevelVariable), [currentSnapshot.envs]);

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
      toast.error(error instanceof Error ? error.message : "Failed to load secrets");
    } finally {
      setLoadingTarget(false);
    }
  }

  async function handleRedeploy(logId?: string) {
    if (!canWrite) {
      toast.error("You don't have permission to update this project's environment.");
      return;
    }

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
      markDeploymentHistoryForRefresh({ projectId, workspace });
      toast.success("Redeploy started");
      router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start redeploy");
    }
  }

  function addDraftRow() {
    setDraftRows((prev) => [...prev, { id: createDraftId(), name: "", value: "", shared: false }]);
  }

  function updateDraftRow(id: string, field: "name" | "value", nextValue: string) {
    setDraftRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: nextValue } : row)));
  }

  function toggleDraftShared(id: string) {
    setDraftRows((prev) => prev.map((row) => (row.id === id ? { ...row, shared: !row.shared } : row)));
  }

  function removeDraftRow(id: string) {
    setDraftRows((prev) => {
      const next = prev.filter((row) => row.id !== id);
      if (next.length > 0) {
        return next;
      }
      return [{ id: createDraftId(), name: "", value: "", shared: false }];
    });
  }

  async function handleSaveDraftRows() {
    if (!canWrite) {
      toast.error("You don't have permission to update this project's environment.");
      return;
    }

    if (!projectId || savingDraftRows) {
      return;
    }

    const sanitized = sanitizeEnvironmentEntries(draftRows);
    const nonEmpty = sanitized.filter((row) => row.name || row.value);
    const validation = validateEnvironmentEntries(nonEmpty);

    if (!validation.valid) {
      toast.error(validation.message || "Invalid secrets");
      return;
    }

    if (nonEmpty.length === 0) {
      toast.error("Add at least one variable before saving");
      return;
    }

    // Map draft IDs to shared flag — sanitized rows lose the shared field,
    // so look up by matching name against the original drafts.
    const sharedNames = new Set(draftRows.filter((r) => r.shared).map((r) => r.name.trim().toUpperCase()));
    const projectRows = nonEmpty.filter((r) => !sharedNames.has(r.name.trim().toUpperCase()));
    const sharedRows = nonEmpty.filter((r) => sharedNames.has(r.name.trim().toUpperCase()));

    try {
      setSavingDraftRows(true);

      const promises: Promise<unknown>[] = [];
      if (projectRows.length > 0) {
        promises.push(
          addEnvs({
            data: {
              projectId,
              target: selectedTarget,
              environments: projectRows,
            },
          }),
        );
      }
      if (sharedRows.length > 0 && sharedLayerEnabled && projectEnvironmentId) {
        promises.push(
          saveEnvLevelVars({
            data: {
              environmentId: projectEnvironmentId,
              workspace,
              variables: sharedRows.map((r) => ({
                name: r.name,
                value: r.value,
              })),
            },
          }),
        );
      }

      await Promise.all(promises);
      await loadEnvironmentTarget(selectedTarget);
      void fetchEnvLevelVars();

      setDraftRows([{ id: createDraftId(), name: "", value: "", shared: false }]);
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
      toast.error(error instanceof Error ? error.message : "Failed to save secrets");
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
          environments: editableProjectRows.map((env) => ({
            name: env.name,
            value: env.value,
          })),
        },
      });

      const decryptedMap = new Map(decrypted.map((item) => [item.name, item.value]));
      const merged = editableProjectRows.map((env) => ({
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
    if (!canWrite) {
      toast.error("You don't have permission to update this project's environment.");
      return;
    }

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
      toast.error(validation.message || "Invalid secrets");
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

    const row = mergedRows.find((entry) => entry.id === nextValue);
    if (!row) {
      setExpandedRowId(nextValue);
      return;
    }

    // Values from env-level API are plain text; legacy /envs rows are encrypted.
    if (!row.meta.encrypted) {
      setDecryptedCache((prev) => ({
        ...prev,
        [nextValue]: row.value,
      }));
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
    <div data-ph-mask className="mx-auto flex max-w-[1000px] flex-col gap-4 py-8">
      <TabHeader title="Secrets">
        {getEnvironmentDescription(canEdit)}{" "}
        <a href="#" className="text-[#4879f8] underline">
          Learn more
        </a>
      </TabHeader>

      <hr className="border-dash-border" />

      {!envTabSupported && (
        <div className="rounded-[4px] border-[0.5px] border-dash-border px-4 py-5 text-sm text-dash-text-faded">
          Secrets are not available for HTML projects.
        </div>
      )}

      {envTabSupported && (
        <>
          {databaseProject && <InfoBanner>Connect to your database service using a private connection in the same region.</InfoBanner>}

          <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
            <div
              className={`flex flex-wrap items-center gap-3 border-b-[0.5px] border-dash-border px-3.5 py-3.5 ${databaseProject ? "justify-end" : ""}`}
            >
              {!databaseProject && (
                <div className="flex min-w-[220px] flex-1 items-center gap-2">
                  <Search className="size-5 shrink-0 text-dash-text-extra-faded" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search secrets..."
                    className="w-full bg-transparent text-sm text-dash-text-strong outline-none placeholder:text-dash-text-extra-faded"
                  />
                </div>
              )}

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
                className="flex h-[34px] items-center gap-2 rounded-[4px] border border-[#232931] bg-gradient-to-b from-[#545459] via-[#45454b] to-[#2d2d32] px-3.5 text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-opacity hover:opacity-90 disabled:opacity-60"
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
                    ENV
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
                  placeholder={rawFormat === "json" ? '{\n  "API_KEY": "value"\n}' : "API_KEY=value"}
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
                      <AnimatePresence initial={false}>
                        {draftRows.map((row) => (
                          <motion.div
                            key={row.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{
                              duration: 0.2,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            className="overflow-hidden"
                          >
                            <div className="flex items-center gap-2 px-px py-1">
                              <input
                                type="text"
                                value={row.name}
                                onChange={(event) => updateDraftRow(row.id, "name", event.target.value)}
                                placeholder="APP_ENV"
                                className="input-base input-focus h-[36px] min-w-0 flex-1 px-3 font-mono text-sm text-dash-text-strong placeholder:text-dash-text-extra-faded"
                              />
                              <ReferenceHighlightInput
                                value={row.value}
                                onChange={(next) => updateDraftRow(row.id, "value", next)}
                                placeholder="value"
                                masked={hiddenDraftIds.has(row.id)}
                                autocomplete={autocompleteConfig}
                              />
                              {sharedLayerEnabled && (
                                <SimpleTooltip content="Share this variable across all projects in your workspace" side="top">
                                  <button
                                    type="button"
                                    onClick={() => toggleDraftShared(row.id)}
                                    className="group flex h-[36px] shrink-0 items-center gap-1.5 rounded-[4px] px-2 text-dash-text-faded hover:text-dash-text-body"
                                  >
                                    <span
                                      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                                        row.shared ? "bg-[#4879f8]" : "bg-dash-border"
                                      }`}
                                    >
                                      <span
                                        className={`inline-block size-3 rounded-full bg-white transition-transform ${
                                          row.shared ? "translate-x-3.5" : "translate-x-0.5"
                                        }`}
                                      />
                                    </span>
                                    <span className={`text-xs ${row.shared ? "text-[#4879f8]" : "text-dash-text-extra-faded"}`}>
                                      Shared
                                    </span>
                                  </button>
                                </SimpleTooltip>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setHiddenDraftIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(row.id)) next.delete(row.id);
                                    else next.add(row.id);
                                    return next;
                                  })
                                }
                                className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[4px] text-dash-text-faded hover:text-dash-text-body"
                                title={hiddenDraftIds.has(row.id) ? "Show value" : "Hide value"}
                              >
                                {hiddenDraftIds.has(row.id) ? <Eye className="size-4" /> : <EyeSlash className="size-4" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeDraftRow(row.id)}
                                disabled={draftRows.length === 1}
                                className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[4px] text-dash-text-faded hover:text-red-400 disabled:opacity-30"
                              >
                                <X className="size-4" />
                              </button>
                            </div>
                            <ReferenceWarnings value={row.value} context={validationContext} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <button type="button" onClick={addDraftRow} className="text-sm text-dash-text-faded hover:text-dash-text-strong">
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
                          {mergedRows.length === 0 ? "No secrets" : "No matching secrets"}
                        </h3>
                        <p className="max-w-[360px] text-sm text-dash-text-faded">
                          {mergedRows.length === 0
                            ? databaseProject
                              ? "No credentials are available for this deployment target yet."
                              : "Add secrets to securely store API keys, database URLs, and other sensitive values."
                            : `No secrets matching "${search}".`}
                        </p>
                      </div>
                    )}

                    {filteredRows.length > 0 && (
                      <Accordion
                        type="single"
                        collapsible
                        value={expandedRowId ?? ""}
                        onValueChange={(val: string) => {
                          void handleAccordionChange(val);
                        }}
                      >
                        {filteredRows.map((row) => (
                          <EnvAccordionRow
                            key={row.id}
                            row={row}
                            projectId={projectId || ""}
                            databaseProject={databaseProject}
                            isExpanded={expandedRowId === row.id}
                            isDecrypting={decryptingRowId === row.id}
                            decryptedValue={decryptedCache[row.id]}
                            canWrite={canWrite}
                            isShared={row.meta.isShared}
                            sharedVarId={row.meta.sharedVarId}
                            sharedSource={row.meta.sharedSource}
                            sharedSourceEnvironment={row.meta.sharedSourceEnvironment}
                            sharedEncrypted={row.meta.encrypted}
                            environmentId={sharedLayerEnabled ? (projectEnvironmentId ?? undefined) : undefined}
                            workspace={workspace}
                            selectedTarget={selectedTarget}
                            onRedeploy={handleRedeploy}
                            onUpdated={() => {
                              void refreshCurrentTarget();
                              void fetchEnvLevelVars();
                            }}
                            onDeleted={(envId) => {
                              setExpandedRowId(undefined);
                              if (row.meta.isShared) {
                                setEnvLevelVars((prev) => prev.filter((v) => v.id !== envId));
                              } else {
                                patchCurrentSnapshot((current) => ({
                                  ...current,
                                  envs: current.envs.filter((item) => item.id !== envId),
                                }));
                              }
                              void refreshCurrentTarget();
                              void fetchEnvLevelVars();
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
