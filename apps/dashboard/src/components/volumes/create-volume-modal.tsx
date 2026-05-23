import { useEffect, useMemo, useRef, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { Modal, ModalHeader, ModalFooter, ModalCancelButton, ModalContinueButton } from "@/components/shared/modal";
import { DashInput } from "@/components/shared/dash-input";
import { Dropdown } from "@/components/shared/dropdown";
import { getDiskPricing } from "@/components/shared/disk-size-options";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { buildRegionLabel } from "@/lib/regions/format";
import type { Region } from "@/backend/regions";
import { VolumeType, type VolumeResponse } from "@/backend/volumes";
import { createVolumeServerFn } from "@/server/volumes/actions";
import { listRegionsServerFn } from "@/server/regions/actions";

const NAME_PATTERN = /^[a-z0-9-]{1,40}$/;
const MIN_SIZE_GB = 10;
const MAX_SIZE_GB = 50;
const SIZE_OPTIONS = getDiskPricing().filter((option) => {
  const size = Number(option.id);
  return size >= MIN_SIZE_GB && size <= MAX_SIZE_GB;
});

const TYPE_LABELS: Record<VolumeType, string> = {
  [VolumeType.Web]: "Web",
  [VolumeType.Database]: "Database",
  [VolumeType.Sandbox]: "Sandbox",
};
const TYPE_DESCRIPTIONS: Record<VolumeType, string> = {
  [VolumeType.Web]: "Attach to a project deployment.",
  [VolumeType.Database]: "Attach to a database service.",
  [VolumeType.Sandbox]: "Attach to a sandbox.",
};
const TYPE_OPTIONS = [
  { id: VolumeType.Web, label: TYPE_LABELS[VolumeType.Web] },
  { id: VolumeType.Database, label: TYPE_LABELS[VolumeType.Database] },
  { id: VolumeType.Sandbox, label: TYPE_LABELS[VolumeType.Sandbox] },
];

const schema = Yup.object({
  name: Yup.string()
    .trim()
    .matches(NAME_PATTERN, "Use lowercase letters, numbers, and hyphens — up to 40 characters")
    .required("Name is required"),
  sizeGB: Yup.number().integer().min(MIN_SIZE_GB).max(MAX_SIZE_GB).required(),
  type: Yup.mixed<VolumeType>().oneOf(Object.values(VolumeType)).required(),
  region: Yup.string().trim().required("Region is required"),
});

interface FormValues {
  name: string;
  sizeGB: number;
  type: VolumeType;
  region: string;
}

interface CreateVolumeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regions: Region[];
  workspace?: string;
  defaultType?: VolumeType;
  defaultRegion?: string;
  onCreated: (volume: VolumeResponse) => void;
}

export function CreateVolumeModal({ open, onOpenChange, regions: initialRegions, workspace, defaultType, defaultRegion, onCreated }: CreateVolumeModalProps) {
  const createVolume = useServerFn(createVolumeServerFn);
  const listRegions = useServerFn(listRegionsServerFn);

  const initialType = defaultType ?? VolumeType.Web;
  const [regions, setRegions] = useState<Region[]>(initialRegions);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const wasOpenRef = useRef(false);

  const regionOptions = useMemo(
    () =>
      regions
        .filter((region) => region.enabled !== false)
        .map((region) => ({
          id: region.id,
          label: buildRegionLabel(region),
        })),
    [regions],
  );

  const defaultRegionId = useMemo(() => {
    if (defaultRegion && regions.some((region) => region.id === defaultRegion)) {
      return defaultRegion;
    }
    const fallback = regions.find((region) => region.default) ?? regions[0];
    return fallback?.id ?? "";
  }, [regions, defaultRegion]);

  const formik = useFormik<FormValues>({
    initialValues: { name: "", sizeGB: MIN_SIZE_GB, type: initialType, region: defaultRegionId },
    validationSchema: schema,
    enableReinitialize: false,
    onSubmit: async (values) => {
      try {
        const volume = await createVolume({
          data: {
            name: values.name.trim(),
            sizeGB: values.sizeGB,
            region: values.region,
            type: values.type,
            ...(workspace ? { workspace } : {}),
          },
        });
        toast.success(`Volume "${volume.name}" created`);
        onCreated(volume);
        onOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create volume");
      }
    },
  });

  const { values, errors, touched, isSubmitting, handleChange, handleBlur, setFieldValue, resetForm, submitForm } = formik;

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      resetForm({ values: { name: "", sizeGB: MIN_SIZE_GB, type: initialType, region: "" } });
    }
    wasOpenRef.current = open;
  }, [open, initialType, resetForm]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      setRegionsLoading(true);
      try {
        const next = await listRegions({ data: { type: values.type, enabled: true, workspace } });
        if (cancelled) return;
        setRegions(next);
        const fallback = next.find((region) => region.default) ?? next[0];
        void setFieldValue("region", fallback?.id ?? "");
      } finally {
        if (!cancelled) setRegionsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [values.type, listRegions, open, setFieldValue, workspace]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={520} dismissible={!isSubmitting}>
      <ModalHeader title="Create volume" description="Persistent storage you can attach to a workload later." />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitForm();
        }}
        className="flex flex-col gap-5 px-6 py-5"
      >
        <Field label="Name" error={touched.name ? errors.name : undefined} hint="Lowercase letters, numbers, hyphens; up to 40 chars.">
          <DashInput
            name="name"
            value={values.name}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="workspace-cache"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={40}
          />
        </Field>

        <Field label="Size" hint={`Min ${MIN_SIZE_GB} GB · Max ${MAX_SIZE_GB} GB`}>
          <Dropdown
            value={String(values.sizeGB)}
            options={SIZE_OPTIONS}
            onChange={(id) => void setFieldValue("sizeGB", Number(id))}
          />
        </Field>

        <Field label="Type" hint={TYPE_DESCRIPTIONS[values.type]}>
          <Dropdown
            value={values.type}
            options={TYPE_OPTIONS}
            onChange={(id) => void setFieldValue("type", id as VolumeType)}
          />
        </Field>

        <Field
          label="Region"
          error={touched.region ? errors.region : undefined}
          hint={`Region and type are permanent. Volumes can only attach to ${TYPE_LABELS[values.type].toLowerCase()} resources in the same region.`}
        >
          <Dropdown
            value={values.region}
            options={regionOptions}
            onChange={(id) => void setFieldValue("region", id)}
            searchable
            placeholder={regionsLoading ? "Loading regions..." : "Select region"}
          />
        </Field>

        <a
          href="https://paper.brimble.io/volumes/overview"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-[#4879f8] transition-colors hover:text-[#3c6ce7]"
        >
          Read the volume docs
          <ExternalLink className="size-3" />
        </a>
      </form>

      <ModalFooter>
        <ModalCancelButton />
        <ModalContinueButton onClick={() => void submitForm()} loading={isSubmitting} disabled={!values.name || !values.region}>
          Create volume
        </ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div
      className={`flex flex-col gap-1 ${
        error ? "[&_.input-base]:!shadow-[0_0_0_1px_#ef2f1f,0_0_0_3px_rgba(239,47,31,0.15)]" : ""
      }`}
    >
      <label className="text-sm text-dash-text-body">{label}</label>
      {children}
      {error ? <p className="text-xs text-[#f05252]">{error}</p> : hint ? <p className="text-xs text-dash-text-faded">{hint}</p> : null}
    </div>
  );
}
