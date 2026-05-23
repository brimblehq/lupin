import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UploadCloud, X } from "lucide-react";
import { File as FileIcon } from "@phosphor-icons/react";
import { Modal, ModalHeader, ModalFooter, ModalCancelButton, ModalContinueButton } from "@/components/shared/modal";
import { DashInput } from "@/components/shared/dash-input";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { getAccessTokenServerFn } from "@/server/auth/actions";
import { uploadSandboxFile } from "@/lib/sandboxes/upload-file";
import { formatBytes } from "@/lib/format";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface UploadFileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sandboxId: string;
  sandboxName: string;
  persistent: boolean;
}


function validatePath(path: string): string | null {
  if (!path) return "Destination path is required";
  if (!path.startsWith("/")) return "Path must start with /";
  if (/\s/.test(path)) return "Path can't contain whitespace";
  if (path.split("/").some((seg) => seg === "..")) return "Path can't contain ..";
  return null;
}

export function UploadFileModal({ open, onOpenChange, sandboxId, sandboxName, persistent }: UploadFileModalProps) {
  const getAccessToken = useServerFn(getAccessTokenServerFn);

  const [file, setFile] = useState<File | null>(null);
  const [destPath, setDestPath] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const pathTouchedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setDestPath("");
      setIsDragging(false);
      setUploading(false);
      setProgress({ sent: 0, total: 0 });
      pathTouchedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (file && !pathTouchedRef.current) {
      const root = persistent ? "/workspace" : "/tmp";
      setDestPath(`${root}/${file.name}`);
    }
  }, [file, persistent]);

  const oversize = file ? file.size > MAX_FILE_SIZE : false;
  const pathError = useMemo(() => validatePath(destPath), [destPath]);
  const fileError = oversize ? `file exceeds max size of ${MAX_FILE_SIZE} bytes` : null;
  const canSubmit = Boolean(file) && !pathError && !fileError && !uploading;

  function pickFile(next: File | null) {
    setFile(next);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) pickFile(dropped);
  }

  async function handleUpload() {
    if (!file || pathError || fileError) return;

    const token = await getAccessToken({ data: undefined });
    if (!token) {
      toast.error("Session expired, please reload");
      return;
    }

    const finalPath = destPath.endsWith("/") ? `${destPath}${file.name}` : destPath;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setUploading(true);
    setProgress({ sent: 0, total: file.size });

    try {
      await uploadSandboxFile({
        sandboxId,
        destPath: finalPath,
        file,
        token,
        onProgress: (sent, total) => setProgress({ sent, total }),
        signal: ctrl.signal,
      });
      toast.success(`Uploaded ${file.name} to ${finalPath}`);
      onOpenChange(false);
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  }

  const percent = progress.total > 0 ? Math.min(100, (progress.sent / progress.total) * 100) : 0;

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={520} dismissible={!uploading}>
      <ModalHeader title="Upload file" description={`Send a file into ${sandboxName}.`} />

      <div className="flex flex-col gap-4 px-6 py-5">
        <Field label="Destination path" hint="Path inside the sandbox. Parent directory must already exist." error={pathError && file ? pathError : undefined}>
          <DashInput
            value={destPath}
            onChange={(event) => {
              pathTouchedRef.current = true;
              setDestPath(event.target.value);
            }}
            placeholder={persistent ? "/workspace/file.txt" : "/tmp/file.txt"}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={uploading}
          />
        </Field>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-dash-text-body">File</label>
          {file ? (
            <div className="flex items-center justify-between gap-3 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileIcon className="size-4 shrink-0 text-dash-text-faded" />
                <div className="min-w-0">
                  <div className="truncate text-sm text-dash-text-strong">{file.name}</div>
                  <div className="text-xs text-dash-text-faded">{formatBytes(file.size)}</div>
                </div>
              </div>
              {!uploading ? (
                <button
                  type="button"
                  onClick={() => pickFile(null)}
                  className="flex size-6 shrink-0 items-center justify-center rounded-[2px] text-dash-text-faded transition-colors hover:bg-dash-bg hover:text-dash-text-strong"
                  aria-label="Remove file"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[4px] border border-dashed px-6 py-8 text-center transition-colors ${
                isDragging
                  ? "border-[#4879f8] bg-[#4879f8]/5"
                  : "border-dash-border hover:border-dash-border-strong hover:bg-dash-bg-elevated"
              }`}
            >
              <UploadCloud className="size-5 text-dash-text-faded" />
              <div className="text-sm text-dash-text-body">Drag a file here or click to browse</div>
              <div className="text-xs text-dash-text-faded">Max 50 MB</div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              const picked = event.target.files?.[0] ?? null;
              if (picked) pickFile(picked);
              event.target.value = "";
            }}
          />
          {fileError ? <p className="mt-1 text-xs text-[#f05252]">{fileError}</p> : null}
        </div>

        {uploading ? (
          <div className="flex flex-col gap-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-dash-bg-elevated">
              <div
                className="h-full rounded-full bg-[#4879f8] transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-dash-text-faded">
              <span>Uploading…</span>
              <span>{formatBytes(progress.sent)} / {formatBytes(progress.total)}</span>
            </div>
          </div>
        ) : null}
      </div>

      <ModalFooter>
        <ModalCancelButton onClick={() => abortRef.current?.abort()} />
        <ModalContinueButton
          onClick={() => void handleUpload()}
          disabled={!canSubmit}
          loading={uploading}
          loadingLabel="Uploading..."
        >
          Upload
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
