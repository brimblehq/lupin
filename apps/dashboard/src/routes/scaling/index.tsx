import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import { Search, Plus, Pencil } from "lucide-react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { PageHeader } from "../../components/shared/page-header";
import { GlossyButton } from "../../components/shared/glossy-button";
import { ToggleSwitch } from "../../components/shared/toggle-switch";
import { RangeSlider } from "../../components/shared/range-slider";
import { WarningModal } from "../../components/shared/warning-modal";
import { FolderTrashIcon } from "../../components/shared/folder-trash-icon";
import { dashInputClassName } from "@/components/shared/dash-input";
import {
  deleteScalingGroupServerFn,
  listScalingGroupsServerFn,
  saveScalingGroupServerFn,
  toggleScalingGroupServerFn,
  type ScalingGroup as BackendScalingGroup,
} from "@/server/scaling/actions";
import { formatRelativeTime } from "@/utils/dashboard";
import { workspaceLoaderDeps } from "@/utils/workspace-route-search";
import { usePlanGate } from "@/hooks/use-plan-gate";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { useFeatureFlag, FeatureFlags } from "@/lib/feature-flags";
import { PlanUpgradePrompt } from "../../components/shared/plan-upgrade-prompt";
import { ScalingPending } from "@/components/shared/route-pending";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

export const Route = createFileRoute("/scaling/")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  pendingComponent: ScalingPending,
  validateSearch: (search: Record<string, unknown>) => workspaceLoaderDeps(search),
  loaderDeps: ({ search }) => workspaceLoaderDeps(search),
  loader: async ({ deps }) => {
    const result = await (
      listScalingGroupsServerFn as unknown as (input: {
        data: { workspace?: string };
      }) => Promise<{ items: BackendScalingGroup[]; message?: string }>
    )({
      data: { workspace: deps.workspace },
    });

    return {
      workspace: deps.workspace,
      groups: result.items,
      message: result.message ?? null,
    };
  },
  component: ScalingPage,
});

const ease = [0.16, 1, 0.3, 1] as const;

