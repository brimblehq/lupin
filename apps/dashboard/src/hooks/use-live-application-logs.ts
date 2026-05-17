import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { subHours } from "date-fns";
import config from "@/config";
import { getAccessTokenServerFn } from "@/server/auth/actions";
import { buildAppLogPipeline, type AppLogFilters } from "@/utils/log-filters";

export interface LiveApplicationLogEntry {
  rawTimestampNs: string;
  epochMs: number;
  message: string;
  labels: Record<string, string>;
}

interface UseLiveApplicationLogsInput {
  projectId: string;
  searchQuery?: string | null;
  filters?: AppLogFilters;
  start?: Date;
  end?: Date;
  enabled?: boolean;
  limit?: number;
}

interface LokiStreamPayload {
  streams?: Array<{
    stream?: Record<string, string>;
    values?: Array<[string, string]>;
  }>;
}

function mergedPipeline(searchQuery: string | null | undefined, filters: AppLogFilters | undefined): string {
  const merged: AppLogFilters = { ...(filters ?? {}) };
  const text = searchQuery?.trim();
  if (text && !merged.text) {
    merged.text = text;
  }
  return buildAppLogPipeline(merged);
}

function nsStringToEpochMs(raw: string): number {
  if (!raw) {
    return 0;
  }

  try {
    return Number(BigInt(raw) / 1000000n);
  } catch {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      return 0;
    }
    return Math.floor(parsed / 1_000_000);
  }
}

function parseSocketPayload(payload: unknown): LiveApplicationLogEntry[] {
  let parsed: LokiStreamPayload | null = null;

  if (typeof payload === "string") {
    try {
      parsed = JSON.parse(payload) as LokiStreamPayload;
    } catch {
      return [];
    }
  } else if (payload && typeof payload === "object") {
    parsed = payload as LokiStreamPayload;
  }

  const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
  const items: LiveApplicationLogEntry[] = [];

  for (const stream of streams) {
    const labels = stream.stream && typeof stream.stream === "object" ? stream.stream : {};
    const values = Array.isArray(stream.values) ? stream.values : [];

    for (const tuple of values) {
      if (!Array.isArray(tuple) || tuple.length < 2) {
        continue;
      }

      const rawTimestampNs = String(tuple[0] ?? "");
      const message = String(tuple[1] ?? "");
      if (!message.trim()) {
        continue;
      }

      items.push({
        rawTimestampNs,
        epochMs: nsStringToEpochMs(rawTimestampNs),
        message,
        labels,
      });
    }
  }

  return items;
}

function mergeUniqueLogs(current: LiveApplicationLogEntry[], incoming: LiveApplicationLogEntry[]): LiveApplicationLogEntry[] {
  if (incoming.length === 0) {
    return current;
  }

  const map = new Map<string, LiveApplicationLogEntry>();

  for (const item of current) {
    map.set(`${item.rawTimestampNs}:${item.message}`, item);
  }

  for (const item of incoming) {
    map.set(`${item.rawTimestampNs}:${item.message}`, item);
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    if (a.epochMs !== b.epochMs) {
      return a.epochMs - b.epochMs;
    }
    return a.rawTimestampNs.localeCompare(b.rawTimestampNs);
  });

  return merged.slice(-1000);
}

interface TailRequestParams {
  projectId: string;
  query?: string;
  start: string;
  limit: string;
  delay_for: string;
  end?: string;
}

const CONCURRENT_TAIL_LIMIT_RE = /max concurrent tail requests limit exceeded/i;
const MAX_RANGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let sharedSocket: Socket | null = null;
let sharedSocketInitPromise: Promise<Socket | null> | null = null;
let sharedSocketConsumers = 0;

function extractMessage(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const next = extractMessage(item);
      if (next) {
        return next;
      }
    }
    return "";
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.reason === "string") return record.reason;
    if (typeof record.error === "string") return record.error;
    if (typeof record.data === "string") return record.data;

    if (record.data && typeof record.data === "object") {
      const nested = extractMessage(record.data);
      if (nested) {
        return nested;
      }
    }
  }

  return "";
}

function isConcurrentTailLimitError(value: unknown): boolean {
  return CONCURRENT_TAIL_LIMIT_RE.test(extractMessage(value));
}

