import { format } from "date-fns";
import type { RawDeploymentRunLogRow } from "@/backend/deployment-run-logs";

export type DeploymentDrawerLogEntryType = "section" | "detail";
export type DeploymentDrawerLogSectionStatus = "success" | "error" | "pending";

export type BuildPhase = "queued" | "clone" | "setup" | "install" | "build" | "push" | "start" | "health" | "live";

export const BUILD_PHASE_ORDER: BuildPhase[] = ["queued", "clone", "setup", "install", "build", "push", "start", "health", "live"];

export const BUILD_PHASE_LABEL: Record<BuildPhase, string> = {
  queued: "Queued",
  clone: "Clone",
  setup: "Setup",
  install: "Install",
  build: "Build",
  push: "Push",
  start: "Start",
  health: "Health",
  live: "Live",
};

export interface DeploymentDrawerLogEntry {
  rawId?: string;
  messageId?: string;
  type: DeploymentDrawerLogEntryType;
  message: string;
  timestamp: string;
  timestampRaw?: string;
  timestampMs?: number | null;
  status?: DeploymentDrawerLogSectionStatus;
  phase?: BuildPhase;
  securityData?: any;
}

interface SectionRule {
  pattern: RegExp;
  status?: DeploymentDrawerLogSectionStatus;
}

const SECTION_RULES: SectionRule[] = [
  { pattern: /^(?:⚡(?:\uFE0F)?\s*)?starting\b/i },
  { pattern: /deployment queued starting soon/i, status: "pending" },
  { pattern: /deployment started/i, status: "success" },
  { pattern: /site (is )?(live|running)\b/i, status: "success" },
  { pattern: /deployment failed/i, status: "error" },
  { pattern: /build failed/i, status: "error" },
  { pattern: /failed to deploy/i, status: "error" },
];

interface PhaseRule {
  pattern: RegExp;
  phase: BuildPhase;
}

const PHASE_RULES: PhaseRule[] = [
  { pattern: /deployment queued/i, phase: "queued" },
  { pattern: /\bcloning from\b|\brepository cloned\b|\bhead is now at\b/i, phase: "clone" },
  { pattern: /detected \d+ environment variables|\bmise\s+\S+@/i, phase: "setup" },
  { pattern: /\b(pnpm|npm|yarn|bun)\s+(install|i)\b|lockfile|packages:\s*\+|progress: resolved|installing dependencies/i, phase: "install" },
  { pattern: /building with docker buildkit|vite\s+v?\d|webpack|next build|nuxt build|modules transformed|rendering chunks|\bbuilt in\b|astro build|remix build/i, phase: "build" },
  { pattern: /exporting (layers|manifest|to image)|pushing (manifest|layers)|pushed\b/i, phase: "push" },
  { pattern: /^(?:⚡(?:️)?\s*)?starting\b/i, phase: "start" },
  { pattern: /running health check|health check (passed|ok|succeeded)/i, phase: "health" },
  { pattern: /site (is )?(live|running)\b/i, phase: "live" },
];

export function detectPhase(message: string): BuildPhase | undefined {
  for (const rule of PHASE_RULES) {
    if (rule.pattern.test(message)) {
      return rule.phase;
    }
  }
  return undefined;
}

function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return format(date, "MMM dd yyyy  HH:mm:ss");
}

function parseTimestampMs(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getTime();
}

function tryParseEmbeddedLogLine(content: string): {
  message: string;
  embeddedTimestamp?: string;
} {
  const trimmed = content.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s+---\s+(.+)$/i);

  if (!match) {
    return { message: trimmed };
  }

  return {
    embeddedTimestamp: match[1],
    message: match[2].trim(),
  };
}

function classifyLogMessage(message: string): {
  type: DeploymentDrawerLogEntryType;
  status?: DeploymentDrawerLogSectionStatus;
} {
  for (const rule of SECTION_RULES) {
    if (rule.pattern.test(message)) {
      return { type: "section", status: rule.status };
    }
  }

  return { type: "detail" };
}

export function mapDeploymentRunLogsToDrawerEntries(rows: RawDeploymentRunLogRow[]): DeploymentDrawerLogEntry[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const entries: DeploymentDrawerLogEntry[] = [];

  for (const row of rows) {
    const rawContent = typeof row.content === "string" ? row.content : "";
    if (!rawContent.trim()) {
      continue;
    }

    const parsedLine = tryParseEmbeddedLogLine(rawContent);
    let message = parsedLine.message;
    let securityData: any = undefined;

    const securityDataKey = "__BRIMBLE_SEC_SCAN_DATA__=";
    if (message.includes(securityDataKey)) {
      const parts = message.split(securityDataKey);
      message = parts[0].trim();
      try {
        securityData = JSON.parse(parts[1]);
      } catch (e) {
        // ignore parse error
      }
    }

    const classification = classifyLogMessage(message);
    const timestampValue = parsedLine.embeddedTimestamp ?? row.timestamp ?? row.timeStamp;
    const messageId = typeof row.id === "string" ? row.id.trim() : "";
    entries.push({
      rawId: messageId || undefined,
      messageId: messageId || undefined,
      type: classification.type,
      message,
      timestamp: formatTimestamp(timestampValue),
      timestampRaw: timestampValue ?? undefined,
      timestampMs: parseTimestampMs(timestampValue),
      status: classification.status,
      phase: detectPhase(message),
      securityData,
    });
  }

  return sortDeploymentDrawerEntries(entries);
}

export interface BuildPhaseSummary {
  phase: BuildPhase;
  startMs: number;
  endMs: number;
  durationMs: number;
}

export function summarizePhases(entries: DeploymentDrawerLogEntry[]): BuildPhaseSummary[] {
  const phaseFirstMs = new Map<BuildPhase, number>();
  let lastTimestampMs: number | null = null;

  for (const entry of entries) {
    if (typeof entry.timestampMs === "number") {
      lastTimestampMs = entry.timestampMs;
    }

    if (!entry.phase || typeof entry.timestampMs !== "number") {
      continue;
    }

    if (!phaseFirstMs.has(entry.phase)) {
      phaseFirstMs.set(entry.phase, entry.timestampMs);
    }
  }

  const observed = BUILD_PHASE_ORDER.filter((phase) => phaseFirstMs.has(phase));
  if (observed.length === 0) {
    return [];
  }

  const summaries: BuildPhaseSummary[] = [];
  for (let index = 0; index < observed.length; index++) {
    const phase = observed[index];
    const startMs = phaseFirstMs.get(phase) as number;
    const nextPhase = observed[index + 1];
    const endMs = nextPhase ? (phaseFirstMs.get(nextPhase) as number) : (lastTimestampMs ?? startMs);
    const durationMs = Math.max(0, endMs - startMs);
    summaries.push({ phase, startMs, endMs, durationMs });
  }

  return summaries;
}

export function sortDeploymentDrawerEntries(entries: DeploymentDrawerLogEntry[]): DeploymentDrawerLogEntry[] {
  if (entries.length <= 1) {
    return entries;
  }

  return [...entries].sort((a, b) => {
    const aMs = typeof a.timestampMs === "number" ? a.timestampMs : null;
    const bMs = typeof b.timestampMs === "number" ? b.timestampMs : null;

    if (aMs !== null && bMs !== null && aMs !== bMs) {
      return aMs - bMs;
    }

    if (aMs !== null && bMs === null) {
      return -1;
    }

    if (aMs === null && bMs !== null) {
      return 1;
    }

    return 0;
  });
}
