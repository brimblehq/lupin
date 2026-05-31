import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { SimpleTooltip } from "@/components/shared/tooltip";
import { StatusChip } from "@/components/shared/status-chip";
import { TabHeader } from "@/components/shared/tab-header";
import { SandboxDetailPending } from "@/components/shared/route-pending";
import { SandboxSubnav } from "@/components/sandboxes/sandbox-subnav";
import { SandboxTerminal } from "@/components/sandboxes/sandbox-terminal";
import { getSandboxScopedAblyOptions } from "@/lib/ably-auth";
import { snapshotEventBus } from "@/lib/sandboxes/snapshot-event-bus";
import { getSandboxServerFn } from "@/server/sandboxes/actions";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import { workspaceLoaderDeps } from "@/utils/workspace-route-search";
import { SandboxStatus } from "@/backend/sandboxes";
import type { SandboxResponse } from "@/backend/sandboxes";
import { getTemplateIcon } from "@/lib/sandboxes/template-icon";

export const Route = createFileRoute("/sandboxes/$sandboxId")({
  staleTime: 60_000,
  preloadStaleTime: 60_000,
  loaderDeps: ({ search }) => workspaceLoaderDeps(search),
  loader: async ({ params, deps }) => {
    const workspace = deps.workspace;

    try {
      const sandbox = await (
        getSandboxServerFn as unknown as (input: { data: { sandboxId: string; workspace?: string } }) => Promise<SandboxResponse>
      )({
        data: { sandboxId: params.sandboxId, workspace },
      });

      return { sandbox, workspace };
    } catch {
      throw redirect({
        to: "/sandboxes",
        search: workspace ? { workspace } : {},
      });
    }
  },
  pendingComponent: SandboxDetailPending,
  component: SandboxDetailLayout,
});

function SandboxDetailLayout() {
  const { sandbox } = Route.useLoaderData();
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isTerminalRoute = pathname.endsWith("/terminal") || pathname.endsWith("/terminal/");
  const router = useRouter();
  const icon = getTemplateIcon(sandbox.template);

  const [status, setStatus] = useState<SandboxStatus>(sandbox.status);
  const [hasMountedTerminalPanel, setHasMountedTerminalPanel] = useState(isTerminalRoute && sandbox.status === SandboxStatus.Ready);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStatus(sandbox.status);
  }, [sandbox.status]);

  async function copyName() {
    try {
      await navigator.clipboard.writeText(sandbox.name);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  useEffect(() => {
    if (isTerminalRoute && status === SandboxStatus.Ready) {
      setHasMountedTerminalPanel(true);
    }
  }, [isTerminalRoute, status]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const authOptions = await getSandboxScopedAblyOptions(sandbox.id);
      if (!authOptions || cancelled) return;

      const { Realtime } = await import("ably");
      const ably = new Realtime(authOptions);
      const channel = ably.channels.get(`sandbox:${sandbox.id}`);

      const onPaused = () => setStatus(SandboxStatus.Paused);
      const onResumed = () => setStatus(SandboxStatus.Ready);
      const onDestroyed = () => {
        setStatus(SandboxStatus.Destroyed);
        void router.invalidate();
      };
      const onSnapshotCompleted = (message: { data?: unknown }) => {
        const data = (message?.data ?? {}) as { snapshotId?: string; sizeBytes?: number; imageTag?: string };
        if (!data.snapshotId) return;
        snapshotEventBus.dispatch(sandbox.id, {
          type: "completed",
          snapshotId: data.snapshotId,
          sizeBytes: typeof data.sizeBytes === "number" ? data.sizeBytes : null,
          imageTag: typeof data.imageTag === "string" ? data.imageTag : null,
        });
      };
      const onSnapshotFailed = (message: { data?: unknown }) => {
        const data = (message?.data ?? {}) as { snapshotId?: string; reason?: string };
        if (!data.snapshotId) return;
        snapshotEventBus.dispatch(sandbox.id, {
          type: "failed",
          snapshotId: data.snapshotId,
          reason: typeof data.reason === "string" ? data.reason : null,
        });
      };

      void channel.subscribe("sandbox:paused", onPaused);
      void channel.subscribe("sandbox:resumed", onResumed);
      void channel.subscribe("sandbox:destroyed", onDestroyed);
      void channel.subscribe("sandbox:snapshot:completed", onSnapshotCompleted);
      void channel.subscribe("sandbox:snapshot:failed", onSnapshotFailed);

      cleanup = () => {
        try {
          channel.unsubscribe("sandbox:paused", onPaused);
          channel.unsubscribe("sandbox:resumed", onResumed);
          channel.unsubscribe("sandbox:destroyed", onDestroyed);
          channel.unsubscribe("sandbox:snapshot:completed", onSnapshotCompleted);
          channel.unsubscribe("sandbox:snapshot:failed", onSnapshotFailed);
          ably.close();
        } catch {
          // ignore teardown errors
        }
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [sandbox.id, router]);

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-4">
        <Link
          to={withWorkspaceQuery({ pathname: "/sandboxes", searchStr }) as any}
          className="inline-flex items-center gap-1.5 text-xs font-light text-dash-text-faded transition-colors hover:text-dash-text-strong"
        >
          <ArrowLeft className="size-3.5" />
          Sandboxes
        </Link>
      </div>

      <div className="mb-6 flex items-start gap-3">
        {icon ? (
          <img src={icon.src} alt="" className={`size-10 shrink-0 object-contain ${icon.shouldInvert ? "dark:invert" : ""}`} />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[4px] bg-dash-bg-elevated text-sm font-semibold uppercase text-dash-text-faded">
            {sandbox.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-medium tracking-[-0.03px] text-dash-text-strong">{sandbox.name}</h1>
            <SimpleTooltip content={copied ? "Copied" : "Copy name"}>
              <button
                type="button"
                onClick={() => void copyName()}
                className="shrink-0 rounded-[3px] p-1 text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
                aria-label="Copy sandbox name"
              >
                {copied ? <Check className="size-3.5 text-[#22c55e]" /> : <Copy className="size-3.5" />}
              </button>
            </SimpleTooltip>
            <StatusChip status={status} className="origin-left scale-[0.92]" />
          </div>
          <p className="mt-1 truncate text-sm font-light text-dash-text-faded">{sandbox.template}</p>
        </div>
      </div>

      <SandboxSubnav sandbox={sandbox} status={status} onStatusChange={setStatus} />

      <div className="pt-6">
        <div style={{ display: isTerminalRoute ? "block" : "none" }}>
          {status === SandboxStatus.Ready ? (
            isTerminalRoute || hasMountedTerminalPanel ? (
              <PersistentTerminalPanel sandbox={sandbox} isVisible={isTerminalRoute} />
            ) : null
          ) : (
            <div className="flex flex-col gap-4">
              <TabHeader title="Terminal">Interactive shell into your sandbox.</TabHeader>
              <div className="flex flex-col items-center justify-center gap-2 rounded-[4px] border-[0.5px] border-dashed border-dash-border-soft py-16">
                <p className="text-sm text-dash-text-faded">Terminal is available when the sandbox is ready (current status: {status}).</p>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: isTerminalRoute ? "none" : "block" }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function PersistentTerminalPanel({ sandbox, isVisible }: { sandbox: SandboxResponse; isVisible: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <TabHeader title="Terminal">Interactive shell into your sandbox.</TabHeader>
      <SandboxTerminal sandbox={sandbox} isVisible={isVisible} />
    </div>
  );
}
