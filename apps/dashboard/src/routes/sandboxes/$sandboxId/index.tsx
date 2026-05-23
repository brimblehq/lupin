import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Fragment, useCallback, useState } from "react";
import type { ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { tokenizeCode } from "@/lib/syntax-highlight";
import { formatRelativeTime } from "@/utils/dashboard";
import {
  SandboxActivityStatus,
  type PaginatedSandboxActivityResponse,
  type SandboxActivityResponse,
  type SandboxResponse,
} from "@/backend/sandboxes";
import { listSandboxActivityServerFn } from "@/server/sandboxes/actions";
import { workspaceLoaderDeps } from "@/utils/workspace-route-search";
import { parseActivityCommand, type ParsedActivityCommand } from "@/lib/sandboxes/activity-command";
import { ActivityDetailModal } from "@/components/sandboxes/activity-detail-modal";
import { NumberPagination } from "@/components/shared/pagination";

const TIMELINE_PAGE_SIZE = 10;

export const Route = createFileRoute("/sandboxes/$sandboxId/")({
  staleTime: 60_000,
  preloadStaleTime: 60_000,
  loaderDeps: ({ search }) => workspaceLoaderDeps(search),
  loader: async ({ params, deps }) => {
    const activity = await (
      listSandboxActivityServerFn as unknown as (input: {
        data: { sandboxId: string; workspace?: string; page?: number; limit?: number };
      }) => Promise<PaginatedSandboxActivityResponse>
    )({
      data: { sandboxId: params.sandboxId, workspace: deps.workspace, page: 1, limit: TIMELINE_PAGE_SIZE },
    });

    return { activity, workspace: deps.workspace };
  },
  component: SandboxOverviewPanel,
});

const detailIconClass = "size-3.5 shrink-0 opacity-60 invert dark:invert-0";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateTimeFormatter.format(date);
}

const parentRouteApi = getRouteApi("/sandboxes/$sandboxId");

function SandboxOverviewPanel() {
  const { sandbox } = parentRouteApi.useLoaderData() as { sandbox: SandboxResponse };
  const { activity: initialActivity, workspace } = Route.useLoaderData();
  const cpu = sandbox.specs?.cpu ?? 0;
  const memory = sandbox.specs?.memory ?? 0;
  const disk = sandbox.specs?.disk ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <GettingStartedSection sandbox={sandbox} />

      <section className="flex flex-col gap-3">
        <SectionHeader title="Resources" description="Compute and storage allocated to this sandbox." />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <ResourceTile icon={<img src="/icons/cpu.svg" alt="" className={detailIconClass} />} label="CPU" value={`${cpu} MHz`} />
          <ResourceTile icon={<img src="/icons/memory.svg" alt="" className={detailIconClass} />} label="Memory" value={`${memory} MB`} />
          <ResourceTile icon={<img src="/icons/disk.svg" alt="" className={detailIconClass} />} label="Disk" value={`${disk} GB`} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Details" description="Configuration and lifecycle metadata for this sandbox." />
        <dl className="grid grid-cols-1 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg text-sm sm:grid-cols-2">
          <div className="flex flex-col px-4 sm:border-r-[0.5px] sm:border-dash-border-soft">
            <DetailRow
              icon={<img src="/icons/region.svg" alt="" className={detailIconClass} />}
              label="Region"
              value={
                sandbox.regionName
                  ? sandbox.regionCountry
                    ? `${sandbox.regionName} (${sandbox.regionCountry})`
                    : sandbox.regionName
                  : sandbox.region
              }
            />
            <DetailRow
              icon={<img src="/icons/template.svg" alt="" className={detailIconClass} />}
              label="Template"
              value={sandbox.template}
            />
            <DetailRow
              icon={<img src="/icons/clock.svg" alt="" className={detailIconClass} />}
              label="Created"
              value={sandbox.createdAt ? formatRelativeTime(sandbox.createdAt) : "—"}
            />
            <DetailRow
              icon={<img src="/icons/status.svg" alt="" className={detailIconClass} />}
              label="Last activity"
              value={sandbox.lastActivityAt ? formatRelativeTime(sandbox.lastActivityAt) : "—"}
            />
            <DetailRow
              icon={<img src="/icons/arrow-down.svg" alt="" className={detailIconClass} />}
              label="Persistent"
              value={sandbox.persistent ? "Enabled" : "Disabled"}
            />
          </div>
          <div className="flex flex-col px-4">
            <DetailRow
              icon={<img src="/icons/disk.svg" alt="" className={detailIconClass} />}
              label="Persistent disk"
              value={sandbox.persistentDiskGB ? `${sandbox.persistentDiskGB} GB` : "—"}
            />
            <DetailRow
              icon={<img src="/icons/calendar.svg" alt="" className={detailIconClass} />}
              label="Auto destroy"
              value={sandbox.autoDestroy ? `Yes (${sandbox.destroyTimeout ?? "—"})` : "No"}
            />
            <DetailRow
              icon={<img src="/icons/mode.svg" alt="" className={detailIconClass} />}
              label="Snapshot mode"
              value={sandbox.snapshotMode}
            />
            <DetailRow
              icon={<img src="/icons/clock.svg" alt="" className={detailIconClass} />}
              label="Snapshot frequency"
              value={sandbox.snapshotFrequency ?? "—"}
            />
            <DetailRow
              icon={<img src="/icons/stopwatch.svg" alt="" className={detailIconClass} />}
              label="Expires"
              value={formatDate(sandbox.expiresAt)}
            />
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Timeline" description="Lifecycle activity and commands run on this sandbox." />
        <TimelineList sandbox={sandbox} initialActivity={initialActivity} workspace={workspace} />
      </section>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-base font-medium leading-5 tracking-[-0.03px] text-dash-text-strong">{title}</h2>
      {description ? <p className="max-w-[600px] text-sm font-light leading-[1.3] text-dash-text-faded">{description}</p> : null}
    </div>
  );
}

function ResourceTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[4px] bg-dash-bg-elevated px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-dash-text-faded">
        {icon}
        {label}
      </div>
      <span className="text-sm font-medium text-dash-text-strong">{value}</span>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b-[0.5px] border-dash-border-soft py-3 last:border-b-0">
      <span className="flex items-center gap-2 text-dash-text-faded">
        {icon}
        {label}
      </span>
      <span className="truncate text-dash-text-body">{value}</span>
    </div>
  );
}

type TimelineEventType = "created" | "paused" | "destroyed" | "exec_running" | "exec_succeeded" | "exec_failed";

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  label: string;
  description?: string;
  at: string;
  activity?: SandboxActivityResponse;
  parsed?: ParsedActivityCommand;
}

interface TimelineDotStyle {
  bg: string;
  border: string;
}

const TIMELINE_DOT_VARIANT: Record<TimelineEventType, TimelineDotStyle> = {
  created: {
    bg: "linear-gradient(180deg, #7fb6ff 0%, #4879f8 35%, #3060d0 100%)",
    border: "#3060d0",
  },
  paused: {
    bg: "linear-gradient(180deg, #ffc66b 0%, #f5a623 35%, #c97f0a 100%)",
    border: "#c97f0a",
  },
  destroyed: {
    bg: "linear-gradient(180deg, #f07070 0%, #ef4444 35%, #d63031 100%)",
    border: "#d63031",
  },
  exec_running: {
    bg: "linear-gradient(180deg, #ffe066 0%, #facc15 35%, #d4a912 100%)",
    border: "#d4a912",
  },
  exec_succeeded: {
    bg: "linear-gradient(180deg, #34e89e 0%, #13d282 35%, #0fba72 100%)",
    border: "#0fba72",
  },
  exec_failed: {
    bg: "linear-gradient(180deg, #f07070 0%, #ef4444 35%, #d63031 100%)",
    border: "#d63031",
  },
};

function deriveLifecycleEvents(sandbox: SandboxResponse): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const regionLabel = sandbox.regionName ?? sandbox.region;

  if (sandbox.createdAt) {
    events.push({
      id: "lifecycle-created",
      type: "created",
      label: "Created",
      description: `Provisioned from ${sandbox.template}${regionLabel ? ` in ${regionLabel}` : ""}`,
      at: sandbox.createdAt,
    });
  }

  if (sandbox.pausedAt) {
    events.push({ id: "lifecycle-paused", type: "paused", label: "Paused", at: sandbox.pausedAt });
  }

  if (sandbox.destroyedAt) {
    events.push({
      id: "lifecycle-destroyed",
      type: "destroyed",
      label: "Destroyed",
      description: sandbox.destroyReason ? `Reason: ${sandbox.destroyReason}` : undefined,
      at: sandbox.destroyedAt,
    });
  }

  return events;
}

