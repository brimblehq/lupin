import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Modal, ModalCancelButton, ModalContinueButton, ModalFooter, ModalHeader } from "@/components/shared/modal";
import { WarningModal } from "@/components/shared/warning-modal";
import { type S3CredentialRole, type S3CredentialsRecord, type StorageCredentialRecord } from "@/backend/storage";

type CreateS3CredentialsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucketName: string;
  onCreate: (input: { role: S3CredentialRole }) => Promise<void>;
};

type S3CredentialsCreatedModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credentials: S3CredentialsRecord | null;
};

const ROLE_OPTIONS: { value: S3CredentialRole; title: string; description: string }[] = [
  { value: "ReadOnly", title: "Read-only", description: "Download and list objects in this bucket." },
  { value: "Editor", title: "Editor", description: "Upload, edit, delete, and list objects." },
];

export function CreateS3CredentialsModal({ open, onOpenChange, bucketName, onCreate }: CreateS3CredentialsModalProps) {
  const [role, setRole] = useState<S3CredentialRole>("ReadOnly");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setRole("ReadOnly");
    setError(null);
    setSubmitting(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  async function handleCreate() {
    try {
      setSubmitting(true);
      setError(null);
      await onCreate({ role });
      reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create S3 credentials");
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange} width={440} dismissible={!submitting}>
      <ModalHeader title="Create S3 credentials" description={`Choose an access level for ${bucketName}.`} />

      <div className="flex flex-col gap-3 px-6 py-5">
        <div className="flex flex-col gap-0.5" role="radiogroup" aria-label="Access level">
          {ROLE_OPTIONS.map((option) => {
            const isSelected = role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setRole(option.value)}
                disabled={submitting}
                className="flex items-center gap-3 rounded-[4px] px-2 py-2 text-left transition-colors hover:bg-dash-bg-elevated disabled:opacity-60"
              >
                <span
                  className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isSelected ? "border-[#4879f8] bg-[#4879f8]" : "border-dash-border"
                  }`}
                >
                  {isSelected ? <div className="size-1.5 rounded-full bg-white" /> : null}
                </span>
                <span className="shrink-0 text-sm font-medium text-dash-text-strong">{option.title}</span>
                <span className="min-w-0 truncate text-xs text-dash-text-faded">· {option.description}</span>
              </button>
            );
          })}
        </div>

        <p className="text-xs leading-[1.4] text-dash-text-extra-faded">The secret access key is shown once after creation.</p>

        {error && <p className="rounded-[4px] bg-[#e1291d]/10 px-3 py-2 text-sm text-[#e1291d]">{error}</p>}
      </div>

      <ModalFooter>
        <ModalCancelButton />
        <ModalContinueButton onClick={handleCreate} loading={submitting} loadingLabel="Creating...">
          Create credentials
        </ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}

export function S3CredentialsCreatedModal({ open, onOpenChange, credentials }: S3CredentialsCreatedModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!credentials) return null;

  async function copyValue(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedField(label);
    window.setTimeout(() => setCopiedField(null), 1600);
  }

  function handleOpenChange(nextOpen: boolean) {
    setCopiedField(null);
    onOpenChange(nextOpen);
  }

  const rows = [
    { label: "Access key ID", value: credentials.accessKeyId },
    { label: "Secret access key", value: credentials.secretAccessKey },
    { label: "Bucket", value: credentials.bucketName },
    { label: "Region", value: credentials.region },
    { label: "Endpoint", value: credentials.endpoint },
    { label: "Role", value: credentials.role },
  ];

  const allCredentials = rows.map((row) => `${row.label}: ${row.value}`).join("\n");

  return (
    <Modal open={open} onOpenChange={handleOpenChange} width={560}>
      <ModalHeader title="S3 credentials created" description="Copy these credentials now. The secret access key is only shown once." />

      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="overflow-hidden rounded-[4px] border-[0.5px] border-dash-border">
          {rows.map((row, index) => (
            <div
              key={row.label}
              className={`grid grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5 ${
                index < rows.length - 1 ? "border-b-[0.5px] border-dash-border" : ""
              }`}
            >
              <span className="text-xs font-medium text-dash-text-faded">{row.label}</span>
              <code
                title={row.value}
                className="block truncate rounded-[4px] bg-dash-bg-elevated px-2 py-1.5 font-mono text-sm text-dash-text-body"
              >
                {row.value}
              </code>
              <button
                type="button"
                onClick={() => void copyValue(row.label, row.value)}
                aria-label={copiedField === row.label ? `${row.label} copied` : `Copy ${row.label}`}
                title={copiedField === row.label ? "Copied" : `Copy ${row.label}`}
                className="flex size-8 items-center justify-center rounded-[4px] border-[0.5px] border-dash-border text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
              >
                {copiedField === row.label ? <Check className="size-3.5 text-[#13d282]" /> : <Copy className="size-3.5" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      <ModalFooter>
        <button
          type="button"
          onClick={() => void copyValue("all", allCredentials)}
          className="flex h-[34px] items-center gap-2 rounded-[4px] border border-dash-border bg-dash-bg px-3.5 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated"
        >
          {copiedField === "all" ? <Check className="size-3.5 text-[#13d282]" /> : <Copy className="size-3.5" />}
          {copiedField === "all" ? "Copied all" : "Copy all"}
        </button>
        <ModalContinueButton onClick={() => handleOpenChange(false)}>Done</ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}

type RevokeCredentialModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential: StorageCredentialRecord | null;
  onConfirm: (credential: StorageCredentialRecord) => Promise<void>;
};

export function RevokeCredentialModal({ open, onOpenChange, credential, onConfirm }: RevokeCredentialModalProps) {
  if (!credential) return null;
  return (
    <WarningModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Revoke "${credential.name}"?`}
      description="Immediately invalidates this access key ID. Existing sessions and applications using it will stop working. This action cannot be undone."
      confirmLabel="Revoke"
      confirmLoadingLabel="Revoking..."
      onConfirm={() => onConfirm(credential)}
    />
  );
}
