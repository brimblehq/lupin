import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { GlossyButton } from "@/components/shared/glossy-button";
import { DashInput } from "@/components/shared/dash-input";
import { Dropdown } from "@/components/shared/dropdown";
import { ToggleSwitch } from "@/components/shared/toggle-switch";
import { RangeSlider } from "@/components/shared/range-slider";
import { DestroyTimeout, SnapshotMode, SnapshotStatus } from "@/backend/sandboxes";
import type { CreateSandboxInput, SandboxTemplate, SnapshotResponse } from "@/backend/sandboxes";
import { buildRegionLabel } from "@/lib/regions/format";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import { listRegionsServerFn } from "@/server/regions/actions";
import { createSandboxServerFn, listSandboxSnapshotsServerFn, listSandboxTemplatesServerFn } from "@/server/sandboxes/actions";
import { listVolumesServerFn } from "@/server/volumes/actions";
import { MOUNT_PATH_ERROR, MOUNT_PATH_PATTERN, MOUNT_PATH_ROOT_ERROR } from "@/lib/mount-path";

export const Route = createFileRoute("/sandboxes/new")({
  component: NewSandboxPage,
});

const DESTROY_TIMEOUT_OPTIONS = [
  { id: DestroyTimeout.ThirtyMinutes, label: "30 minutes" },
  { id: DestroyTimeout.OneHour, label: "1 hour" },
  { id: DestroyTimeout.ThreeHours, label: "3 hours" },
  { id: DestroyTimeout.SixHours, label: "6 hours" },
  { id: DestroyTimeout.TwelveHours, label: "12 hours" },
  { id: DestroyTimeout.EighteenHours, label: "18 hours" },
] as const;

const SNAPSHOT_MODE_OPTIONS = [
  { id: SnapshotMode.Manual, label: "Manual" },
  { id: SnapshotMode.Automatic, label: "Automatic" },
] as const;

const SNAPSHOT_FREQUENCY_OPTIONS = [
  { id: "*/30 * * * *", label: "Every 30 minutes" },
  { id: "0 */2 * * *", label: "Every 2 hours" },
  { id: "0 */6 * * *", label: "Every 6 hours" },
  { id: "0 0 * * *", label: "Daily" },
] as const;

const PERSISTENT_DISK_OPTIONS = [10, 15, 20, 30, 40, 50].map((value) => ({
  id: String(value),
  label: `${value} GB`,
}));

interface SandboxFormValues {
  name: string;
  useSnapshot: boolean;
  template: string;
  fromSnapshot: string;
  region: string;
  cpu: number;
  memory: number;
  disk: number;
  useExistingVolume: boolean;
  volumeId: string;
  persistent: boolean;
  persistentDiskGB: number;
  mountPath: string;
  destroyTimeout: DestroyTimeout;
  oneShot: boolean;
  blockOutbound: boolean;
  snapshotMode: SnapshotMode;
  snapshotFrequency: string;
}

interface RegionOption {
  id: string;
  label: string;
  isDefault: boolean;
}

interface VolumeOption {
  id: string;
  label: string;
  regionId: string;
  regionLabel: string;
  attachedSandboxId: string | null;
  attachedProjectId: string | null;
}

