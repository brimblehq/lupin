import { useState, useEffect } from "react";
import { IpWhitelist } from "@/components/shared/ip-whitelist";
import {
  createFileRoute,
  getRouteApi,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import {
  GearSix,
  Hammer,
  Cpu,
  Warning,
  DatabaseIcon,
} from "@phosphor-icons/react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { Formik } from "formik";
import { GlossyButton } from "../../../components/shared/glossy-button";
import { TabHeader } from "../../../components/shared/tab-header";
import { WarningModal } from "../../../components/shared/warning-modal";
import { RootDirectoryDrawer } from "../../../components/project/root-directory-drawer";
import { RangeSlider } from "../../../components/shared/range-slider";
import { Dropdown } from "../../../components/shared/dropdown";
import { ToggleSwitch } from "../../../components/shared/toggle-switch";
import { RootDirectoryTrigger } from "../../../components/shared/root-directory-trigger";
import {
  updateDatabaseProjectConfigServerFn,
  saveProjectGeneralConfigServerFn,
  saveProjectBuildConfigServerFn,
  deleteProjectServerFn,
  moveProjectEnvironmentServerFn,
} from "@/server/projects/actions";
import { listProjectEnvironmentsServerFn } from "@/server/environments/actions";
import type { ProjectEnvironment } from "@/backend/environments";
import { listScalingGroupsServerFn } from "@/server/scaling/actions";
import { listRegionsServerFn } from "@/server/regions/actions";
import type { FrameworkOption } from "@/backend/frameworks";
import type { RepositoryMetadata } from "@/backend/repositories";
import type { ScalingGroup } from "@/backend/scaling";
import type { Region } from "@/backend/regions";
import { listFrameworksServerFn } from "@/server/frameworks/actions";
import { getGithubRepoServerFn } from "@/server/repositories/actions";
import { mapFrameworksToDropdownOptions } from "@/utils/framework-dropdown";
import {
  formatMemory,
  normalizeCpuValue,
  normalizeMemoryGbValue,
} from "@/utils/project-configuration";
import {
  getConfigurationDescription,
  isDatabaseProject,
  isStaticProject,
  shouldShowBranchRootFrameworkFields,
  shouldShowBuildCacheToggle,
  shouldShowBuildSection,
  shouldShowDockerSourceFields,
  shouldShowHealthCheckField,
  shouldShowMcpAuthToggle,
  shouldShowPersistentStorageField,
  shouldShowScalingGroupField,
} from "@/utils/project-capabilities";
import {
  generalConfigSchema,
  databaseConfigSchema,
  resourcesConfigSchema,
} from "@/utils/configuration-schemas";
import type {
  GeneralConfigValues,
  DatabaseConfigValues,
  ResourcesConfigValues,
} from "@/utils/configuration-schemas";

const parentRoute = getRouteApi("/projects/$projectId");

export const Route = createFileRoute("/projects/$projectId/configuration")({
  staleTime: 120_000,
  preloadStaleTime: 120_000,
  loader: async ({ context }) => {
    const project = (context as any).project;
    const workspace = (context as any).workspace;

    let repo: RepositoryMetadata | null = null;
    let frameworks: FrameworkOption[] = [];
    let scalingGroups: ScalingGroup[] = [];
    let regions: Region[] = [];
    let environments: ProjectEnvironment[] = [];
    const repoName = project?.repo?.fullName || project?.repo?.name;
    const installationId = project?.repo?.installationId;

    const tasks: Promise<void>[] = [];

    tasks.push(
      (
        listFrameworksServerFn as unknown as (input: {
          data?: undefined;
        }) => Promise<
          | FrameworkOption[]
          | { result?: FrameworkOption[]; data?: FrameworkOption[] }
        >
      )({
        data: undefined,
      })
        .then((items) => {
          let parsedItems: FrameworkOption[] = [];

          if (Array.isArray(items)) {
            parsedItems = items;
          } else if (items && typeof items === "object") {
            if (Array.isArray((items as any).result)) {
              parsedItems = (items as any).result;
            } else if (Array.isArray((items as any).data)) {
              parsedItems = (items as any).data;
            }
          }

          if (Array.isArray(parsedItems)) {
            frameworks = parsedItems;
          } else {
            frameworks = [];
          }
        })
        .catch(() => {
          frameworks = [];
        }),
    );

    tasks.push(
      (
        listScalingGroupsServerFn as unknown as (input: {
          data?: { workspace?: string };
        }) => Promise<
          | { items: ScalingGroup[]; message?: string }
          | {
              result?: { items?: ScalingGroup[]; message?: string };
              data?: { items?: ScalingGroup[]; message?: string };
            }
        >
      )({
        data: { workspace },
      })
        .then((result) => {
          if (result && typeof result === "object") {
            if (Array.isArray((result as any).items)) {
              scalingGroups = (result as any).items;
              return;
            }

            if (Array.isArray((result as any).result?.items)) {
              scalingGroups = (result as any).result.items;
              return;
            }

            if (Array.isArray((result as any).data?.items)) {
              scalingGroups = (result as any).data.items;
              return;
            }
          }

          scalingGroups = [];
        })
        .catch(() => {
          scalingGroups = [];
        }),
    );

    tasks.push(
      (
        listRegionsServerFn as unknown as (input: {
          data?: { type?: string; enabled?: boolean; teamId?: string };
        }) => Promise<Region[]>
      )({
        data: { type: "web", enabled: true },
      })
        .then((items) => {
          regions = Array.isArray(items) ? items : [];
        })
        .catch(() => {
          regions = [];
        }),
    );

    tasks.push(
      (
        listProjectEnvironmentsServerFn as unknown as (input: {
          data?: { workspace?: string };
        }) => Promise<ProjectEnvironment[]>
      )({
        data: { workspace },
      })
        .then((items) => {
          environments = Array.isArray(items) ? items : [];
        })
        .catch(() => {
          environments = [];
        }),
    );

    if (repoName) {
      tasks.push(
        (
          getGithubRepoServerFn as unknown as (input: {
            data: { repoName: string; installationId?: number | string };
          }) => Promise<RepositoryMetadata>
        )({
          data: { repoName, installationId },
        })
          .then((result) => {
            repo = result;
          })
          .catch(() => {
            repo = null;
          }),
      );
    }

    await Promise.all(tasks);

    return {
      repo,
      frameworks,
      scalingGroups,
      regions,
      environments,
      workspace,
    };
  },
  component: ConfigurationPage,
});

/* ─── Constants ─── */

const ease = [0.16, 1, 0.3, 1] as const;

const inputClass =
  "w-full input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]";

const PERSISTENT_STORAGE_PRICE_PER_GB = 0.25;

function normalizeStorageValue(value: unknown, fallback = 1): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const diskSizes = Array.from({ length: 15 }, (_, index) => {
  const size = (index + 1) * 10;
  return {
    id: String(size),
    label: `${size} GB ($${size * PERSISTENT_STORAGE_PRICE_PER_GB}/month)`,
  };
});

import { ConfigSection } from "../../../types/enums";

const allSections: {
  id: ConfigSection;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    id: ConfigSection.General,
    label: "General",
    icon: <GearSix size={16} weight="duotone" />,
  },
  {
    id: ConfigSection.Build,
    label: "Build & Deploy",
    icon: <Hammer size={16} weight="duotone" />,
  },
  {
    id: ConfigSection.Resources,
    label: "Resources",
    icon: <Cpu size={16} weight="duotone" />,
  },
  {
    id: ConfigSection.Danger,
    label: "Danger zone",
    icon: <Warning size={16} weight="duotone" />,
  },
];

