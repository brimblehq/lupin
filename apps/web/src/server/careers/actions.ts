import { createServerFn } from "@tanstack/react-start";
import { requestAirtableJson } from "@/server/airtable/request-json";

export type CareerRole = {
  slug: string;
  title: string;
  level?: string;
  location: string;
  employmentType: string;
  compensation?: string;
  applicationsClose?: string;
  summary: string;
  applyUrl: string;
  notionUrl?: string;
  content: string;
  closed: boolean;
};

function readEnv(key: string): string | undefined {
  const fromVite = typeof import.meta !== "undefined" ? ((import.meta as ImportMeta).env?.[key] as string | undefined) : undefined;
  if (fromVite) return fromVite;

  const maybeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return maybeProcess?.env?.[key];
}

interface AirtableConfig {
  apiKey: string;
  baseId: string;
  table: string;
}

function getAirtableConfig(): AirtableConfig | null {
  const apiKey = readEnv("AIRTABLE_API_KEY");
  const baseId = readEnv("AIRTABLE_CAREERS_BASE_ID");
  const table = readEnv("AIRTABLE_CAREERS_TABLE") ?? "Roles";
  if (!apiKey || !baseId) return null;
  return { apiKey, baseId, table };
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatDate(value: unknown): string | undefined {
  const raw = str(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return dateFormatter.format(date);
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

function mapRecord(record: AirtableRecord): CareerRole | null {
  const f = record.fields ?? {};
  const slug = str(f["Slug"]);
  const title = str(f["Title"]);
  const location = str(f["Location"]);
  const employmentType = str(f["Employment Type"]);
  const summary = str(f["Summary"]);
  const applyUrl = str(f["Apply URL"]);
  const content = typeof f["Content"] === "string" ? (f["Content"] as string) : "";

  if (!slug || !title || !location || !employmentType || !summary || !applyUrl) {
    return null;
  }

  return {
    slug,
    title,
    level: str(f["Level"]),
    location,
    employmentType,
    compensation: str(f["Compensation"]),
    applicationsClose: formatDate(f["Applications Close"]),
    summary,
    applyUrl,
    notionUrl: str(f["Notion URL"]),
    content,
    closed: Boolean(f["Closed"]),
  };
}

let cache: { data: CareerRole[]; expiresAt: number } | null = null;
const TTL_MS = 60_000;

export const listCareersServerFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<CareerRole[]> => {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  const config = getAirtableConfig();
  if (!config) {
    console.error("[careers] AIRTABLE_API_KEY or AIRTABLE_CAREERS_BASE_ID is not configured");
    return [];
  }

  const url = new URL(`https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(config.table)}`);
  url.searchParams.set("filterByFormula", "{Status}='Published'");
  url.searchParams.set("sort[0][field]", "Closed");
  url.searchParams.set("sort[0][direction]", "asc");
  url.searchParams.set("sort[1][field]", "Order");
  url.searchParams.set("sort[1][direction]", "asc");

  const { data, failure } = await requestAirtableJson<AirtableResponse>({
    url: url.toString(),
    apiKey: config.apiKey,
    logTag: "careers",
  });

  if (!data) {
    if (failure?.status) {
      console.error(`[careers] Airtable request failed (${failure.status}): ${failure.body ?? ""}`);
    } else {
      console.error("[careers] Failed to fetch from Airtable:", failure?.error);
    }
    return [];
  }

  if (data.offset) {
    console.warn("[careers] Airtable response paginated; only first page is rendered. Reduce role count or add pagination.");
  }

  const roles = (data.records ?? [])
    .map(mapRecord)
    .filter((role): role is CareerRole => role !== null);

  cache = { data: roles, expiresAt: Date.now() + TTL_MS };
  return roles;
});