function activityToTimelineEvent(activity: SandboxActivityResponse): TimelineEvent | null {
  const parsed = parseActivityCommand(activity.command);

  // Lifecycle destruction is already surfaced via deriveLifecycleEvents — skip the activity row.
  if (parsed.kind === "destroyed") return null;

  if (activity.status === SandboxActivityStatus.Running) {
    return {
      id: activity.id,
      type: "exec_running",
      label: "Command running",
      description: parsed.headline,
      at: activity.startedAt,
      activity,
      parsed,
    };
  }

  if (activity.status === SandboxActivityStatus.Failed) {
    let failureSuffix = "";
    if (activity.error) {
      failureSuffix = ` · ${activity.error}`;
    } else if (activity.exitCode !== null) {
      failureSuffix = ` · exit code ${activity.exitCode}`;
    }
    return {
      id: activity.id,
      type: "exec_failed",
      label: "Command failed",
      description: `${parsed.headline}${failureSuffix}`,
      at: activity.startedAt,
      activity,
      parsed,
    };
  }

  return {
    id: activity.id,
    type: "exec_succeeded",
    label: "Command succeeded",
    description: parsed.headline,
    at: activity.startedAt,
    activity,
    parsed,
  };
}

interface TimelineListProps {
  sandbox: SandboxResponse;
  initialActivity: PaginatedSandboxActivityResponse;
  workspace?: string;
}

function TimelineList({ sandbox, initialActivity, workspace }: TimelineListProps) {
  const listActivity = useServerFn(listSandboxActivityServerFn);

  const [items, setItems] = useState<SandboxActivityResponse[]>(initialActivity.items);
  const [currentPage, setCurrentPage] = useState<number>(initialActivity.currentPage);
  const [totalPages, setTotalPages] = useState<number>(initialActivity.totalPages);
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const [selected, setSelected] = useState<{ activity: SandboxActivityResponse; parsed: ParsedActivityCommand } | null>(null);

  const handlePageChange = useCallback(
    async (page: number) => {
      if (loadingPage !== null || page === currentPage || page < 1 || page > totalPages) return;
      setLoadingPage(page);
      try {
        const result = await listActivity({
          data: { sandboxId: sandbox.id, workspace, page, limit: TIMELINE_PAGE_SIZE },
        });
        setItems(result.items);
        setCurrentPage(result.currentPage);
        setTotalPages(result.totalPages);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load activity");
      } finally {
        setLoadingPage(null);
      }
    },
    [listActivity, loadingPage, currentPage, totalPages, sandbox.id, workspace],
  );

  // Lifecycle events anchor page 1 (provenance start) — never duplicated across pages.
  const lifecycleEvents = currentPage === 1 ? deriveLifecycleEvents(sandbox) : [];
  const events: TimelineEvent[] = [
    ...lifecycleEvents,
    ...items.map(activityToTimelineEvent).filter((e): e is TimelineEvent => e !== null),
  ].sort((a, b) => a.at.localeCompare(b.at));

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-[4px] border-[0.5px] border-dashed border-dash-border-soft px-4 py-8 text-xs text-dash-text-faded">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg px-4 py-2 text-sm">
        {events.map((event, index) => (
          <TimelineRow
            key={event.id}
            event={event}
            isLast={index === events.length - 1}
            onSelect={event.activity && event.parsed ? () => setSelected({ activity: event.activity!, parsed: event.parsed! }) : undefined}
          />
        ))}
      </ol>

      <div className="flex justify-end">
        <NumberPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => void handlePageChange(page)}
          isLoading={loadingPage !== null}
          loadingPage={loadingPage}
        />
      </div>

      <ActivityDetailModal
        open={selected !== null}
        onOpenChange={(next) => {
          if (!next) setSelected(null);
        }}
        activity={selected?.activity ?? null}
        parsed={selected?.parsed ?? null}
      />
    </div>
  );
}