/* ─── ConfigInput ─── */

/* ─── Section: General ─── */

function EnvironmentSection({
  projectId,
  currentEnvironmentId,
  workspace,
  initialEnvironments = [],
  canWrite = true,
}: {
  projectId: string;
  currentEnvironmentId?: string | null;
  workspace?: string;
  initialEnvironments?: ProjectEnvironment[];
  canWrite?: boolean;
}) {
  const router = useRouter();
  const [environments, setEnvironments] =
    useState<ProjectEnvironment[]>(initialEnvironments);
  const [selectedId, setSelectedId] = useState(() => {
    if (
      currentEnvironmentId &&
      initialEnvironments.some((env) => env._id === currentEnvironmentId)
    ) {
      return currentEnvironmentId;
    }

    const defaultEnvironment =
      initialEnvironments.find((env) => env.isDefault) ??
      initialEnvironments[0];
    return defaultEnvironment?._id ?? "";
  });
  const [inheritEnvVars, setInheritEnvVars] = useState(true);
  const [saving, setSaving] = useState(false);

  const listEnvironments = useServerFn(
    listProjectEnvironmentsServerFn as any,
  ) as (args: {
    data: { workspace?: string };
  }) => Promise<ProjectEnvironment[]>;
  const moveProject = useServerFn(
    moveProjectEnvironmentServerFn as any,
  ) as (args: {
    data: {
      projectId: string;
      environmentId: string;
      inheritEnvVars?: boolean;
      workspace?: string;
    };
  }) => Promise<{ id: string; environmentId: string; inheritEnvVars: boolean }>;

  useEffect(() => {
    setEnvironments(initialEnvironments);
  }, [initialEnvironments]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const envs = await listEnvironments({ data: { workspace } });
        if (!cancelled && Array.isArray(envs)) {
          setEnvironments(envs);
          if (
            !selectedId ||
            !envs.some((environment) => environment._id === selectedId)
          ) {
            const defaultEnv = envs.find((e) => e.isDefault);
            setSelectedId(defaultEnv?._id ?? envs[0]?._id ?? "");
          }
        }
      } catch {
        // keep empty
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  useEffect(() => {
    if (
      currentEnvironmentId &&
      environments.some(
        (environment) => environment._id === currentEnvironmentId,
      )
    ) {
      setSelectedId(currentEnvironmentId);
    }
  }, [currentEnvironmentId, environments]);

  useEffect(() => {
    setInheritEnvVars(true);
  }, [selectedId]);

  const isDirty =
    environments.length > 0 && selectedId !== (currentEnvironmentId ?? "");
  const options = environments.map((e) => ({ id: e._id, label: e.name }));

  return (
    <div className="mb-6 rounded-[4px] border-[0.5px] border-dash-border">
      <div className="flex items-center justify-between gap-4 px-4 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label className="text-sm font-medium text-dash-text-strong">
            Environment
          </label>
          <Dropdown
            value={selectedId}
            options={options}
            onChange={setSelectedId}
            placeholder="Select environment..."
            disabled={!canWrite}
          />
        </div>
      </div>
      {isDirty && (
        <div className="flex items-center justify-between gap-4 border-t border-dash-border px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-dash-text-body">
            <input
              type="checkbox"
              checked={inheritEnvVars}
              onChange={(e) => setInheritEnvVars(e.target.checked)}
              disabled={!canWrite}
              className="size-4 rounded border-dash-border accent-[#4879f8]"
            />
            Inherit environment variables
          </label>
          <GlossyButton
            variant="black"
            disabled={!canWrite || saving}
            loading={saving}
            loadingLabel="Saving..."
            onClick={async () => {
              setSaving(true);
              try {
                const result = await moveProject({
                  data: {
                    projectId,
                    environmentId: selectedId,
                    inheritEnvVars,
                    workspace,
                  },
                });
                setSelectedId(result.environmentId);
                toast.success("Environment updated successfully");
                await router.invalidate();
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Failed to update environment",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            Move
          </GlossyButton>
        </div>
      )}
    </div>
  );
}

function GeneralSection({
  initialValues,
  onSubmit,
  branchOptions,
  rootDir,
  onOpenDrawer,
  frameworkOptions,
  regionOptions,
  showSourceFields,
  dockerSourceImage,
  showMcpAuthControl,
  showBuildCacheControl,
  canWrite = true,
}: {
  initialValues: GeneralConfigValues;
  onSubmit: (values: GeneralConfigValues) => Promise<void>;
  branchOptions: { id: string; label: string }[];
  rootDir: string;
  onOpenDrawer: () => void;
  frameworkOptions: { id: string; label: string; icon?: string }[];
  regionOptions: { id: string; label: string }[];
  showSourceFields: boolean;
  dockerSourceImage?: string;
  showMcpAuthControl: boolean;
  showBuildCacheControl: boolean;
  canWrite?: boolean;
}) {
  return (
    <Formik
      initialValues={initialValues}
      validationSchema={generalConfigSchema}
      onSubmit={(values, { setSubmitting }) => {
        onSubmit(values)
          .catch(() => {})
          .finally(() => setSubmitting(false));
      }}
      enableReinitialize
    >
      {({
        values,
        errors,
        touched,
        dirty,
        isSubmitting,
        handleSubmit,
        handleChange,
        handleBlur,
        setFieldValue,
      }) => (
        <form
          className="rounded-[4px] border-[0.5px] border-dash-border"
          onSubmit={handleSubmit}
        >
          {/* Row 1: Project name */}
          <div className="flex flex-col gap-1.5 px-4 py-4">
            <label className="text-sm font-medium text-dash-text-strong">
              Project name
            </label>
            <div
              className="input-base input-focus-within flex items-stretch overflow-hidden"
              style={
                touched.name && errors.name
                  ? {
                      boxShadow:
                        "0px 1px 2px rgba(239,47,31,0.3), 0px 0px 0px 1px #ef2f1f",
                    }
                  : undefined
              }
            >
              <div className="flex items-center border-r border-dash-border px-3">
                <span className="whitespace-nowrap text-sm leading-6 text-dash-text-faded">
                  brimble.io/
                </span>
              </div>
              <input
                type="text"
                name="name"
                value={values.name}
                onChange={handleChange}
                onBlur={handleBlur}
                readOnly={!canWrite}
                className="w-full bg-transparent px-3 py-2.5 text-sm leading-6 text-dash-text-strong outline-none"
              />
            </div>
            {touched.name && errors.name && (
              <span className="text-xs text-[#ef2f1f]">{errors.name}</span>
            )}
          </div>

          <hr className="border-dash-border" />

          {showSourceFields ? (
            <>
              {/* Row 2: Branch to deploy */}
              <div className="flex flex-col gap-1.5 px-4 py-4">
                <label className="text-sm font-medium text-dash-text-strong">
                  Branch to deploy
                </label>
                <Dropdown
                  value={values.branch}
                  options={branchOptions}
                  onChange={(v) => setFieldValue("branch", v)}
                  placeholder="Select branch..."
                  disabled={!canWrite}
                />
              </div>

              <hr className="border-dash-border" />

              {/* Row 3: Root directory */}
              <div className="flex flex-col gap-1.5 px-4 py-4">
                <label className="text-sm font-medium text-dash-text-strong">
                  Root directory
                </label>
                <RootDirectoryTrigger value={rootDir} onClick={canWrite ? onOpenDrawer : undefined} />
              </div>

              <hr className="border-dash-border" />

              {/* Row 4: Framework */}
              <div className="flex flex-col gap-1.5 px-4 py-4">
                <label className="text-sm font-medium text-dash-text-strong">
                  Framework
                </label>
                <Dropdown
                  value={values.framework}
                  options={frameworkOptions}
                  onChange={(v) => setFieldValue("framework", v)}
                  placeholder="Select framework..."
                  disabled={!canWrite}
                />
              </div>

              <hr className="border-dash-border" />
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 px-4 py-4">
                <label className="text-sm font-medium text-dash-text-strong">
                  Source image
                </label>
                <div
                  className={`${inputClass} flex items-center font-family-mono text-[13px]`}
                >
                  <span className="truncate">
                    {dockerSourceImage || "Docker source project"}
                  </span>
                </div>
                <p className="text-xs text-dash-text-faded">
                  This project is configured from a Docker image source, so
                  branch, root directory and framework presets are not used.
                </p>
              </div>
              <hr className="border-dash-border" />
            </>
          )}

          {/* Region */}
          {regionOptions.length > 0 && (
            <>
              <div className="flex flex-col gap-1.5 px-4 py-4">
                <label className="text-sm font-medium text-dash-text-strong">
                  Region
                </label>
                <Dropdown
                  value={values.region}
                  options={regionOptions}
                  onChange={(v) => setFieldValue("region", v)}
                  placeholder="Select region..."
                  disabled={!canWrite}
                />
              </div>
              <hr className="border-dash-border" />
            </>
          )}

          {(showBuildCacheControl || showMcpAuthControl) && (
            <>
              <div className="flex flex-col gap-3 px-4 py-4">
                {showBuildCacheControl && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-dash-text-strong">
                        Enable Build Cache on Redeploy
                      </span>
                      <span className="text-xs text-dash-text-faded">
                        Reuse the previous build cache to speed up redeploys.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={values.buildCacheEnabled}
                      onChange={(v) => setFieldValue("buildCacheEnabled", v)}
                      disabled={!canWrite}
                    />
                  </div>
                )}
                {showMcpAuthControl && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-dash-text-strong">
                        Enable Authentication
                      </span>
                      <span className="text-xs text-dash-text-faded">
                        Require API key authentication for your MCP server.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={values.authEnabled}
                      onChange={(v) => setFieldValue("authEnabled", v)}
                      disabled={!canWrite}
                    />
                  </div>
                )}
              </div>
              <hr className="border-dash-border" />
            </>
          )}

          <div className="flex justify-end px-4 py-4">
            <GlossyButton
              type="submit"
              disabled={!canWrite || !dirty || isSubmitting}
              loading={isSubmitting}
              loadingLabel="Saving..."
            >
              Save
            </GlossyButton>
          </div>
        </form>
      )}
    </Formik>
  );
}

/* ─── Section: Build & Deploy ─── */

interface BuildInitialValues {
  installCommand: string;
  buildCommand: string;
  startCommand: string;
  healthCheckPath: string;
  preStartCommand: string;
  dockerImage: string;
}

function BuildSection({
  initialValues,
  onSubmit,
  showCommands = true,
  showHealthCheck = true,
  showDockerSourceFields = false,
  canWrite = true,
}: {
  initialValues: BuildInitialValues;
  onSubmit: (values: BuildInitialValues) => Promise<void>;
  showCommands?: boolean;
  showHealthCheck?: boolean;
  showDockerSourceFields?: boolean;
  canWrite?: boolean;
}) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(initialValues);
  }, [
    initialValues.installCommand,
    initialValues.buildCommand,
    initialValues.startCommand,
    initialValues.healthCheckPath,
    initialValues.preStartCommand,
    initialValues.dockerImage,
  ]);

  const dirty =
    values.installCommand !== initialValues.installCommand ||
    values.buildCommand !== initialValues.buildCommand ||
    values.startCommand !== initialValues.startCommand ||
    values.healthCheckPath !== initialValues.healthCheckPath ||
    values.preStartCommand !== initialValues.preStartCommand ||
    values.dockerImage !== initialValues.dockerImage;

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
      {showDockerSourceFields && (
        <>
          <div className="flex flex-col gap-1.5 px-4 py-4">
            <label className="text-sm font-medium text-dash-text-strong">
              PreStart command
            </label>
            <input
              type="text"
              value={values.preStartCommand}
              onChange={(e) =>
                setValues((v) => ({ ...v, preStartCommand: e.target.value }))
              }
              placeholder="apk add curl"
              readOnly={!canWrite}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-dash-text-faded">
              Runs in an Alpine environment before your container starts.
            </p>
          </div>
          <hr className="border-dash-border" />
          <div className="flex flex-col gap-1.5 px-4 py-4">
            <label className="text-sm font-medium text-dash-text-strong">
              Docker image
            </label>
            <input
              type="text"
              value={values.dockerImage}
              onChange={(e) =>
                setValues((v) => ({ ...v, dockerImage: e.target.value }))
              }
              placeholder="docker.io/library/nginx:latest"
              readOnly={!canWrite}
              className={`${inputClass} font-family-mono text-[13px]`}
            />
          </div>
          <hr className="border-dash-border" />
        </>
      )}

      {showCommands && (
        <>
          {/* Row 1: Install command */}
          <div className="flex flex-col gap-1.5 px-4 py-4">
            <label className="text-sm font-medium text-dash-text-strong">
              Install command
            </label>
            <input
              type="text"
              value={values.installCommand}
              onChange={(e) =>
                setValues((v) => ({ ...v, installCommand: e.target.value }))
              }
              placeholder="npm install"
              readOnly={!canWrite}
              className={inputClass}
            />
          </div>

          <hr className="border-dash-border" />

          {/* Row 2: Build command */}
          <div className="flex flex-col gap-1.5 px-4 py-4">
            <label className="text-sm font-medium text-dash-text-strong">
              Build command
            </label>
            <input
              type="text"
              value={values.buildCommand}
              onChange={(e) =>
                setValues((v) => ({ ...v, buildCommand: e.target.value }))
              }
              placeholder="npm run build"
              readOnly={!canWrite}
              className={inputClass}
            />
          </div>

          <hr className="border-dash-border" />

          {/* Row 3: Start command */}
          <div className="flex flex-col gap-1.5 px-4 py-4">
            <label className="text-sm font-medium text-dash-text-strong">
              Start command
            </label>
            <input
              type="text"
              value={values.startCommand}
              onChange={(e) =>
                setValues((v) => ({ ...v, startCommand: e.target.value }))
              }
              placeholder="npm start"
              readOnly={!canWrite}
              className={inputClass}
            />
          </div>
          <hr className="border-dash-border" />
        </>
      )}

      {showHealthCheck && (
        <div className="flex flex-col gap-1.5 px-4 py-4">
          <label className="text-sm font-medium text-dash-text-strong">
            Health check path
          </label>
          <input
            type="text"
            value={values.healthCheckPath}
            onChange={(e) =>
              setValues((v) => ({ ...v, healthCheckPath: e.target.value }))
            }
            placeholder="/api/health"
            readOnly={!canWrite}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-dash-text-faded">
            Health check endpoint to monitor your application's status
          </p>
        </div>
      )}

      {!showHealthCheck && !showCommands && !showDockerSourceFields && (
        <div className="px-4 py-5 text-sm font-light text-dash-text-faded">
          Build & deploy settings are not available for this service type.
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end border-t border-dash-border px-4 py-3">
        <GlossyButton
          disabled={!canWrite || !dirty || saving}
          loading={saving}
          loadingLabel="Saving..."
          onClick={handleSave}
        >
          Save
        </GlossyButton>
      </div>
    </div>
  );
}