async function getOrCreateSharedSocket(): Promise<Socket | null> {
  if (sharedSocket) {
    return sharedSocket;
  }

  if (sharedSocketInitPromise) {
    return sharedSocketInitPromise;
  }

  sharedSocketInitPromise = (async () => {
    let token: string | null = null;
    try {
      token = await (getAccessTokenServerFn as unknown as (input: { data?: undefined }) => Promise<string | null>)({ data: undefined });
    } catch {
      // continue without token
    }

    const parsed = new URL(config.logsSocketUrl);
    const pathPrefix = parsed.pathname === "/" ? "" : parsed.pathname;

    const socket = io(`${parsed.origin}/loki`, {
      transports: ["websocket", "polling"],
      timeout: 10_000,
      // Keep connection behavior explicit so server-side limits are easier to control.
      reconnection: false,
      autoConnect: false,
      path: `${pathPrefix}/socket.io/`,
      auth: token ? { token } : undefined,
    });

    sharedSocket = socket;
    sharedSocketInitPromise = null;
    return socket;
  })().catch(() => {
    sharedSocketInitPromise = null;
    return null;
  });

  return sharedSocketInitPromise;
}

function retainSharedSocket() {
  sharedSocketConsumers += 1;
}

function releaseSharedSocket() {
  sharedSocketConsumers = Math.max(0, sharedSocketConsumers - 1);
  if (sharedSocketConsumers === 0 && sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
    sharedSocketInitPromise = null;
  }
}

