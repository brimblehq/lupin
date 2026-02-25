import { formatDistanceToNow } from "date-fns";
import type { ProjectEnvironmentVariable } from "@/backend/environments";

export type RawEnvFormat = "env" | "json";

export interface EditableEnvRow {
  id: string;
  name: string;
  value: string;
}

const EDITABLE_SERVICE_TYPES = new Set(["webservice", "web_service", "web-service", "static", "worker", "mcp"]);
const DELETEABLE_SERVICE_TYPES = new Set(["webservice", "web_service", "web-service", "static"]);
const NON_EDITABLE_ENV_NAMES = new Set([
  "BRIMBLE_URL",
  "BRIMBLE_ENV",
  "BRIMBLE_PROJECT_ID",
  "BRIMBLE_PROJECT_NAME",
]);

export function normalizeServiceType(value?: string): string {
  return String(value ?? "").trim().toLowerCase();
}

export function canEditProjectEnvs(serviceType?: string): boolean {
  return EDITABLE_SERVICE_TYPES.has(normalizeServiceType(serviceType));
}

export function canDeleteProjectEnv(serviceType?: string): boolean {
  return DELETEABLE_SERVICE_TYPES.has(normalizeServiceType(serviceType));
}

export function isDatabaseService(serviceType?: string): boolean {
  return normalizeServiceType(serviceType) === "database";
}

export function shouldShowEnvironmentTab(framework?: string): boolean {
  const value = String(framework ?? "").trim().toLowerCase();
  if (!value) {
    return false;
  }

  return value !== "html";
}

export function isNonEditableEnvName(name?: string): boolean {
  return NON_EDITABLE_ENV_NAMES.has(String(name ?? "").trim());
}

export function sortEnvironmentTargets(targets: string[]): string[] {
  const normalized = targets
    .map((target) => String(target).trim())
    .filter(Boolean);

  const unique = Array.from(new Set(normalized));
  unique.sort((a, b) => {
    if (a === "PRODUCTION") return -1;
    if (b === "PRODUCTION") return 1;
    return a.localeCompare(b);
  });

  return unique.length > 0 ? unique : ["PRODUCTION"];
}

export function filterEnvironmentRows(
  rows: ProjectEnvironmentVariable[],
  query: string,
): ProjectEnvironmentVariable[] {
  const search = query.trim().toLowerCase();
  if (!search) {
    return rows;
  }

  return rows.filter((row) => {
    return (
      row.name.toLowerCase().includes(search) ||
      String(row.user ?? "").toLowerCase().includes(search)
    );
  });
}

export function sanitizeEnvironmentEntries(
  rows: Array<{ name: string; value: string }>,
): Array<{ name: string; value: string }> {
  return rows.map((row) => ({
    name: row.name.trim(),
    value: row.value.trim(),
  }));
}

export function validateEnvironmentEntries(
  rows: Array<{ name: string; value: string }>,
): { valid: boolean; message?: string } {
  if (rows.length === 0) {
    return { valid: false, message: "Please add at least one variable" };
  }

  for (const row of rows) {
    if (!row.name && !row.value) {
      continue;
    }

    if (!row.name) {
      return { valid: false, message: "Provide a name for each variable" };
    }
    if (!row.value) {
      return { valid: false, message: `Provide a value for ${row.name}` };
    }
  }

  return { valid: true };
}

export function toEditableEnvRows(rows: ProjectEnvironmentVariable[]): EditableEnvRow[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    value: row.value,
  }));
}

export function toEnvText(rows: Array<{ name: string; value: string }>): string {
  return rows
    .filter((row) => row.name.trim())
    .map((row) => `${row.name}=${row.value}`)
    .join("\n");
}

export function fromEnvText(text: string): EditableEnvRow[] {
  const rows: EditableEnvRow[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const idx = line.indexOf("=");
    if (idx === -1) {
      rows.push({
        id: cryptoRandomId(),
        name: trimmed,
        value: "",
      });
      continue;
    }

    rows.push({
      id: cryptoRandomId(),
      name: line.slice(0, idx).trim(),
      value: line.slice(idx + 1),
    });
  }

  return rows;
}

export function toJsonText(rows: Array<{ name: string; value: string }>): string {
  const obj: Record<string, string> = {};
  for (const row of rows) {
    if (!row.name.trim()) {
      continue;
    }
    obj[row.name] = row.value;
  }
  return JSON.stringify(obj, null, 2);
}

export function fromJsonText(text: string): EditableEnvRow[] {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }

    return Object.entries(parsed).map(([name, value]) => ({
      id: cryptoRandomId(),
      name,
      value: String(value),
    }));
  } catch {
    return [];
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function highlightEnvText(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return "";
      }
      if (trimmed.startsWith("#")) {
        return `<span class="text-dash-text-extra-faded">${escapeHtml(line)}</span>`;
      }

      const idx = line.indexOf("=");
      if (idx === -1) {
        return `<span class="text-[#c4651a]">${escapeHtml(line)}</span>`;
      }

      const key = escapeHtml(line.slice(0, idx));
      const value = escapeHtml(line.slice(idx + 1));
      return `<span class="text-[#c4651a]">${key}</span><span class="text-dash-text-extra-faded">=</span><span class="text-dash-text-strong">${value}</span>`;
    })
    .join("\n");
}

export function highlightJsonText(text: string): string {
  return text.replace(
    /("(?:[^"\\]|\\.)*")\s*(:)|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\]:,])/g,
    (match, key, colon, str, bool, num, punct) => {
      if (key && colon) {
        return `<span class="text-[#c4651a]">${escapeHtml(key)}</span><span class="text-dash-text-extra-faded">${escapeHtml(colon)}</span>`;
      }
      if (str) return `<span class="text-dash-text-strong">${escapeHtml(str)}</span>`;
      if (bool) return `<span class="text-[#c4651a]">${escapeHtml(bool)}</span>`;
      if (num) return `<span class="text-[#c4651a]">${escapeHtml(num)}</span>`;
      if (punct) return `<span class="text-dash-text-extra-faded">${escapeHtml(punct)}</span>`;
      return escapeHtml(match);
    },
  );
}

export function formatEnvRowRelativeTime(createdAt?: string, updatedAt?: string): string {
  const source = updatedAt && updatedAt !== createdAt ? updatedAt : createdAt;
  if (!source) {
    return "Unknown";
  }

  try {
    const prefix = updatedAt && updatedAt !== createdAt ? "Updated" : "Added";
    return `${prefix} ${formatDistanceToNow(new Date(source), { addSuffix: true }).replace("about ", "")}`;
  } catch {
    return source;
  }
}

export function getEnvironmentDescription(canEdit: boolean): string {
  if (canEdit) {
    return "Manage your project's environment variables. Changes made will be applied on the next build.";
  }

  return "View your database connection credentials.";
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `env-${Math.random().toString(36).slice(2)}`;
}