function TimelineRow({ event, isLast, onSelect }: { event: TimelineEvent; isLast: boolean; onSelect?: () => void }) {
  const body = (
    <>
      <div className="flex flex-col items-center pt-1">
        <span
          className="size-3 shrink-0 rounded-full border shadow-[0px_1px_2px_rgba(16,24,40,0.18),inset_0px_1px_0px_rgba(255,255,255,0.35)]"
          style={{
            background: TIMELINE_DOT_VARIANT[event.type].bg,
            borderColor: TIMELINE_DOT_VARIANT[event.type].border,
          }}
        />
        {isLast ? null : <span className="mt-1 w-px flex-1 bg-dash-border-soft" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-dash-text-strong">{event.label}</span>
          <span className="shrink-0 text-xs text-dash-text-faded" title={formatDate(event.at)}>
            {formatRelativeTime(event.at)}
          </span>
        </div>
        {event.description ? <p className="mt-0.5 truncate text-xs leading-[1.5] text-dash-text-faded">{event.description}</p> : null}
      </div>
    </>
  );

  if (onSelect) {
    return (
      <li>
        <button
          type="button"
          onClick={onSelect}
          className="-mx-2 flex w-[calc(100%+1rem)] gap-3 rounded-[4px] px-2 py-1.5 text-left transition-colors hover:bg-dash-bg-elevated"
        >
          {body}
        </button>
      </li>
    );
  }

  return <li className="flex gap-3 py-1.5">{body}</li>;
}

function buildStarterSnippet(sandbox: SandboxResponse): string {
  const template = sandbox.template || "python-3.12";
  const region = sandbox.regionName || sandbox.region || "auto";

  return [
    `import { Sandbox } from "@brimble/sandbox";`,
    ``,
    `const sandbox = await Sandbox.create({`,
    `  template: "${template}",`,
    `  region: "${region}",`,
    `});`,
    ``,
    `const result = await sandbox.exec("echo 'Hello, world!'");`,
    `console.log(result.stdout);`,
  ].join("\n");
}

function GettingStartedSection({ sandbox }: { sandbox: SandboxResponse }) {
  const snippet = buildStarterSnippet(sandbox);
  const installCommand = "npm install @brimble/sandbox";
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);

  async function copy(value: string, kind: "snippet" | "install") {
    try {
      await navigator.clipboard.writeText(value);
      if (kind === "snippet") {
        setCopiedSnippet(true);
        window.setTimeout(() => setCopiedSnippet(false), 1500);
      } else {
        setCopiedInstall(true);
        window.setTimeout(() => setCopiedInstall(false), 1500);
      }
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="Getting started" description="Run code in this sandbox from your app using the @brimble/sandbox SDK." />

      <div className="flex items-center justify-between gap-2 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-3 py-2">
        <code className="truncate font-mono text-[12px] text-dash-text-body">{installCommand}</code>
        <button
          type="button"
          onClick={() => void copy(installCommand, "install")}
          className="inline-flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-[11px] font-medium text-dash-text-faded transition-colors hover:text-dash-text-strong"
        >
          {copiedInstall ? (
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

      <div className="relative">
        <pre className="overflow-x-auto rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated p-4 pr-14 font-mono text-[12px] leading-[1.7] text-dash-text-body">
          <code>
            {tokenizeCode(snippet).map((tok, i) => (
              <Fragment key={i}>{tok.cls ? <span className={tok.cls}>{tok.text}</span> : tok.text}</Fragment>
            ))}
          </code>
        </pre>
        <button
          type="button"
          onClick={() => void copy(snippet, "snippet")}
          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[3px] border-[0.5px] border-dash-border bg-dash-bg px-2 py-1 text-[11px] font-medium text-dash-text-faded transition-colors hover:text-dash-text-strong"
        >
          {copiedSnippet ? (
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

      <a
        href="https://paper.brimble.io/sandboxes/overview"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 self-start text-xs font-medium text-[#4879f8] transition-colors hover:text-[#3a6ae6]"
      >
        Read the full sandbox SDK guide
        <ArrowUpRight className="size-3" />
      </a>
    </section>
  );
}