export function useLiveApplicationLogs(input: UseLiveApplicationLogsInput) {
  const [logs, setLogs] = useState<LiveApplicationLogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLogsCount, setPendingLogsCount] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const pendingLogsRef = useRef<LiveApplicationLogEntry[]>([]);
  const isPausedRef = useRef(false);
  const activeTailKeyRef = useRef("");
  const desiredTailRef = useRef<{ key: string; params: TailRequestParams } | null>(null);
  const isTailRestartRef = useRef(false);
  const blockedByLimitRef = useRef(false);

  const enabled = Boolean(input.enabled && input.projectId);

  const lokiQuery = useMemo(() => mergedPipeline(input.searchQuery, input.filters), [input.searchQuery, input.filters]);

  const rangeStartMs = useMemo(() => {
    if (input.start instanceof Date) {
      return input.start.getTime();
    }

    return subHours(new Date(), 1).getTime();
  }, [input.start]);

  const rangeEndMs = useMemo(() => {
    if (!(input.end instanceof Date)) return null;

    const endMs = input.end.getTime();
    if (endMs - rangeStartMs > MAX_RANGE_MS) {
      return rangeStartMs + MAX_RANGE_MS;
    }

    return endMs;
  }, [input.end, rangeStartMs]);

  const tailParams = useMemo(() => {
    const params: TailRequestParams = {
      projectId: input.projectId,
      start: String(rangeStartMs * 1_000_000),
      limit: String(input.limit ?? 150),
      delay_for: "0",
    };

    if (lokiQuery) {
      params.query = lokiQuery;
    }

    if (rangeEndMs !== null) {
      params.end = String(rangeEndMs * 1_000_000);
    }

    return params;
  }, [input.limit, input.projectId, lokiQuery, rangeEndMs, rangeStartMs]);

  const tailKey = useMemo(() => JSON.stringify(tailParams), [tailParams]);

  useEffect(() => {
    desiredTailRef.current = { key: tailKey, params: tailParams };
  }, [tailKey, tailParams]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    pendingLogsRef.current = [];
    setPendingLogsCount(0);
    activeTailKeyRef.current = "";
  }, []);

  const emitDesiredTail = useCallback(
    (force = false) => {
      const socket = socketRef.current;
      const desired = desiredTailRef.current;

      if (!enabled || !socket || !desired || blockedByLimitRef.current) {
        return;
      }

      if (!socket.connected) {
        setIsConnecting(true);
        socket.connect();
        return;
      }

      if (!force && desired.key === activeTailKeyRef.current) {
        return;
      }

      if (activeTailKeyRef.current && desired.key !== activeTailKeyRef.current) {
        // Grafana tail sessions accumulate server-side; restart transport before re-tail.
        isTailRestartRef.current = true;
        activeTailKeyRef.current = "";
        setIsConnecting(true);
        socket.disconnect();
        socket.connect();
        return;
      }

      socket.emit("tail", desired.params);
      activeTailKeyRef.current = desired.key;
    },
    [enabled],
  );

  const pause = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
    if (pendingLogsRef.current.length > 0) {
      setLogs((prev) => mergeUniqueLogs(prev, pendingLogsRef.current));
      pendingLogsRef.current = [];
      setPendingLogsCount(0);
    }
    emitDesiredTail(true);
  }, [emitDesiredTail]);

  const reconnect = useCallback(() => {
    clearLogs();
    blockedByLimitRef.current = false;
    setError(null);

    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    activeTailKeyRef.current = "";
    isTailRestartRef.current = true;
    if (socket.connected) {
      socket.disconnect();
    }
    setIsConnecting(true);
    socket.connect();
  }, [clearLogs]);

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      setIsConnecting(false);
      return;
    }

    let cancelled = false;
    let socket: Socket | null = null;
    let handlers: {
      onConnect: () => void;
      onConnected: () => void;
      onLogs: (payload: unknown) => void;
      onSocketDisconnect: (reason?: unknown) => void;
      onServerDisconnected: (reason?: unknown) => void;
      onError: (evt: unknown) => void;
      onConnectError: (evt: unknown) => void;
    } | null = null;

    retainSharedSocket();
    setIsConnecting(true);
    setError(null);

    void (async () => {
      const shared = await getOrCreateSharedSocket();
      if (cancelled) {
        return;
      }

      if (!shared) {
        setIsConnecting(false);
        setError((prev) => prev ?? "Unable to initialize log stream");
        releaseSharedSocket();
        return;
      }

      socket = shared;
      socketRef.current = shared;

      const onConnect = () => {
        setIsConnected(true);
        setIsConnecting(false);
        if (!blockedByLimitRef.current) {
          setError(null);
        }
        isTailRestartRef.current = false;
        if (!isPausedRef.current) {
          emitDesiredTail(true);
        }
      };

      const onLogs = (payload: unknown) => {
        const items = parseSocketPayload(payload);
        if (items.length === 0) return;

        if (isPausedRef.current) {
          pendingLogsRef.current = mergeUniqueLogs(pendingLogsRef.current, items);
          setPendingLogsCount(pendingLogsRef.current.length);
          return;
        }

        setLogs((prev) => mergeUniqueLogs(prev, items));
      };

      const onSocketDisconnect = (reason?: unknown) => {
        setIsConnected(false);
        setIsConnecting(false);
        activeTailKeyRef.current = "";

        const reasonText = extractMessage(reason);
        if (isTailRestartRef.current || reasonText === "io client disconnect") {
          isTailRestartRef.current = false;
          return;
        }

        if (isConcurrentTailLimitError(reason)) {
          blockedByLimitRef.current = true;
          setError(reasonText || "Log stream limit reached. Click reconnect to retry with one active stream.");
        }
      };

      const onServerDisconnected = (reason?: unknown) => {
        const reasonText = extractMessage(reason);
        if (!reasonText) {
          return;
        }

        setIsConnected(false);
        setIsConnecting(false);
        activeTailKeyRef.current = "";
        setError(reasonText);

        if (isConcurrentTailLimitError(reason)) {
          blockedByLimitRef.current = true;
          socketRef.current?.disconnect();
        }
      };

      const onError = (evt: unknown) => {
        setIsConnected(false);
        setIsConnecting(false);
        const message = extractMessage(evt) || "Unable to stream application logs";
        setError(message);
        if (isConcurrentTailLimitError(evt)) {
          blockedByLimitRef.current = true;
          socketRef.current?.disconnect();
        }
      };

      handlers = {
        onConnect,
        onConnected: onConnect,
        onLogs,
        onSocketDisconnect,
        onServerDisconnected,
        onError,
        onConnectError: onError,
      };

      shared.on("connect", handlers.onConnect);
      shared.on("connected", handlers.onConnected);
      shared.on("logs", handlers.onLogs);
      shared.on("disconnect", handlers.onSocketDisconnect);
      shared.on("disconnected", handlers.onServerDisconnected);
      shared.on("error", handlers.onError);
      shared.on("connect_error", handlers.onConnectError);

      if (!shared.connected) {
        shared.connect();
      } else {
        onConnect();
      }
    })();

    return () => {
      cancelled = true;

      if (socket && handlers) {
        socket.off("connect", handlers.onConnect);
        socket.off("connected", handlers.onConnected);
        socket.off("logs", handlers.onLogs);
        socket.off("disconnect", handlers.onSocketDisconnect);
        socket.off("disconnected", handlers.onServerDisconnected);
        socket.off("error", handlers.onError);
        socket.off("connect_error", handlers.onConnectError);
      }

      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      activeTailKeyRef.current = "";
      isTailRestartRef.current = false;
      releaseSharedSocket();
    };
  }, [emitDesiredTail, enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    clearLogs();
    if (!isPausedRef.current) {
      emitDesiredTail();
    }
  }, [clearLogs, emitDesiredTail, enabled, tailKey]);

  return {
    logs,
    isPaused,
    isConnected,
    isConnecting,
    error,
    pendingLogsCount,
    clearLogs,
    pause,
    resume,
    reconnect,
  };
}
