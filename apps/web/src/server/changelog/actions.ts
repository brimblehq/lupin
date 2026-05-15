import { createServerFn } from "@tanstack/react-start";
import { requestAirtableJson } from "@/server/airtable/request-json";

export type ChangelogType = "Feature" | "Improvement" | "Fix";

export type ChangelogEntry = {
  slug: string;
  title: string;
  date: string;
  dateISO: string;
  type: ChangelogType;
  summary: string;
  content: string;
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
  const baseId = readEnv("AIRTABLE_CHANGELOG_BASE_ID");
  const table = readEnv("AIRTABLE_CHANGELOG_TABLE") ?? "Entries";
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

function asType(value: unknown): ChangelogType | undefined {
  if (value === "Feature" || value === "Improvement" || value === "Fix") return value;
  return undefined;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

function mapRecord(record: AirtableRecord): ChangelogEntry | null {
  const f = record.fields ?? {};
  const slug = str(f["Slug"]);
  const title = str(f["Title"]);
  const dateRaw = str(f["Date"]);
  const type = asType(f["Type"]);
  const summary = str(f["Summary"]);
  const content = typeof f["Content"] === "string" ? (f["Content"] as string) : "";

  if (!slug || !title || !dateRaw || !type || !summary) {
    return null;
  }

  const parsed = new Date(dateRaw);
  const validDate = !Number.isNaN(parsed.getTime());

  return {
    slug,
    title,
    date: validDate ? dateFormatter.format(parsed) : dateRaw,
    dateISO: validDate ? parsed.toISOString().slice(0, 10) : dateRaw,
    type,
    summary,
    content,
  };
}

let cache: { data: ChangelogEntry[]; expiresAt: number } | null = null;
const TTL_MS = 60_000;

export const listChangelogServerFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<ChangelogEntry[]> => {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  const config = getAirtableConfig();
  if (!config) {
    console.error("[changelog] AIRTABLE_API_KEY or AIRTABLE_CHANGELOG_BASE_ID is not configured");
    return [];
  }

  const url = new URL(`https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(config.table)}`);
  url.searchParams.set("filterByFormula", "{Status}='Published'");
  url.searchParams.set("sort[0][field]", "Date");
  url.searchParams.set("sort[0][direction]", "desc");

  const { data, failure } = await requestAirtableJson<AirtableResponse>({
    url: url.toString(),
    apiKey: config.apiKey,
    logTag: "changelog",
  });

  if (!data) {
    if (failure?.status) {
      console.error(`[changelog] Airtable request failed (${failure.status}): ${failure.body ?? ""}`);
    } else {
      console.error("[changelog] Failed to fetch from Airtable:", failure?.error);
    }
    return [];
  }

  if (data.offset) {
    console.warn("[changelog] Airtable response paginated; only first page is rendered.");
  }

  const entries = (data.records ?? [])
    .map(mapRecord)
    .filter((entry): entry is ChangelogEntry => entry !== null);

  cache = { data: entries, expiresAt: Date.now() + TTL_MS };
  return entries;
});
