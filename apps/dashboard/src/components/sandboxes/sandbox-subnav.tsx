import { useState } from "react";
import { cn } from "@brimble/ui";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ChartBar, ClockClockwise, GlobeSimple, Terminal } from "@phosphor-icons/react";
import { Loader2, Pause, Play, Upload } from "lucide-react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { SimpleTooltip } from "@/components/shared/tooltip";
import { FolderTrashIcon } from "@/components/shared/folder-trash-icon";
import { PauseSandboxModal } from "@/components/sandboxes/pause-sandbox-modal";
import { DestroySandboxModal } from "@/components/sandboxes/destroy-sandbox-modal";
import { UploadFileModal } from "@/components/sandboxes/upload-file-modal";
import { TakeSnapshotModal } from "@/components/sandboxes/take-snapshot-modal";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import { SandboxStatus } from "@/backend/sandboxes";
import { resumeSandboxServerFn } from "@/server/sandboxes/actions";
import type { SandboxResponse } from "@/backend/sandboxes";

interface SandboxSubnavProps {
  sandbox: SandboxResponse;
  status: SandboxStatus;
  onStatusChange: (status: SandboxStatus) => void;
}

const TABS = [
  { label: "Overview", slug: "", Icon: GlobeSimple },
  { label: "Observability", slug: "observability", Icon: ChartBar },
  { label: "Snapshots", slug: "snapshots", Icon: ClockClockwise },
  { label: "Terminal", slug: "terminal", Icon: Terminal },
] as const;

interface LifecycleConfig {
  mode: "pause" | "resume";
  label: string;
  tooltip: string;
  enabled: boolean;
  Icon: typeof Pause | typeof Play | typeof Loader2;
  spinning?: boolean;
}

const LIFECYCLE: Partial<Record<SandboxStatus, LifecycleConfig>> = {
  [SandboxStatus.Ready]:    { mode: "pause",  label: "Pause",     tooltip: "Pause sandbox",       enabled: true,  Icon: Pause },
  [SandboxStatus.Pausing]:  { mode: "pause",  label: "Pausing…",  tooltip: "Pausing…",            enabled: false, Icon: Loader2, spinning: true },
  [SandboxStatus.Paused]:   { mode: "resume", label: "Resume",    tooltip: "Resume sandbox",      enabled: true,  Icon: Play },
  [SandboxStatus.Resuming]: { mode: "resume", label: "Resuming…", tooltip: "Resuming…",           enabled: false, Icon: Loader2, spinning: true },
  [SandboxStatus.Starting]: { mode: "pause",  label: "Pause",     tooltip: "Sandbox is starting", enabled: false, Icon: Pause },
};

