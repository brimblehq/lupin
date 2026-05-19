import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { debugSuggestionsPrServerFn, debugSuggestionsServerFn } from "@/server/projects/actions";
import type {
  DebugAction,
  DebugConfidence,
  DebugLikelyCause,
  DebugPriority,
  DebugSuggestionsPrResponse,
  DebugSuggestionsResponse,
  ProvidedDebugContext,
} from "@/backend/projects";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { Spinner } from "@/components/shared/spinner";
import { Modal } from "@/components/shared/modal";
import { GlossyButton } from "@/components/shared/glossy-button";

interface LogAiDebugPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  logId: string;
  messageId: string;
  message: string;
}

type ChipPalette = { bg: string; border: string };

const greenChip: ChipPalette = {
  bg: "linear-gradient(180deg, #34e89e 0%, #13d282 30%, #0fba72 100%)",
  border: "border-[#0fba72]",
};
const orangeChip: ChipPalette = {
  bg: "linear-gradient(180deg, #ffa040 0%, #ff7a00 30%, #e06800 100%)",
  border: "border-[#e06800]",
};
const redChip: ChipPalette = {
  bg: "linear-gradient(180deg, #f07070 0%, #ef4444 30%, #d63031 100%)",
  border: "border-[#d63031]",
};
const grayChip: ChipPalette = {
  bg: "linear-gradient(180deg, #a0a2a7 0%, #7a7c81 30%, #65676c 100%)",
  border: "border-[#65676c]",
};

const confidencePalette: Record<DebugConfidence, ChipPalette> = {
  high: greenChip,
  medium: orangeChip,
  low: grayChip,
};

const priorityPalette: Record<DebugPriority, ChipPalette> = {
  high: redChip,
  medium: orangeChip,
  low: grayChip,
};

export const LOG_AI_DEBUG_MAX_MESSAGE_LENGTH = 5000;

function LevelChip({ label, palette }: { label: string; palette: ChipPalette }) {
  return (
    <div
      style={{ background: palette.bg }}
      className={`flex h-5 shrink-0 items-center gap-2 rounded-[4px] border ${palette.border} px-2 shadow-[0px_1px_2px_rgba(16,24,40,0.1),inset_0px_1px_0px_rgba(255,255,255,0.25)]`}
    >
      <span className="size-1.5 rounded-full bg-white" />
      <span className="text-[8px] font-medium uppercase tracking-[-0.01px] text-white">{label}</span>
    </div>
  );
}

