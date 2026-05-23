import { Fragment, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Modal, ModalHeader, ModalFooter, ModalCancelButton } from "@/components/shared/modal";
import { StatusChip } from "@/components/shared/status-chip";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { tokenizeCode } from "@/lib/syntax-highlight";
import { formatRelativeTime } from "@/utils/dashboard";
import type { SandboxActivityResponse } from "@/backend/sandboxes";
import type { ParsedActivityCommand } from "@/lib/sandboxes/activity-command";

interface ActivityDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: SandboxActivityResponse | null;
  parsed: ParsedActivityCommand | null;
}

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatTimestamp(value: string | null): { value: string; title?: string } {
  if (!value) return { value: "—" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { value };
  return { value: formatRelativeTime(value), title: fullDateFormatter.format(date) };
}

function formatDurationMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms} ms`;

  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(2)}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes < 60) {
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

export function ActivityDetailModal({ open, onOpenChange, activity, parsed }: ActivityDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!activity || !parsed) return null;

  const commandValue = parsed.kind === "exec" ? parsed.command : parsed.headline;

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(commandValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={560}>
      <ModalHeader title="Activity detail" description="Command and execution metadata for this entry." />

      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex items-center gap-3">
          <StatusChip status={activity.status} />
          {parsed.kind === "exec" && parsed.cwd ? (
            <span className="text-xs text-dash-text-faded">
              cwd <span className="font-mono text-dash-text-body">{parsed.cwd}</span>
            </span>
          ) : null}
        </div>

        <Field label="Command">
          <CodeBlock value={commandValue} copied={copied} onCopy={() => void copyCommand()} />
        </Field>

        <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <MetaRow label="Started" {...formatTimestamp(activity.startedAt)} />
          <MetaRow label="Duration" value={formatDurationMs(activity.durationMs)} />
          <MetaRow label="Exit code" value={activity.exitCode !== null ? String(activity.exitCode) : "—"} />
        </dl>

        {activity.error ? (
          <Field label="Error">
            <div className="rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-3 py-2 font-mono text-xs text-[#ef4444]">
              {activity.error}
            </div>
          </Field>
        ) : null}
      </div>

      <ModalFooter>
        <div />
        <ModalCancelButton />
      </ModalFooter>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-dash-text-faded">{label}</span>
      {children}
    </div>
  );
}

function MetaRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-dash-text-faded">{label}</dt>
      <dd className="text-sm text-dash-text-body" title={title}>
        {value}
      </dd>
    </div>
  );
}

function CodeBlock({ value, copied, onCopy }: { value: string; copied: boolean; onCopy: () => void }) {
  const tokens = tokenizeCode(value);

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated p-4 pr-14 font-mono text-[12px] leading-[1.7] text-dash-text-body scrollbar-subtle">
        <code>
          {tokens.map((tok, i) => (
            <Fragment key={i}>{tok.cls ? <span className={tok.cls}>{tok.text}</span> : tok.text}</Fragment>
          ))}
        </code>
      </pre>
      <button
        type="button"
        onClick={onCopy}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[3px] border-[0.5px] border-dash-border bg-dash-bg px-2 py-1 text-[11px] font-medium text-dash-text-faded transition-colors hover:text-dash-text-strong"
      >
        {copied ? (
          <>
            <Check className="size-3 text-[#22c55e]" />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-3" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}
