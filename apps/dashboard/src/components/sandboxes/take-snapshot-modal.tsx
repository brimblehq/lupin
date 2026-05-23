import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Modal, ModalHeader, ModalFooter, ModalCancelButton, ModalContinueButton } from "@/components/shared/modal";
import { DashInput } from "@/components/shared/dash-input";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { createSandboxSnapshotServerFn } from "@/server/sandboxes/actions";

const NAME_PATTERN = /^[a-z0-9-]{1,40}$/;

const schema = Yup.object({
  name: Yup.string()
    .trim()
    .matches(NAME_PATTERN, "Use lowercase letters, numbers, and hyphens — up to 40 characters")
    .required("Name is required"),
});

interface FormValues {
  name: string;
}

interface TakeSnapshotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sandboxId: string;
  sandboxName: string;
  workspace?: string;
  onSnapshotCreated: () => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function suggestedName(): string {
  const now = new Date();
  return `snap-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export function TakeSnapshotModal({ open, onOpenChange, sandboxId, sandboxName, workspace, onSnapshotCreated }: TakeSnapshotModalProps) {
  const createSnapshot = useServerFn(createSandboxSnapshotServerFn);
  const [defaultName, setDefaultName] = useState(suggestedName());

  const formik = useFormik<FormValues>({
    initialValues: { name: defaultName },
    validationSchema: schema,
    enableReinitialize: false,
    onSubmit: async (values) => {
      try {
        await createSnapshot({
          data: {
            sandboxId,
            name: values.name.trim(),
            ...(workspace ? { workspace } : {}),
          },
        });
        toast.success("Snapshot creation started");
        onSnapshotCreated();
        onOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to take snapshot");
      }
    },
  });

  const { values, errors, touched, isSubmitting, handleChange, handleBlur, resetForm, submitForm } = formik;

  useEffect(() => {
    if (open) {
      const next = suggestedName();
      setDefaultName(next);
      resetForm({ values: { name: next } });
    }
  }, [open, resetForm]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={480} dismissible={!isSubmitting}>
      <ModalHeader
        title={`Take snapshot of ${sandboxName}`}
        description="Captures the current state of your sandbox into a re-runnable image."
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitForm();
        }}
        className="flex flex-col gap-4 px-6 py-5"
      >
        <Field label="Name" error={touched.name ? errors.name : undefined} hint="Lowercase letters, numbers, hyphens; up to 40 chars.">
          <DashInput
            name="name"
            value={values.name}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={defaultName}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={40}
          />
        </Field>
      </form>

      <ModalFooter>
        <ModalCancelButton />
        <ModalContinueButton onClick={() => void submitForm()} loading={isSubmitting} loadingLabel="Starting..." disabled={!values.name}>
          Take snapshot
        </ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 ${error ? "[&_.input-base]:!shadow-[0_0_0_1px_#ef2f1f,0_0_0_3px_rgba(239,47,31,0.15)]" : ""}`}>
      <label className="text-sm text-dash-text-body">{label}</label>
      {children}
      {error ? <p className="text-xs text-[#f05252]">{error}</p> : hint ? <p className="text-xs text-dash-text-faded">{hint}</p> : null}
    </div>
  );
}