/* ─── Section: Resources ─── */

function ResourcesSection({
  initialValues,
  onSubmit,
  scalingGroupOptions,
  showScalingGroup = true,
  showPersistentStorage = true,
  canSave = true,
  canWrite = true,
}: {
  initialValues: ResourcesConfigValues;
  onSubmit?: (values: ResourcesConfigValues) => Promise<void>;
  scalingGroupOptions: { id: string; label: string }[];
  showScalingGroup?: boolean;
  showPersistentStorage?: boolean;
  canSave?: boolean;
  canWrite?: boolean;
}) {
  return (
    <Formik
      initialValues={initialValues}
      validationSchema={resourcesConfigSchema}
      onSubmit={(values, { setSubmitting }) => {
        if (!onSubmit) return;
        onSubmit(values)
          .catch(() => {})
          .finally(() => setSubmitting(false));
      }}
      enableReinitialize
    >
      {({ values, dirty, isSubmitting, handleSubmit, setFieldValue }) => (
        <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
          {/* Row 1: CPU */}
          <div className="flex flex-col gap-2 px-4 py-4">
            <label className="text-sm font-medium text-dash-text-strong">
              CPU
            </label>
            <p className="text-sm font-light leading-[1.3] text-dash-text-faded">
              CPU resources allocated to each container
            </p>
            <RangeSlider
              value={values.cpuValue}
              onChange={(v) => setFieldValue("cpuValue", v)}
              min={0.5}
              max={8}
              step={0.5}
              unit=" vCPU"
              disabled={!canWrite}
            />
          </div>

          <hr className="border-dash-border" />

          {/* Row 2: Memory */}
          <div className="flex flex-col gap-2 px-4 py-4">
            <label className="text-sm font-medium text-dash-text-strong">
              Memory
            </label>
            <p className="text-sm font-light leading-[1.3] text-dash-text-faded">
              Memory allocated to each container
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <RangeSlider
                  value={values.memoryValue}
                  onChange={(v) => setFieldValue("memoryValue", v)}
                  min={0.5}
                  max={12}
                  step={0.5}
                  hideValue
                  disabled={!canWrite}
                />
              </div>
              <span className="min-w-[52px] text-right text-sm font-medium text-dash-text-strong">
                {formatMemory(values.memoryValue)}
              </span>
            </div>
          </div>

          <hr className="border-dash-border" />

          {showScalingGroup && (
            <>
              {/* Row 3: Scaling group */}
              <div className="flex flex-col gap-1.5 px-4 py-4">
                <label className="text-sm font-medium text-dash-text-strong">
                  Scaling group
                </label>
                <p className="text-sm font-light leading-[1.3] text-dash-text-faded">
                  Attach to a scaling group for automatic instance management
                </p>
                <Dropdown
                  value={values.scalingGroup}
                  options={scalingGroupOptions}
                  onChange={(v) => setFieldValue("scalingGroup", v)}
                  placeholder="Select scaling group..."
                  disabled={!canWrite}
                />
              </div>

              <hr className="border-dash-border" />
            </>
          )}

          {showPersistentStorage && (
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DatabaseIcon
                    size={16}
                    weight="duotone"
                    className="text-dash-text-faded"
                  />
                  <span className="text-sm font-medium text-dash-text-strong">
                    Persistent Storage
                  </span>
                </div>
                <ToggleSwitch
                  checked={values.diskEnabled}
                  onChange={(v) => setFieldValue("diskEnabled", v)}
                  size="sm"
                  disabled={!canWrite}
                />
              </div>
              <p className="mt-1 ml-6 text-sm font-light leading-[1.3] text-dash-text-faded">
                Attach a volume that persists across restarts and deployments.
              </p>

              <AnimatePresence>
                {values.diskEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                    animate={{
                      opacity: 1,
                      height: "auto",
                      transitionEnd: { overflow: "visible" },
                    }}
                    exit={{ overflow: "hidden", opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease }}
                  >
                    <div className="mt-4 flex flex-col gap-4">
                      <div className="grid grid-cols-1 gap-3 px-px pb-px sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs text-dash-text-faded">
                            Disk size
                          </label>
                          <Dropdown
                            value={values.diskSize}
                            options={diskSizes}
                            onChange={(v) => setFieldValue("diskSize", v)}
                            disabled={!canWrite}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-dash-text-faded">
                            Mount path
                          </label>
                          <input
                            type="text"
                            value={values.mountPath}
                            onChange={(e) =>
                              setFieldValue("mountPath", e.target.value)
                            }
                            placeholder="/mnt/data"
                            readOnly={!canWrite}
                            className={`${inputClass} font-family-mono text-[13px]`}
                          />
                        </div>
                      </div>

                      <div className="rounded-[4px] bg-[#4879f8]/[0.04] px-3 py-2.5 dark:bg-[#4879f8]/[0.08]">
                        <p className="text-xs leading-relaxed text-dash-text-body">
                          <span className="font-medium text-[#4879f8]">
                            ${PERSISTENT_STORAGE_PRICE_PER_GB}/GB per month.
                          </span>{" "}
                          Data persists across container restarts and
                          deployments. The volume mounts at{" "}
                          <code className="rounded bg-dash-bg-elevated px-1 py-0.5 font-family-mono text-[11px] text-dash-text-strong">
                            {values.mountPath || "/mnt/data"}
                          </code>{" "}
                          inside your container.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end border-t border-dash-border px-4 py-3">
            <GlossyButton
              disabled={!canWrite || !canSave || !dirty || isSubmitting}
              loading={isSubmitting}
              loadingLabel="Saving..."
              onClick={() => handleSubmit()}
            >
              Save
            </GlossyButton>
          </div>
        </div>
      )}
    </Formik>
  );
}

/* ─── Section: Database Configuration ─── */

function DatabaseConfigurationPanel({
  initialValues,
  onSubmit,
  region,
  dbImageName,
  canWrite = true,
}: {
  initialValues: DatabaseConfigValues;
  onSubmit: (values: DatabaseConfigValues) => Promise<void>;
  region?: string;
  dbImageName?: string;
  canWrite?: boolean;
}) {
  return (
    <Formik
      initialValues={initialValues}
      validationSchema={databaseConfigSchema}
      onSubmit={(values, { setSubmitting, setFieldValue }) => {
        onSubmit(values)
          .then(() => {
            setFieldValue("password", "");
            setFieldValue("confirmPassword", "");
          })
          .catch(() => {})
          .finally(() => setSubmitting(false));
      }}
      enableReinitialize
    >
      {({
        values,
        errors,
        touched,
        isSubmitting,
        handleSubmit,
        handleChange,
        handleBlur,
        setFieldValue,
      }) => {
        const hasPassword = values.password.trim().length > 0;
        const passwordError = touched.confirmPassword && errors.confirmPassword;
        const canSave = (hasPassword ? !passwordError : true) && !isSubmitting;
        const isPublicAccess = (values.whitelistIps ?? []).some(
          (ip) => ip.value === "0.0.0.0/0",
        );

        return (
          <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
            <div className="flex flex-col gap-1.5 px-4 py-4">
              <label className="text-sm font-medium text-dash-text-strong">
                Project name
              </label>
              <input
                type="text"
                name="name"
                value={values.name}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Project name"
                readOnly={!canWrite}
                className={inputClass}
              />
              {touched.name && errors.name && (
                <span className="text-xs text-[#ef2f1f]">{errors.name}</span>
              )}
            </div>
            <hr className="border-dash-border" />
            <div className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-dash-text-strong">
                  Database engine
                </span>
                <span className="text-sm font-light text-dash-text-faded">
                  {dbImageName || "Unknown"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-dash-text-strong">
                  Region
                </span>
                <span className="text-sm font-light text-dash-text-faded">
                  {region || "Unknown"}
                </span>
              </div>
            </div>
            <hr className="border-dash-border" />
            <div className="flex flex-col gap-3 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-dash-text-strong">
                    Public connection
                  </span>
                  <span className="text-xs text-dash-text-faded">
                    Control whether your database can be accessed from any IP
                    address.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPublicAccess}
                  disabled={!canWrite}
                  onClick={() => {
                    if (isPublicAccess) {
                      setFieldValue("whitelistIps", []);
                    } else {
                      setFieldValue("whitelistIps", [
                        { id: 0, value: "0.0.0.0/0" },
                      ]);
                    }
                  }}
                  className={`${isPublicAccess ? "bg-[#3b82f6]" : "bg-[#6b7280]"} relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors`}
                >
                  <span
                    className={`${isPublicAccess ? "translate-x-6" : "translate-x-1"} inline-block size-4 rounded-full bg-white transition-transform`}
                  />
                </button>
              </div>
              {isPublicAccess ? (
                <p className="text-xs text-[#f59e0b]">
                  Your database is accessible from any IP address. Only enable
                  this if you understand the security implications.
                </p>
              ) : (
                <IpWhitelist
                  ips={values.whitelistIps ?? []}
                  onAdd={() => {
                    const current = values.whitelistIps ?? [];
                    const nextId =
                      current.length > 0
                        ? Math.max(...current.map((ip) => ip.id)) + 1
                        : 0;
                    setFieldValue("whitelistIps", [
                      ...current,
                      { id: nextId, value: "" },
                    ]);
                  }}
                  onRemove={(id) => {
                    setFieldValue(
                      "whitelistIps",
                      (values.whitelistIps ?? []).filter((ip) => ip.id !== id),
                    );
                  }}
                  onUpdate={(id, value) => {
                    setFieldValue(
                      "whitelistIps",
                      (values.whitelistIps ?? []).map((ip) =>
                        ip.id === id ? { ...ip, value } : ip,
                      ),
                    );
                  }}
                  inputClassName={`${inputClass} flex-1 font-family-mono text-[13px]`}
                />
              )}
            </div>
            <hr className="border-dash-border" />
            <div className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-dash-text-strong">
                  Database password
                </label>
                <input
                  type="password"
                  name="password"
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter new password"
                  readOnly={!canWrite}
                  className={inputClass}
                  autoComplete="new-password"
                />
                <p className="text-xs text-dash-text-faded">
                  Set a new password for database connections.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-dash-text-strong">
                  Confirm password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={values.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Re-enter password"
                  readOnly={!canWrite}
                  className={inputClass}
                  autoComplete="new-password"
                />
                {passwordError && (
                  <p className="text-xs text-[#ef2f1f]">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end border-t border-dash-border px-4 py-3">
              <GlossyButton
                disabled={!canWrite || !canSave}
                loading={isSubmitting}
                loadingLabel="Saving..."
                onClick={() => handleSubmit()}
              >
                Save
              </GlossyButton>
            </div>
          </div>
        );
      }}
    </Formik>
  );
}

/* ─── Section: Danger zone ─── */

function DangerSection({
  maintenanceMode,
  setMaintenanceMode,
  projectName,
  projectId,
  workspace,
}: {
  maintenanceMode: boolean;
  setMaintenanceMode: (v: boolean) => void;
  projectName: string;
  projectId: string;
  workspace?: string;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const deleteProject = useServerFn(deleteProjectServerFn as any) as (args: {
    data: { projectId: string; workspace?: string };
  }) => Promise<{ success: boolean }>;

  return (
    <>
      <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border border-t-2 border-t-red-400/40">
        {/* Row 1: Maintenance mode */}
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-medium text-dash-text-strong">
              Toggle Maintenance mode
            </h4>
            <p className="text-sm font-light leading-[1.3] text-dash-text-faded">
              Maintenance mode allows your team perform upgrades and tests
              without deploying to production.{" "}
              <a href="#" className="text-[#008cff] underline">
                Learn about Maintenance mode.
              </a>
            </p>
          </div>
          <ToggleSwitch
            checked={maintenanceMode}
            onChange={setMaintenanceMode}
          />
        </div>

        <hr className="border-dash-border" />

        {/* Row 2: Delete project */}
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-medium text-dash-text-strong">
              Delete project
            </h4>
            <p className="text-sm font-light leading-[1.3] text-dash-text-faded">
              Permanently delete{" "}
              <span className="font-normal text-dash-text-strong">
                brimble.io/{projectName}
              </span>{" "}
              and all its deployments.
            </p>
          </div>
          <button
            onClick={() => setDeleteOpen(true)}
            className="shrink-0 rounded-[4px] border border-red-500/30 bg-gradient-to-b from-red-500 via-red-600 to-red-700 px-4 py-[5px] text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-opacity hover:opacity-90"
          >
            Delete project
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <WarningModal
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setConfirmText("");
        }}
        title="Delete this project?"
        description="This action cannot be undone. All deployments, domains, and environment variables associated with this project will be permanently deleted."
        confirmLabel="Delete project"
        cancelLabel="Cancel"
        confirmDisabled={confirmText !== projectName || deleting}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await deleteProject({
              data: { projectId, workspace },
            });
            toast.success("Project deleted successfully");
            await navigate({
              to: "/projects",
              search: workspace ? { workspace } : {},
            });
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Failed to delete project",
            );
          } finally {
            setDeleting(false);
          }
        }}
      >
        <div className="flex flex-col gap-2 text-left">
          <label className="text-sm leading-5 text-dash-text-faded">
            Type{" "}
            <span className="font-medium text-dash-text-strong">
              {projectName}
            </span>{" "}
            to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            placeholder={projectName}
            className={inputClass}
            autoFocus
          />
        </div>
      </WarningModal>
    </>
  );
}

/* ─── Main Page ─── */

function ConfigurationPage() {
  const { project, workspace } = parentRoute.useLoaderData() as any;
  const {
    repo,
    frameworks,
    scalingGroups,
    regions,
    environments: preloadedEnvironments,
  } = Route.useLoaderData();
  const params = Route.useParams();
  const navigate = useNavigate();
  const saveGeneralConfig = useServerFn(
    saveProjectGeneralConfigServerFn as any,
  ) as (args: {
    data: {
      projectId: string;
      workspace?: string;
      name: string;
      branch?: string;
      rootDirectory?: string;
      framework?: string;
      region?: string;
      cpu?: number;
      memory?: number;
      storage?: number;
      authEnabled?: boolean;
      buildCacheEnabled?: boolean;
    };
  }) => Promise<{ id?: string; message?: string }>;
  const saveDatabaseConfig = useServerFn(
    updateDatabaseProjectConfigServerFn as any,
  ) as (args: {
    data: {
      projectId: string;
      workspace?: string;
      name: string;
      password: string;
      configurations?: Record<string, unknown> | null;
      whitelistedIps?: string[];
    };
  }) => Promise<{ message?: string }>;
  const saveBuildConfig = useServerFn(
    saveProjectBuildConfigServerFn as any,
  ) as (args: {
    data: {
      projectId: string;
      workspace?: string;
      installCommand?: string;
      buildCommand?: string;
      startCommand?: string;
      healthCheckPath?: string;
      preStartCommand?: string;
    };
  }) => Promise<{ message?: string }>;
  const [activeSection, setActiveSection] = useState<ConfigSection>(
    ConfigSection.General,
  );
  const haptics = useHaptics();
  const { canWrite } = useWorkspaceRole();

  // Root directory (managed outside Formik — set by drawer)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rootDir, setRootDir] = useState(project?.rootDirectory || "./");

  // Maintenance mode
  const [maintenanceMode, setMaintenanceMode] = useState(
    Boolean(project?.maintenance),
  );
  const [repoMetadata, setRepoMetadata] = useState<RepositoryMetadata | null>(
    repo ?? null,
  );

  // Sync when project data changes
  useEffect(() => {
    setRootDir(project?.rootDirectory || "./");
    setMaintenanceMode(Boolean(project?.maintenance));
  }, [project]);

  useEffect(() => {
    setRepoMetadata(repo ?? null);
  }, [repo]);

  // General section initial values
  const currentRegionId =
    project?.specs?.region?.id ?? project?.specs?.region?._id ?? "";

  const generalInitialValues: GeneralConfigValues = {
    name: project?.name || "",
    branch: project?.repo?.branch || "",
    rootDirectory: project?.rootDirectory || "./",
    framework: project?.framework || "",
    region: typeof currentRegionId === "string" ? currentRegionId : "",
    authEnabled: Boolean(project?.authEnabled),
    buildCacheEnabled: Boolean(project?.buildCacheEnabled),
  };

  // Build section initial values
  const buildInitialValues: BuildInitialValues = {
    installCommand: project?.installCommand || "",
    buildCommand: project?.buildCommand || "",
    startCommand: project?.startCommand || "",
    healthCheckPath: project?.healthCheckPath || "",
    preStartCommand: project?.preStartCommand || "",
    dockerImage: project?.repo?.name || "",
  };

  // Database section initial values
  const initialWhitelistIps = Array.isArray(project?.whiteListedIps)
    ? project.whiteListedIps.map((ip: string, i: number) => ({
        id: i,
        value: ip,
      }))
    : [];

  const databaseInitialValues: DatabaseConfigValues = {
    name: project?.name || "",
    password: "",
    confirmPassword: "",
    whitelistIps: initialWhitelistIps,
  };

  // Resources section initial values
  const resourcesInitialValues: ResourcesConfigValues = {
    cpuValue: normalizeCpuValue(project?.specs?.cpu),
    memoryValue: normalizeMemoryGbValue(project?.specs?.memory),
    scalingGroup: project?.autoscalingGroup?.id || "",
    diskEnabled: Boolean(project?.diskSize || project?.volumeMount),
    diskSize: String(project?.diskSize || 1),
    mountPath: project?.volumeMount || "",
  };

  const branchOptions = (repoMetadata?.branches || []).map((branchName) => ({
    id: branchName,
    label: branchName,
  }));

  const frameworkOptions = (() => {
    const mapped = mapFrameworksToDropdownOptions(frameworks);

    if (!generalInitialValues.framework) {
      return mapped;
    }

    const exists = mapped.some(
      (item) => item.id === generalInitialValues.framework,
    );
    if (exists) {
      return mapped;
    }

    return [
      ...mapped,
      {
        id: generalInitialValues.framework,
        label: generalInitialValues.framework,
      },
    ];
  })();

  const regionOptions = (() => {
    const mapped = (regions || []).map((r) => ({
      id: r.id,
      label: r.country ? `${r.name} (${r.country})` : r.name,
    }));

    if (!currentRegionId) {
      return mapped;
    }

    const exists = mapped.some((item) => item.id === currentRegionId);
    if (exists) {
      return mapped;
    }

    // Fallback: show current region even if not in the list
    const currentRegionName =
      project?.specs?.region?.name || project?.region || currentRegionId;
    return [...mapped, { id: currentRegionId, label: currentRegionName }];
  })();

  const scalingGroupOptions = (() => {
    const mapped = (scalingGroups || [])
      .filter(
        (group) =>
          group &&
          typeof group.id === "string" &&
          typeof group.name === "string",
      )
      .map((group) => ({
        id: group.id,
        label: group.name,
      }));

    const options = [{ id: "", label: "None" }, ...mapped];

    const currentScalingGroup = project?.autoscalingGroup?.id || "";

    if (!currentScalingGroup) {
      return options;
    }

    const exists = options.some((option) => option.id === currentScalingGroup);
    if (exists) {
      return options;
    }

    let fallbackLabel = "Current scaling group";
    if (
      project?.autoscalingGroup &&
      typeof project.autoscalingGroup === "object" &&
      typeof project.autoscalingGroup.name === "string" &&
      project.autoscalingGroup.name.trim()
    ) {
      fallbackLabel = project.autoscalingGroup.name.trim();
    }

    return [...options, { id: currentScalingGroup, label: fallbackLabel }];
  })();

  const databaseProject = isDatabaseProject(project);
  const sourceFieldsVisible = shouldShowBranchRootFrameworkFields(project);
  const dockerSourceFieldsVisible = shouldShowDockerSourceFields(project);
  const buildSectionVisible = shouldShowBuildSection(project);
  const healthCheckVisible = shouldShowHealthCheckField(project);
  const scalingGroupVisible = shouldShowScalingGroupField(project);
  const persistentStorageVisible = shouldShowPersistentStorageField(project);
  const buildCacheToggleVisible = shouldShowBuildCacheToggle(project);
  const mcpAuthToggleVisible = shouldShowMcpAuthToggle(project);

  const sections = allSections.filter((section) => {
    if (databaseProject && section.id === ConfigSection.Build) {
      return false;
    }

    if (isStaticProject(project) && section.id === ConfigSection.Resources) {
      return false;
    }

    if (!buildSectionVisible && section.id === ConfigSection.Build) {
      return false;
    }

    if (!canWrite && section.id === ConfigSection.Danger) {
      return false;
    }

    return true;
  });

  useEffect(() => {
    if (!sections.some((section) => section.id === activeSection)) {
      setActiveSection(ConfigSection.General);
    }
  }, [activeSection, sections]);

  /* ─── Submit handlers ─── */

  async function handleSubmitGeneral(values: GeneralConfigValues) {
    try {
      await saveGeneralConfig({
        data: {
          projectId: project?.id || params.projectId,
          workspace,
          name: values.name.trim(),
          branch: values.branch,
          rootDirectory: rootDir,
          framework: values.framework,
          region: values.region,
          cpu: normalizeCpuValue(project?.specs?.cpu),
          memory: normalizeMemoryGbValue(project?.specs?.memory),
          storage: normalizeStorageValue(project?.specs?.storage),
          authEnabled: values.authEnabled,
          buildCacheEnabled: values.buildCacheEnabled,
        },
      });

      const nextProjectId = values.name.trim();
      if (nextProjectId && nextProjectId !== params.projectId) {
        let nextUrl = `/projects/${encodeURIComponent(nextProjectId)}/configuration`;
        if (workspace) {
          nextUrl = `${nextUrl}?workspace=${encodeURIComponent(workspace)}`;
        }

        await navigate({
          to: nextUrl as any,
          replace: true,
        });
      }

      toast.success("Configuration saved. Redeploy started.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save configuration",
      );
    }
  }

  async function handleSubmitBuild(values: BuildInitialValues) {
    try {
      await saveBuildConfig({
        data: {
          projectId: project?.id || params.projectId,
          workspace,
          installCommand: values.installCommand,
          buildCommand: values.buildCommand,
          startCommand: values.startCommand,
          healthCheckPath: values.healthCheckPath,
          preStartCommand: values.preStartCommand,
        },
      });
      toast.success("Build configuration saved. Redeploy started.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save build configuration",
      );
    }
  }

  async function handleSubmitDatabase(values: DatabaseConfigValues) {
    const password = values.password.trim();

    await saveDatabaseConfig({
      data: {
        projectId: project?.id || params.projectId,
        workspace,
        name: values.name.trim(),
        password,
        configurations: project?.specs
          ? ({ ...project.specs } as Record<string, unknown>)
          : null,
        whitelistedIps: (values.whitelistIps ?? [])
          .map((ip) => ip.value)
          .filter(Boolean),
      },
    });

    const nextProjectId = values.name.trim();
    if (nextProjectId && nextProjectId !== params.projectId) {
      let nextUrl = `/projects/${encodeURIComponent(nextProjectId)}/configuration`;
      if (workspace) {
        nextUrl = `${nextUrl}?workspace=${encodeURIComponent(workspace)}`;
      }

      await navigate({
        to: nextUrl as any,
        replace: true,
      });
    }

    toast.success("Database configuration updated");
  }

  async function handleSubmitResources(values: ResourcesConfigValues) {
    const nextConfigurations: Record<string, unknown> = {
      cpu: values.cpuValue,
      memory: values.memoryValue,
      storage: project?.specs?.storage,
      diskSize: values.diskEnabled ? Number(values.diskSize || 0) : 0,
      volumeMount: values.diskEnabled
        ? (values.mountPath || "/mnt/data").trim()
        : "",
    };

    // Re-read current whitelist IPs from project data
    const currentWhitelistIps = Array.isArray(project?.whiteListedIps)
      ? project.whiteListedIps.filter(Boolean)
      : [];

    await saveDatabaseConfig({
      data: {
        projectId: project?.id || params.projectId,
        workspace,
        name: project?.name || params.projectId,
        password: "",
        configurations: nextConfigurations,
        whitelistedIps: currentWhitelistIps,
      },
    });

    toast.success("Resources updated");
  }

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4 px-4 py-8 sm:px-0">
      <TabHeader title="Configuration">
        {getConfigurationDescription(project)}{" "}
        <a href="#" className="text-[#4879f8] underline">
          Learn more
        </a>
      </TabHeader>

      <hr className="border-dash-border" />

      {/* Sidebar + Content layout */}
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
        {/* Sidebar nav */}
        <nav className="scrollbar-hidden flex w-full gap-1 overflow-x-auto rounded-[4px] border-[0.5px] border-dash-border p-1 lg:sticky lg:top-8 lg:w-[180px] lg:shrink-0 lg:flex-col lg:gap-0.5 lg:self-start lg:overflow-visible lg:rounded-none lg:border-0 lg:p-0">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                haptics.selection();
                setActiveSection(s.id);
              }}
              className={`shrink-0 whitespace-nowrap lg:w-full flex items-center gap-2.5 rounded-[4px] px-3 py-2 text-left text-sm transition-colors ${
                s.id === activeSection
                  ? "bg-dash-bg-elevated font-medium text-dash-text-strong"
                  : "text-dash-text-faded hover:bg-dash-bg-elevated/50 hover:text-dash-text-body"
              } ${s.id === ConfigSection.Danger ? "text-red-400/80 hover:text-red-400 lg:mt-4" : ""}`}
            >
              <span
                className={
                  s.id === activeSection
                    ? s.id === ConfigSection.Danger
                      ? "text-red-400"
                      : "text-dash-text-strong"
                    : ""
                }
              >
                {s.icon}
              </span>
              {s.label}
            </button>
          ))}
        </nav>

        {/* Content panel */}
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease }}
            >
              {activeSection === ConfigSection.General &&
                (databaseProject ? (
                  <DatabaseConfigurationPanel
                    initialValues={databaseInitialValues}
                    onSubmit={handleSubmitDatabase}
                    region={project?.region}
                    dbImageName={project?.dbImage?.name}
                    canWrite={canWrite}
                  />
                ) : (
                  <>
                    <EnvironmentSection
                      projectId={project?.id || params.projectId}
                      currentEnvironmentId={project?.projectEnvironmentId}
                      workspace={workspace}
                      initialEnvironments={preloadedEnvironments}
                      canWrite={canWrite}
                    />
                    <GeneralSection
                      initialValues={generalInitialValues}
                      onSubmit={handleSubmitGeneral}
                      branchOptions={branchOptions}
                      rootDir={rootDir}
                      onOpenDrawer={() => setDrawerOpen(true)}
                      frameworkOptions={frameworkOptions}
                      regionOptions={regionOptions}
                      showSourceFields={sourceFieldsVisible}
                      dockerSourceImage={buildInitialValues.dockerImage}
                      showMcpAuthControl={mcpAuthToggleVisible}
                      showBuildCacheControl={buildCacheToggleVisible}
                      canWrite={canWrite}
                    />
                  </>
                ))}
              {activeSection === ConfigSection.Build && (
                <BuildSection
                  initialValues={buildInitialValues}
                  onSubmit={handleSubmitBuild}
                  showCommands={sourceFieldsVisible}
                  showHealthCheck={healthCheckVisible}
                  showDockerSourceFields={dockerSourceFieldsVisible}
                  canWrite={canWrite}
                />
              )}
              {activeSection === ConfigSection.Resources && (
                <ResourcesSection
                  initialValues={resourcesInitialValues}
                  onSubmit={databaseProject ? handleSubmitResources : undefined}
                  scalingGroupOptions={scalingGroupOptions}
                  showScalingGroup={scalingGroupVisible}
                  showPersistentStorage={persistentStorageVisible}
                  canSave={databaseProject}
                  canWrite={canWrite}
                />
              )}
              {canWrite && activeSection === ConfigSection.Danger && (
                <DangerSection
                  maintenanceMode={maintenanceMode}
                  setMaintenanceMode={setMaintenanceMode}
                  projectName={project?.name || ""}
                  projectId={project?.id || params.projectId}
                  workspace={workspace}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Root directory drawer */}
      {sourceFieldsVisible && (
        <RootDirectoryDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          repoName={project?.repo?.fullName || project?.repo?.name}
          installationId={project?.repo?.installationId}
          branch={generalInitialValues.branch}
          selectedPath={rootDir || "./"}
          onSelect={({ path, framework: detectedFramework }) => {
            setRootDir(path || "./");

            if (detectedFramework?.slug) {
              // Framework will be updated via Formik when the user saves
            }
            if (detectedFramework?.installCommand) {
              setInstallCmd(detectedFramework.installCommand);
            }
            if (detectedFramework?.buildCommand) {
              setBuildCmd(detectedFramework.buildCommand);
            }
            if (detectedFramework?.startCommand) {
              setStartCmd(detectedFramework.startCommand);
            }
          }}
        />
      )}
    </div>
  );
}
