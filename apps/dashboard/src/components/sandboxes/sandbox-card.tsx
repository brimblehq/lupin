import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { intervalToDuration } from "date-fns";
import { Timer } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { StatusChip } from "@/components/shared/status-chip";
import type { SandboxResponse } from "@/backend/sandboxes";
import { formatRelativeTime } from "@/utils/dashboard";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import { getTemplateIcon } from "@/lib/sandboxes/template-icon";

const cardMetaIconClass = "size-3.5 shrink-0 opacity-60 invert dark:invert-0";

interface SandboxCardProps {
  sandbox: SandboxResponse;
  regionLabel?: string;
}

function formatCountdown(targetMs: number, nowMs: number): string {
  const duration = intervalToDuration({ start: nowMs, end: targetMs });
  const days = duration.days ?? 0;
  const hours = duration.hours ?? 0;
  const minutes = duration.minutes ?? 0;
  const seconds = duration.seconds ?? 0;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function useDestroyCountdown(expiresAt: string | null | undefined): string | null {
  const targetMs = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  const isValid = Number.isFinite(targetMs);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isValid) return;
    if (targetMs <= Date.now()) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isValid, targetMs]);

  if (!isValid || targetMs <= nowMs) return null;
  return formatCountdown(targetMs, nowMs);
}

function formatLastActivity(timestamp: string | null | undefined): string {
  if (!timestamp) {
    return "No activity yet";
  }

  return formatRelativeTime(timestamp);
}

function formatAbsoluteDate(timestamp: string | null | undefined): string {
  if (!timestamp) {
    return "No activity yet";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function SandboxCard({ sandbox, regionLabel }: SandboxCardProps) {
  const memoryMb = sandbox.specs?.memory ?? 0;
  const cpuMhz = sandbox.specs?.cpu ?? 0;
  const diskGb = sandbox.specs?.disk ?? 0;
  const sandboxName = sandbox.name;
  const lastActivityLabel = formatLastActivity(sandbox.lastActivityAt);
  const lastActivityAbsolute = formatAbsoluteDate(sandbox.lastActivityAt);
  const destroyCountdown = useDestroyCountdown(sandbox.expiresAt);
  const destroyAtAbsolute = sandbox.expiresAt ? formatAbsoluteDate(sandbox.expiresAt) : undefined;
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });

  return (
    <Link
      to={withWorkspaceQuery({ pathname: `/sandboxes/${sandbox.id}`, searchStr }) as any}
      preload="intent"
      className="block w-full text-left"
    >
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="flex min-h-[168px] cursor-pointer flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-3.5 pt-3 pb-3 text-sm tracking-[-0.02px]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {(() => {
                const icon = getTemplateIcon(sandbox.template);
                if (icon) {
                  return <img src={icon} alt="" className="size-5 shrink-0 object-contain" />;
                }
                return (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-dash-bg-elevated text-[10px] font-semibold uppercase text-dash-text-faded">
                    {sandboxName.charAt(0)}
                  </span>
                );
              })()}
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="min-w-0 truncate font-medium text-dash-text-strong">{sandboxName}</span>
                <span className="min-w-0 truncate text-xs font-light text-dash-text-faded">{sandbox.template}</span>
              </div>
            </div>
            <StatusChip status={sandbox.status} className="shrink-0 origin-top-right scale-[0.92]" />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-dash-text-faded">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <img src="/icons/cpu.svg" alt="" className={cardMetaIconClass} />
              {cpuMhz} MHz
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <img src="/icons/memory.svg" alt="" className={cardMetaIconClass} />
              {memoryMb} MB
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <img src="/icons/disk.svg" alt="" className={cardMetaIconClass} />
              {diskGb} GB
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5 overflow-hidden">
              <img src="/icons/region.svg" alt="" className={cardMetaIconClass} />
              <span className="truncate whitespace-nowrap">{regionLabel ?? sandbox.region}</span>
            </span>
          </div>
        </div>

        <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-t-[0.5px] border-dash-border px-3.5">
          <span className="text-xs leading-[18px] tracking-[-0.02px] text-dash-text-extra-faded" title={lastActivityAbsolute}>
            {lastActivityLabel}
          </span>
          {destroyCountdown ? (
            <span
              className="inline-flex items-center gap-1.5 text-xs tabular-nums leading-[18px] tracking-[-0.02px] text-dash-text-faded"
              title={destroyAtAbsolute ? `Expires at ${destroyAtAbsolute}` : undefined}
            >
              <Timer className="size-3.5 shrink-0" />
              destroys in {destroyCountdown}
            </span>
          ) : null}
        </div>
      </motion.div>
    </Link>
  );
}
