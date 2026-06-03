import type { DateRange } from "react-day-picker";
import { format, subDays, subMinutes } from "date-fns";
import type { RequestLogEntry as ApiRequestLogEntry } from "@/backend/logs";

export interface UiRequestLogEntry {
  method: string;
  path: string;
  status: number;
  duration: string;
  timestamp: string;
  ip: string;
  host: string;
  url: string;
  browser: string;
  query?: Record<string, string>;
  headers: Record<string, string>;
  response: string;
  isoTimestamp: string;
}

export type UiLogLevel = "info" | "warn" | "error" | "debug";

export const requestMethodColors: Record<string, string> = {
  GET: "text-[#28c840]",
  POST: "text-[#4879f8]",
  PUT: "text-[#ff9b01]",
  PATCH: "text-[#ff9b01]",
  DELETE: "text-[#ff5f57]",
};

export function defaultRequestLogsDateRange(): DateRange {
  return {
    from: subDays(new Date(), 30),
    to: new Date(),
  };
}

export function defaultApplicationLogsDateRange(): DateRange {
  const now = new Date();
  return {
    from: subMinutes(now, 30),
    to: now,
  };
}

export function formatAppLogTime(date: Date): string {
  return format(date, "MMM d yyyy HH:mm:ss");
}

export function detectAppLogLevel(message: string): UiLogLevel {
  const lower = message.toLowerCase();
  if (
    lower.includes("error") ||
    lower.includes("failed") ||
    lower.includes("exception") ||
    lower.includes("panic") ||
    lower.includes("fatal")
  ) {
    return "error";
  }

  if (lower.includes("warn") || lower.includes("deprecated")) {
    return "warn";
  }

  if (lower.includes("debug") || lower.includes("trace")) {
    return "debug";
  }

  return "info";
}

export const embeddedIsoTimestampRegex = /^[\d-]{4}-[\d-]{2}-[\d-]{2}T[\d:.]{8,}Z\s*/;

export function requestStatusColor(status: number): string {
  if (status < 300) {
    return "text-[#28c840]";
  }

  if (status < 400) {
    return "text-[#ff9b01]";
  }

  return "text-[#ff5f57]";
}

export function requestStatusDot(status: number): string {
  if (status < 300) {
    return "bg-[#28c840]";
  }

  if (status < 400) {
    return "bg-[#ff9b01]";
  }

  return "bg-[#ff5f57]";
}

export function buildRequestLogRawData(log: UiRequestLogEntry) {
  const raw: Record<string, unknown> = {
    timestamp: log.isoTimestamp,
    hostname: log.host,
    method: log.method,
    url: log.url,
  };

  if (log.query) {
    raw.query = log.query;
  }

  raw.status = log.status;
  raw.response = log.response;
  raw.browser = log.browser;
  raw.headers = log.headers;
  raw.ip = log.ip;
  raw.duration = log.duration;

  return raw;
}

export function mapApiRequestLogToUiRow(log: ApiRequestLogEntry): UiRequestLogEntry {
  let path = "/";

  try {
    const parsed = new URL(log.url);
    path = `${parsed.pathname}${parsed.search || ""}`;
  } catch {
    path = log.url || "/";
  }

  const isoTimestamp = log.timestamp || new Date().toISOString();
  const date = new Date(isoTimestamp);
  const timestamp = Number.isNaN(date.getTime()) ? "" : format(date, "MMM d yyyy HH:mm:ss");

  let duration = "—";
  const durationMatch = log.message.match(/(\d+(?:\.\d+)?)\s*ms/i);
  if (durationMatch) {
    duration = `${durationMatch[1]}ms`;
  }

  return {
    method: log.method || "GET",
    path,
    status: log.status || 0,
    duration,
    timestamp,
    ip: log.headers["cf-connecting-ip"] || log.headers["x-forwarded-for"] || "—",
    host: log.hostname || "—",
    url: log.url,
    browser: log.browser || log.headers["user-agent"] || "—",
    query: log.query,
    headers: log.headers,
    response: log.message || "",
    isoTimestamp,
  };
}