export function LogAiDebugPanel({ open, onOpenChange, projectId, logId, messageId, message }: LogAiDebugPanelProps) {
  const debugFn = useServerFn(debugSuggestionsServerFn as any) as (args: {
    data: { projectId: string; logId: string; messageId: string; message: string };
  }) => Promise<DebugSuggestionsResponse>;
  const prFn = useServerFn(debugSuggestionsPrServerFn as any) as (args: {
    data: { projectId: string; logId: string; messageId: string; message: string; debug?: ProvidedDebugContext | null };
  }) => Promise<DebugSuggestionsPrResponse>;
  const queryClient = useQueryClient();

  const trimmedMessage = message.trim();
  const messageTooLong = trimmedMessage.length > LOG_AI_DEBUG_MAX_MESSAGE_LENGTH;
  const enabled = open && !messageTooLong && Boolean(projectId && logId && messageId && trimmedMessage.length >= 5);
  const [copied, setCopied] = useState(false);

  const query = useQuery<DebugSuggestionsResponse>({
    queryKey: ["debug-suggestions", projectId, logId, messageId, trimmedMessage],
    queryFn: () => debugFn({ data: { projectId, logId, messageId, message: trimmedMessage } }),
    enabled,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const prMutation = useMutation<DebugSuggestionsPrResponse, Error, void>({
    mutationFn: () => {
      const debug: ProvidedDebugContext | null = query.data
        ? {
            framework: query.data.framework ?? null,
            envNames: query.data.envNames,
            rootDir: query.data.rootDir,
            suggestions: query.data.suggestions,
          }
        : null;
      return prFn({ data: { projectId, logId, messageId, message: trimmedMessage, debug } });
    },
    onSuccess: (data) => {
      if (data.status === "created") {
        const url = data.pullRequest?.url?.trim();
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
          toast.success("Pull request opened.");
        } else if (data.pullRequest?.headBranch) {
          toast.success(`Branch ${data.pullRequest.headBranch} created.`);
        } else {
          toast.success("Pull request opened.");
        }
        onOpenChange(false);
        return;
      }
      if (data.status === "queued") {
        toast.success(data.message || "Auto-fix pull request generation queued successfully.");
        onOpenChange(false);
        return;
      }

      switch (data.reason) {
        case "plan_disabled":
          toast.error(data.message || "AI debug isn't included on your current plan.");
          break;
        case "quota_exceeded":
          toast.error(data.message || "Daily AI debug limit reached.");
          break;
        case "unsupported_provider":
          toast.error(data.message || "This repository's git provider isn't supported for auto-fix PRs.");
          break;
        case "no_safe_changes":
          toast(data.message || "No safe automated fix found. Try the manual steps.");
          break;
        case "generation_failed":
        default:
          toast.error(data.message || "Couldn't generate the auto-fix pull request.");
      }
    },
    onError: (error) => {
      const errMessage = error instanceof Error ? error.message : "";
      if (errMessage.toLowerCase().includes("already in progress")) {
        toast("We're still working on the previous request — please wait.");
        return;
      }
      toast.error(errMessage || "Couldn't generate the auto-fix pull request.");
    },
  });

  useEffect(() => {
    if (!open || !query.error) {
      return;
    }
    const errorMessage = query.error instanceof Error ? query.error.message : "Unable to generate debug suggestions.";
    toast.error(errorMessage);
    queryClient.removeQueries({ queryKey: ["debug-suggestions", projectId, logId, messageId, trimmedMessage] });
    onOpenChange(false);
  }, [open, query.error, queryClient, projectId, logId, messageId, trimmedMessage, onOpenChange]);

  const usage = query.data?.usage;
  const remaining = usage ? Math.max(0, usage.limit - usage.count) : null;
  const limited = usage?.limited === true;
  const isLow = remaining !== null && remaining > 0 && remaining <= 2;
  const isExhausted = remaining !== null && remaining === 0;

  const usageTone = isExhausted ? "text-[#fc391e]" : isLow ? "text-[#b37a10] dark:text-[#ffb020]" : "text-dash-text-faded";

  const canCopy = !!query.data && !limited;

  function handleCopy() {
    if (!query.data) return;
    const text = formatSuggestionsForClipboard(query.data);
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      },
      () => {
        toast.error("Failed to copy to clipboard");
      },
    );
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={640} className="max-h-[min(640px,calc(100vh-32px))]">
      <div className="flex shrink-0 items-start justify-between gap-3 rounded-t-lg border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-6 py-4">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-[3px] size-3.5 shrink-0 text-[#4879f8]" />
          <div className="flex flex-col gap-0.5">
            <Dialog.Title className="text-base leading-[1.4] tracking-[-0.096px] text-dash-text-strong">Debug with AI</Dialog.Title>
            <Dialog.Description className="text-sm font-light leading-[1.3] text-dash-text-faded">
              Suggested fixes for this log line
            </Dialog.Description>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`font-logs text-xs tabular-nums tracking-[-0.01px] ${usageTone}`}
            aria-label={usage ? `${remaining} of ${usage.limit} daily uses left` : "Daily usage not yet loaded"}
          >
            {usage ? `[${remaining}/${usage.limit} left]` : "[—/— left]"}
          </span>
          {canCopy && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy analysis"
              className="flex h-7 w-7 items-center justify-center rounded-md text-dash-text-faded transition-colors hover:bg-dash-bg hover:text-dash-text-strong"
            >
              {copied ? <Check className="size-3.5 text-[#13d282]" /> : <Copy className="size-3.5" />}
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 [scrollbar-color:rgba(0,0,0,0.14)_transparent] [scrollbar-width:thin] dark:[scrollbar-color:rgba(255,255,255,0.14)_transparent]">
        {query.isLoading || query.error || (enabled && query.isFetching && !query.data) ? (
          <LoadingState />
        ) : limited ? (
          <p className="text-sm leading-[1.45] text-dash-text-body">
            Daily AI debug limit reached. Resets at midnight UTC. Upgrade your plan for more daily debugs.
          </p>
        ) : messageTooLong ? (
          <p className="text-xs text-dash-text-faded">This log line is too long for quick fix.</p>
        ) : query.data ? (
          <SuggestionsView data={query.data} />
        ) : !enabled ? (
          <p className="text-xs text-dash-text-faded">Message is too short to debug.</p>
        ) : null}

        {!limited && <p className="mt-4 text-[11px] leading-[1.4] text-dash-text-extra-faded">Limit resets at midnight UTC.</p>}
      </div>

      {canCopy && (
        <div className="flex shrink-0 items-center justify-end border-t-[0.5px] border-dash-border px-6 py-4">
          <GlossyButton
            variant="blue"
            loading={prMutation.isPending}
            loadingLabel="Opening pull request..."
            disabled={prMutation.isPending}
            onClick={() => prMutation.mutate()}
          >
            Open pull request
          </GlossyButton>
        </div>
      )}
    </Modal>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-2 text-dash-text-faded">
      <Spinner size="size-3.5" />
      <span className="text-sm">Generating suggestions…</span>
    </div>
  );
}