export function SandboxSubnav({ sandbox, status, onStatusChange }: SandboxSubnavProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const navigate = useNavigate();
  const haptics = useHaptics();
  const resumeSandbox = useServerFn(resumeSandboxServerFn);

  const basePath = `/sandboxes/${sandbox.id}`;
  const lifecycle = LIFECYCLE[status];
  const workspace = (() => {
    const params = new URLSearchParams(searchStr || "");
    const value = params.get("workspace")?.trim();
    return value || undefined;
  })();

  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [destroyModalOpen, setDestroyModalOpen] = useState(false);
  const [destroyRequested, setDestroyRequested] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);

  const isDestroyed = status === SandboxStatus.Destroyed;
  const canUpload = status === SandboxStatus.Ready;
  const canSnapshot = status === SandboxStatus.Ready;
  const destroyDisabled = destroyRequested;

  function handlePauseClick() {
    haptics.selection();
    setPauseModalOpen(true);
  }

  async function handleResumeClick() {
    haptics.selection();
    onStatusChange(SandboxStatus.Resuming);
    try {
      await resumeSandbox({ data: { sandboxId: sandbox.id } });
      toast.success("Resume requested");
    } catch (error) {
      onStatusChange(SandboxStatus.Paused);
      toast.error(error instanceof Error ? error.message : "Failed to resume sandbox");
    }
  }

  function handleSnapshotCreated() {
    void navigate({
      to: "/sandboxes/$sandboxId/snapshots",
      params: { sandboxId: sandbox.id },
      search: workspace ? { workspace } : {},
    });
  }

  return (
    <div data-subnav className="flex items-center justify-between border-b-[0.5px] border-dash-border">
      <div className="scrollbar-hidden flex min-w-0 flex-1 items-start overflow-x-auto md:overflow-visible">
        {TABS.map((tab) => {
          const tabPath = tab.slug ? `${basePath}/${tab.slug}` : basePath;
          const isActive = pathname === tabPath || pathname === `${tabPath}/`;

          return (
            <Link
              key={tab.label}
              to={withWorkspaceQuery({ pathname: tabPath, searchStr }) as any}
              preload="intent"
              onClick={() => haptics.selection()}
              className={cn(
                "flex h-14 items-center gap-2 px-2 text-sm tracking-[-0.09px] transition-colors duration-200 ease-out",
                isActive ? "border-b border-[#3c6ce7] text-dash-text-strong" : "font-light text-dash-text-faded hover:text-dash-text-strong",
              )}
            >
              <tab.Icon className="size-4 shrink-0" weight="fill" />
              <span className={cn("whitespace-nowrap md:inline", isActive ? "inline" : "hidden")}>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-4 px-3.5">
        {lifecycle ? (
          <SimpleTooltip content={lifecycle.tooltip}>
            <button
              type="button"
              onClick={() => (lifecycle.mode === "resume" ? void handleResumeClick() : handlePauseClick())}
              disabled={!lifecycle.enabled}
              className="flex items-center gap-1.5 text-sm font-light text-dash-text-body transition-colors hover:text-dash-text-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-dash-text-body"
              aria-label={`${lifecycle.mode === "resume" ? "Resume" : "Pause"} sandbox`}
            >
              <lifecycle.Icon className={cn("size-4", lifecycle.spinning && "animate-spin")} />
              <span className="hidden sm:inline">{lifecycle.label}</span>
            </button>
          </SimpleTooltip>
        ) : null}
        {!isDestroyed ? (
          <SimpleTooltip content={canSnapshot ? "Take snapshot" : "Snapshot available when sandbox is ready"}>
            <button
              type="button"
              onClick={() => {
                haptics.selection();
                setSnapshotModalOpen(true);
              }}
              disabled={!canSnapshot}
              className="flex items-center gap-1.5 text-sm font-light text-dash-text-body transition-colors hover:text-dash-text-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-dash-text-body"
              aria-label="Take snapshot"
            >
              <Camera className="size-4" weight="regular" />
              <span className="hidden sm:inline">Snapshot</span>
            </button>
          </SimpleTooltip>
        ) : null}
        {!isDestroyed ? (
          <SimpleTooltip content={canUpload ? "Upload file" : "Upload available when sandbox is ready"}>
            <button
              type="button"
              onClick={() => {
                haptics.selection();
                setUploadModalOpen(true);
              }}
              disabled={!canUpload}
              className="flex items-center gap-1.5 text-sm font-light text-dash-text-body transition-colors hover:text-dash-text-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-dash-text-body"
              aria-label="Upload file"
            >
              <Upload className="size-4" />
              <span className="hidden sm:inline">Upload</span>
            </button>
          </SimpleTooltip>
        ) : null}
        <SimpleTooltip
          content={
            destroyRequested
              ? "Destroy in progress…"
              : isDestroyed
                ? "Permanently destroy sandbox"
                : "Destroy sandbox"
          }
        >
          <button
            type="button"
            onClick={() => {
              haptics.selection();
              setDestroyModalOpen(true);
            }}
            disabled={destroyDisabled}
            className="transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Destroy sandbox"
          >
            <FolderTrashIcon className="size-4" color="#ef2f1f" />
          </button>
        </SimpleTooltip>
      </div>

      <PauseSandboxModal
        open={pauseModalOpen}
        onOpenChange={setPauseModalOpen}
        sandboxId={sandbox.id}
        sandboxName={sandbox.name}
        onPauseRequested={() => onStatusChange(SandboxStatus.Pausing)}
      />

      <DestroySandboxModal
        open={destroyModalOpen}
        onOpenChange={setDestroyModalOpen}
        sandboxId={sandbox.id}
        sandboxName={sandbox.name}
        template={sandbox.template}
        persistent={sandbox.persistent}
        isDestroyed={isDestroyed}
        onDestroyRequested={() => setDestroyRequested(true)}
      />

      <UploadFileModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        sandboxId={sandbox.id}
        sandboxName={sandbox.name}
        persistent={sandbox.persistent}
      />

      <TakeSnapshotModal
        open={snapshotModalOpen}
        onOpenChange={setSnapshotModalOpen}
        sandboxId={sandbox.id}
        sandboxName={sandbox.name}
        workspace={workspace}
        onSnapshotCreated={handleSnapshotCreated}
      />
    </div>
  );
}
