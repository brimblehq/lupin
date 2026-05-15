import axios from "axios";

export interface RawDeploymentRunLogRow {
  id?: string;
  content?: string | null;
  logId?: string | null;
  ownerId?: string | null;
  timestamp?: string | null;
  timeStamp?: string | null;
}

export interface ListDeploymentRunLogsInput {
  logId: string;
  ownerId: string;
  limit?: number;
}

export async function listDeploymentRunLogsFromSupabase(input: {
  supabaseUrl: string;
  supabaseKey: string;
  accessToken?: string;
  tableName: string;
  filter: ListDeploymentRunLogsInput;
}): Promise<RawDeploymentRunLogRow[]> {
  const supabaseUrl = input.supabaseUrl.trim();
  const supabaseKey = input.supabaseKey.trim();
  const accessToken = input.accessToken?.trim() || supabaseKey;
  const tableName = input.tableName.trim();
  const logId = input.filter.logId.trim();
  const ownerId = input.filter.ownerId.trim();

  if (!supabaseUrl) {
    throw new Error("Supabase URL is not configured");
  }

  if (!supabaseKey) {
    throw new Error("Supabase key is not configured");
  }

  if (!tableName) {
    throw new Error("Supabase table name is not configured");
  }

  if (!logId) {
    throw new Error("Deployment log ID is required");
  }

  if (!ownerId) {
    throw new Error("Deployment log owner ID is required");
  }

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("logId", `eq.${logId}`);
  params.set("ownerId", `eq.${ownerId}`);
  params.set("order", "timestamp.asc");

  if (typeof input.filter.limit === "number" && input.filter.limit > 0) {
    params.set("limit", String(input.filter.limit));
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${encodeURIComponent(tableName)}?${params.toString()}`;

  const response = await axios.get<RawDeploymentRunLogRow[]>(endpoint, {
    timeout: 25_000,
    headers: {
      Accept: "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!Array.isArray(response.data)) {
    return [];
  }

  return response.data;
}