function SuggestionsView({ data }: { data: DebugSuggestionsResponse }) {
  const { suggestions } = data;

  return (
    <div className="flex flex-col gap-4">
      {suggestions.summary && <p className="text-sm leading-[1.45] text-dash-text-strong">{suggestions.summary}</p>}

      {suggestions.likelyCauses.length > 0 && (
        <Section title="Likely causes">
          <ul className="flex flex-col gap-2">
            {suggestions.likelyCauses.map((cause, index) => (
              <LikelyCauseRow key={index} cause={cause} />
            ))}
          </ul>
        </Section>
      )}

      {suggestions.actions.length > 0 && (
        <Section title="Suggested actions">
          <ol className="flex list-decimal flex-col gap-3 pl-4 marker:text-dash-text-faded">
            {suggestions.actions.map((action, index) => (
              <li key={index}>
                <ActionRow action={action} />
              </li>
            ))}
          </ol>
        </Section>
      )}

      {suggestions.quickChecks.length > 0 && (
        <Section title="Quick checks">
          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm leading-[1.45] text-dash-text-body marker:text-dash-text-faded">
            {suggestions.quickChecks.map((check, index) => (
              <li key={index}>{check}</li>
            ))}
          </ul>
        </Section>
      )}

      {suggestions.notes.length > 0 && (
        <Section title="Notes">
          <ul className="flex flex-col gap-1 text-xs italic leading-[1.45] text-dash-text-faded">
            {suggestions.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-dash-text-strong">{title}</p>
      {children}
    </div>
  );
}

function LikelyCauseRow({ cause }: { cause: DebugLikelyCause }) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-dash-text-strong">{cause.title}</span>
        <LevelChip label={cause.confidence} palette={confidencePalette[cause.confidence]} />
      </div>
      {cause.reason && <p className="text-xs leading-[1.45] text-dash-text-faded">{cause.reason}</p>}
    </li>
  );
}

function ActionRow({ action }: { action: DebugAction }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-dash-text-strong">{action.title}</span>
        <LevelChip label={action.priority} palette={priorityPalette[action.priority]} />
      </div>
      {action.why && <p className="text-xs leading-[1.45] text-dash-text-faded">{action.why}</p>}
      {action.steps.length > 0 && (
        <ol className="flex list-decimal flex-col gap-1 pl-4 text-sm leading-[1.45] text-dash-text-body marker:text-dash-text-faded">
          {action.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      )}
      {action.commands.length > 0 && (
        <div className="flex flex-col gap-1">
          {action.commands.map((cmd, index) => (
            <code
              key={index}
              className="block whitespace-pre-wrap break-words rounded bg-dash-bg-elevated px-2 py-1 font-logs text-xs text-dash-text-strong"
            >
              {cmd}
            </code>
          ))}
        </div>
      )}
      {action.files.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {action.files.map((file, index) => (
            <code key={index} className="rounded bg-dash-bg-elevated px-1.5 py-0.5 font-logs text-[11px] text-dash-text-body">
              {file}
            </code>
          ))}
        </div>
      )}
      {action.expectedResult && (
        <p className="text-xs leading-[1.45] text-dash-text-faded">
          <span className="font-medium text-dash-text-body">Expected:</span> {action.expectedResult}
        </p>
      )}
    </div>
  );
}

function formatSuggestionsForClipboard(data: DebugSuggestionsResponse): string {
  const { suggestions } = data;
  const parts: string[] = ["Debug with AI", ""];

  if (suggestions.summary) {
    parts.push(suggestions.summary, "");
  }

  if (suggestions.likelyCauses.length > 0) {
    parts.push("Likely causes");
    for (const cause of suggestions.likelyCauses) {
      parts.push(`- ${cause.title} [${cause.confidence.toUpperCase()}]`);
      if (cause.reason) parts.push(`  ${cause.reason}`);
    }
    parts.push("");
  }

  if (suggestions.actions.length > 0) {
    parts.push("Suggested actions");
    suggestions.actions.forEach((action, index) => {
      parts.push(`${index + 1}. ${action.title} [${action.priority.toUpperCase()}]`);
      if (action.why) parts.push(`   Why: ${action.why}`);
      if (action.steps.length > 0) {
        parts.push("   Steps:");
        action.steps.forEach((step, i) => parts.push(`     ${i + 1}. ${step}`));
      }
      if (action.commands.length > 0) {
        parts.push("   Commands:");
        action.commands.forEach((cmd) => parts.push(`     $ ${cmd}`));
      }
      if (action.files.length > 0) {
        parts.push(`   Files: ${action.files.join(", ")}`);
      }
      if (action.expectedResult) {
        parts.push(`   Expected: ${action.expectedResult}`);
      }
    });
    parts.push("");
  }

  if (suggestions.quickChecks.length > 0) {
    parts.push("Quick checks");
    for (const check of suggestions.quickChecks) {
      parts.push(`- ${check}`);
    }
    parts.push("");
  }

  if (suggestions.notes.length > 0) {
    parts.push("Notes");
    for (const note of suggestions.notes) {
      parts.push(`- ${note}`);
    }
    parts.push("");
  }

  return parts.join("\n").trimEnd();
}
