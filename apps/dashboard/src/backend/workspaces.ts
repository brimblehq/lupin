import config from "@/config";
import type { ApiClient, ApiListResponse } from "./types";
import { asRecord, pickNonEmptyString, pickString } from "./normalize";
import { notImplemented } from "./utils";

export interface Workspace {
  id: string;
  name: string;
  slug?: string;
  avatarUrl?: string;
  role?: "creator" | "administrator" | "member";
  accepted?: boolean;
}

export interface CreateWorkspaceInput {
  team_name: string;
  type: "TEAM_PLAN";
  members: string[];
  startup_code_reference: string;
  specifications: {
    members: number;
    concurrent_builds: number;
  };
  accept_terms: boolean;
}

export interface VerifyWorkspacePromoCodeResult {
  valid: boolean;
  reference?: string;
  message?: string;
}

export interface WorkspacesApi {
  list(): Promise<ApiListResponse<Workspace>>;
  getById(workspaceId: string): Promise<Workspace>;
  create(input: CreateWorkspaceInput): Promise<Workspace>;
  verifyStartupCode(code: string): Promise<VerifyWorkspacePromoCodeResult>;
  switchWorkspace(workspaceId: string): Promise<void>;
}

export function createWorkspacesApi(client: ApiClient): WorkspacesApi {
  const listEndpoint = "/core/v1/teams";

  function mapWorkspace(team: unknown): Workspace {
    const row = asRecord(team) ?? {};
    const explicitSlug =
      pickNonEmptyString(row, "slug", "workspaceSlug", "workspace_slug") ??
      undefined;
    const name = String(pickString(row, "name", "team_name") ?? "");
    return {
      id: String(row.id ?? row._id ?? ""),
      name,
      slug:
        explicitSlug ??
        (name ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : undefined),
      avatarUrl: pickString(row, "avatar", "avatarUrl") || undefined,
      role: row.isCreator ? "creator" : "member",
      accepted: row.accepted !== undefined ? Boolean(row.accepted) : undefined,
    };
  }

  return {
    async list() {
      const response = await client.request<any>(listEndpoint, {
        method: "GET",
      });

      const root = response?.data?.data ?? response?.data ?? response ?? [];
      const teams = Array.isArray(root) ? root : [];

      return {
        items: teams.map((team: any) => mapWorkspace(team)),
      } satisfies ApiListResponse<Workspace>;
    },
    getById: () => notImplemented<Workspace>("workspaces", "getById"),
    async create(input) {
      const response = await client.request<any>(`${config.paymentApiUrl}/subscription/create`, {
        method: "POST",
        body: input,
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rootRecord = asRecord(root) ?? {};
      const teamRecord =
        asRecord(rootRecord.team) ??
        asRecord(rootRecord.workspace) ??
        asRecord(rootRecord.data) ??
        rootRecord;

      return mapWorkspace(teamRecord);
    },
    async verifyStartupCode(code) {
      const trimmedCode = code.trim();
      if (!trimmedCode) {
        throw new Error("Promo code is required");
      }

      const response = await client.request<any>(`${config.paymentApiUrl}/startup/validate`, {
        method: "POST",
        body: { code: trimmedCode },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const record = asRecord(root) ?? {};
      const nested = asRecord(record.data);
      const reference =
        pickNonEmptyString(record, "reference") ??
        pickNonEmptyString(nested, "reference");

      return {
        valid: Boolean(reference) || record.valid === true || nested?.valid === true,
        reference,
        message: pickString(record, "message") ?? pickString(nested, "message"),
      } satisfies VerifyWorkspacePromoCodeResult;
    },
    switchWorkspace: () => notImplemented<void>("workspaces", "switchWorkspace"),
  };
}