const inputClass = `${dashInputClassName} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;

type UiScalingGroup = {
  id: string;
  name: string;
  active: boolean;
  minInstances: number;
  maxInstances: number;
  runningInstances: number;
  cpuThreshold: number;
  memoryThreshold: number;
  createdAtLabel: string;
  createdAtRaw?: string;
};

type ScalingFormValues = {
  id?: string;
  name: string;
  active: boolean;
  replicas: number;
  minInstances: number;
  maxInstances: number;
  cpuThreshold: number;
  memoryThreshold: number;
};

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return Math.round(value);
}

function mapGroupToUi(group: BackendScalingGroup): UiScalingGroup {
  const createdAtSource = group.createdAt || group.updatedAt;
  const createdAtLabel = createdAtSource ? formatRelativeTime(createdAtSource) : "just now";

  const runningInstances = group.active ? group.minContainers : group.replicas;

  return {
    id: group.id,
    name: group.name,
    active: group.active,
    minInstances: group.minContainers,
    maxInstances: group.maxContainers,
    runningInstances,
    cpuThreshold: group.maxCpuThreshold,
    memoryThreshold: group.maxMemoryThreshold,
    createdAtLabel,
    createdAtRaw: createdAtSource,
  };
}

function toFormValues(group?: UiScalingGroup | null): ScalingFormValues {
  if (!group) {
    return {
      name: "",
      active: true,
      replicas: 2,
      minInstances: 2,
      maxInstances: 5,
      cpuThreshold: 70,
      memoryThreshold: 70,
    };
  }

  return {
    id: group.id,
    name: group.name,
    active: group.active,
    replicas: group.runningInstances || 2,
    minInstances: group.minInstances,
    maxInstances: group.maxInstances,
    cpuThreshold: group.cpuThreshold,
    memoryThreshold: group.memoryThreshold,
  };
}

function getThresholdCapColor(value: number): string {
  if (value >= 85) return "#ff2200";
  if (value >= 70) return "#ff5500";
  if (value >= 50) return "#ff8c1a";
  return "#ffa800";
}

function ThresholdBar({ label, value }: { label: string; value: number }) {
  const totalBlocks = 6;
  const filledBlocks = Math.round((value / 100) * totalBlocks);
  const capColor = getThresholdCapColor(value);

  return (
    <div className="flex items-center gap-2">
      <span className="w-[28px] text-xs text-dash-text-faded">{label}</span>
      <div className="flex gap-[2px]">
        {Array.from({ length: totalBlocks }).map((_, i) => {
          if (i >= filledBlocks) {
            return <div key={i} className="h-[8px] w-[6px] rounded-[1px] bg-dash-border" />;
          }
          const isTop = i === filledBlocks - 1;
          return (
            <div
              key={i}
              className="h-[8px] w-[6px] rounded-[1px]"
              style={{ backgroundColor: isTop ? capColor : "#ff7a00" }}
            />
          );
        })}
      </div>
      <span className="text-xs font-medium text-dash-text-body">{value}%</span>
    </div>
  );
}

function ScalingGroupCard({
  group,
  onToggle,
  onEdit,
  onDelete,
  toggling,
  deleting,
  canWrite = true,
}: {
  group: UiScalingGroup;
  onToggle: (group: UiScalingGroup, nextActive: boolean) => void;
  onEdit: (group: UiScalingGroup) => void;
  onDelete: (group: UiScalingGroup) => void;
  toggling?: boolean;
  deleting?: boolean;
  canWrite?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`flex flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border ${!group.active ? "opacity-70" : ""}`}
    >
      <div className="flex items-center justify-between px-3.5 pb-1 pt-3">
        <span className="text-sm font-medium leading-5 text-dash-text-strong">{group.name}</span>
        <div className="flex items-center gap-2">
          {canWrite && (
            <button
              type="button"
              onClick={() => onEdit(group)}
              className="rounded-[4px] p-1 text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-body"
              title="Edit scaling group"
              disabled={Boolean(deleting)}
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          {canWrite && (
            <button
              type="button"
              onClick={() => onDelete(group)}
              className="rounded-[4px] p-1 text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-[#ef2f1f]"
              title="Delete scaling group"
              disabled={Boolean(deleting)}
            >
              <FolderTrashIcon className="size-3.5" color="currentColor" />
            </button>
          )}
          <ToggleSwitch
            size="sm"
            checked={group.active}
            onChange={(next) => onToggle(group, next)}
            disabled={!canWrite || Boolean(toggling) || Boolean(deleting)}
          />
        </div>
      </div>

      <div className="px-3.5 pb-3">
        <span className="text-xs text-dash-text-faded">{group.active ? "Auto-scaling enabled" : "Fixed replicas mode"}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 px-3.5 pb-3">
        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-dash-text-extra-faded">Instances</span>
          <span className="text-sm font-medium text-dash-text-strong">
            {group.active ? `${group.minInstances} → ${group.maxInstances}` : `${group.runningInstances} fixed`}
          </span>
          <span className="mt-0.5 block text-xs text-dash-text-faded">{group.runningInstances} running</span>
        </div>
        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-dash-text-extra-faded">Thresholds</span>
          <div className="flex flex-col gap-1">
            <ThresholdBar label="CPU" value={group.cpuThreshold} />
            <ThresholdBar label="Mem" value={group.memoryThreshold} />
          </div>
        </div>
      </div>

      <div className="flex h-10 items-center border-t-[0.5px] border-dash-border px-3.5">
        <span className="font-mono text-xs uppercase leading-[18px] tracking-[-0.02px] text-dash-text-extra-faded opacity-80">
          Created {group.createdAtLabel}
        </span>
      </div>
    </motion.div>
  );
}

function CreationForm({
  initialValues,
  onCancel,
  onSubmit,
  isSubmitting,
}: {
  initialValues: ScalingFormValues;
  onCancel: () => void;
  onSubmit: (values: ScalingFormValues) => Promise<void> | void;
  isSubmitting?: boolean;
}) {
  const isEditing = Boolean(initialValues.id);

  const [name, setName] = useState(initialValues.name);
  const [autoScaling, setAutoScaling] = useState(initialValues.active);
  const [replicas, setReplicas] = useState(initialValues.replicas);
  const [minInstances, setMinInstances] = useState(initialValues.minInstances);
  const [maxInstances, setMaxInstances] = useState(initialValues.maxInstances);
  const [cpuThreshold, setCpuThreshold] = useState(initialValues.cpuThreshold);
  const [memThreshold, setMemThreshold] = useState(initialValues.memoryThreshold);

  useEffect(() => {
    setName(initialValues.name);
    setAutoScaling(initialValues.active);
    setReplicas(initialValues.replicas);
    setMinInstances(initialValues.minInstances);
    setMaxInstances(initialValues.maxInstances);
    setCpuThreshold(initialValues.cpuThreshold);
    setMemThreshold(initialValues.memoryThreshold);
  }, [initialValues]);

  const normalizedReplicas = clampInt(replicas, 1, 10);
  const normalizedMin = clampInt(minInstances, 1, 5);
  const normalizedMax = clampInt(maxInstances, 1, 5);
  const normalizedCpu = clampInt(cpuThreshold, 1, 100);
  const normalizedMem = clampInt(memThreshold, 10, 100);

  const invalidAutoscalingRange = autoScaling && normalizedMin >= normalizedMax;
  const canSubmit = name.trim().length > 0 && !invalidAutoscalingRange;

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) {
      return;
    }

    await onSubmit({
      id: initialValues.id,
      name: name.trim(),
      active: autoScaling,
      replicas: normalizedReplicas,
      minInstances: normalizedMin,
      maxInstances: normalizedMax,
      cpuThreshold: normalizedCpu,
      memoryThreshold: normalizedMem,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease }}
      className="overflow-hidden"
    >
      <div className="mb-6 rounded-[4px] border-[0.5px] border-dash-border p-5">
        <div className="mb-4">
          <label className="mb-1.5 block text-sm text-dash-text-body">Group name</label>
          <input
            type="text"
            placeholder="e.g. web-frontend"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            autoFocus
          />
        </div>

        <hr className="my-5 border-dash-border-soft" />

        <div className="mb-5 flex items-center justify-between">
          <div>
            <span className="block text-sm font-medium text-dash-text-strong">Auto-scaling</span>
            <span className="text-xs text-dash-text-faded">Automatically adjust instances based on load</span>
          </div>
          <ToggleSwitch checked={autoScaling} onChange={setAutoScaling} />
        </div>

        {!autoScaling ? (
          <div className="mb-4">
            <label className="mb-1.5 block text-sm text-dash-text-body">Number of instances</label>
            <input
              type="number"
              min={1}
              max={10}
              value={replicas}
              onChange={(e) => setReplicas(clampInt(Number(e.target.value), 1, 10))}
              className={inputClass}
            />
          </div>
        ) : (
          <div className="mb-4">
            <label className="mb-1.5 block text-sm text-dash-text-body">Instance range</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-dash-text-faded">Min</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={minInstances}
                  onChange={(e) => {
                    const nextMin = clampInt(Number(e.target.value), 1, 5);
                    setMinInstances(nextMin);
                    if (nextMin >= maxInstances) {
                      setMaxInstances(clampInt(nextMin + 1, 1, 5));
                    }
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-dash-text-faded">Max</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={maxInstances}
                  onChange={(e) => {
                    const nextMax = clampInt(Number(e.target.value), 1, 5);
                    setMaxInstances(nextMax);
                    if (nextMax <= minInstances) {
                      setMinInstances(clampInt(nextMax - 1, 1, 5));
                    }
                  }}
                  className={inputClass}
                />
              </div>
            </div>
            {invalidAutoscalingRange ? (
              <p className="mt-1 text-sm text-[#f5a623]">For auto-scaling to work, max instances must be greater than min instances.</p>
            ) : null}
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1.5 block text-sm text-dash-text-body">CPU threshold</label>
          <RangeSlider value={cpuThreshold} onChange={setCpuThreshold} min={1} max={100} step={1} disabled={!autoScaling} />
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-sm text-dash-text-body">Memory threshold</label>
          <RangeSlider value={memThreshold} onChange={setMemThreshold} min={10} max={100} step={5} disabled={!autoScaling} />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={Boolean(isSubmitting)}
            className="px-2 text-sm font-medium text-dash-text-faded transition-colors hover:text-dash-text-strong disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>
          <GlossyButton
            variant="blue"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={!canSubmit}
            loading={Boolean(isSubmitting)}
            loadingLabel={isEditing ? "Saving..." : "Creating..."}
          >
            {isEditing ? "Save Changes" : "Create Group"}
          </GlossyButton>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ onCreateClick, canWrite = true }: { onCreateClick: () => void; canWrite?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease }}
      className="flex flex-col items-center justify-center py-20"
    >
      <img src="/icons/scaling.svg" alt="" className="mb-4 size-10 opacity-30 dark:invert dark:opacity-35" />
      <h3 className="mb-1 text-sm font-medium text-dash-text-strong">No scaling groups yet</h3>
      <p className="mb-5 max-w-[320px] text-center text-sm text-dash-text-faded">
        Create a scaling group to automatically manage instance counts based on CPU and memory usage.
      </p>
      {canWrite && (
        <GlossyButton variant="blue" onClick={onCreateClick}>
          Create Scaling Group
        </GlossyButton>
      )}
    </motion.div>
  );
}

function ScalingPage() {
  const { canWrite } = useWorkspaceRole();
  const router = useRouter();
  const { autoscalingEnabled } = usePlanGate();
  const scalingFeatureEnabled = useFeatureFlag(FeatureFlags.ENABLE_AUTO_SCALING);
  const { groups: serverGroups, workspace } = Route.useLoaderData();
  const saveScalingGroup = useServerFn(saveScalingGroupServerFn as any) as (args: {
    data: {
      id?: string;
      workspace?: string;
      name: string;
      active: boolean;
      replicas: number;
      minContainers: number;
      maxContainers: number;
      maxCpuThreshold: number;
      maxMemoryThreshold: number;
    };
  }) => Promise<BackendScalingGroup>;
  const toggleScalingGroup = useServerFn(toggleScalingGroupServerFn as any) as (args: {
    data: { id: string; active: boolean; workspace?: string };
  }) => Promise<{ success: boolean }>;
  const deleteScalingGroup = useServerFn(deleteScalingGroupServerFn as any) as (args: {
    data: { id: string; workspace?: string };
  }) => Promise<{ success: boolean }>;

  const [rows, setRows] = useState<UiScalingGroup[]>(() => serverGroups.map(mapGroupToUi));
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UiScalingGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UiScalingGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Record<string, boolean>>({});
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setRows(serverGroups.map(mapGroupToUi));
  }, [serverGroups]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return rows;
    }

    return rows.filter((g) => g.name.toLowerCase().includes(term));
  }, [rows, search]);

  function handleEdit(group: UiScalingGroup) {
    setEditingGroup(group);
    setFormOpen(true);
  }

  function handleNewGroup() {
    setEditingGroup(null);
    setFormOpen(true);
  }

  function handleFormCancel() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingGroup(null);
  }

  async function handleSave(values: ScalingFormValues) {
    if (!canWrite) {
      toast.error("You don't have permission to manage scaling in this workspace.");
      return;
    }

    try {
      setSaving(true);
      const isEdit = Boolean(values.id);

      const saved = await saveScalingGroup({
        data: {
          id: values.id,
          workspace,
          name: values.name,
          active: values.active,
          replicas: values.replicas,
          minContainers: values.minInstances,
          maxContainers: values.maxInstances,
          maxCpuThreshold: values.cpuThreshold,
          maxMemoryThreshold: values.memoryThreshold,
        },
      });

      const nextRow = mapGroupToUi(saved);

      setRows((prev) => {
        if (isEdit) {
          return prev.map((row) => (row.id === nextRow.id ? nextRow : row));
        }

        return [nextRow, ...prev];
      });

      setFormOpen(false);
      setEditingGroup(null);

      if (isEdit) {
        toast.success(`Updated ${saved.name}`);
      } else {
        toast.success(`Created ${saved.name}`);
      }
      invalidateActiveMatches(router);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save scaling group");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(group: UiScalingGroup, nextActive: boolean) {
    if (!canWrite) {
      toast.error("You don't have permission to manage scaling in this workspace.");
      return;
    }

    setTogglingIds((prev) => ({ ...prev, [group.id]: true }));

    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== group.id) {
          return row;
        }

        return {
          ...row,
          active: nextActive,
          runningInstances: nextActive ? row.minInstances : row.runningInstances,
        };
      }),
    );

    try {
      await toggleScalingGroup({
        data: {
          id: group.id,
          active: nextActive,
          workspace,
        },
      });

      toast.success(`${nextActive ? "Enabled" : "Disabled"} ${group.name}`);
      invalidateActiveMatches(router);
    } catch (error) {
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== group.id) {
            return row;
          }

          return {
            ...row,
            active: group.active,
            runningInstances: group.runningInstances,
          };
        }),
      );
      toast.error(error instanceof Error ? error.message : "Failed to update scaling group");
    } finally {
      setTogglingIds((prev) => {
        const next = { ...prev };
        delete next[group.id];
        return next;
      });
    }
  }

  async function confirmDelete() {
    if (!canWrite) {
      setDeleteTarget(null);
      toast.error("You don't have permission to manage scaling in this workspace.");
      return;
    }

    if (!deleteTarget) {
      return;
    }

    const target = deleteTarget;
    setDeletingIds((prev) => ({ ...prev, [target.id]: true }));

    try {
      await deleteScalingGroup({
        data: {
          id: target.id,
          workspace,
        },
      });

      setRows((prev) => prev.filter((row) => row.id !== target.id));
      setDeleteTarget(null);
      toast.success(`Deleted ${target.name}`);
      invalidateActiveMatches(router);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete scaling group");
      throw error;
    } finally {
      setDeletingIds((prev) => {
        const next = { ...prev };
        delete next[target.id];
        return next;
      });
    }
  }

  if (!autoscalingEnabled || !scalingFeatureEnabled) {
    return (
      <div className="max-w-[1000px]">
        <PageHeader title="Scaling" image="/images/scaling-tab.svg">
          Configure auto-scaling groups to automatically adjust the number of running instances for your projects based on CPU and memory
          thresholds.
        </PageHeader>
        <hr className="-ml-4 mb-6 border-dash-border-soft md:-ml-10" />
        <PlanUpgradePrompt feature="Autoscaling" description="Upgrade your plan to enable autoscaling." />
      </div>
    );
  }

  return (
    <div className="max-w-[1000px]">
      <PageHeader title="Scaling" image="/images/scaling-tab.svg">
        Configure auto-scaling groups to automatically adjust the number of running instances for your projects based on CPU and memory
        thresholds.
      </PageHeader>

      <hr className="-ml-4 mb-6 border-dash-border-soft md:-ml-10" />

      <div className="mb-5 flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dash-text-extra-faded" />
          <input
            type="text"
            placeholder="Search scaling groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>
        {canWrite && (
          <GlossyButton variant="blue" onClick={handleNewGroup} className="shrink-0 gap-1.5">
            <Plus className="size-3.5" />
            New Scaling Group
          </GlossyButton>
        )}
      </div>

      <AnimatePresence mode="wait">
        {canWrite && formOpen ? (
          <CreationForm
            key={editingGroup?.id ?? "new"}
            initialValues={toFormValues(editingGroup)}
            onCancel={handleFormCancel}
            onSubmit={handleSave}
            isSubmitting={saving}
          />
        ) : null}
      </AnimatePresence>

      {rows.length === 0 ? (
        formOpen ? null : <EmptyState onCreateClick={handleNewGroup} canWrite={canWrite} />
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-dash-text-faded">No scaling groups match your search.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((group, i) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.08 * i, ease }}
            >
              <ScalingGroupCard
                group={group}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={(next) => setDeleteTarget(next)}
                toggling={Boolean(togglingIds[group.id])}
                deleting={Boolean(deletingIds[group.id])}
                canWrite={canWrite}
              />
            </motion.div>
          ))}
        </div>
      )}

      <WarningModal
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title="Delete scaling group?"
        description={
          deleteTarget
            ? `This will permanently delete ${deleteTarget.name}. Projects using it may need a new scaling configuration.`
            : "This action cannot be undone."
        }
        confirmLabel="Delete group"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