const sandboxFormSchema = Yup.object({
  name: Yup.string()
    .trim()
    .min(3, "Name should be at least 3 characters")
    .max(48, "Name should be less than 49 characters")
    .required("Sandbox name is required"),
  useSnapshot: Yup.boolean().required(),
  template: Yup.string().trim(),
  fromSnapshot: Yup.string().trim(),
  region: Yup.string().trim().required("Region is required"),
  cpu: Yup.number().integer().min(1).max(2000).required(),
  memory: Yup.number().integer().min(1).max(2048).required(),
  disk: Yup.number().integer().min(1).max(5).required(),
  useExistingVolume: Yup.boolean().required(),
  volumeId: Yup.string().trim(),
  persistent: Yup.boolean().required(),
  persistentDiskGB: Yup.number().integer().min(10).max(50).required(),
  mountPath: Yup.string().trim().test("mount-path-format", "", function (value) {
    if (!value) return true;
    if (!MOUNT_PATH_PATTERN.test(value)) return this.createError({ message: MOUNT_PATH_ERROR });
    if (value === "/") return this.createError({ message: MOUNT_PATH_ROOT_ERROR });
    return true;
  }),
  destroyTimeout: Yup.mixed<DestroyTimeout>().oneOf(Object.values(DestroyTimeout)).required(),
  oneShot: Yup.boolean().required(),
  blockOutbound: Yup.boolean().required(),
  snapshotMode: Yup.mixed<SnapshotMode>().oneOf(Object.values(SnapshotMode)).required(),
  snapshotFrequency: Yup.string().trim(),
})
  .test("storage-rule", "Storage settings are invalid", (value) => {
    if (!value) {
      return true;
    }

    if (value.useExistingVolume && value.persistent) {
      return false;
    }

    if (value.useExistingVolume) {
      return Boolean(value.volumeId);
    }

    return true;
  })
  .test("mountPath-rule", "", function (value) {
    if (!value) return true;

    const wantsPersistent = value.persistent || (value.useExistingVolume && Boolean(value.volumeId));
    const hasMount = Boolean(value.mountPath?.trim());

    if (wantsPersistent && !hasMount) {
      return this.createError({ path: "mountPath", message: "mountPath is required when using persistent storage" });
    }

    if (!wantsPersistent && hasMount) {
      return this.createError({ path: "mountPath", message: "mountPath requires persistent storage or an attached volume" });
    }

    return true;
  })
  .test("base-image-rule", "Pick a template or a snapshot", (value) => {
    if (!value) {
      return true;
    }

    if (value.useSnapshot) {
      return Boolean(value.fromSnapshot);
    }

    return Boolean(value.template);
  })
  .test("snapshot-frequency-rule", "Snapshot frequency is required for automatic snapshots", (value) => {
    if (!value) {
      return true;
    }

    if (value.snapshotMode === SnapshotMode.Automatic) {
      return Boolean(value.snapshotFrequency);
    }

    return !value.snapshotFrequency;
  });

const initialValues: SandboxFormValues = {
  name: "",
  useSnapshot: false,
  template: "",
  fromSnapshot: "",
  region: "",
  cpu: 500,
  memory: 512,
  disk: 2,
  useExistingVolume: false,
  volumeId: "",
  persistent: false,
  persistentDiskGB: 20,
  mountPath: "",
  destroyTimeout: DestroyTimeout.ThirtyMinutes,
  oneShot: false,
  blockOutbound: false,
  snapshotMode: SnapshotMode.Manual,
  snapshotFrequency: "",
};

function parseLifecycleErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Failed to create sandbox";
  }

  const lower = error.message.toLowerCase();

  if (lower.includes("plan") && lower.includes("sandbox")) {
    return "Sandbox creation is not available on your current plan.";
  }

  if (lower.includes("spending") && lower.includes("paused")) {
    return "Sandbox creation is paused for this workspace due to spending limits.";
  }

  if (lower.includes("region") && lower.includes("allowed")) {
    return "This region is not available for your current plan.";
  }

  if (lower.includes("volume") && lower.includes("region")) {
    return "The selected volume is in a different region. Pick a volume in the same region as the sandbox.";
  }

  return error.message;
}

function NewSandboxPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const workspace = (() => {
    const params = new URLSearchParams(searchStr || "");
    const value = params.get("workspace")?.trim();
    return value || undefined;
  })();

  const listRegions = useServerFn(listRegionsServerFn);
  const listTemplates = useServerFn(listSandboxTemplatesServerFn);
  const listVolumes = useServerFn(listVolumesServerFn);
  const listSnapshots = useServerFn(listSandboxSnapshotsServerFn);
  const createSandbox = useServerFn(createSandboxServerFn);

  const haptics = useHaptics();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [templateOptions, setTemplateOptions] = useState<SandboxTemplate[]>([]);
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([]);
  const [volumeOptions, setVolumeOptions] = useState<VolumeOption[]>([]);
  const [snapshotOptions, setSnapshotOptions] = useState<SnapshotResponse[]>([]);

  const formik = useFormik<SandboxFormValues>({
    initialValues,
    validationSchema: sandboxFormSchema,
    onSubmit: async (values) => {
      setSubmitting(true);
      haptics.medium();

      try {
        const useSnapshot = values.useSnapshot && Boolean(values.fromSnapshot);
        const payload: CreateSandboxInput & { workspace?: string } = {
          name: values.name,
          region: values.region,
          ...(useSnapshot ? { fromSnapshot: values.fromSnapshot } : values.template ? { template: values.template } : {}),
          specs: {
            cpu: values.cpu,
            memory: values.memory,
            disk: values.disk,
          },
          autoDestroy: true,
          destroyTimeout: values.destroyTimeout,
          oneShot: values.oneShot,
          blockOutbound: values.blockOutbound,
          ...(values.persistent
            ? {
                persistent: true,
                persistentDiskGB: values.persistentDiskGB,
              }
            : {}),
          ...(values.useExistingVolume && values.volumeId
            ? {
                volumeId: values.volumeId,
              }
            : {}),
          ...((values.persistent || (values.useExistingVolume && values.volumeId)) && values.mountPath
            ? { mountPath: values.mountPath.trim() }
            : {}),
          snapshotMode: values.snapshotMode,
          ...(values.snapshotMode === SnapshotMode.Automatic ? { snapshotFrequency: values.snapshotFrequency } : {}),
          ...(workspace ? { workspace } : {}),
        };

        const created = await createSandbox({ data: payload });

        if (!created.id) {
          throw new Error("Sandbox id missing from create response");
        }

        toast.success("Sandbox provisioning started");
        await router.invalidate({ filter: (route) => route.routeId === "/sandboxes/" });
        await navigate({
          to: "/sandboxes",
          search: workspace ? { workspace } : {},
        });
      } catch (error) {
        toast.error(parseLifecycleErrorMessage(error));
      } finally {
        setSubmitting(false);
      }
    },
  });

  const { values, errors, touched, setFieldValue, handleSubmit, handleChange, handleBlur } = formik;

  useEffect(() => {
    let active = true;

    void Promise.all([
      listTemplates(),
      listRegions({ data: { type: "sandbox", enabled: true, workspace } }),
      listVolumes({ data: { workspace, page: 1, limit: 50 } }),
      listSnapshots({ data: { page: 1, limit: 50, workspace } }),
    ])
      .then(([templates, regions, volumes, snapshots]) => {
        if (!active) {
          return;
        }

        const mappedRegions = regions
          .filter((region) => region.enabled !== false)
          .map((region) => ({
            id: region.id,
            label: buildRegionLabel(region),
            isDefault: Boolean(region.default),
          }));

        const mappedVolumes = volumes.items.map((volume) => ({
          id: volume.id,
          label: `${volume.name} (${volume.sizeGB} GB)`,
          regionId: volume.region?.id ?? "",
          regionLabel: volume.region ? buildRegionLabel(volume.region) : "—",
          attachedSandboxId: volume.attachedSandboxId,
          attachedProjectId: volume.attachedProjectId,
        }));

        setTemplateOptions(templates);
        setRegionOptions(mappedRegions);
        setVolumeOptions(mappedVolumes);
        setSnapshotOptions(snapshots.items);
      })
      .catch((error) => {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Failed to load sandbox options");
          setTemplateOptions([]);
          setRegionOptions([]);
          setVolumeOptions([]);
          setSnapshotOptions([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [listRegions, listSnapshots, listTemplates, listVolumes, workspace]);

  useEffect(() => {
    if (!templateOptions.length || values.template) {
      return;
    }

    void setFieldValue("template", templateOptions[0].name);
  }, [setFieldValue, templateOptions, values.template]);

  useEffect(() => {
    if (!regionOptions.length) {
      return;
    }

    const hasSelectedRegion = values.region && regionOptions.some((option) => option.id === values.region);
    if (hasSelectedRegion) {
      return;
    }

    const defaultRegion = regionOptions.find((option) => option.isDefault) ?? regionOptions[0];
    void setFieldValue("region", defaultRegion.id);
  }, [regionOptions, setFieldValue, values.region]);

  useEffect(() => {
    if (!values.useExistingVolume || !values.volumeId || !values.region) {
      return;
    }

    const selectedVolume = volumeOptions.find((volume) => volume.id === values.volumeId);
    if (!selectedVolume) {
      void setFieldValue("volumeId", "");
      return;
    }

    if (selectedVolume.regionId !== values.region) {
      void setFieldValue("volumeId", "");
    }
  }, [setFieldValue, values.region, values.useExistingVolume, values.volumeId, volumeOptions]);

  const attachableVolumes = useMemo(
    () =>
      volumeOptions.filter((volume) => {
        return !volume.attachedSandboxId && !volume.attachedProjectId;
      }),
    [volumeOptions],
  );

  const volumeDropdownOptions = useMemo(
    () =>
      attachableVolumes.map((volume) => {
        const mismatchedRegion = Boolean(values.region) && volume.regionId !== values.region;
        return {
          id: volume.id,
          label: volume.label,
          disabled: mismatchedRegion,
          asideText: mismatchedRegion ? volume.regionLabel : undefined,
        };
      }),
    [attachableVolumes, values.region],
  );

  const snapshotDropdownOptions = useMemo(
    () =>
      snapshotOptions.map((snapshot) => {
        const ready = snapshot.status === SnapshotStatus.Ready;
        return {
          id: snapshot.id,
          label: snapshot.name,
          disabled: !ready,
          asideText: ready ? snapshot.sourceTemplate : snapshot.status,
        };
      }),
    [snapshotOptions],
  );

  useEffect(() => {
    if (!values.useSnapshot || !values.fromSnapshot) return;
    const stillReady = snapshotOptions.some(
      (snapshot) => snapshot.id === values.fromSnapshot && snapshot.status === SnapshotStatus.Ready,
    );
    if (!stillReady) {
      void setFieldValue("fromSnapshot", "");
    }
  }, [setFieldValue, snapshotOptions, values.useSnapshot, values.fromSnapshot]);

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-[680px]">
        <div className="mb-8">
          <Link
            to={withWorkspaceQuery({ pathname: "/sandboxes", searchStr })}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-dash-text-faded transition-colors hover:text-dash-text-strong"
          >
            <ArrowLeft className="size-4" />
            Back to sandboxes
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-medium text-dash-text-strong">New sandbox</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#4879f8]/15 px-2.5 py-1 text-xs font-medium text-[#4879f8] dark:bg-[#4879f8]/20">
              <Clock className="size-3" />
              Time to live: {DESTROY_TIMEOUT_OPTIONS.find((opt) => opt.id === values.destroyTimeout)?.label ?? "—"}
            </span>
          </div>
          <p className="mt-1 text-sm text-dash-text-faded">
            Pick a template and region, configure lifecycle settings, then wait for the sandbox to become ready.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Section title="Basics" description="Identify this sandbox for your team.">
            <Field label="Sandbox name" error={touched.name ? errors.name : undefined}>
              <DashInput
                name="name"
                value={values.name}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="research-agent"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </Field>
          </Section>

          <Divider />

          <Section title="Runtime" description="Choose the base image and where this sandbox will run.">
            <ToggleRow
              title="Restore from snapshot"
              description="Skip the fresh template and boot from a snapshot you've already taken."
              checked={values.useSnapshot}
              onChange={(next) => {
                void setFieldValue("useSnapshot", next);
                if (next) {
                  void setFieldValue("template", "");
                } else {
                  void setFieldValue("fromSnapshot", "");
                }
              }}
            />

            {values.useSnapshot ? (
              <Field
                label="Snapshot"
                hint="Only ready snapshots can be restored. The new sandbox uses the snapshot's source template."
                error={touched.fromSnapshot ? errors.fromSnapshot : undefined}
              >
                <Dropdown
                  value={values.fromSnapshot}
                  options={snapshotDropdownOptions}
                  onChange={(id) => void setFieldValue("fromSnapshot", id)}
                  searchable
                  placeholder={loading ? "Loading snapshots..." : snapshotDropdownOptions.length === 0 ? "No snapshots available" : "Select snapshot"}
                />
              </Field>
            ) : (
              <Field label="Template" error={touched.template ? errors.template : undefined}>
                <Dropdown
                  value={values.template}
                  options={templateOptions.map((template) => ({ id: template.name, label: template.displayName }))}
                  onChange={(id) => void setFieldValue("template", id)}
                  placeholder={loading ? "Loading templates..." : "Select template"}
                />
              </Field>
            )}

            <Field label="Region" error={touched.region ? errors.region : undefined}>
              <Dropdown
                value={values.region}
                options={regionOptions}
                onChange={(id) => void setFieldValue("region", id)}
                searchable
                placeholder={loading ? "Loading regions..." : "Select region"}
              />
            </Field>
          </Section>

          <Divider />

          <Section title="Resources" description="Set compute and ephemeral storage limits.">
            <Field label="CPU (MHz)">
              <RangeSlider
                value={values.cpu}
                onChange={(next) => void setFieldValue("cpu", next)}
                min={1}
                max={2000}
                step={25}
                unit=" MHz"
              />
            </Field>

            <Field label="Memory (MB)">
              <RangeSlider
                value={values.memory}
                onChange={(next) => void setFieldValue("memory", next)}
                min={1}
                max={2048}
                step={64}
                unit=" MB"
              />
            </Field>

            <Field label="Ephemeral disk (GB)">
              <RangeSlider value={values.disk} onChange={(next) => void setFieldValue("disk", next)} min={1} max={5} step={1} unit=" GB" />
            </Field>
          </Section>

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => {
                haptics.selection();
                setShowAdvanced((value) => !value);
              }}
              className="flex items-center gap-1.5 text-sm text-dash-text-faded transition-colors hover:text-dash-text-strong"
            >
              {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {showAdvanced ? "Hide advanced configuration" : "Show advanced configuration"}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {showAdvanced ? (
              <motion.div
                key="advanced"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: "hidden" }}
              >
                <div className="px-px">
                  <Divider />

                  <Section title="Storage" description="Attach existing storage or provision a new persistent disk.">
                    <ToggleRow
                      title="Attach existing volume"
                      description="Use a detached volume in the same region as this sandbox."
                      checked={values.useExistingVolume}
                      onChange={(next) => {
                        void setFieldValue("useExistingVolume", next);
                        if (!next) {
                          void setFieldValue("volumeId", "");
                          return;
                        }

                        void setFieldValue("persistent", false);
                      }}
                    />

                    {values.useExistingVolume ? (
                      <Field label="Volume" error={touched.volumeId ? errors.volumeId : undefined}>
                        <Dropdown
                          value={values.volumeId}
                          options={volumeDropdownOptions}
                          onChange={(id) => void setFieldValue("volumeId", id)}
                          placeholder={attachableVolumes.length > 0 ? "Select volume" : "No detached volumes available"}
                        />
                      </Field>
                    ) : null}

                    <ToggleRow
                      title="Provision persistent disk"
                      description="Create a fresh persistent disk for this sandbox."
                      checked={values.persistent}
                      onChange={(next) => {
                        void setFieldValue("persistent", next);
                        if (next) {
                          void setFieldValue("useExistingVolume", false);
                          void setFieldValue("volumeId", "");
                        }
                      }}
                    />

                    {values.persistent ? (
                      <Field label="Persistent disk size">
                        <Dropdown
                          value={String(values.persistentDiskGB)}
                          options={PERSISTENT_DISK_OPTIONS}
                          onChange={(id) => {
                            const next = Number(id);
                            if (!Number.isNaN(next)) {
                              void setFieldValue("persistentDiskGB", next);
                            }
                          }}
                        />
                      </Field>
                    ) : null}

                    {values.persistent || values.useExistingVolume ? (
                      <Field
                        label="Mount path"
                        error={touched.mountPath ? errors.mountPath : undefined}
                      >
                        <DashInput
                          name="mountPath"
                          value={values.mountPath}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="/workspace"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                        />
                      </Field>
                    ) : null}
                  </Section>

                  <Divider />

                  <Section title="Lifecycle" description="Sandboxes are ephemeral and always auto-destroy after the chosen timeout.">
                    <Field label="Destroy after" error={touched.destroyTimeout ? errors.destroyTimeout : undefined}>
                      <Dropdown
                        value={values.destroyTimeout}
                        options={DESTROY_TIMEOUT_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
                        onChange={(id) => void setFieldValue("destroyTimeout", id)}
                      />
                    </Field>

                    <ToggleRow
                      title="One-shot sandbox"
                      description="Auto-destroy as soon as the main process exits."
                      checked={values.oneShot}
                      onChange={(next) => void setFieldValue("oneShot", next)}
                    />
                  </Section>

                  <Divider />

                  <Section title="Snapshots" description="Choose manual or scheduled snapshots.">
                    <Dropdown
                      value={values.snapshotMode}
                      options={SNAPSHOT_MODE_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
                      onChange={(id) => {
                        const mode = id === SnapshotMode.Automatic ? SnapshotMode.Automatic : SnapshotMode.Manual;
                        void setFieldValue("snapshotMode", mode);
                        if (mode === SnapshotMode.Manual) {
                          void setFieldValue("snapshotFrequency", "");
                        }
                      }}
                    />

                    {values.snapshotMode === SnapshotMode.Automatic ? (
                      <Field label="Snapshot frequency" error={touched.snapshotFrequency ? errors.snapshotFrequency : undefined}>
                        <Dropdown
                          value={values.snapshotFrequency}
                          options={SNAPSHOT_FREQUENCY_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
                          onChange={(id) => void setFieldValue("snapshotFrequency", id)}
                        />
                      </Field>
                    ) : null}
                  </Section>

                  <Divider />

                  <Section title="Network" description="Restrict outbound network access if required.">
                    <ToggleRow
                      title="Block outbound network"
                      description="Deny all outbound internet traffic from this sandbox."
                      checked={values.blockOutbound}
                      onChange={(next) => void setFieldValue("blockOutbound", next)}
                    />
                  </Section>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-end gap-3">
            <Link
              to={withWorkspaceQuery({ pathname: "/sandboxes", searchStr })}
              className="text-sm text-dash-text-faded transition-colors hover:text-dash-text-strong"
            >
              Cancel
            </Link>
            <GlossyButton type="submit" disabled={submitting || loading} loading={submitting} loadingLabel="Creating...">
              Create sandbox
            </GlossyButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-dash-text-strong">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-dash-text-faded">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div
      className={`flex flex-col gap-1 ${
        error
          ? "[&_.input-base]:!shadow-[0_0_0_1px_#ef2f1f,0_0_0_3px_rgba(239,47,31,0.15)] [&_textarea]:!shadow-[0_0_0_1px_#ef2f1f,0_0_0_3px_rgba(239,47,31,0.15)]"
          : ""
      }`}
    >
      <label className="text-sm text-dash-text-body">{label}</label>
      {children}
      {error ? <p className="text-xs text-[#f05252]">{error}</p> : hint ? <p className="text-xs text-dash-text-faded">{hint}</p> : null}
    </div>
  );
}

function Divider() {
  return <hr className="my-6 border-dash-border-soft" />;
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm leading-5 text-dash-text-strong">{title}</p>
        <p className="text-xs leading-[1.4] text-dash-text-faded">{description}</p>
      </div>
      <div className="mt-0.5 shrink-0">
        <ToggleSwitch checked={checked} onChange={onChange} />
      </div>
    </div>
  );
}
