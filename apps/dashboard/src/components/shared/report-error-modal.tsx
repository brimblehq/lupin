import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { FileText } from "@phosphor-icons/react";
import { useServerFn } from "@tanstack/react-start";
import { Modal, ModalHeader, ModalFooter, ModalCancelButton, ModalContinueButton } from "./modal";
import { dashInputClassName } from "./dash-input";
import { REPORT_ERROR_EVENT, hapticToast as toast, type ReportErrorEventDetail } from "@/utils/haptic-toast";
import { createSupportTicketServerFn } from "@/server/support/actions";
import type { SupportTicket, SupportTicketAttachmentInput } from "@/backend/support";

const MAX_FILES = 3;
const MAX_FILES_MESSAGE = "You can attach up to 3 files.";
const MAX_MESSAGE_LENGTH = 5000;
const DESCRIPTION_MAX_LENGTH = 4000;
const ALLOWED_FILE_PATTERN = /\.(png|jpe?g|gif|webp|log)$/i;

function isAllowedFile(file: File): boolean {
  return ALLOWED_FILE_PATTERN.test(file.name);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function composeMessage(description: string, errorMessage?: string): string {
  const lines = [description.trim()];
  if (errorMessage) {
    lines.push("", "---", `Error: ${errorMessage.slice(0, 800)}`);
  }
  const pageUrl = typeof window === "undefined" ? "" : window.location.href;
  if (pageUrl) {
    lines.push(`Page: ${pageUrl}`);
  }
  return lines.join("\n").slice(0, MAX_MESSAGE_LENGTH);
}

interface Attachment {
  id: string;
  file: File;
  isImage: boolean;
  url?: string;
}

export function ReportErrorModal() {
  const createTicket = useServerFn(createSupportTicketServerFn as any) as (args: {
    data: { message: string; subject?: string; files?: SupportTicketAttachmentInput[] };
  }) => Promise<SupportTicket>;

  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleOpen(event: Event) {
      const detail = (event as CustomEvent<ReportErrorEventDetail>).detail;
      setErrorMessage(detail?.message);
      setOpen(true);
    }
    window.addEventListener(REPORT_ERROR_EVENT, handleOpen);
    return () => window.removeEventListener(REPORT_ERROR_EVENT, handleOpen);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      attachments.forEach((attachment) => {
        if (attachment.url) URL.revokeObjectURL(attachment.url);
      });
      setAttachments([]);
      setDescription("");
      setErrorMessage(undefined);
    }
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const accepted = Array.from(files).filter(isAllowedFile);
    const remaining = MAX_FILES - attachments.length;
    if (remaining <= 0) {
      toast(MAX_FILES_MESSAGE);
      return;
    }
    if (accepted.length > remaining) {
      toast(MAX_FILES_MESSAGE);
    }
    const picked = accepted.slice(0, remaining).map((file) => {
      const isImage = file.type.startsWith("image/");
      return { id: crypto.randomUUID(), file, isImage, url: isImage ? URL.createObjectURL(file) : undefined };
    });
    setAttachments((prev) => [...prev, ...picked]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const target = prev.find((attachment) => attachment.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((attachment) => attachment.id !== id);
    });
  }

  async function handleSubmit() {
    if (!description.trim() || submitting) return;
    setSubmitting(true);
    try {
      const files = await Promise.all(
        attachments.map(async (attachment) => ({
          filename: attachment.file.name,
          content_base64: await fileToBase64(attachment.file),
        })),
      );
      await createTicket({
        data: {
          message: composeMessage(description, errorMessage),
          files: files.length ? files : undefined,
        },
      });
      handleOpenChange(false);
      toast.success("Thanks — your report has been sent to the team.");
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Couldn't send your report");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange} width={520}>
      <ModalHeader title="Report an error" description="Tell us what went wrong. Add screenshots or logs if they help us reproduce it." />

      <div className="flex flex-col gap-4 px-6 py-5">
        {errorMessage ? (
          <div className="rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/40 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-dash-text-extra-faded">Error</p>
            <p className="mt-0.5 text-xs leading-relaxed text-dash-text-faded">{errorMessage}</p>
          </div>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-dash-text-strong">What happened?</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            autoFocus
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder="Describe the issue and what you were doing when it happened."
            className={`${dashInputClassName} min-h-[110px] resize-y text-sm`}
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-dash-text-strong">
            Attachments <span className="font-normal text-dash-text-extra-faded">(optional, up to 3 files)</span>
          </span>
          {attachments.length > 0 ? (
            <div className="flex flex-col gap-2">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center gap-2.5 rounded-[4px] border-[0.5px] border-dash-border px-2.5 py-2">
                  {attachment.isImage && attachment.url ? (
                    <img src={attachment.url} alt="" className="size-9 shrink-0 rounded-[3px] object-cover" />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-[3px] bg-dash-bg-elevated text-dash-text-faded">
                      <FileText className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs text-dash-text-body">{attachment.file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    aria-label="Remove attachment"
                    className="shrink-0 text-dash-text-faded transition-colors hover:text-dash-text-strong"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {attachments.length < MAX_FILES ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-0.5 rounded-[4px] border border-dashed border-dash-border px-4 py-6 text-center transition-colors hover:bg-dash-bg-elevated"
            >
              <span className="text-sm font-medium text-dash-text-body">Click to upload</span>
              <span className="text-[11px] text-dash-text-extra-faded">Images or log files — up to 3</span>
            </button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.gif,.webp,.log"
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      <ModalFooter>
        <ModalCancelButton />
        <ModalContinueButton onClick={handleSubmit} disabled={!description.trim()} loading={submitting} loadingLabel="Sending...">
          Send report
        </ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}
